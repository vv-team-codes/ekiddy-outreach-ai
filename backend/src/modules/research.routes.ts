import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  companyResearchRequestSchema,
  QUEUE_NAMES,
  updateCompanyResearchSchema
} from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { BackgroundJob, CompanyResearch, Organization } from '../models/index.js';
import { deductCredits } from '../services/credits.service.js';
import { queueManager } from '../services/queue.service.js';
import { NotFoundError, ok } from '../utils/errors.js';
import { validateSafePublicUrl } from '../utils/urlSecurity.js';

export const researchRouter = Router();
researchRouter.use(authenticate);

researchRouter.get('/company', async (req, res, next) => {
  try {
    const records = await CompanyResearch.find({ organizationId: req.auth!.organizationId })
      .sort({ createdAt: -1 })
      .limit(25);
    ok(res, records);
  } catch (err) {
    next(err);
  }
});

researchRouter.get('/company/:id', async (req, res, next) => {
  try {
    const record = await CompanyResearch.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!record) throw new NotFoundError('Company research record not found');
    ok(res, record);
  } catch (err) {
    next(err);
  }
});

researchRouter.post('/company', validateBody(companyResearchRequestSchema), async (req, res, next) => {
  try {
    const { websiteUrl, projectId, companyNameHint } = req.body;
    const safeUrl = await validateSafePublicUrl(websiteUrl);

    const requestKey = (req.headers['x-idempotency-key'] as string) || `research:${uuidv4()}`;
    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'company_research',
      idempotencyKey: requestKey,
      description: `Company website research for ${safeUrl.hostname}`
    });

    const research = await CompanyResearch.create({
      organizationId: req.auth!.organizationId,
      projectId: projectId || undefined,
      websiteUrl: safeUrl.toString(),
      status: 'queued',
      progress: 5,
      companyName: companyNameHint || safeUrl.hostname.replace(/^www\./, '')
    });

    const job = await queueManager.enqueue({
      organizationId: req.auth!.organizationId,
      createdBy: req.auth!.userId,
      queueName: QUEUE_NAMES.COMPANY_RESEARCH,
      jobKey: `research:${research._id.toString()}`,
      payload: {
        organizationId: req.auth!.organizationId,
        researchId: research._id.toString(),
        websiteUrl: safeUrl.toString(),
        companyNameHint
      },
      runImmediatelyInTest: true
    });

    await Organization.findByIdAndUpdate(req.auth!.organizationId, {
      'onboarding.websiteUrl': safeUrl.toString(),
      'onboarding.researchId': research._id
    });

    const latest = await CompanyResearch.findById(research._id);
    ok(res, { research: latest || research, job }, undefined, 201);
  } catch (err) {
    next(err);
  }
});

researchRouter.patch('/company/:id', validateBody(updateCompanyResearchSchema), async (req, res, next) => {
  try {
    const updated = await CompanyResearch.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      req.body,
      { new: true }
    );
    if (!updated) throw new NotFoundError('Company research record not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

researchRouter.post('/company/:id/retry', async (req, res, next) => {
  try {
    const research = await CompanyResearch.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!research) throw new NotFoundError('Company research record not found');

    research.status = 'queued';
    research.progress = 5;
    research.errorMessage = undefined;
    await research.save();

    const job = await queueManager.enqueue({
      organizationId: req.auth!.organizationId,
      createdBy: req.auth!.userId,
      queueName: QUEUE_NAMES.COMPANY_RESEARCH,
      jobKey: `research-retry:${research._id.toString()}:${Date.now()}`,
      payload: {
        organizationId: req.auth!.organizationId,
        researchId: research._id.toString(),
        websiteUrl: research.websiteUrl,
        companyNameHint: research.companyName
      },
      runImmediatelyInTest: true
    });

    const latest = await CompanyResearch.findById(research._id);
    ok(res, { research: latest, job });
  } catch (err) {
    next(err);
  }
});

researchRouter.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const job = await BackgroundJob.findOne({
      _id: req.params.jobId,
      organizationId: req.auth!.organizationId
    });
    if (!job) throw new NotFoundError('Background job not found');
    ok(res, job);
  } catch (err) {
    next(err);
  }
});
