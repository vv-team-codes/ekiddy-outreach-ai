import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { getDatabaseMode } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { analyticsRouter } from './modules/analytics.routes.js';
import { authRouter } from './modules/auth.routes.js';
import { billingRouter } from './modules/billing.routes.js';
import { campaignsRouter } from './modules/campaigns.routes.js';
import { companiesRouter } from './modules/companies.routes.js';
import { competitorsRouter } from './modules/competitors.routes.js';
import { conversationsRouter } from './modules/conversations.routes.js';
import { creditsRouter } from './modules/credits.routes.js';
import { emailsRouter } from './modules/emails.routes.js';
import { icpRouter } from './modules/icp.routes.js';
import { inboxRouter } from './modules/inbox.routes.js';
import { integrationsRouter } from './modules/integrations.routes.js';
import { leadsRouter } from './modules/leads.routes.js';
import { meetingsRouter } from './modules/meetings.routes.js';
import { organizationsRouter } from './modules/organizations.routes.js';
import { peopleRouter } from './modules/people.routes.js';
import { projectsRouter } from './modules/projects.routes.js';
import { researchRouter } from './modules/research.routes.js';
import { sendingAccountsRouter } from './modules/sendingAccounts.routes.js';
import { sequencesRouter } from './modules/sequences.routes.js';
import { settingsRouter } from './modules/settings.routes.js';
import { usersRouter } from './modules/users.routes.js';
import { webhooksRouter } from './modules/webhooks.routes.js';
import { queueManager } from './services/queue.service.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin) || env.nodeEnv !== 'production') {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true
    })
  );
  app.use(compression());

  if (env.nodeEnv !== 'test') {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false
      })
    );
  }

  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      }
    })
  );

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        service: 'ekiddy-outreach-api',
        databaseState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        databaseMode: getDatabaseMode(),
        queueMode: queueManager.getMode(),
        aiConfigured: Boolean(env.geminiApiKey || env.openRouterApiKey),
        timestamp: new Date().toISOString()
      }
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/organizations', organizationsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/research', researchRouter);
  app.use('/api/competitors', competitorsRouter);
  app.use('/api/icp', icpRouter);
  app.use('/api/companies', companiesRouter);
  app.use('/api/people', peopleRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/sequences', sequencesRouter);
  app.use('/api/sending-accounts', sendingAccountsRouter);
  app.use('/api/inbox', inboxRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/meetings', meetingsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/credits', creditsRouter);
  app.use('/api/integrations', integrationsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/webhooks', webhooksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
