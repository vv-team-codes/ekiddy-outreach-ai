import { QUEUE_NAMES } from '@ekiddy/shared';
import {
  Campaign,
  CompanyResearch,
  Competitor,
  Contact,
  EmailSequence,
  ICP,
  Notification
} from '../models/index.js';
import {
  analyzeCompanyWithAI,
  discoverCompetitorsWithAI,
  generateEmailWithAI,
  generateIcpsWithAI
} from '../services/ai.service.js';
import { crawlCompanyWebsite } from '../services/crawler.service.js';
import { dispatchOutboundEmail, renderTemplateString } from '../services/email.service.js';
import { computeLeadScore, verifyEmailAddress } from '../services/prospect.service.js';
import { queueManager } from '../services/queue.service.js';

export function registerAllQueueHandlers(): void {
  queueManager.registerHandler(QUEUE_NAMES.COMPANY_RESEARCH, async (payload, helpers) => {
    const researchId = String(payload.researchId);
    const organizationId = String(payload.organizationId);
    const websiteUrl = String(payload.websiteUrl);
    const companyNameHint = payload.companyNameHint ? String(payload.companyNameHint) : undefined;

    await CompanyResearch.findByIdAndUpdate(researchId, { status: 'running', progress: 15 });
    await helpers.updateProgress(15);

    try {
      const crawled = await crawlCompanyWebsite(websiteUrl);
      await CompanyResearch.findByIdAndUpdate(researchId, {
        progress: 50,
        rawExtractedPages: crawled.pages
      });
      await helpers.updateProgress(50);

      const aiOut = await analyzeCompanyWithAI({
        organizationId,
        websiteUrl: crawled.normalizedUrl,
        companyNameHint,
        extractedText: crawled.combinedText || crawled.crawlWarning || '',
        pageTitles: crawled.pages.map((p) => p.title)
      });

      await CompanyResearch.findByIdAndUpdate(researchId, {
        status: 'completed',
        progress: 100,
        websiteUrl: crawled.normalizedUrl,
        ...aiOut.result,
        aiMode: aiOut.aiMode,
        aiProvider: aiOut.aiProvider,
        aiModel: aiOut.aiModel,
        errorMessage: crawled.crawlWarning
      });
      await helpers.updateProgress(100);

      await Notification.create({
        organizationId,
        type: 'success',
        title: 'Company Research Complete',
        message: `Finished researching ${aiOut.result.companyName}.`,
        link: '/research'
      });

      return { researchId, companyName: aiOut.result.companyName };
    } catch (err) {
      await CompanyResearch.findByIdAndUpdate(researchId, {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Research failed'
      });
      throw err;
    }
  });

  queueManager.registerHandler(QUEUE_NAMES.COMPETITOR_DISCOVERY, async (payload, helpers) => {
    const organizationId = String(payload.organizationId);
    const researchId = payload.researchId ? String(payload.researchId) : undefined;
    const projectId = payload.projectId ? String(payload.projectId) : undefined;

    await helpers.updateProgress(30);
    const research = researchId
      ? await CompanyResearch.findOne({ _id: researchId, organizationId })
      : await CompanyResearch.findOne({ organizationId }).sort({ createdAt: -1 });

    const aiOut = await discoverCompetitorsWithAI({
      organizationId,
      companyName: research?.companyName || String(payload.companyName || 'Our Company'),
      industry: research?.industry || String(payload.industry || 'B2B Software'),
      overview: research?.companyOverview || String(payload.overview || '')
    });

    await helpers.updateProgress(80);
    const created = await Promise.all(
      aiOut.result.competitors.map((c) =>
        Competitor.create({
          organizationId,
          projectId,
          researchId: research?._id,
          ...c,
          source: 'ai',
          status: 'researched'
        })
      )
    );
    await helpers.updateProgress(100);
    return { count: created.length };
  });

  queueManager.registerHandler(QUEUE_NAMES.ICP_GENERATION, async (payload, helpers) => {
    const organizationId = String(payload.organizationId);
    const researchId = payload.researchId ? String(payload.researchId) : undefined;
    const projectId = payload.projectId ? String(payload.projectId) : undefined;

    await helpers.updateProgress(30);
    const research = researchId
      ? await CompanyResearch.findOne({ _id: researchId, organizationId })
      : await CompanyResearch.findOne({ organizationId }).sort({ createdAt: -1 });

    const aiOut = await generateIcpsWithAI({
      organizationId,
      companyName: research?.companyName || String(payload.companyName || 'Our Company'),
      industry: research?.industry || 'B2B SaaS',
      targetMarket: research?.targetMarket || 'Growth B2B teams',
      uniqueSellingPoints: research?.uniqueSellingPoints || []
    });

    const created = await Promise.all(
      aiOut.result.icps.map((icp) =>
        ICP.create({
          organizationId,
          projectId,
          researchId: research?._id,
          ...icp
        })
      )
    );
    await helpers.updateProgress(100);
    return { count: created.length };
  });

  queueManager.registerHandler(QUEUE_NAMES.EMAIL_VERIFICATION, async (payload, helpers) => {
    const organizationId = String(payload.organizationId);
    const contactIds = Array.isArray(payload.contactIds) ? payload.contactIds.map(String) : [];

    let processed = 0;
    for (const id of contactIds) {
      const contact = await Contact.findOne({ _id: id, organizationId });
      if (!contact) continue;
      const verification = await verifyEmailAddress(contact.email);
      contact.emailStatus = verification.status;
      contact.verificationDetails = verification.details;
      contact.leadScore = computeLeadScore(contact);
      await contact.save();
      processed++;
      await helpers.updateProgress(Math.round((processed / Math.max(1, contactIds.length)) * 100));
    }
    return { processed };
  });

  queueManager.registerHandler(QUEUE_NAMES.CONTACT_ENRICHMENT, async (payload) => {
    const organizationId = String(payload.organizationId);
    const contactId = String(payload.contactId);
    const contact = await Contact.findOne({ _id: contactId, organizationId });
    if (!contact) return { updated: false };

    if (!contact.firstName && contact.fullName) {
      const parts = contact.fullName.split(' ');
      contact.firstName = parts[0];
      contact.lastName = parts.slice(1).join(' ');
    }
    if (contact.email) {
      const verification = await verifyEmailAddress(contact.email);
      contact.emailStatus = verification.status;
      contact.verificationDetails = verification.details;
    }
    contact.leadScore = computeLeadScore(contact);
    await contact.save();
    return { updated: true, leadScore: contact.leadScore };
  });

  queueManager.registerHandler(QUEUE_NAMES.AI_EMAIL_GENERATION, async (payload) => {
    return (await generateEmailWithAI(payload as Parameters<typeof generateEmailWithAI>[0])) as unknown as Record<
      string,
      unknown
    >;
  });

  queueManager.registerHandler(QUEUE_NAMES.CAMPAIGN_SCHEDULER, async (payload, helpers) => {
    const organizationId = String(payload.organizationId);
    const campaignId = String(payload.campaignId);

    const campaign = await Campaign.findOne({ _id: campaignId, organizationId });
    if (!campaign || campaign.status !== 'Active') {
      return { skipped: true };
    }

    const sequence = await EmailSequence.findOne({ campaignId: campaign._id, organizationId });
    const step1 = sequence?.steps?.sort((a, b) => a.stepOrder - b.stepOrder)[0];
    if (!step1) {
      return { skipped: true, reason: 'No sequence steps configured' };
    }

    const contacts = await Contact.find({
      _id: { $in: campaign.targetContactIds },
      organizationId
    });

    let dispatched = 0;
    for (const contact of contacts.slice(0, campaign.dailySendLimit)) {
      if (!contact.email || contact.emailStatus === 'invalid') continue;
      const vars = {
        firstName: contact.firstName || contact.fullName.split(' ')[0],
        fullName: contact.fullName,
        companyName: contact.companyName || 'your company',
        jobTitle: contact.jobTitle || 'team'
      };
      await queueManager.enqueue({
        organizationId,
        queueName: QUEUE_NAMES.EMAIL_DELIVERY,
        jobKey: `camp:${campaignId}:step:${step1.stepOrder}:contact:${contact._id.toString()}`,
        payload: {
          organizationId,
          campaignId,
          contactId: contact._id.toString(),
          sendingAccountId: campaign.sendingAccountId?.toString(),
          toEmail: contact.email,
          subject: renderTemplateString(step1.subject, vars),
          bodyText: renderTemplateString(step1.body, vars),
          stepOrder: step1.stepOrder,
          forceSandbox: campaign.testMode
        },
        runImmediatelyInTest: true
      });
      dispatched++;
      await helpers.updateProgress(Math.round((dispatched / Math.max(1, contacts.length)) * 100));
    }

    return { dispatched };
  });

  queueManager.registerHandler(QUEUE_NAMES.EMAIL_DELIVERY, async (payload) => {
    const organizationId = String(payload.organizationId);
    const campaignId = payload.campaignId ? String(payload.campaignId) : undefined;
    const contactId = payload.contactId ? String(payload.contactId) : undefined;
    const stepOrder = Number(payload.stepOrder || 1);
    const idempotencyKey = `delivery:${campaignId || 'direct'}:step:${stepOrder}:${contactId || payload.toEmail}`;

    const res = await dispatchOutboundEmail({
      organizationId,
      campaignId,
      contactId,
      sendingAccountId: payload.sendingAccountId ? String(payload.sendingAccountId) : undefined,
      toEmail: String(payload.toEmail),
      subject: String(payload.subject),
      bodyText: String(payload.bodyText),
      stepOrder,
      idempotencyKey,
      forceSandbox: Boolean(payload.forceSandbox)
    });

    return { alreadyProcessed: res.alreadyProcessed, suppressed: Boolean(res.suppressed) };
  });

  queueManager.registerHandler(QUEUE_NAMES.FOLLOW_UP_SEQUENCE, async (payload) => {
    return { scheduled: true, campaignId: payload.campaignId };
  });

  queueManager.registerHandler(QUEUE_NAMES.COMPANY_SEARCH, async (payload) => ({ ok: true, payload }));
  queueManager.registerHandler(QUEUE_NAMES.PEOPLE_SEARCH, async (payload) => ({ ok: true, payload }));
  queueManager.registerHandler(QUEUE_NAMES.INBOX_SYNC, async () => ({ synced: true, timestamp: new Date().toISOString() }));
  queueManager.registerHandler(QUEUE_NAMES.ANALYTICS_AGGREGATION, async () => ({ aggregated: true }));
}
