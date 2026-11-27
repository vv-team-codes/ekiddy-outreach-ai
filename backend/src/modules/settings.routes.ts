import { Router } from 'express';
import { authenticate, recordAuditLog, requireRole } from '../middleware/auth.middleware.js';
import { AuditLog, Notification, Organization } from '../models/index.js';
import { NotFoundError, ok } from '../utils/errors.js';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

settingsRouter.get('/', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.auth!.organizationId);
    if (!org) throw new NotFoundError('Organization not found');
    ok(res, {
      organization: org,
      aiSettings: org.aiSettings,
      autopilotSettings: org.autopilotSettings
    });
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch('/ai', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { provider, model, fallbackEnabled } = req.body as {
      provider?: 'auto' | 'gemini' | 'openrouter';
      model?: string;
      fallbackEnabled?: boolean;
    };
    const org = await Organization.findById(req.auth!.organizationId);
    if (!org) throw new NotFoundError('Organization not found');

    if (provider && ['auto', 'gemini', 'openrouter'].includes(provider)) {
      org.aiSettings.provider = provider;
    }
    if (model) org.aiSettings.model = model;
    if (typeof fallbackEnabled === 'boolean') org.aiSettings.fallbackEnabled = fallbackEnabled;
    await org.save();

    ok(res, org.aiSettings);
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch('/autopilot', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const {
      enabled,
      requireApprovalForCampaignLaunch,
      requireApprovalForSpendChange,
      requireApprovalForReplies
    } = req.body as Record<string, boolean | undefined>;

    const org = await Organization.findById(req.auth!.organizationId);
    if (!org) throw new NotFoundError('Organization not found');

    if (typeof enabled === 'boolean') org.autopilotSettings.enabled = enabled;
    if (typeof requireApprovalForCampaignLaunch === 'boolean') {
      org.autopilotSettings.requireApprovalForCampaignLaunch = requireApprovalForCampaignLaunch;
    }
    if (typeof requireApprovalForSpendChange === 'boolean') {
      org.autopilotSettings.requireApprovalForSpendChange = requireApprovalForSpendChange;
    }
    if (typeof requireApprovalForReplies === 'boolean') {
      org.autopilotSettings.requireApprovalForReplies = requireApprovalForReplies;
    }
    await org.save();

    await recordAuditLog({
      organizationId: req.auth!.organizationId,
      actorUserId: req.auth!.userId,
      action: 'settings.autopilot_updated',
      metadata: org.autopilotSettings
    });

    ok(res, org.autopilotSettings);
  } catch (err) {
    next(err);
  }
});

settingsRouter.get('/notifications', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ organizationId: req.auth!.organizationId })
      .sort({ createdAt: -1 })
      .limit(30);
    ok(res, notifications);
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      { read: true },
      { new: true }
    );
    if (!updated) throw new NotFoundError('Notification not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

settingsRouter.get('/audit-logs', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ organizationId: req.auth!.organizationId })
      .sort({ createdAt: -1 })
      .limit(100);
    ok(res, logs);
  } catch (err) {
    next(err);
  }
});
