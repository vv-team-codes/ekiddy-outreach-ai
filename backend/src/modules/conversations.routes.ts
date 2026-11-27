import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { inboxReplySchema } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { Contact, Conversation, Message, SendingAccount } from '../models/index.js';
import { classifyAndDraftReplyWithAI } from '../services/ai.service.js';
import { dispatchOutboundEmail } from '../services/email.service.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';
import { recordInboundReply } from './inbox.routes.js';

export const conversationsRouter = Router();
conversationsRouter.use(authenticate);

conversationsRouter.get('/:id', async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    })
      .populate('contactId')
      .populate('companyId')
      .populate('campaignId', 'name objective status');

    if (!conversation) throw new NotFoundError('Conversation not found');

    if (conversation.unreadCount > 0) {
      conversation.unreadCount = 0;
      await conversation.save();
    }

    const messages = await Message.find({
      conversationId: conversation._id,
      organizationId: req.auth!.organizationId
    }).sort({ createdAt: 1 });

    ok(res, { conversation, messages });
  } catch (err) {
    next(err);
  }
});

conversationsRouter.post('/:id/draft-ai-reply', async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    }).populate('contactId');
    if (!conversation) throw new NotFoundError('Conversation not found');

    const latestInbound = await Message.findOne({
      conversationId: conversation._id,
      organizationId: req.auth!.organizationId,
      direction: 'inbound'
    }).sort({ createdAt: -1 });

    const contact = conversation.contactId as unknown as {
      fullName?: string;
      companyName?: string;
      email?: string;
    } | null;

    const aiRes = await classifyAndDraftReplyWithAI({
      organizationId: req.auth!.organizationId,
      incomingText: latestInbound?.bodyText || conversation.lastMessageSnippet || conversation.subject,
      contactName: contact?.fullName || 'Prospect',
      companyName: contact?.companyName,
      senderName: req.auth!.fullName
    });

    const draft = await Message.create({
      organizationId: req.auth!.organizationId,
      conversationId: conversation._id,
      direction: 'outbound',
      fromEmail: req.auth!.email,
      toEmail: contact?.email || latestInbound?.fromEmail || 'prospect@example.com',
      subject: `Re: ${conversation.subject}`,
      bodyText: aiRes.result.suggestedDraft || 'Thank you for your reply.',
      status: 'pending_approval',
      isAiDraft: true
    });

    ok(res, { draft, classification: aiRes.result.classification, aiMode: aiRes.aiMode }, undefined, 201);
  } catch (err) {
    next(err);
  }
});

conversationsRouter.post('/:id/reply', validateBody(inboxReplySchema), async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    }).populate('contactId');
    if (!conversation) throw new NotFoundError('Conversation not found');

    if (req.body.approveAiDraft === false) {
      throw new BadRequestError('Sending AI-suggested replies requires explicit user approval');
    }

    const contact = conversation.contactId as unknown as { _id: string; email?: string } | null;
    const latestInbound = await Message.findOne({
      conversationId: conversation._id,
      direction: 'inbound'
    }).sort({ createdAt: -1 });

    const toEmail = contact?.email || latestInbound?.fromEmail;
    if (!toEmail) throw new BadRequestError('Recipient email not found on conversation');

    const sendingAccount = await SendingAccount.findOne({
      organizationId: req.auth!.organizationId,
      status: 'active'
    });

    const dispatchRes = await dispatchOutboundEmail({
      organizationId: req.auth!.organizationId,
      campaignId: conversation.campaignId?.toString(),
      contactId: contact?._id?.toString(),
      sendingAccountId: sendingAccount?._id?.toString(),
      toEmail,
      subject: req.body.subject || `Re: ${conversation.subject}`,
      bodyText: req.body.bodyText,
      idempotencyKey: `inbox-reply:${conversation._id.toString()}:${uuidv4()}`
    });

    if (dispatchRes.suppressed) {
      throw new BadRequestError('Cannot send reply: contact has opted out / is on suppression list');
    }

    // Mark any pending AI draft as approved/consumed
    await Message.updateMany(
      { conversationId: conversation._id, status: 'pending_approval' },
      { status: 'draft', approvedBy: req.auth!.userId }
    );

    if (conversation.folder === 'needs_reply') {
      conversation.folder = 'all';
      await conversation.save();
    }

    ok(res, dispatchRes, undefined, 201);
  } catch (err) {
    next(err);
  }
});

conversationsRouter.post('/:id/notes', async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) throw new BadRequestError('Note text is required');

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      {
        $push: {
          internalNotes: {
            authorId: req.auth!.userId,
            authorName: req.auth!.fullName,
            text,
            createdAt: new Date()
          }
        }
      },
      { new: true }
    );
    if (!conversation) throw new NotFoundError('Conversation not found');
    ok(res, conversation);
  } catch (err) {
    next(err);
  }
});

conversationsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { folder, classification, leadStage } = req.body as {
      folder?: string;
      classification?: string;
      leadStage?: string;
    };
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!conversation) throw new NotFoundError('Conversation not found');

    if (folder) conversation.folder = folder as typeof conversation.folder;
    if (classification) conversation.classification = classification as typeof conversation.classification;
    await conversation.save();

    if (leadStage && conversation.contactId) {
      await Contact.findByIdAndUpdate(conversation.contactId, { stage: leadStage });
    }

    ok(res, conversation);
  } catch (err) {
    next(err);
  }
});

conversationsRouter.post('/simulate-inbound', async (req, res, next) => {
  try {
    const { fromEmail, toEmail, subject, bodyText, campaignId } = req.body as Record<string, string | undefined>;
    if (!fromEmail || !bodyText) {
      throw new BadRequestError('fromEmail and bodyText are required');
    }
    const result = await recordInboundReply({
      organizationId: req.auth!.organizationId,
      fromEmail,
      toEmail: toEmail || req.auth!.email,
      subject: subject || 'Re: Outreach',
      bodyText,
      campaignId,
      providerMessageId: `sim_${uuidv4()}`
    });
    ok(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
});
