import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { EMAIL_TONES, generateEmailSchema } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { CompanyResearch, EmailTemplate } from '../models/index.js';
import { generateEmailWithAI } from '../services/ai.service.js';
import { deductCredits } from '../services/credits.service.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';
import { sanitizeMultilineText, sanitizeText } from '../utils/sanitize.js';
import { z } from 'zod';

export const emailsRouter = Router();
emailsRouter.use(authenticate);

// Backend-local validation for email templates (shared/src is read-only):
// bounded lengths on every text field, tone restricted to the known enum.
const emailTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  objective: z.string().trim().max(500).optional(),
  tone: z.enum(EMAIL_TONES).optional(),
  subject: z.string().trim().min(1).max(300),
  openingLine: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1).max(10000),
  cta: z.string().trim().max(500).optional(),
  followUpBody: z.string().trim().max(10000).optional(),
  isAiGenerated: z.boolean().optional()
});

emailsRouter.post('/generate', validateBody(generateEmailSchema), async (req, res, next) => {
  try {
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || `email-gen:${uuidv4()}`;
    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'ai_email_generation',
      idempotencyKey,
      description: `Generate personalized outreach email for ${req.body.companyName}`
    });

    let companyInfo = req.body.companyInformation || '';
    if (!companyInfo && req.body.researchId) {
      const research = await CompanyResearch.findOne({
        _id: req.body.researchId,
        organizationId: req.auth!.organizationId
      });
      if (research) {
        companyInfo = `${research.companyOverview} ${research.businessPositioning}`.trim();
      }
    }

    const generated = await generateEmailWithAI({
      organizationId: req.auth!.organizationId,
      ...req.body,
      companyInformation: companyInfo,
      senderName: req.body.senderName || req.auth!.fullName
    });

    ok(res, generated);
  } catch (err) {
    next(err);
  }
});

emailsRouter.post('/alternatives', validateBody(generateEmailSchema), async (req, res, next) => {
  try {
    const variants = await Promise.all(
      [1, 2, 3].map((seed) =>
        generateEmailWithAI({
          organizationId: req.auth!.organizationId,
          ...req.body,
          senderName: req.body.senderName || req.auth!.fullName,
          variationSeed: seed
        })
      )
    );
    ok(res, variants);
  } catch (err) {
    next(err);
  }
});

emailsRouter.get('/templates', async (req, res, next) => {
  try {
    const templates = await EmailTemplate.find({ organizationId: req.auth!.organizationId }).sort({
      createdAt: -1
    });
    ok(res, templates);
  } catch (err) {
    next(err);
  }
});

emailsRouter.post('/templates', validateBody(emailTemplateSchema), async (req, res, next) => {
  try {
    const { name, objective, tone, subject, openingLine, body, cta, followUpBody, isAiGenerated } = req.body;
    const cleanSubject = sanitizeText(subject, 300);
    const cleanBody = sanitizeMultilineText(body, 10000);

    const variableMatches = Array.from(cleanBody.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map(
      (m) => m[1]
    );

    const template = await EmailTemplate.create({
      organizationId: req.auth!.organizationId,
      name: sanitizeText(name, 200),
      objective: objective ? sanitizeText(objective, 500) : undefined,
      tone: tone || 'Professional',
      subject: cleanSubject,
      openingLine: openingLine ? sanitizeText(openingLine, 500) : undefined,
      body: cleanBody,
      cta: cta ? sanitizeText(cta, 500) : undefined,
      followUpBody: followUpBody ? sanitizeMultilineText(followUpBody, 10000) : undefined,
      variables: Array.from(new Set(variableMatches)),
      isAiGenerated: Boolean(isAiGenerated ?? true)
    });
    ok(res, template, undefined, 201);
  } catch (err) {
    next(err);
  }
});

emailsRouter.patch('/templates/:id', async (req, res, next) => {
  try {
    // Mass-assignment guard: only whitelisted template fields, sanitised.
    const allowed: Record<string, (v: unknown) => unknown> = {
      name: (v) => sanitizeText(v, 200),
      objective: (v) => sanitizeText(v, 500),
      tone: (v) =>
        typeof v === 'string' && (EMAIL_TONES as readonly string[]).includes(v) ? v : undefined,
      subject: (v) => sanitizeText(v, 300),
      openingLine: (v) => sanitizeText(v, 500),
      body: (v) => sanitizeMultilineText(v, 10000),
      cta: (v) => sanitizeText(v, 500),
      followUpBody: (v) => sanitizeMultilineText(v, 10000),
      isAiGenerated: (v) => (typeof v === 'boolean' ? v : undefined)
    };
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
      if (key in allowed) {
        const cleaned = allowed[key](value);
        if (cleaned !== undefined) updates[key] = cleaned;
      }
    }
    if (Object.keys(updates).length === 0) throw new BadRequestError('No valid template fields to update');
    const updated = await EmailTemplate.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      updates,
      { new: true }
    );
    if (!updated) throw new NotFoundError('Email template not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

emailsRouter.delete('/templates/:id', async (req, res, next) => {
  try {
    const deleted = await EmailTemplate.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!deleted) throw new NotFoundError('Email template not found');
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
