import { Router } from 'express';
import mongoose from 'mongoose';
import { INBOX_FOLDERS, QUEUE_NAMES, type InboxFolder } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  Campaign,
  Contact,
  Conversation,
  EmailEvent,
  Message,
  SuppressionRecord
} from '../models/index.js';
import { classifyAndDraftReplyWithAI } from '../services/ai.service.js';
import { queueManager } from '../services/queue.service.js';
import { ok } from '../utils/errors.js';

export const inboxRouter = Router();
inboxRouter.use(authenticate);

export function mapClassificationToFolder(classification: string): InboxFolder {
  switch (classification) {
    case 'Interested':
    case 'Positive response':
      return 'interested';
    case 'Meeting request':
      return 'meetings';
    case 'Negative response':
      return 'not_interested';
    case 'Out of office':
      return 'out_of_office';
    case 'Unsubscribe':
      return 'unsubscribed';
    default:
      return 'needs_reply';
  }
}

export async function recordInboundReply(params: {
  organizationId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  providerMessageId?: string;
  campaignId?: string;
}) {
  const normalizedFrom = params.fromEmail.trim().toLowerCase();
  const contact = await Contact.findOne({ organizationId: params.organizationId, email: normalizedFrom });

  let conversation = await Conversation.findOne({
    organizationId: params.organizationId,
    ...(contact ? { contactId: contact._id } : { subject: params.subject })
  }).sort({ lastMessageAt: -1 });

  const classificationResult = await classifyAndDraftReplyWithAI({
    organizationId: params.organizationId,
    incomingText: params.bodyText,
    contactName: contact?.fullName || normalizedFrom,
    companyName: contact?.companyName,
    senderName: 'Ekiddy Team'
  });

  const folder = mapClassificationToFolder(classificationResult.result.classification);

  if (!conversation) {
    conversation = await Conversation.create({
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      contactId: contact?._id,
      companyId: contact?.companyId,
      subject: params.subject || 'Reply from prospect',
      folder,
      classification: classificationResult.result.classification,
      unreadCount: 1,
      lastMessageAt: new Date(),
      lastMessageSnippet: params.bodyText.slice(0, 180)
    });
  } else {
    conversation.folder = folder;
    conversation.classification = classificationResult.result.classification;
    conversation.unreadCount += 1;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageSnippet = params.bodyText.slice(0, 180);
    await conversation.save();
  }

  const inboundMsg = await Message.create({
    organizationId: params.organizationId,
    conversationId: conversation._id,
    direction: 'inbound',
    fromEmail: normalizedFrom,
    toEmail: params.toEmail.toLowerCase(),
    subject: params.subject,
    bodyText: params.bodyText,
    status: 'received',
    providerMessageId: params.providerMessageId
  });

  let aiDraftMessage = null;
  if (classificationResult.result.suggestedDraft && classificationResult.result.classification !== 'Unsubscribe') {
    aiDraftMessage = await Message.create({
      organizationId: params.organizationId,
      conversationId: conversation._id,
      direction: 'outbound',
      fromEmail: params.toEmail.toLowerCase(),
      toEmail: normalizedFrom,
      subject: `Re: ${conversation.subject}`,
      bodyText: classificationResult.result.suggestedDraft,
      status: 'pending_approval',
      isAiDraft: true
    });
  }

  // Immediately honor unsubscribe opt-outs
  if (classificationResult.result.classification === 'Unsubscribe') {
    await SuppressionRecord.findOneAndUpdate(
      { organizationId: params.organizationId, email: normalizedFrom },
      {
        organizationId: params.organizationId,
        email: normalizedFrom,
        reason: 'unsubscribe',
        sourceCampaignId: conversation.campaignId
      },
      { upsert: true }
    );
    if (contact) {
      contact.stage = 'unsubscribed';
      await contact.save();
    }
  } else if (contact) {
    if (['Interested', 'Positive response', 'Meeting request'].includes(classificationResult.result.classification)) {
      contact.stage = 'interested';
    } else if (contact.stage === 'new' || contact.stage === 'contacted') {
      contact.stage = 'replied';
    }
    await contact.save();
  }

  const linkedCampaignId = params.campaignId || conversation.campaignId?.toString();
  if (linkedCampaignId) {
    const isPositive = ['Interested', 'Positive response', 'Meeting request'].includes(
      classificationResult.result.classification
    );
    await Campaign.findByIdAndUpdate(linkedCampaignId, {
      $inc: {
        'stats.replied': 1,
        ...(isPositive ? { 'stats.positiveReplies': 1 } : {})
      }
    });
  }

  await EmailEvent.create({
    organizationId: params.organizationId,
    campaignId: conversation.campaignId,
    contactId: contact?._id,
    conversationId: conversation._id,
    idempotencyKey: `reply:${params.providerMessageId || inboundMsg._id.toString()}`,
    toEmail: normalizedFrom,
    subject: params.subject,
    bodyPreview: params.bodyText.slice(0, 180),
    eventType: 'replied'
  });

  return { conversation, inboundMsg, aiDraftMessage, classification: classificationResult.result.classification };
}

inboxRouter.get('/counts', async (req, res, next) => {
  try {
    const countsAgg = await Conversation.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(req.auth!.organizationId) } },
      { $group: { _id: '$folder', count: { $sum: 1 } } }
    ]);
    const counts: Record<string, number> = {};
    for (const folder of INBOX_FOLDERS) counts[folder] = 0;
    let total = 0;
    for (const row of countsAgg) {
      counts[row._id] = row.count;
      if (row._id !== 'archived') total += row.count;
    }
    counts.all = total;
    ok(res, counts);
  } catch (err) {
    next(err);
  }
});

inboxRouter.get('/threads', async (req, res, next) => {
  try {
    const folder = String(req.query.folder || 'all');
    const q = String(req.query.q || '').trim();
    const classification = String(req.query.classification || '').trim();

    const filter: Record<string, unknown> = { organizationId: req.auth!.organizationId };
    if (folder && folder !== 'all') {
      filter.folder = folder;
    } else {
      filter.folder = { $ne: 'archived' };
    }
    if (classification) filter.classification = classification;
    if (q) {
      filter.$or = [
        { subject: { $regex: q, $options: 'i' } },
        { lastMessageSnippet: { $regex: q, $options: 'i' } }
      ];
    }

    const threads = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .populate('contactId', 'fullName email jobTitle companyName stage emailStatus')
      .populate('companyId', 'name domain industry location');

    ok(res, threads);
  } catch (err) {
    next(err);
  }
});

inboxRouter.post('/sync', async (req, res, next) => {
  try {
    const job = await queueManager.enqueue({
      organizationId: req.auth!.organizationId,
      createdBy: req.auth!.userId,
      queueName: QUEUE_NAMES.INBOX_SYNC,
      jobKey: `inbox-sync:${Date.now()}`,
      payload: { organizationId: req.auth!.organizationId },
      runImmediatelyInTest: true
    });
    ok(res, { synced: true, job });
  } catch (err) {
    next(err);
  }
});
