import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { peopleSearchSchema, QUEUE_NAMES } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { Company, Contact, LeadList } from '../models/index.js';
import { deductCredits } from '../services/credits.service.js';
import { computeLeadScore, searchPeopleFromProvider, verifyEmailAddress } from '../services/prospect.service.js';
import { queueManager } from '../services/queue.service.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';
import { escapeRegExp } from '../utils/sanitize.js';

export const peopleRouter = Router();
peopleRouter.use(authenticate);

peopleRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const q = String(req.query.q || '').trim();
    const emailStatus = String(req.query.emailStatus || '').trim();
    const department = String(req.query.department || '').trim();

    const filter: Record<string, unknown> = { organizationId: req.auth!.organizationId };
    if (q) {
      const safeQ = escapeRegExp(q);
      filter.$or = [
        { fullName: { $regex: safeQ, $options: 'i' } },
        { jobTitle: { $regex: safeQ, $options: 'i' } },
        { companyName: { $regex: safeQ, $options: 'i' } },
        { email: { $regex: safeQ, $options: 'i' } }
      ];
    }
    if (emailStatus) filter.emailStatus = emailStatus;
    if (department) filter.department = { $regex: escapeRegExp(department), $options: 'i' };

    const [items, total] = await Promise.all([
      Contact.find(filter)
        .sort({ leadScore: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Contact.countDocuments(filter)
    ]);

    ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

peopleRouter.post('/search', validateBody(peopleSearchSchema), async (req, res, next) => {
  try {
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || `people-search:${uuidv4()}`;
    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'people_search',
      idempotencyKey,
      description: 'B2B decision-maker search'
    });

    const result = await searchPeopleFromProvider(req.auth!.organizationId, req.body);
    const saved = [];

    if (req.body.saveResults !== false) {
      for (const person of result.people) {
        let companyId;
        if (person.companyDomain) {
          const company = await Company.findOne({
            organizationId: req.auth!.organizationId,
            domain: person.companyDomain.toLowerCase()
          });
          companyId = company?._id;
        }

        if (person.email) {
          const doc = await Contact.findOneAndUpdate(
            { organizationId: req.auth!.organizationId, email: person.email.toLowerCase() },
            {
              $setOnInsert: {
                organizationId: req.auth!.organizationId,
                projectId: req.body.projectId || undefined,
                companyId,
                ...person
              }
            },
            { upsert: true, new: true }
          );
          saved.push(doc);
        } else {
          const doc = await Contact.create({
            organizationId: req.auth!.organizationId,
            projectId: req.body.projectId || undefined,
            companyId,
            ...person
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
        contacts: saved.length > 0 ? saved : result.people
      },
      { mode: result.mode }
    );
  } catch (err) {
    next(err);
  }
});

peopleRouter.post('/', async (req, res, next) => {
  try {
    const { fullName, jobTitle, department, companyName, companyDomain, location, linkedinUrl, email } = req.body as Record<
      string,
      string | undefined
    >;
    if (!fullName) throw new BadRequestError('Contact fullName is required');

    const cleanEmail = email?.trim().toLowerCase();
    if (cleanEmail) {
      const existing = await Contact.findOne({ organizationId: req.auth!.organizationId, email: cleanEmail });
      if (existing) {
        return ok(res, { contact: existing, duplicate: true });
      }
    }

    const parts = fullName.trim().split(/\s+/);
    const emailStatus = cleanEmail ? 'unverified' : 'unknown';
    const leadScore = computeLeadScore({ emailStatus, jobTitle, companyName, linkedinUrl });

    const contact = await Contact.create({
      organizationId: req.auth!.organizationId,
      fullName: fullName.trim(),
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
      jobTitle,
      department,
      companyName,
      companyDomain,
      location,
      linkedinUrl,
      email: cleanEmail,
      emailStatus,
      leadScore,
      source: 'manual',
      isDemoData: false
    });

    ok(res, contact, undefined, 201);
  } catch (err) {
    next(err);
  }
});

peopleRouter.post('/:id/enrich', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, organizationId: req.auth!.organizationId });
    if (!contact) throw new NotFoundError('Contact not found');

    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || `enrich:${contact._id.toString()}:${Date.now()}`;
    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'contact_enrichment',
      idempotencyKey,
      referenceId: contact._id.toString(),
      description: `Enrich contact ${contact.fullName}`
    });

    await queueManager.enqueue({
      organizationId: req.auth!.organizationId,
      createdBy: req.auth!.userId,
      queueName: QUEUE_NAMES.CONTACT_ENRICHMENT,
      jobKey: `enrich:${contact._id.toString()}:${Date.now()}`,
      payload: { organizationId: req.auth!.organizationId, contactId: contact._id.toString() },
      runImmediatelyInTest: true
    });

    const refreshed = await Contact.findById(contact._id);
    ok(res, refreshed);
  } catch (err) {
    next(err);
  }
});

peopleRouter.post('/:id/verify-email', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, organizationId: req.auth!.organizationId });
    if (!contact) throw new NotFoundError('Contact not found');

    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || `verify:${contact._id.toString()}:${Date.now()}`;
    await deductCredits({
      organizationId: req.auth!.organizationId,
      userId: req.auth!.userId,
      operation: 'email_verification',
      idempotencyKey,
      referenceId: contact._id.toString(),
      description: `Verify email for ${contact.fullName}`
    });

    const verification = await verifyEmailAddress(contact.email);
    contact.emailStatus = verification.status;
    contact.verificationDetails = verification.details;
    contact.leadScore = computeLeadScore(contact);
    await contact.save();

    ok(res, contact);
  } catch (err) {
    next(err);
  }
});

peopleRouter.patch('/:id', async (req, res, next) => {
  try {
    const updated = await Contact.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      req.body,
      { new: true }
    );
    if (!updated) throw new NotFoundError('Contact not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

peopleRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Contact.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!deleted) throw new NotFoundError('Contact not found');
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

peopleRouter.post('/bulk', async (req, res, next) => {
  try {
    const { action, ids, listId } = req.body as { action?: string; ids?: string[]; listId?: string };
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestError('ids array is required');

    if (action === 'delete') {
      const result = await Contact.deleteMany({ _id: { $in: ids }, organizationId: req.auth!.organizationId });
      return ok(res, { deletedCount: result.deletedCount });
    }

    if (action === 'verify') {
      await deductCredits({
        organizationId: req.auth!.organizationId,
        userId: req.auth!.userId,
        operation: 'email_verification',
        units: ids.length,
        idempotencyKey: `bulk-verify:${uuidv4()}`,
        description: `Bulk verify ${ids.length} contacts`
      });
      const job = await queueManager.enqueue({
        organizationId: req.auth!.organizationId,
        createdBy: req.auth!.userId,
        queueName: QUEUE_NAMES.EMAIL_VERIFICATION,
        jobKey: `bulk-verify:${uuidv4()}`,
        payload: { organizationId: req.auth!.organizationId, contactIds: ids },
        runImmediatelyInTest: true
      });
      return ok(res, { job, processed: ids.length });
    }

    if (action === 'add_to_list' && listId) {
      const list = await LeadList.findOneAndUpdate(
        { _id: listId, organizationId: req.auth!.organizationId },
        { $addToSet: { contactIds: { $each: ids } } },
        { new: true }
      );
      if (!list) throw new NotFoundError('Lead list not found');
      return ok(res, list);
    }

    throw new BadRequestError('Unsupported bulk action');
  } catch (err) {
    next(err);
  }
});
