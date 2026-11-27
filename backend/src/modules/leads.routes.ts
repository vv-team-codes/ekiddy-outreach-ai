import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { authenticate } from '../middleware/auth.middleware.js';
import { Contact, LeadList } from '../models/index.js';
import { computeLeadScore } from '../services/prospect.service.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';

export const leadsRouter = Router();
leadsRouter.use(authenticate);

leadsRouter.get('/lists', async (req, res, next) => {
  try {
    const lists = await LeadList.find({ organizationId: req.auth!.organizationId })
      .sort({ createdAt: -1 })
      .populate('contactIds', 'fullName email jobTitle companyName emailStatus leadScore');
    ok(res, lists);
  } catch (err) {
    next(err);
  }
});

leadsRouter.post('/lists', async (req, res, next) => {
  try {
    const { name, description, contactIds, companyIds } = req.body as {
      name?: string;
      description?: string;
      contactIds?: string[];
      companyIds?: string[];
    };
    if (!name || !name.trim()) throw new BadRequestError('Lead list name is required');
    const list = await LeadList.create({
      organizationId: req.auth!.organizationId,
      name: name.trim(),
      description,
      contactIds: contactIds || [],
      companyIds: companyIds || []
    });
    ok(res, list, undefined, 201);
  } catch (err) {
    next(err);
  }
});

leadsRouter.patch('/lists/:id', async (req, res, next) => {
  try {
    const updated = await LeadList.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      req.body,
      { new: true }
    );
    if (!updated) throw new NotFoundError('Lead list not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

leadsRouter.delete('/lists/:id', async (req, res, next) => {
  try {
    const deleted = await LeadList.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!deleted) throw new NotFoundError('Lead list not found');
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

leadsRouter.post('/import-csv', async (req, res, next) => {
  try {
    const csvText = String(req.body?.csvText || '');
    const listId = req.body?.listId ? String(req.body.listId) : undefined;
    if (!csvText.trim()) throw new BadRequestError('csvText is required');

    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Array<Record<string, string>>;

    let imported = 0;
    let duplicatesSkipped = 0;
    const importedIds: string[] = [];

    for (const row of rows.slice(0, 500)) {
      const fullName = row.fullName || row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim();
      const email = (row.email || '').trim().toLowerCase();
      if (!fullName && !email) continue;

      if (email) {
        const existing = await Contact.findOne({ organizationId: req.auth!.organizationId, email });
        if (existing) {
          duplicatesSkipped++;
          importedIds.push(existing._id.toString());
          continue;
        }
      }

      const emailStatus = email ? 'unverified' : 'unknown';
      const created = await Contact.create({
        organizationId: req.auth!.organizationId,
        fullName: fullName || email,
        firstName: row.firstName || fullName.split(' ')[0],
        lastName: row.lastName || fullName.split(' ').slice(1).join(' '),
        jobTitle: row.jobTitle || row.title || '',
        department: row.department || '',
        companyName: row.companyName || row.company || '',
        companyDomain: row.companyDomain || row.domain || '',
        location: row.location || '',
        linkedinUrl: row.linkedinUrl || row.linkedin || undefined,
        email: email || undefined,
        emailStatus,
        leadScore: computeLeadScore({
          emailStatus,
          jobTitle: row.jobTitle || row.title,
          companyName: row.companyName || row.company
        }),
        source: 'csv',
        isDemoData: false
      });
      imported++;
      importedIds.push(created._id.toString());
    }

    if (listId && importedIds.length > 0) {
      await LeadList.findOneAndUpdate(
        { _id: listId, organizationId: req.auth!.organizationId },
        { $addToSet: { contactIds: { $each: importedIds } } }
      );
    }

    ok(res, { imported, duplicatesSkipped, totalProcessed: rows.length }, undefined, 201);
  } catch (err) {
    next(err);
  }
});

leadsRouter.get('/export-csv', async (req, res, next) => {
  try {
    const contacts = await Contact.find({ organizationId: req.auth!.organizationId })
      .sort({ createdAt: -1 })
      .limit(2000);

    const csv = stringify(
      contacts.map((c) => ({
        fullName: c.fullName,
        email: c.email || '',
        emailStatus: c.emailStatus,
        jobTitle: c.jobTitle || '',
        department: c.department || '',
        companyName: c.companyName || '',
        location: c.location || '',
        leadScore: c.leadScore,
        stage: c.stage
      })),
      { header: true }
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ekiddy-contacts.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});
