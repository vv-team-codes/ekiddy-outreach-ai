import { Router } from 'express';
import {
  CREDIT_PACKS,
  createCreditOrderSchema,
  SUBSCRIPTION_PLANS,
  verifyRazorpaySchema
} from '@ekiddy/shared';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { Subscription } from '../models/index.js';
import {
  createRazorpayOrder,
  generateTestPaymentSignature,
  isRazorpayLiveConfigured,
  verifyAndApplyRazorpayPayment
} from '../services/razorpay.service.js';
import { ok } from '../utils/errors.js';

export const billingRouter = Router();
billingRouter.use(authenticate);

billingRouter.get('/plans', (_req, res) => {
  ok(res, {
    plans: SUBSCRIPTION_PLANS,
    creditPacks: CREDIT_PACKS,
    razorpayMode: isRazorpayLiveConfigured() ? 'configured' : 'test_sandbox'
  });
});

billingRouter.get('/subscription', async (req, res, next) => {
  try {
    let sub = await Subscription.findOne({ organizationId: req.auth!.organizationId });
    if (!sub) {
      sub = await Subscription.create({
        organizationId: req.auth!.organizationId,
        planId: 'free',
        status: 'active',
        billingProvider: 'test'
      });
    }
    ok(res, sub);
  } catch (err) {
    next(err);
  }
});

billingRouter.post(
  '/razorpay/order',
  requireRole('owner', 'admin'),
  validateBody(createCreditOrderSchema),
  async (req, res, next) => {
    try {
      const order = await createRazorpayOrder({
        organizationId: req.auth!.organizationId,
        packId: req.body.packId,
        planId: req.body.planId
      });

      const testPaymentId = order.mode === 'test' ? `pay_test_${Date.now()}` : undefined;
      const testSignature =
        order.mode === 'test' && testPaymentId
          ? generateTestPaymentSignature(order.orderId, testPaymentId)
          : undefined;

      ok(
        res,
        {
          ...order,
          ...(testPaymentId ? { testPaymentPreview: { paymentId: testPaymentId, signature: testSignature } } : {})
        },
        undefined,
        201
      );
    } catch (err) {
      next(err);
    }
  }
);

billingRouter.post(
  '/razorpay/verify',
  requireRole('owner', 'admin'),
  validateBody(verifyRazorpaySchema),
  async (req, res, next) => {
    try {
      const result = await verifyAndApplyRazorpayPayment({
        organizationId: req.auth!.organizationId,
        userId: req.auth!.userId,
        orderId: req.body.razorpay_order_id,
        paymentId: req.body.razorpay_payment_id,
        signature: req.body.razorpay_signature,
        packId: req.body.packId,
        planId: req.body.planId
      });
      ok(res, result);
    } catch (err) {
      next(err);
    }
  }
);

billingRouter.get('/invoices', async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ organizationId: req.auth!.organizationId });
    ok(res, sub?.invoices || []);
  } catch (err) {
    next(err);
  }
});

billingRouter.get('/refunds', async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ organizationId: req.auth!.organizationId });
    ok(res, sub?.refunds || []);
  } catch (err) {
    next(err);
  }
});
