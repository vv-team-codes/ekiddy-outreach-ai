import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { EMAIL_TONES, generateEmailSchema } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { CompanyResearch, EmailTemplate } from '../models/index.js';
import { generateEmailWithAI } from '../services/ai.service.js';
import { deductCredits } from '../services/credits.service.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';

export const emailsRouter = Router();
emailsRouter.use(authenticate);

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

emailsRouter.post('/templates', async (req, res, next) => {
  try {
    const { name, objective, tone, subject, openingLine, body, cta, followUpBody, isAiGenerated } = req.body as Record<
      string,
      unknown
    >;
    if (!name || !subject || !body) {
      throw new BadRequestError('Template name, subject, and body are required');
    }

    const variableMatches = Array.from(String(body).matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map(
      (m) => m[1]
    );

    const template = await EmailTemplate.create({
      organizationId: req.auth!.organizationId,
      name: String(name).trim(),
      objective: objective ? String(objective) : undefined,
      tone: EMAIL_TONES.includes(tone as (typeof EMAIL_TONES)[number]) ? tone : 'Professional',
      subject: String(subject),
      openingLine: openingLine ? String(openingLine) : undefined,
      body: String(body),
      cta: cta ? String(cta) : undefined,
      followUpBody: followUpBody ? String(followUpBody) : undefined,
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
    const updated = await EmailTemplate.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      req.body,
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
