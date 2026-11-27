import { v4 as uuidv4 } from 'uuid';
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from '@ekiddy/shared';
import { env } from '../config/env.js';
import { Organization, Subscription } from '../models/index.js';
import { signHmacSha256, verifyHmacSha256 } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';
import { grantCredits } from './credits.service.js';

export function isRazorpayLiveConfigured(): boolean {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

export async function createRazorpayOrder(params: {
  organizationId: string;
  packId?: string;
  planId?: string;
}) {
  let amountInPaise = 0;
  let description = '';
  let creditsToGrant = 0;

  if (params.packId) {
    const pack = CREDIT_PACKS.find((p) => p.id === params.packId);
    if (!pack) throw new BadRequestError('Invalid credit pack');
    amountInPaise = pack.amountInPaise;
    description = pack.name;
    creditsToGrant = pack.credits;
  } else if (params.planId) {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === params.planId);
    if (!plan || plan.monthlyPriceInr === 0) throw new BadRequestError('Invalid paid plan');
    amountInPaise = plan.monthlyPriceInr * 100;
    description = `${plan.name} Monthly Subscription`;
    creditsToGrant = plan.monthlyCredits;
  } else {
    throw new BadRequestError('Either packId or planId must be specified');
  }

  const receipt = `rcpt_${params.organizationId.slice(-6)}_${Date.now()}`;

  if (isRazorpayLiveConfigured()) {
    const authHeader = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          organizationId: params.organizationId,
          packId: params.packId || '',
          planId: params.planId || '',
          credits: String(creditsToGrant)
        }
      })
    });
    if (!res.ok) {
      throw new Error(`Razorpay order creation failed with status ${res.status}`);
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      mode: env.razorpayKeyId.startsWith('rzp_test_') ? ('test' as const) : ('live' as const),
      keyId: env.razorpayKeyId,
      orderId: order.id,
      amountInPaise: order.amount,
      currency: order.currency,
      description,
      creditsToGrant
    };
  }

  const testOrderId = `order_test_${uuidv4().replace(/-/g, '').slice(0, 14)}`;
  return {
    mode: 'test' as const,
    keyId: 'rzp_test_local_sandbox',
    orderId: testOrderId,
    amountInPaise,
    currency: 'INR',
    description,
    creditsToGrant
  };
}

export function getEffectiveRazorpaySecret(): string {
  return env.razorpayKeySecret || 'ekiddy_test_razorpay_secret';
}

export async function verifyAndApplyRazorpayPayment(params: {
  organizationId: string;
  userId?: string;
  orderId: string;
  paymentId: string;
  signature: string;
  packId?: string;
  planId?: string;
}) {
  const secret = getEffectiveRazorpaySecret();
  const payload = `${params.orderId}|${params.paymentId}`;
  const isValid = verifyHmacSha256(payload, params.signature, secret);
  if (!isValid) {
    throw new BadRequestError('Invalid Razorpay payment signature');
  }

  let credits = 0;
  let amountInPaise = 0;
  let description = '';

  if (params.packId) {
    const pack = CREDIT_PACKS.find((p) => p.id === params.packId);
    if (!pack) throw new BadRequestError('Invalid packId');
    credits = pack.credits;
    amountInPaise = pack.amountInPaise;
    description = `Purchased ${pack.name}`;
  } else if (params.planId) {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === params.planId);
    if (!plan) throw new BadRequestError('Invalid planId');
    credits = plan.monthlyCredits;
    amountInPaise = plan.monthlyPriceInr * 100;
    description = `Subscribed to ${plan.name}`;

    await Organization.findByIdAndUpdate(params.organizationId, {
      plan: plan.id,
      dailySendLimit: plan.dailySendLimit
    });
  } else {
    throw new BadRequestError('packId or planId required');
  }

  const creditResult = await grantCredits({
    organizationId: params.organizationId,
    userId: params.userId,
    type: 'purchase',
    operation: params.planId ? 'subscription_credit_grant' : 'credit_pack_purchase',
    amount: credits,
    idempotencyKey: `razorpay:${params.paymentId}`,
    referenceId: params.paymentId,
    description
  });

  if (!creditResult.alreadyApplied) {
    await Subscription.findOneAndUpdate(
      { organizationId: params.organizationId },
      {
        $set: {
          ...(params.planId ? { planId: params.planId } : {}),
          status: 'active',
          billingProvider: isRazorpayLiveConfigured() ? 'razorpay' : 'test',
          razorpayOrderId: params.orderId,
          razorpayPaymentId: params.paymentId,
          amountInPaise,
          currency: 'INR'
        },
        $push: {
          invoices: {
            invoiceNumber: `INV-${Date.now()}`,
            amountInPaise,
            currency: 'INR',
            status: 'paid',
            issuedAt: new Date(),
            paymentId: params.paymentId,
            description
          }
        }
      },
      { upsert: true, new: true }
    );
  }

  return {
    verified: true,
    alreadyApplied: creditResult.alreadyApplied,
    balanceAfter: creditResult.balanceAfter,
    creditsAdded: credits
  };
}

export function generateTestPaymentSignature(orderId: string, paymentId: string): string {
  return signHmacSha256(`${orderId}|${paymentId}`, getEffectiveRazorpaySecret());
}
