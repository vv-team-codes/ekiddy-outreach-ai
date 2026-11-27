import { CREDIT_COSTS, type CreditOperation } from '@ekiddy/shared';
import { CreditTransaction, Organization, type ICreditTransaction } from '../models/index.js';
import { InsufficientCreditsError, NotFoundError } from '../utils/errors.js';

export interface CreditSpendResult {
  transaction: ICreditTransaction;
  balanceAfter: number;
  alreadyApplied: boolean;
}

export function getOperationCost(operation: CreditOperation, units = 1): number {
  return CREDIT_COSTS[operation] * Math.max(1, units);
}

/**
 * Atomically deducts credits from an organization with strict idempotency protection.
 * Never deducts twice for the same (organizationId, idempotencyKey).
 */
export async function deductCredits(params: {
  organizationId: string;
  userId?: string;
  operation: CreditOperation;
  units?: number;
  idempotencyKey: string;
  referenceId?: string;
  description?: string;
}): Promise<CreditSpendResult> {
  const existing = await CreditTransaction.findOne({
    organizationId: params.organizationId,
    idempotencyKey: params.idempotencyKey
  });
  if (existing) {
    return {
      transaction: existing,
      balanceAfter: existing.balanceAfter,
      alreadyApplied: true
    };
  }

  const cost = getOperationCost(params.operation, params.units ?? 1);
  const updatedOrg = await Organization.findOneAndUpdate(
    { _id: params.organizationId, creditBalance: { $gte: cost } },
    { $inc: { creditBalance: -cost } },
    { new: true }
  );

  if (!updatedOrg) {
    const org = await Organization.findById(params.organizationId);
    if (!org) throw new NotFoundError('Organization not found');
    throw new InsufficientCreditsError(cost, org.creditBalance);
  }

  try {
    const tx = await CreditTransaction.create({
      organizationId: params.organizationId,
      userId: params.userId,
      type: 'usage',
      operation: params.operation,
      amount: -cost,
      balanceAfter: updatedOrg.creditBalance,
      idempotencyKey: params.idempotencyKey,
      referenceId: params.referenceId,
      description: params.description || `Credits used for ${params.operation}`
    });

    return {
      transaction: tx,
      balanceAfter: updatedOrg.creditBalance,
      alreadyApplied: false
    };
  } catch (err) {
    // Handle concurrent duplicate idempotencyKey race by rolling back the decrement
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: number }).code === 11000) {
      await Organization.findByIdAndUpdate(params.organizationId, { $inc: { creditBalance: cost } });
      const existingRace = await CreditTransaction.findOne({
        organizationId: params.organizationId,
        idempotencyKey: params.idempotencyKey
      });
      if (existingRace) {
        return {
          transaction: existingRace,
          balanceAfter: existingRace.balanceAfter,
          alreadyApplied: true
        };
      }
    }
    await Organization.findByIdAndUpdate(params.organizationId, { $inc: { creditBalance: cost } });
    throw err;
  }
}

/**
 * Atomically grants/purchases credits into an organization with strict idempotency protection.
 */
export async function grantCredits(params: {
  organizationId: string;
  userId?: string;
  type: 'grant' | 'purchase' | 'refund' | 'adjustment';
  operation: string;
  amount: number;
  idempotencyKey: string;
  referenceId?: string;
  description: string;
}): Promise<CreditSpendResult> {
  const existing = await CreditTransaction.findOne({
    organizationId: params.organizationId,
    idempotencyKey: params.idempotencyKey
  });
  if (existing) {
    return {
      transaction: existing,
      balanceAfter: existing.balanceAfter,
      alreadyApplied: true
    };
  }

  const updatedOrg = await Organization.findByIdAndUpdate(
    params.organizationId,
    { $inc: { creditBalance: params.amount } },
    { new: true }
  );
  if (!updatedOrg) throw new NotFoundError('Organization not found');

  try {
    const tx = await CreditTransaction.create({
      organizationId: params.organizationId,
      userId: params.userId,
      type: params.type,
      operation: params.operation,
      amount: params.amount,
      balanceAfter: updatedOrg.creditBalance,
      idempotencyKey: params.idempotencyKey,
      referenceId: params.referenceId,
      description: params.description
    });
    return {
      transaction: tx,
      balanceAfter: updatedOrg.creditBalance,
      alreadyApplied: false
    };
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: number }).code === 11000) {
      await Organization.findByIdAndUpdate(params.organizationId, { $inc: { creditBalance: -params.amount } });
      const existingRace = await CreditTransaction.findOne({
        organizationId: params.organizationId,
        idempotencyKey: params.idempotencyKey
      });
      if (existingRace) {
        return {
          transaction: existingRace,
          balanceAfter: existingRace.balanceAfter,
          alreadyApplied: true
        };
      }
    }
    await Organization.findByIdAndUpdate(params.organizationId, { $inc: { creditBalance: -params.amount } });
    throw err;
  }
}
