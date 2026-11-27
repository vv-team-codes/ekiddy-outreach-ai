import { Router } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, recordAuditLog } from '../middleware/auth.middleware.js';
import {
  Campaign,
  Company,
  CompanyResearch,
  Contact,
  CreditTransaction,
  EmailEvent,
  Meeting,
  Organization
} from '../models/index.js';
import { generateAutopilotRecommendationsWithAI } from '../services/ai.service.js';
import { deductCredits } from '../services/credits.service.js';
import { ForbiddenError, ok } from '../utils/errors.js';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);

async function computeOverviewMetrics(organizationId: string) {
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  const [
    companiesResearched,
    companiesDiscovered,
    contactsDiscovered,
    verifiedContacts,
    meetingsBooked,
    eventCounts,
    positiveReplies,
    creditsAgg
  ] = await Promise.all([
    CompanyResearch.countDocuments({ organizationId: orgObjectId, status: 'completed' }),
    Company.countDocuments({ organizationId: orgObjectId }),
    Contact.countDocuments({ organizationId: orgObjectId }),
    Contact.countDocuments({ organizationId: orgObjectId, emailStatus: 'verified' }),
    Meeting.countDocuments({ organizationId: orgObjectId, status: { $ne: 'cancelled' } }),
    EmailEvent.aggregate([
      { $match: { organizationId: orgObjectId } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } }
    ]),
    Campaign.aggregate([
      { $match: { organizationId: orgObjectId } },
      { $group: { _id: null, positiveReplies: { $sum: '$stats.positiveReplies' } } }
    ]),
    CreditTransaction.aggregate([
      { $match: { organizationId: orgObjectId } },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' }
        }
      }
    ])
  ]);

  const byEvent: Record<string, number> = {};
  for (const row of eventCounts) byEvent[row._id] = row.count;

  const emailsSent = byEvent.sent || 0;
  const deliveredEmails = byEvent.delivered || 0;
  const bouncedEmails = byEvent.bounced || 0;
  const replies = byEvent.replied || 0;
  const positiveCount = positiveReplies[0]?.positiveReplies || 0;
  const conversionRate = emailsSent > 0 ? Number(((meetingsBooked / emailsSent) * 100).toFixed(2)) : 0;

  let creditsUsed = 0;
  for (const row of creditsAgg) {
    if (row._id === 'usage') creditsUsed = Math.abs(row.totalAmount);
  }

  return {
    companiesResearched,
    companiesDiscovered,
    contactsDiscovered,
    verifiedContacts,
    emailsSent,
    deliveredEmails,
    bouncedEmails,
    replies,
    positiveReplies: positiveCount,
    meetingsBooked,
    campaignConversionRate: conversionRate,
    creditsUsed,
    estimatedSpendUsd: Number((creditsUsed * 0.02).toFixed(2))
  };
}

analyticsRouter.get('/overview', async (req, res, next) => {
  try {
    const overview = await computeOverviewMetrics(req.auth!.organizationId);
    ok(res, overview);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/trends', async (req, res, next) => {
  try {
    const orgObjectId = new mongoose.Types.ObjectId(req.auth!.organizationId);
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [emailDaily, leadDaily] = await Promise.all([
      EmailEvent.aggregate([
        { $match: { organizationId: orgObjectId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              eventType: '$eventType'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.day': 1 } }
      ]),
      Contact.aggregate([
        { $match: { organizationId: orgObjectId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            contacts: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const dayMap = new Map<
      string,
      { date: string; sent: number; delivered: number; replies: number; bounced: number; leads: number }
    >();

    for (const row of emailDaily) {
      const day = row._id.day;
      if (!dayMap.has(day)) {
        dayMap.set(day, { date: day, sent: 0, delivered: 0, replies: 0, bounced: 0, leads: 0 });
      }
      const item = dayMap.get(day)!;
      if (row._id.eventType === 'sent') item.sent += row.count;
      if (row._id.eventType === 'delivered') item.delivered += row.count;
      if (row._id.eventType === 'replied') item.replies += row.count;
      if (row._id.eventType === 'bounced') item.bounced += row.count;
    }

    for (const row of leadDaily) {
      if (!dayMap.has(row._id)) {
        dayMap.set(row._id, { date: row._id, sent: 0, delivered: 0, replies: 0, bounced: 0, leads: 0 });
      }
      dayMap.get(row._id)!.leads += row.contacts;
    }

    ok(res, Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)));
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/campaigns', async (req, res, next) => {
  try {
    const campaigns = await Campaign.find({ organizationId: req.auth!.organizationId })
      .sort({ createdAt: -1 })
      .select('name status stats segment testMode createdAt');
    ok(res, campaigns);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/autopilot/recommendations', async (req, res, next) => {
  try {
    const metricsSummary = await computeOverviewMetrics(req.auth!.organizationId);
    const aiRes = await generateAutopilotRecommendationsWithAI({
      organizationId: req.auth!.organizationId,
      metricsSummary
    });
    const org = await Organization.findById(req.auth!.organizationId);

    ok(res, {
      autopilotSettings: org?.autopilotSettings,
      aiMode: aiRes.aiMode,
      metricsSummary,
      recommendations: aiRes.result.recommendations
    });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.post('/autopilot/recommendations/:id/apply', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.auth!.organizationId);
    if (!org) throw new ForbiddenError('Organization not found');

    const { approved } = req.body as { approved?: boolean; actionType?: string };
    if (!approved) {
      throw new ForbiddenError('Explicit user authorization is required before applying Autopilot actions');
    }

    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'autopilot_analysis',
      idempotencyKey: `autopilot:${req.params.id}:${uuidv4()}`,
      description: `Applied AI Autopilot recommendation ${req.params.id}`
    });

    await recordAuditLog({
      organizationId: req.auth!.organizationId,
      actorUserId: req.auth!.userId,
      action: 'autopilot.recommendation_applied',
      resourceType: 'AutopilotRecommendation',
      resourceId: req.params.id
    });

    ok(res, { applied: true, recommendationId: req.params.id });
  } catch (err) {
    next(err);
  }
});
