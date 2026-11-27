import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { competitorCreateSchema, QUEUE_NAMES } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { CompanyResearch, Competitor } from '../models/index.js';
import { discoverCompetitorsWithAI } from '../services/ai.service.js';
import { deductCredits } from '../services/credits.service.js';
import { queueManager } from '../services/queue.service.js';
import { NotFoundError, ok } from '../utils/errors.js';

export const competitorsRouter = Router();
competitorsRouter.use(authenticate);

competitorsRouter.get('/', async (req, res, next) => {
  try {
    const competitors = await Competitor.find({ organizationId: req.auth!.organizationId }).sort({ createdAt: -1 });
    ok(res, competitors);
  } catch (err) {
    next(err);
  }
});

competitorsRouter.post('/discover', async (req, res, next) => {
  try {
    const { researchId, projectId, companyName, industry, overview } = req.body as Record<string, string | undefined>;
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || `competitors:${uuidv4()}`;

    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'competitor_discovery',
      idempotencyKey,
      description: 'AI competitor discovery'
    });

    const job = await queueManager.enqueue({
      organizationId: req.auth!.organizationId,
      createdBy: req.auth!.userId,
      queueName: QUEUE_NAMES.COMPETITOR_DISCOVERY,
      jobKey: `discover:${uuidv4()}`,
      payload: {
        organizationId: req.auth!.organizationId,
        researchId,
        projectId,
        companyName,
        industry,
        overview
      },
      runImmediatelyInTest: true
    });

    const competitors = await Competitor.find({ organizationId: req.auth!.organizationId }).sort({ createdAt: -1 });
    ok(res, { competitors, job }, undefined, 201);
  } catch (err) {
    next(err);
  }
});

competitorsRouter.post('/', validateBody(competitorCreateSchema), async (req, res, next) => {
  try {
    const competitor = await Competitor.create({
      organizationId: req.auth!.organizationId,
      ...req.body,
      source: 'manual',
      status: 'researched'
    });
    ok(res, competitor, undefined, 201);
  } catch (err) {
    next(err);
  }
});

competitorsRouter.patch('/:id', async (req, res, next) => {
  try {
    const updated = await Competitor.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      req.body,
      { new: true }
    );
    if (!updated) throw new NotFoundError('Competitor not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

competitorsRouter.post('/:id/refresh', async (req, res, next) => {
  try {
    const competitor = await Competitor.findOne({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!competitor) throw new NotFoundError('Competitor not found');

    const research = await CompanyResearch.findOne({ organizationId: req.auth!.organizationId }).sort({
      createdAt: -1
    });

    const aiOut = await discoverCompetitorsWithAI({
      organizationId: req.auth!.organizationId,
      companyName: research?.companyName || 'Our Company',
      industry: competitor.industry || research?.industry || 'B2B SaaS',
      overview: `Refresh analysis focusing specifically on competitor ${competitor.name} (${competitor.website || ''})`
    });

    const refreshed = aiOut.result.competitors[0];
    if (refreshed) {
      competitor.positioning = refreshed.positioning;
      competitor.comparisonNotes = refreshed.comparisonNotes;
      competitor.opportunities = refreshed.opportunities;
      competitor.status = 'researched';
      await competitor.save();
    }

    ok(res, competitor);
  } catch (err) {
    next(err);
  }
});

competitorsRouter.post('/compare', async (req, res, next) => {
  try {
    const competitors = await Competitor.find({ organizationId: req.auth!.organizationId }).limit(10);
    const research = await CompanyResearch.findOne({ organizationId: req.auth!.organizationId }).sort({
      createdAt: -1
    });
    ok(res, {
      company: research
        ? {
            name: research.companyName,
            positioning: research.businessPositioning,
            uniqueSellingPoints: research.uniqueSellingPoints
          }
        : null,
      competitors: competitors.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        website: c.website,
        positioning: c.positioning,
        targetAudience: c.targetAudience,
        opportunities: c.opportunities,
        comparisonNotes: c.comparisonNotes
      }))
    });
  } catch (err) {
    next(err);
  }
});

competitorsRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Competitor.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!deleted) throw new NotFoundError('Competitor not found');
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
