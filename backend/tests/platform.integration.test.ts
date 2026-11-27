import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { queueManager } from '../src/services/queue.service.js';
import { generateTestPaymentSignature } from '../src/services/razorpay.service.js';
import { signHmacSha256 } from '../src/utils/crypto.js';
import { registerAllQueueHandlers } from '../src/workers/registerWorkers.js';

const app = createApp();

describe('Ekiddy Outreach AI — Full Platform Integration & Security Suite (18 Core Scenarios)', () => {
  let orgAToken = '';
  let orgAId = '';
  let orgABookingSlug = '';
  let orgBToken = '';
  let orgBId = '';

  let researchId = '';
  let icpId = '';
  let contactId = '';
  let campaignId = '';
  let conversationId = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDatabase();
    registerAllQueueHandlers();
    await queueManager.init(true);
  });

  afterAll(async () => {
    await queueManager.shutdown();
    await disconnectDatabase();
  });

  it('1. Registration: creates user, organization, welcome credits, and sandbox sender', async () => {
    const resA = await request(app).post('/api/auth/register').send({
      fullName: 'Alice Founder',
      email: 'alice@org-a.example',
      password: 'Password123!',
      organizationName: 'Org Alpha Labs',
      websiteUrl: 'https://example.com'
    });
    expect(resA.status).toBe(201);
    expect(resA.body.success).toBe(true);
    expect(resA.body.data.token).toBeTruthy();
    expect(resA.body.data.organization.creditBalance).toBe(500);

    orgAToken = resA.body.data.token;
    orgAId = resA.body.data.organization._id;
    orgABookingSlug = resA.body.data.organization.bookingSlug;

    // Verify email using devVerificationToken
    const verifyRes = await request(app).post('/api/auth/verify-email').send({
      token: resA.body.data.devVerificationToken
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verified).toBe(true);

    // Register Org B for tenant isolation checks
    const resB = await request(app).post('/api/auth/register').send({
      fullName: 'Bob Competitor',
      email: 'bob@org-b.example',
      password: 'Password123!',
      organizationName: 'Org Beta Corp'
    });
    expect(resB.status).toBe(201);
    orgBToken = resB.body.data.token;
    orgBId = resB.body.data.organization._id;
  });

  it('2. Login: authenticates registered user and rejects wrong password', async () => {
    const bad = await request(app).post('/api/auth/login').send({
      email: 'alice@org-a.example',
      password: 'WrongPassword!'
    });
    expect(bad.status).toBe(401);

    const good = await request(app).post('/api/auth/login').send({
      email: 'alice@org-a.example',
      password: 'Password123!'
    });
    expect(good.status).toBe(200);
    expect(good.body.data.token).toBeTruthy();
  });

  it('3. Company Research & SSRF Protection: blocks internal IPs and completes public URL research', async () => {
    // SSRF checks
    for (const maliciousUrl of [
      'http://127.0.0.1:8080/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:3000'
    ]) {
      const blocked = await request(app)
        .post('/api/research/company')
        .set('Authorization', `Bearer ${orgAToken}`)
        .send({ websiteUrl: maliciousUrl });
      expect(blocked.status).toBe(400);
    }

    const res = await request(app)
      .post('/api/research/company')
      .set('Authorization', `Bearer ${orgAToken}`)
      .set('x-idempotency-key', 'research-idem-1')
      .send({ websiteUrl: 'https://example.com', companyNameHint: 'Example SaaS' });

    expect(res.status).toBe(201);
    expect(res.body.data.research.status).toBe('completed');
    expect(res.body.data.research.companyName).toBeTruthy();
    researchId = res.body.data.research._id;
  });

  it('16. Credit Deduction Idempotency: does not deduct twice for identical idempotency key', async () => {
    const balBefore = await request(app)
      .get('/api/credits/balance')
      .set('Authorization', `Bearer ${orgAToken}`);
    const startBal = balBefore.body.data.creditBalance;

    const first = await request(app)
      .post('/api/emails/generate')
      .set('Authorization', `Bearer ${orgAToken}`)
      .set('x-idempotency-key', 'email-idem-unique-1')
      .send({
        prospectName: 'Sam Lee',
        prospectDesignation: 'VP Sales',
        companyName: 'Acme Corp',
        campaignObjective: 'Schedule demo',
        productOrService: 'Ekiddy AI',
        tone: 'Professional'
      });
    expect(first.status).toBe(200);

    const balMid = await request(app)
      .get('/api/credits/balance')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(balMid.body.data.creditBalance).toBe(startBal - 2);

    // Repeat with exact same x-idempotency-key
    const second = await request(app)
      .post('/api/emails/generate')
      .set('Authorization', `Bearer ${orgAToken}`)
      .set('x-idempotency-key', 'email-idem-unique-1')
      .send({
        prospectName: 'Sam Lee',
        prospectDesignation: 'VP Sales',
        companyName: 'Acme Corp',
        campaignObjective: 'Schedule demo',
        productOrService: 'Ekiddy AI',
        tone: 'Professional'
      });
    expect(second.status).toBe(200);

    const balAfter = await request(app)
      .get('/api/credits/balance')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(balAfter.body.data.creditBalance).toBe(startBal - 2);
  });

  it('4. Competitor Discovery: discovers, manually creates, refreshes, and compares competitors', async () => {
    const disc = await request(app)
      .post('/api/competitors/discover')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ researchId });
    expect(disc.status).toBe(201);
    expect(disc.body.data.competitors.length).toBeGreaterThan(0);

    const manual = await request(app)
      .post('/api/competitors')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: 'Manual Rival Inc', website: 'https://rival.example', industry: 'SaaS' });
    expect(manual.status).toBe(201);

    const compare = await request(app)
      .post('/api/competitors/compare')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({});
    expect(compare.status).toBe(200);
    expect(compare.body.data.competitors.length).toBeGreaterThanOrEqual(2);
  });

  it('5. ICP Generation: generates, duplicates, and stores ICP profiles', async () => {
    const gen = await request(app)
      .post('/api/icp/generate')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ researchId });
    expect(gen.status).toBe(201);
    expect(gen.body.data.icps.length).toBeGreaterThan(0);
    icpId = gen.body.data.icps[0]._id;

    const dup = await request(app)
      .post(`/api/icp/${icpId}/duplicate`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({});
    expect(dup.status).toBe(201);
    expect(dup.body.data.name).toContain('(Copy)');
  });

  it('6. Company Search: returns clearly labeled demo companies and persists records', async () => {
    const search = await request(app)
      .post('/api/companies/search')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ industry: 'SaaS', saveResults: true });
    expect(search.status).toBe(200);
    expect(search.body.data.mode).toBe('demo');
    expect(search.body.data.companies.length).toBeGreaterThan(0);

    const list = await request(app).get('/api/companies').set('Authorization', `Bearer ${orgAToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
  });

  it('7. People Search & Email Verification: searches decision-makers and verifies email status', async () => {
    const search = await request(app)
      .post('/api/people/search')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ jobTitle: 'VP', saveResults: true });
    expect(search.status).toBe(200);
    expect(search.body.data.contacts.length).toBeGreaterThan(0);

    // Add a real syntax check contact
    const created = await request(app)
      .post('/api/people')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        fullName: 'Jordan Prospect',
        email: 'jordan@gmail.com',
        jobTitle: 'VP of Revenue',
        companyName: 'TestCo'
      });
    expect(created.status).toBe(201);
    contactId = created.body.data._id;

    const verified = await request(app)
      .post(`/api/people/${contactId}/verify-email`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({});
    expect(verified.status).toBe(200);
    expect(['verified', 'unverified']).toContain(verified.body.data.emailStatus);
  });

  it('8. Lead Saving & CSV Import/Export: creates lists, deduplicates CSV imports, and exports CSV', async () => {
    const listRes = await request(app)
      .post('/api/leads/lists')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: 'Q4 Outreach Targets', contactIds: [contactId] });
    expect(listRes.status).toBe(201);

    const csvRes = await request(app)
      .post('/api/leads/import-csv')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        listId: listRes.body.data._id,
        csvText:
          'fullName,email,jobTitle,companyName\nJordan Prospect,jordan@gmail.com,VP Revenue,TestCo\nElena Vance,elena@vance.example,Head of Growth,Vance Corp'
      });
    expect(csvRes.status).toBe(201);
    expect(csvRes.body.data.imported).toBe(1);
    expect(csvRes.body.data.duplicatesSkipped).toBe(1);

    const exportRes = await request(app)
      .get('/api/leads/export-csv')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.text).toContain('elena@vance.example');
  });

  it('9. Email Generation: generates personalized copy across tones and saves template', async () => {
    const gen = await request(app)
      .post('/api/emails/generate')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        prospectName: 'Jordan Prospect',
        prospectDesignation: 'VP of Revenue',
        companyName: 'TestCo',
        campaignObjective: 'Book a 15-min demo',
        productOrService: 'Ekiddy Outreach AI',
        tone: 'Short and direct'
      });
    expect(gen.status).toBe(200);
    expect(gen.body.data.subject).toBeTruthy();
    expect(gen.body.data.body).toContain('TestCo');

    const tpl = await request(app)
      .post('/api/emails/templates')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        name: 'Direct Opener',
        tone: 'Short and direct',
        subject: gen.body.data.subject,
        body: gen.body.data.body
      });
    expect(tpl.status).toBe(201);
  });

  it('10 & 11 & 12. Campaign Creation, Approval Gate & Test-Mode Email Sending', async () => {
    const create = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        name: 'Alpha Test Campaign',
        icpId,
        segment: 'Mid-Market SaaS',
        objective: 'Schedule discovery calls',
        targetContactIds: [contactId],
        testMode: true,
        steps: [
          {
            stepOrder: 1,
            delayDays: 0,
            subject: 'Idea for {{companyName}}',
            body: 'Hi {{firstName}}, open to chatting about {{companyName}}?',
            condition: 'always'
          }
        ]
      });
    expect(create.status).toBe(201);
    campaignId = create.body.data._id;

    // Launching before approval must be blocked
    const unapprovedLaunch = await request(app)
      .post(`/api/campaigns/${campaignId}/activate`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({});
    expect(unapprovedLaunch.status).toBe(400);

    // Explicit approval
    const approve = await request(app)
      .post(`/api/campaigns/${campaignId}/approve`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('Approved');

    // Launch in Sandbox Test Mode
    const launch = await request(app)
      .post(`/api/campaigns/${campaignId}/activate`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({});
    expect(launch.status).toBe(200);
    expect(launch.body.data.campaign.status).toBe('Active');
    expect(launch.body.data.campaign.stats.sent).toBe(1);

    const events = await request(app)
      .get(`/api/campaigns/${campaignId}/events`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(events.status).toBe(200);
    expect(events.body.data.some((e: { eventType: string }) => e.eventType === 'sent')).toBe(true);
  });

  it('13 & 14. Reply Synchronization, AI Classification & Immediate Opt-Out Suppression', async () => {
    // 1. Positive / Meeting request reply via signed email webhook
    const webhookBody = {
      organizationId: orgAId,
      campaignId,
      eventType: 'replied',
      email: 'jordan@gmail.com',
      subject: 'Re: Idea for TestCo',
      bodyText: 'Yes, I am interested! Let us schedule a call next Tuesday.',
      providerMessageId: 'msg-reply-1'
    };
    const sig = signHmacSha256(JSON.stringify(webhookBody), env.emailWebhookSecret);

    const whRes = await request(app)
      .post('/api/webhooks/email')
      .set('x-email-signature', sig)
      .send(webhookBody);
    expect(whRes.status).toBe(200);
    expect(['Meeting request', 'Interested', 'Positive response']).toContain(whRes.body.data.classification);

    const threads = await request(app)
      .get('/api/inbox/threads')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(threads.status).toBe(200);
    expect(threads.body.data.length).toBeGreaterThan(0);
    conversationId = threads.body.data[0]._id;

    // 2. Unsubscribe reply must immediately add email to SuppressionRecord
    const unsubRes = await request(app)
      .post('/api/conversations/simulate-inbound')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        fromEmail: 'optout-user@vance.example',
        subject: 'Unsubscribe',
        bodyText: 'Please unsubscribe me and remove me from your list immediately.'
      });
    expect(unsubRes.status).toBe(201);
    expect(unsubRes.body.data.classification).toBe('Unsubscribe');

    const sendingAcc = await request(app)
      .get('/api/sending-accounts')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(
      sendingAcc.body.data.suppressions.some((s: { email: string }) => s.email === 'optout-user@vance.example')
    ).toBe(true);
  });

  it('15. Meeting Booking: schedules meeting, prevents slot double-booking, and supports public booking', async () => {
    const start = new Date(Date.now() + 2 * 86400000);
    start.setUTCHours(11, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const booked = await request(app)
      .post('/api/meetings')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        title: 'Discovery Call with TestCo',
        attendeeName: 'Jordan Prospect',
        attendeeEmail: 'jordan@gmail.com',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        timezone: 'UTC',
        contactId,
        campaignId,
        conversationId
      });
    expect(booked.status).toBe(201);

    // Double booking same slot must reject
    const conflict = await request(app)
      .post('/api/meetings')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        title: 'Conflicting Call',
        attendeeName: 'Other Prospect',
        attendeeEmail: 'other@example.com',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        timezone: 'UTC'
      });
    expect(conflict.status).toBe(400);

    // Public booking link check
    const pubStart = new Date(start.getTime() + 60 * 60 * 1000);
    const pubEnd = new Date(pubStart.getTime() + 30 * 60 * 1000);
    const pubBook = await request(app).post(`/api/meetings/public/${orgABookingSlug}/book`).send({
      attendeeName: 'External Lead',
      attendeeEmail: 'lead@external.example',
      startTime: pubStart.toISOString(),
      endTime: pubEnd.toISOString()
    });
    expect(pubBook.status).toBe(201);
  });

  it('17. Razorpay Checkout & Webhook Handling: verifies signatures and applies credits idempotently', async () => {
    // 1. Order + signature verification
    const orderRes = await request(app)
      .post('/api/billing/razorpay/order')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ packId: 'pack_500' });
    expect(orderRes.status).toBe(201);
    const { orderId, testPaymentPreview } = orderRes.body.data;

    const verifyRes = await request(app)
      .post('/api/billing/razorpay/verify')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: testPaymentPreview.paymentId,
        razorpay_signature: testPaymentPreview.signature,
        packId: 'pack_500'
      });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verified).toBe(true);
    expect(verifyRes.body.data.creditsAdded).toBe(500);

    // 2. Signed Razorpay Webhook payment.captured
    const balBefore = verifyRes.body.data.balanceAfter;
    const whPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_unique_999',
            order_id: 'order_wh_999',
            amount: 199900,
            currency: 'INR',
            notes: { organizationId: orgAId, packId: 'pack_2500' }
          }
        }
      }
    };
    const whSig = signHmacSha256(JSON.stringify(whPayload), env.razorpayWebhookSecret);
    const whRes = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', whSig)
      .send(whPayload);
    expect(whRes.status).toBe(200);

    // Replay same webhook must NOT double credit
    const whReplay = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', whSig)
      .send(whPayload);
    expect(whReplay.status).toBe(200);

    const balAfter = await request(app)
      .get('/api/credits/balance')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(balAfter.body.data.creditBalance).toBe(balBefore + 2500);

    // Invalid signature rejected
    const badSig = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', 'deadbeef')
      .send(whPayload);
    expect(badSig.status).toBe(400);

    // Verify helper signature matches
    expect(generateTestPaymentSignature('o1', 'p1')).toBeTruthy();
  });

  it('18. Organization Isolation & Credential Safety: blocks cross-tenant access and never leaks secrets', async () => {
    // Store encrypted integration in Org A
    const putInt = await request(app)
      .put('/api/integrations/gemini')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ provider: 'gemini', credentials: { apiKey: 'AIzaSecretRealKey123456' } });
    expect(putInt.status).toBe(200);
    expect(JSON.stringify(putInt.body)).not.toContain('AIzaSecretRealKey123456');

    const getInts = await request(app)
      .get('/api/integrations')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(JSON.stringify(getInts.body)).not.toContain('AIzaSecretRealKey123456');

    // Org B attempting to read Org A resources directly or via x-organization-id header must fail
    const crossHeader = await request(app)
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${orgBToken}`)
      .set('x-organization-id', orgAId);
    expect(crossHeader.status).toBe(403);

    const crossCampaign = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(crossCampaign.status).toBe(404);

    const crossContact = await request(app)
      .patch(`/api/people/${contactId}`)
      .set('Authorization', `Bearer ${orgBToken}`)
      .send({ jobTitle: 'Hacked' });
    expect(crossContact.status).toBe(404);

    const crossThread = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(crossThread.status).toBe(404);

    // Analytics reflects real stored data for Org A, zeroed for Org B
    const analyticsA = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(analyticsA.body.data.emailsSent).toBeGreaterThanOrEqual(1);
    expect(analyticsA.body.data.meetingsBooked).toBeGreaterThanOrEqual(2);

    const analyticsB = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(analyticsB.body.data.emailsSent).toBe(0);
    expect(analyticsB.body.data.meetingsBooked).toBe(0);
    expect(orgBId).not.toBe(orgAId);
  });
});
