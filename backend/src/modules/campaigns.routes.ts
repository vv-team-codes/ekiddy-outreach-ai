import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createCampaignSchema, QUEUE_NAMES } from '@ekiddy/shared';
import { authenticate, recordAuditLog, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { Campaign, EmailEvent, EmailSequence } from '../models/index.js';
import { deductCredits } from '../services/credits.service.js';
import { queueManager } from '../services/queue.service.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';

export const campaignsRouter = Router();
campaignsRouter.use(authenticate);

campaignsRouter.get('/', async (req, res, next) => {
  try {
    const campaigns = await Campaign.find({ organizationId: req.auth!.organizationId })
      .sort({ createdAt: -1 })
      .populate('icpId', 'name segmentTag')
      .populate('sequenceId');
    ok(res, campaigns);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.post('/', validateBody(createCampaignSchema), async (req, res, next) => {
  try {
    const { steps, ...campaignData } = req.body;
    const campaign = await Campaign.create({
      organizationId: req.auth!.organizationId,
      ...campaignData,
      status: campaignData.status || 'Ready for review',
      stats: {
        totalContacts: (campaignData.targetContactIds || []).length,
        sent: 0,
        delivered: 0,
        bounced: 0,
        replied: 0,
        positiveReplies: 0,
        meetingsBooked: 0
      }
    });

    const defaultSteps =
      steps && steps.length > 0
        ? steps
        : [
            {
              stepOrder: 1,
              delayDays: 0,
              subject: `Quick question for {{companyName}}`,
              body: `Hi {{firstName}},\n\nI noticed your role as {{jobTitle}} at {{companyName}} and wanted to share how we help teams with ${campaign.objective}.\n\nOpen to a brief chat?\n\nBest,\n${req.auth!.fullName}`,
              condition: 'always' as const
            }
          ];

    const sequence = await EmailSequence.create({
      organizationId: req.auth!.organizationId,
      campaignId: campaign._id,
      steps: defaultSteps
    });

    campaign.sequenceId = sequence._id;
    await campaign.save();

    const populated = await Campaign.findById(campaign._id).populate('sequenceId');
    ok(res, populated, undefined, 201);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.get('/:id', async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    })
      .populate('icpId')
      .populate('sequenceId')
      .populate('targetContactIds')
      .populate('targetCompanyIds');

    if (!campaign) throw new NotFoundError('Campaign not found');
    ok(res, campaign);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { steps, ...updates } = req.body as Record<string, unknown>;
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!campaign) throw new NotFoundError('Campaign not found');

    Object.assign(campaign, updates);
    if (Array.isArray(updates.targetContactIds)) {
      campaign.stats.totalContacts = updates.targetContactIds.length;
    }
    await campaign.save();

    if (Array.isArray(steps) && steps.length > 0) {
      await EmailSequence.findOneAndUpdate(
        { campaignId: campaign._id, organizationId: req.auth!.organizationId },
        { steps },
        { upsert: true }
      );
    }

    const updated = await Campaign.findById(campaign._id).populate('sequenceId');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const source = await Campaign.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!source) throw new NotFoundError('Campaign not found');
    const sourceSeq = await EmailSequence.findOne({ campaignId: source._id });

    const copy = await Campaign.create({
      organizationId: req.auth!.organizationId,
      projectId: source.projectId,
      icpId: source.icpId,
      sendingAccountId: source.sendingAccountId,
      name: `${source.name} (Copy)`,
      segment: source.segment,
      geography: source.geography,
      industries: source.industries,
      jobTitles: source.jobTitles,
      targetCompanyIds: source.targetCompanyIds,
      targetContactIds: source.targetContactIds,
      objective: source.objective,
      status: 'Draft',
      testMode: source.testMode,
      dailySendLimit: source.dailySendLimit
    });

    if (sourceSeq) {
      const seqCopy = await EmailSequence.create({
        organizationId: req.auth!.organizationId,
        campaignId: copy._id,
        steps: sourceSeq.steps
      });
      copy.sequenceId = seqCopy._id;
      await copy.save();
    }

    ok(res, copy, undefined, 201);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.post('/:id/approve', requireRole('owner', 'admin', 'member'), async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!campaign) throw new NotFoundError('Campaign not found');

    campaign.status = 'Approved';
    campaign.approvedBy = req.auth!.userId as unknown as typeof campaign.approvedBy;
    campaign.approvedAt = new Date();
    await campaign.save();

    await recordAuditLog({
      organizationId: req.auth!.organizationId,
      actorUserId: req.auth!.userId,
      action: 'campaign.approved',
      resourceType: 'Campaign',
      resourceId: campaign._id.toString()
    });

    ok(res, campaign);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.post('/:id/activate', requireRole('owner', 'admin', 'member'), async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!campaign) throw new NotFoundError('Campaign not found');

    if (!campaign.approvedAt && campaign.status !== 'Approved' && campaign.status !== 'Paused') {
      throw new BadRequestError('Campaign must be explicitly approved before first launch');
    }

    const contactCount = Math.max(1, campaign.targetContactIds.length);
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || `activate:${campaign._id.toString()}:${Date.now()}`;
    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'email_send',
      units: Math.min(contactCount, campaign.dailySendLimit),
      idempotencyKey,
      referenceId: campaign._id.toString(),
      description: `Launch campaign "${campaign.name}"`
    });

    campaign.status = 'Active';
    await campaign.save();

    const job = await queueManager.enqueue({
      organizationId: req.auth!.organizationId,
      createdBy: req.auth!.userId,
      queueName: QUEUE_NAMES.CAMPAIGN_SCHEDULER,
      jobKey: `launch:${campaign._id.toString()}:${uuidv4()}`,
      payload: {
        organizationId: req.auth!.organizationId,
        campaignId: campaign._id.toString()
      },
      runImmediatelyInTest: true
    });

    const refreshed = await Campaign.findById(campaign._id).populate('sequenceId');
    ok(res, { campaign: refreshed, job });
  } catch (err) {
    next(err);
  }
});

campaignsRouter.post('/:id/pause', async (req, res, next) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      { status: 'Paused' },
      { new: true }
    );
    if (!campaign) throw new NotFoundError('Campaign not found');
    ok(res, campaign);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.post('/:id/resume', async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!campaign) throw new NotFoundError('Campaign not found');
    if (!campaign.approvedAt) {
      throw new BadRequestError('Campaign must be approved before resuming');
    }
    campaign.status = 'Active';
    await campaign.save();
    ok(res, campaign);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.get('/:id/events', async (req, res, next) => {
  try {
    const events = await EmailEvent.find({
      campaignId: req.params.id,
      organizationId: req.auth!.organizationId
    })
      .sort({ createdAt: -1 })
      .limit(100);
    ok(res, events);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Campaign.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!deleted) throw new NotFoundError('Campaign not found');
    await EmailSequence.deleteOne({ campaignId: deleted._id, organizationId: req.auth!.organizationId });
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
