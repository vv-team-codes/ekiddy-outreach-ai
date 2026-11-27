import { Router } from 'express';
import { CREDIT_COSTS, type CreditOperation } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { CreditTransaction, Organization } from '../models/index.js';
import { getOperationCost } from '../services/credits.service.js';
import { BadRequestError, ok } from '../utils/errors.js';

export const creditsRouter = Router();
creditsRouter.use(authenticate);

creditsRouter.get('/balance', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.auth!.organizationId).select('creditBalance plan dailySendLimit');
    ok(res, {
      creditBalance: org?.creditBalance ?? 0,
      plan: org?.plan ?? 'free',
      dailySendLimit: org?.dailySendLimit ?? 50,
      costs: CREDIT_COSTS
    });
  } catch (err) {
    next(err);
  }
});

creditsRouter.get('/estimate', async (req, res, next) => {
  try {
    const operation = String(req.query.operation || '') as CreditOperation;
    const units = Math.max(1, Number(req.query.units || 1));
    if (!(operation in CREDIT_COSTS)) {
      throw new BadRequestError(`Unknown credit operation: ${operation}`);
    }
    const org = await Organization.findById(req.auth!.organizationId).select('creditBalance');
    const estimatedCredits = getOperationCost(operation, units);
    ok(res, {
      operation,
      units,
      estimatedCredits,
      currentBalance: org?.creditBalance ?? 0,
      sufficient: (org?.creditBalance ?? 0) >= estimatedCredits
    });
  } catch (err) {
    next(err);
  }
});

creditsRouter.get('/transactions', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const [items, total] = await Promise.all([
      CreditTransaction.find({ organizationId: req.auth!.organizationId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      CreditTransaction.countDocuments({ organizationId: req.auth!.organizationId })
    ]);
    ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});
