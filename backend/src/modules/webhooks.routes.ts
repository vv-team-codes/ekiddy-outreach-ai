import { Router } from 'express';
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from '@ekiddy/shared';
import { env } from '../config/env.js';
import {
  Campaign,
  EmailEvent,
  Organization,
  Subscription,
  SuppressionRecord
} from '../models/index.js';
import { grantCredits } from '../services/credits.service.js';
import { verifyHmacSha256 } from '../utils/crypto.js';
import { BadRequestError, ok } from '../utils/errors.js';
import { sanitizeText } from '../utils/sanitize.js';
import { recordInboundReply } from './inbox.routes.js';

export const webhooksRouter = Router();

webhooksRouter.post('/email', async (req, res, next) => {
  try {
    const signature = String(req.headers['x-email-signature'] || '');
    const rawPayload = req.rawBody || JSON.stringify(req.body);
    if (!signature || !verifyHmacSha256(rawPayload, signature, env.emailWebhookSecret)) {
      throw new BadRequestError('Invalid email webhook signature');
    }

    const { organizationId, campaignId, eventType, email, subject, bodyText, providerMessageId } = req.body as {
      organizationId: string;
      campaignId?: string;
      eventType: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'replied' | 'complained';
      email: string;
      subject?: string;
      bodyText?: string;
      providerMessageId?: string;
    };

    const cleanEmail = email.trim().toLowerCase();

    if (eventType === 'replied') {
      const replyRes = await recordInboundReply({
        organizationId,
        fromEmail: cleanEmail,
        toEmail: env.emailFromDefault,
        subject: subject || 'Re: Outreach',
        bodyText: bodyText || '',
        providerMessageId,
        campaignId
      });
      return ok(res, { processed: true, classification: replyRes.classification });
    }

    if (eventType === 'bounced' || eventType === 'complained') {
      await SuppressionRecord.findOneAndUpdate(
        { organizationId, email: cleanEmail },
        {
          organizationId,
          email: cleanEmail,
          reason: eventType === 'bounced' ? 'bounce' : 'complaint',
          sourceCampaignId: campaignId
        },
        { upsert: true }
      );
      if (campaignId && eventType === 'bounced') {
        await Campaign.findOneAndUpdate(
          { _id: campaignId, organizationId },
          { $inc: { 'stats.bounced': 1 } }
        );
      }
    } else if (eventType === 'delivered' && campaignId) {
      await Campaign.findOneAndUpdate(
        { _id: campaignId, organizationId },
        { $inc: { 'stats.delivered': 1 } }
      );
    }

    await EmailEvent.create({
      organizationId,
      campaignId,
      providerMessageId,
      idempotencyKey: `webhook:${eventType}:${providerMessageId || `${cleanEmail}:${Date.now()}`}`,
      toEmail: cleanEmail,
      subject: sanitizeText(subject, 300) || '(Webhook Event)',
      eventType: eventType === 'complained' ? 'bounced' : eventType
    });

    ok(res, { processed: true });
  } catch (err) {
    next(err);
  }
});

webhooksRouter.post('/razorpay', async (req, res, next) => {
  try {
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const rawPayload = req.rawBody || JSON.stringify(req.body);
    if (!signature || !verifyHmacSha256(rawPayload, signature, env.razorpayWebhookSecret)) {
      throw new BadRequestError('Invalid Razorpay webhook signature');
    }

    const event = req.body as {
      event: string;
      payload?: {
        payment?: {
          entity?: {
            id: string;
            order_id?: string;
            amount?: number;
            currency?: string;
            notes?: { organizationId?: string; packId?: string; planId?: string; credits?: string };
          };
        };
        refund?: {
          entity?: {
            id: string;
            payment_id: string;
            amount: number;
            notes?: { organizationId?: string; reason?: string };
          };
        };
      };
    };

    if (event.event === 'payment.captured' && event.payload?.payment?.entity) {
      const payment = event.payload.payment.entity;
      const orgId = payment.notes?.organizationId;
      if (!orgId) {
        return ok(res, { ignored: true, reason: 'Missing organizationId note' });
      }

      const pack = CREDIT_PACKS.find((p) => p.id === payment.notes?.packId);
      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === payment.notes?.planId);
      const credits = pack?.credits || plan?.monthlyCredits || Number(payment.notes?.credits || 0);

      if (credits > 0) {
        await grantCredits({
          organizationId: orgId,
          type: 'purchase',
          operation: 'razorpay_webhook_payment',
          amount: credits,
          idempotencyKey: `razorpay:${payment.id}`,
          referenceId: payment.id,
          description: `Razorpay payment captured (${payment.id})`
        });
      }

      if (plan) {
        await Organization.findByIdAndUpdate(orgId, {
          plan: plan.id,
          dailySendLimit: plan.dailySendLimit
        });
      }

      await Subscription.findOneAndUpdate(
        { organizationId: orgId },
        {
          $set: {
            ...(plan ? { planId: plan.id } : {}),
            status: 'active',
            razorpayOrderId: payment.order_id,
            razorpayPaymentId: payment.id
          },
          $push: {
            invoices: {
              invoiceNumber: `INV-WH-${Date.now()}`,
              amountInPaise: payment.amount || 0,
              currency: payment.currency || 'INR',
              status: 'paid',
              issuedAt: new Date(),
              paymentId: payment.id,
              description: `Webhook payment capture (${payment.id})`
            }
          }
        },
        { upsert: true }
      );
    } else if (event.event === 'refund.created' && event.payload?.refund?.entity) {
      const refund = event.payload.refund.entity;
      const orgId = refund.notes?.organizationId;
      if (orgId) {
        await Subscription.findOneAndUpdate(
          { organizationId: orgId },
          {
            $push: {
              refunds: {
                refundId: refund.id,
                paymentId: refund.payment_id,
                amountInPaise: refund.amount,
                reason: refund.notes?.reason || 'Razorpay refund',
                createdAt: new Date()
              }
            }
          }
        );
      }
    }

    ok(res, { received: true, event: event.event });
  } catch (err) {
    next(err);
  }
});
