import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { icpCreateSchema, QUEUE_NAMES } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { ICP } from '../models/index.js';
import { deductCredits } from '../services/credits.service.js';
import { queueManager } from '../services/queue.service.js';
import { NotFoundError, ok } from '../utils/errors.js';

export const icpRouter = Router();
icpRouter.use(authenticate);

icpRouter.get('/', async (req, res, next) => {
  try {
    const icps = await ICP.find({ organizationId: req.auth!.organizationId }).sort({
      relevanceScore: -1,
      createdAt: -1
    });
    ok(res, icps);
  } catch (err) {
    next(err);
  }
});

icpRouter.post('/generate', async (req, res, next) => {
  try {
    const { researchId, projectId, companyName } = req.body as Record<string, string | undefined>;
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || `icp:${uuidv4()}`;

    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'icp_generation',
      idempotencyKey,
      description: 'AI ICP profile generation'
    });

    const job = await queueManager.enqueue({
      organizationId: req.auth!.organizationId,
      createdBy: req.auth!.userId,
      queueName: QUEUE_NAMES.ICP_GENERATION,
      jobKey: `icp:${uuidv4()}`,
      payload: {
        organizationId: req.auth!.organizationId,
        researchId,
        projectId,
        companyName
      },
      runImmediatelyInTest: true
    });

    const icps = await ICP.find({ organizationId: req.auth!.organizationId }).sort({
      relevanceScore: -1,
      createdAt: -1
    });
    ok(res, { icps, job }, undefined, 201);
  } catch (err) {
    next(err);
  }
});

icpRouter.post('/', validateBody(icpCreateSchema), async (req, res, next) => {
  try {
    const icp = await ICP.create({
      organizationId: req.auth!.organizationId,
      ...req.body
    });
    ok(res, icp, undefined, 201);
  } catch (err) {
    next(err);
  }
});

icpRouter.patch('/:id', async (req, res, next) => {
  try {
    const updated = await ICP.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      req.body,
      { new: true }
    );
    if (!updated) throw new NotFoundError('ICP not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

icpRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const source = await ICP.findOne({ _id: req.params.id, organizationId: req.auth!.organizationId });
    if (!source) throw new NotFoundError('ICP not found');

    const duplicate = await ICP.create({
      organizationId: req.auth!.organizationId,
      projectId: source.projectId,
      researchId: source.researchId,
      name: `${source.name} (Copy)`,
      industries: source.industries,
      locations: source.locations,
      companySizes: source.companySizes,
      revenueRanges: source.revenueRanges,
      jobTitles: source.jobTitles,
      departments: source.departments,
      buyerRoles: source.buyerRoles,
      companyTypes: source.companyTypes,
      customerNeeds: source.customerNeeds,
      businessChallenges: source.businessChallenges,
      relevanceScore: source.relevanceScore,
      segmentTag: source.segmentTag
    });
    ok(res, duplicate, undefined, 201);
  } catch (err) {
    next(err);
  }
});

icpRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await ICP.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!deleted) throw new NotFoundError('ICP not found');
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
