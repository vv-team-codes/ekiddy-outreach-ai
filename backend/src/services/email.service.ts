import dns from 'node:dns/promises';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import {
  Campaign,
  Contact,
  Conversation,
  EmailEvent,
  Message,
  SendingAccount,
  SuppressionRecord,
  type ISendingAccount
} from '../models/index.js';
import { decryptObject } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';

export async function inspectDomainDns(domain: string) {
  const cleanDomain = domain.trim().toLowerCase();
  let spfValid = false;
  let spfRecord = '';
  let dmarcValid = false;
  let dmarcRecord = '';
  let dkimConfigured = false;
  const guidance: string[] = [];

  try {
    const txtRecords = await dns.resolveTxt(cleanDomain);
    const flat = txtRecords.map((parts) => parts.join(''));
    const spf = flat.find((r) => r.toLowerCase().startsWith('v=spf1'));
    if (spf) {
      spfValid = true;
      spfRecord = spf;
    } else {
      guidance.push(`Add TXT record at @: v=spf1 include:_spf.resend.com ~all (or your SMTP provider SPF).`);
    }
  } catch {
    guidance.push(`Could not resolve TXT records for ${cleanDomain}. Add an SPF TXT record: v=spf1 include:_spf.resend.com ~all`);
  }

  try {
    const dmarcTxt = await dns.resolveTxt(`_dmarc.${cleanDomain}`);
    const flat = dmarcTxt.map((parts) => parts.join(''));
    const dmarc = flat.find((r) => r.toLowerCase().startsWith('v=dmarc1'));
    if (dmarc) {
      dmarcValid = true;
      dmarcRecord = dmarc;
    } else {
      guidance.push(`Add TXT record at _dmarc.${cleanDomain}: v=DMARC1; p=quarantine; rua=mailto:dmarc@${cleanDomain}`);
    }
  } catch {
    guidance.push(`Add DMARC TXT record at _dmarc.${cleanDomain}: v=DMARC1; p=none; rua=mailto:dmarc@${cleanDomain}`);
  }

  for (const selector of ['default', 'resend', 'google', 'k1', 's1']) {
    try {
      const dkimTxt = await dns.resolveTxt(`${selector}._domainkey.${cleanDomain}`);
      if (dkimTxt.length > 0) {
        dkimConfigured = true;
        break;
      }
    } catch {
      // check next common selector
    }
  }
  if (!dkimConfigured) {
    guidance.push(`Publish DKIM public key TXT/CNAME record from your email provider under <selector>._domainkey.${cleanDomain}.`);
  }

  return {
    spfValid,
    dkimConfigured,
    dmarcValid,
    spfRecord,
    dmarcRecord,
    checkedAt: new Date(),
    guidance
  };
}

export function renderTemplateString(
  template: string,
  variables: Record<string, string | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    return variables[key] ?? '';
  });
}

async function resetDailyCounterIfNeeded(account: ISendingAccount): Promise<ISendingAccount> {
  const today = new Date().toISOString().slice(0, 10);
  if (account.lastResetDate !== today) {
    account.sentToday = 0;
    account.lastResetDate = today;
    await account.save();
  }
  return account;
}

