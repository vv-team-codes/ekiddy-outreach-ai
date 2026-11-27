import { Router } from 'express';
import { sendingAccountCreateSchema } from '@ekiddy/shared';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { SendingAccount, SuppressionRecord } from '../models/index.js';
import { inspectDomainDns } from '../services/email.service.js';
import { encryptObject } from '../utils/crypto.js';
import { NotFoundError, ok } from '../utils/errors.js';

export const sendingAccountsRouter = Router();
sendingAccountsRouter.use(authenticate);

sendingAccountsRouter.get('/', async (req, res, next) => {
  try {
    const accounts = await SendingAccount.find({ organizationId: req.auth!.organizationId }).sort({
      createdAt: -1
    });
    const suppressions = await SuppressionRecord.find({ organizationId: req.auth!.organizationId })
      .sort({ createdAt: -1 })
      .limit(100);
    ok(res, { accounts, suppressions });
  } catch (err) {
    next(err);
  }
});

sendingAccountsRouter.post(
  '/',
  requireRole('owner', 'admin', 'member'),
  validateBody(sendingAccountCreateSchema),
  async (req, res, next) => {
    try {
      const { email, fromName, provider, dailyLimit, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, apiKey } =
        req.body;
      const domain = email.split('@')[1];
      const dnsStatus =
        provider === 'sandbox'
          ? {
              spfValid: true,
              dkimConfigured: true,
              dmarcValid: true,
              checkedAt: new Date(),
              guidance: ['Sandbox mode active; no external DNS records required.']
            }
          : await inspectDomainDns(domain);

      const encryptedConfig = encryptObject({
        smtpHost: smtpHost || '',
        smtpPort: smtpPort || 587,
        smtpUser: smtpUser || '',
        smtpPass: smtpPass || '',
        smtpSecure: Boolean(smtpSecure),
        apiKey: apiKey || ''
      });

      const account = await SendingAccount.create({
        organizationId: req.auth!.organizationId,
        email,
        fromName,
        domain,
        provider,
        dailyLimit,
        encryptedConfig,
        dnsStatus,
        verified: provider === 'sandbox' || (dnsStatus.spfValid && dnsStatus.dmarcValid),
        status: 'active'
      });

      ok(res, account, undefined, 201);
    } catch (err) {
      next(err);
    }
  }
);

sendingAccountsRouter.post('/:id/check-dns', async (req, res, next) => {
  try {
    const account = await SendingAccount.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!account) throw new NotFoundError('Sending account not found');

    const dnsStatus =
      account.provider === 'sandbox'
        ? {
            spfValid: true,
            dkimConfigured: true,
            dmarcValid: true,
            checkedAt: new Date(),
            guidance: ['Built-in Sandbox Outbox active.']
          }
        : await inspectDomainDns(account.domain);

    account.dnsStatus = dnsStatus;
    account.verified = account.provider === 'sandbox' || (dnsStatus.spfValid && dnsStatus.dmarcValid);
    await account.save();

    ok(res, account);
  } catch (err) {
    next(err);
  }
});

sendingAccountsRouter.patch('/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { dailyLimit, status, fromName } = req.body as Record<string, unknown>;
    const updated = await SendingAccount.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      {
        ...(typeof dailyLimit === 'number' ? { dailyLimit } : {}),
        ...(typeof status === 'string' ? { status } : {}),
        ...(typeof fromName === 'string' ? { fromName } : {})
      },
      { new: true }
    );
    if (!updated) throw new NotFoundError('Sending account not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

sendingAccountsRouter.delete('/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const deleted = await SendingAccount.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!deleted) throw new NotFoundError('Sending account not found');
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

sendingAccountsRouter.post('/suppressions', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) throw new NotFoundError('Email is required');
    const record = await SuppressionRecord.findOneAndUpdate(
      { organizationId: req.auth!.organizationId, email },
      { organizationId: req.auth!.organizationId, email, reason: req.body?.reason || 'manual' },
      { upsert: true, new: true }
    );
    ok(res, record, undefined, 201);
  } catch (err) {
    next(err);
  }
});
