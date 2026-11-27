import { Router } from 'express';
import { INTEGRATION_PROVIDERS, upsertIntegrationSchema } from '@ekiddy/shared';
import { env } from '../config/env.js';
import { authenticate, recordAuditLog, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { Integration } from '../models/index.js';
import { buildGoogleCalendarAuthUrl, exchangeGoogleAuthCode } from '../services/calendar.service.js';
import { encryptObject, maskSecret } from '../utils/crypto.js';
import { BadRequestError, ok } from '../utils/errors.js';

export const integrationsRouter = Router();

// Google OAuth callback can arrive from browser redirect
integrationsRouter.get('/google-calendar/callback', async (req, res, next) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code || !state) {
      throw new BadRequestError('Missing Google OAuth code or organization state');
    }
    await exchangeGoogleAuthCode(state, code);
    res.redirect(`${env.appUrl}/settings?calendar=connected`);
  } catch (err) {
    next(err);
  }
});

integrationsRouter.use(authenticate);

integrationsRouter.get('/', async (req, res, next) => {
  try {
    const stored = await Integration.find({ organizationId: req.auth!.organizationId });
    const byProvider = new Map(stored.map((item) => [item.provider, item]));

    const envStatus: Record<string, boolean> = {
      gemini: Boolean(env.geminiApiKey),
      openrouter: Boolean(env.openRouterApiKey),
      apollo: Boolean(env.dataProviderApiKey && env.dataProviderType === 'apollo'),
      hunter: Boolean(env.emailVerifierApiKey || env.dataProviderType === 'hunter'),
      google_calendar: Boolean(env.googleClientId && env.googleClientSecret),
      resend: Boolean(env.emailProviderApiKey),
      smtp: Boolean(env.smtpHost && env.smtpUser),
      razorpay: Boolean(env.razorpayKeyId && env.razorpayKeySecret)
    };

    const result = INTEGRATION_PROVIDERS.map((provider) => {
      const rec = byProvider.get(provider);
      const envConfigured = envStatus[provider] || false;
      return {
        provider,
        status: rec?.status || (envConfigured ? 'connected' : 'disconnected'),
        configuredBy: rec ? 'organization' : envConfigured ? 'environment' : 'none',
        maskedPreview: rec?.maskedPreview || (envConfigured ? 'Configured via environment' : ''),
        publicConfig: rec?.publicConfig || {},
        lastCheckedAt: rec?.lastCheckedAt || null
      };
    });

    ok(res, result);
  } catch (err) {
    next(err);
  }
});

integrationsRouter.put(
  '/:provider',
  requireRole('owner', 'admin'),
  validateBody(upsertIntegrationSchema),
  async (req, res, next) => {
    try {
      const provider = String(req.params.provider);
      const firstSecretVal = Object.values(req.body.credentials as Record<string, string>).find(Boolean);
      if (!firstSecretVal) {
        throw new BadRequestError('At least one credential value is required');
      }

      const encryptedCredentials = encryptObject(req.body.credentials);
      const maskedPreview = maskSecret(firstSecretVal);

      const integration = await Integration.findOneAndUpdate(
        { organizationId: req.auth!.organizationId, provider },
        {
          organizationId: req.auth!.organizationId,
          provider,
          status: 'connected',
          encryptedCredentials,
          maskedPreview,
          publicConfig: req.body.publicConfig || {},
          lastCheckedAt: new Date()
        },
        { upsert: true, new: true }
      );

      await recordAuditLog({
        organizationId: req.auth!.organizationId,
        actorUserId: req.auth!.userId,
        action: 'integration.updated',
        resourceType: 'Integration',
        resourceId: provider
      });

      ok(res, {
        provider: integration.provider,
        status: integration.status,
        maskedPreview: integration.maskedPreview,
        publicConfig: integration.publicConfig,
        lastCheckedAt: integration.lastCheckedAt
      });
    } catch (err) {
      next(err);
    }
  }
);

integrationsRouter.post('/:provider/test', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const rec = await Integration.findOne({
      organizationId: req.auth!.organizationId,
      provider
    });
    const connected = Boolean(rec && rec.status === 'connected');
    ok(res, {
      provider,
      ok: connected,
      mode: connected ? 'configured' : 'unconfigured',
      message: connected
        ? `${provider} credentials are stored and encrypted.`
        : `${provider} is not configured; platform runs in safe test/demo mode.`
    });
  } catch (err) {
    next(err);
  }
});

integrationsRouter.delete('/:provider', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    await Integration.findOneAndDelete({
      organizationId: req.auth!.organizationId,
      provider: req.params.provider
    });
    ok(res, { deleted: true, provider: req.params.provider });
  } catch (err) {
    next(err);
  }
});

integrationsRouter.get('/google-calendar/auth-url', (req, res) => {
  const result = buildGoogleCalendarAuthUrl(req.auth!.organizationId);
  ok(res, result);
});
