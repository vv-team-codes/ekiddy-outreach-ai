import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { companySearchSchema } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { Company } from '../models/index.js';
import { deductCredits } from '../services/credits.service.js';
import { searchCompaniesFromProvider } from '../services/prospect.service.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';

export const companiesRouter = Router();
companiesRouter.use(authenticate);

companiesRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const q = String(req.query.q || '').trim();
    const industry = String(req.query.industry || '').trim();
    const location = String(req.query.location || '').trim();

    const filter: Record<string, unknown> = { organizationId: req.auth!.organizationId };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { domain: { $regex: q, $options: 'i' } },
        { industry: { $regex: q, $options: 'i' } }
      ];
    }
    if (industry) filter.industry = { $regex: industry, $options: 'i' };
    if (location) filter.location = { $regex: location, $options: 'i' };

    const [items, total] = await Promise.all([
      Company.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Company.countDocuments(filter)
    ]);

    ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

companiesRouter.post('/search', validateBody(companySearchSchema), async (req, res, next) => {
  try {
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || `company-search:${uuidv4()}`;
    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'company_search',
      idempotencyKey,
      description: 'B2B company discovery search'
    });

    const result = await searchCompaniesFromProvider(req.auth!.organizationId, req.body);
    const saved = [];

    if (req.body.saveResults !== false) {
      for (const item of result.companies) {
        if (item.domain) {
          const doc = await Company.findOneAndUpdate(
            { organizationId: req.auth!.organizationId, domain: item.domain.toLowerCase() },
            {
              $setOnInsert: {
                organizationId: req.auth!.organizationId,
                projectId: req.body.projectId || undefined,
                ...item
              }
            },
            { upsert: true, new: true }
          );
          saved.push(doc);
        } else {
          const doc = await Company.create({
            organizationId: req.auth!.organizationId,
            projectId: req.body.projectId || undefined,
            ...item
          });
          saved.push(doc);
        }
      }
    }

    ok(
      res,
      {
        mode: result.mode,
        provider: result.provider,
        companies: saved.length > 0 ? saved : result.companies
      },
      { mode: result.mode }
    );
  } catch (err) {
    next(err);
  }
});

companiesRouter.post('/', async (req, res, next) => {
  try {
    const { name, domain, website, industry, category, location, employeeRange, revenueRange } = req.body as Record<
      string,
      string | undefined
    >;
    if (!name) throw new BadRequestError('Company name is required');
    const cleanDomain = domain?.toLowerCase().trim();
    if (cleanDomain) {
      const existing = await Company.findOne({ organizationId: req.auth!.organizationId, domain: cleanDomain });
      if (existing) {
        return ok(res, { company: existing, duplicate: true });
      }
    }
    const company = await Company.create({
      organizationId: req.auth!.organizationId,
      name: name.trim(),
      domain: cleanDomain,
      website,
      industry,
      category,
      location,
      employeeRange,
      revenueRange,
      source: 'manual',
      isDemoData: false
    });
    ok(res, company, undefined, 201);
  } catch (err) {
    next(err);
  }
});

companiesRouter.patch('/:id', async (req, res, next) => {
  try {
    const updated = await Company.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      req.body,
      { new: true }
    );
    if (!updated) throw new NotFoundError('Company not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

companiesRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Company.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!deleted) throw new NotFoundError('Company not found');
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

companiesRouter.post('/bulk', async (req, res, next) => {
  try {
    const { action, ids } = req.body as { action?: string; ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestError('ids array is required');
    if (action === 'delete') {
      const result = await Company.deleteMany({
        _id: { $in: ids },
        organizationId: req.auth!.organizationId
      });
      return ok(res, { deletedCount: result.deletedCount });
    }
    throw new BadRequestError('Unsupported bulk action');
  } catch (err) {
    next(err);
  }
});