export async function dispatchOutboundEmail(params: {
  organizationId: string;
  campaignId?: string;
  contactId?: string;
  sendingAccountId?: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  stepOrder?: number;
  idempotencyKey: string;
  forceSandbox?: boolean;
}) {
  const normalizedTo = params.toEmail.trim().toLowerCase();

  // Check idempotency first
  const existingEvent = await EmailEvent.findOne({
    organizationId: params.organizationId,
    idempotencyKey: params.idempotencyKey
  });
  if (existingEvent) {
    return { alreadyProcessed: true, event: existingEvent };
  }

  // Enforce opt-out / suppression list strictly
  const suppressed = await SuppressionRecord.findOne({
    organizationId: params.organizationId,
    email: normalizedTo
  });
  if (suppressed) {
    const supEvent = await EmailEvent.create({
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      contactId: params.contactId,
      sendingAccountId: params.sendingAccountId,
      stepOrder: params.stepOrder ?? 1,
      idempotencyKey: params.idempotencyKey,
      toEmail: normalizedTo,
      subject: params.subject,
      bodyPreview: params.bodyText.slice(0, 200),
      eventType: 'suppressed',
      errorMessage: `Skipped: recipient is on suppression list (${suppressed.reason})`
    });
    return { alreadyProcessed: false, suppressed: true, event: supEvent };
  }

  let account: ISendingAccount | null = null;
  if (params.sendingAccountId) {
    account = await SendingAccount.findOne({
      _id: params.sendingAccountId,
      organizationId: params.organizationId
    }).select('+encryptedConfig');
  }
  if (!account) {
    account = await SendingAccount.findOne({
      organizationId: params.organizationId,
      status: 'active'
    }).select('+encryptedConfig');
  }

  let fromEmail = env.emailFromDefault;
  let fromName = 'ekiddy Outreach AI';
  let provider: 'sandbox' | 'smtp' | 'resend' = 'sandbox';
  let config: Record<string, unknown> = {};

  if (account) {
    account = await resetDailyCounterIfNeeded(account);
    if (account.sentToday >= account.dailyLimit) {
      throw new BadRequestError(`Daily sending limit (${account.dailyLimit}) reached for ${account.email}`);
    }
    fromEmail = account.email;
    fromName = account.fromName;
    provider = params.forceSandbox ? 'sandbox' : account.provider;
    if (account.encryptedConfig) {
      try {
        config = decryptObject(account.encryptedConfig);
      } catch {
        config = {};
      }
    }
  }

  let providerMessageId = `sbx_${uuidv4()}`;

  if (provider === 'resend') {
    const apiKey = (config.apiKey as string) || env.emailProviderApiKey;
    if (!apiKey) {
      throw new BadRequestError('Resend API key is not configured for this sending account');
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [normalizedTo],
        subject: params.subject,
        text: params.bodyText
      })
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Resend API error (${res.status}): ${errBody}`);
    }
    const data = (await res.json()) as { id?: string };
    providerMessageId = data.id || providerMessageId;
  } else if (provider === 'smtp') {
    const host = (config.smtpHost as string) || env.smtpHost;
    const port = Number(config.smtpPort || env.smtpPort || 587);
    const user = (config.smtpUser as string) || env.smtpUser;
    const pass = (config.smtpPass as string) || env.smtpPass;
    if (!host || !user || !pass) {
      throw new BadRequestError('SMTP credentials are incomplete for this sending account');
    }
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: Boolean(config.smtpSecure ?? port === 465),
      auth: { user, pass }
    });
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: normalizedTo,
      subject: params.subject,
      text: params.bodyText
    });
    providerMessageId = info.messageId || providerMessageId;
  }

  // Upsert or create Conversation thread for CRM inbox continuity
  let conversation = await Conversation.findOne({
    organizationId: params.organizationId,
    contactId: params.contactId,
    subject: params.subject
  });

  if (!conversation) {
    const contact = params.contactId ? await Contact.findById(params.contactId) : null;
    conversation = await Conversation.create({
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      contactId: params.contactId,
      companyId: contact?.companyId,
      sendingAccountId: account?._id,
      subject: params.subject,
      folder: 'all',
      classification: 'Other',
      lastMessageAt: new Date(),
      lastMessageSnippet: params.bodyText.slice(0, 180)
    });
  } else {
    conversation.lastMessageAt = new Date();
    conversation.lastMessageSnippet = params.bodyText.slice(0, 180);
    await conversation.save();
  }

  await Message.create({
    organizationId: params.organizationId,
    conversationId: conversation._id,
    direction: 'outbound',
    fromEmail,
    toEmail: normalizedTo,
    subject: params.subject,
    bodyText: params.bodyText,
    status: 'sent',
    providerMessageId
  });

  const event = await EmailEvent.create({
    organizationId: params.organizationId,
    campaignId: params.campaignId,
    contactId: params.contactId,
    sendingAccountId: account?._id,
    conversationId: conversation._id,
    stepOrder: params.stepOrder ?? 1,
    idempotencyKey: params.idempotencyKey,
    providerMessageId,
    toEmail: normalizedTo,
    subject: params.subject,
    bodyPreview: params.bodyText.slice(0, 220),
    eventType: 'sent',
    metadata: { provider, sandbox: provider === 'sandbox' }
  });

  if (provider === 'sandbox') {
    await EmailEvent.create({
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      contactId: params.contactId,
      sendingAccountId: account?._id,
      conversationId: conversation._id,
      stepOrder: params.stepOrder ?? 1,
      idempotencyKey: `${params.idempotencyKey}:delivered`,
      providerMessageId,
      toEmail: normalizedTo,
      subject: params.subject,
      bodyPreview: params.bodyText.slice(0, 220),
      eventType: 'delivered',
      metadata: { provider: 'sandbox' }
    });
  }

  if (account) {
    await SendingAccount.findByIdAndUpdate(account._id, { $inc: { sentToday: 1 } });
  }
  if (params.campaignId) {
    await Campaign.findByIdAndUpdate(params.campaignId, {
      $inc: {
        'stats.sent': 1,
        ...(provider === 'sandbox' ? { 'stats.delivered': 1 } : {})
      }
    });
  }
  if (params.contactId) {
    await Contact.findOneAndUpdate(
      { _id: params.contactId, stage: 'new' },
      { stage: 'contacted' }
    );
  }

  return { alreadyProcessed: false, suppressed: false, event, conversationId: conversation._id.toString() };
}
