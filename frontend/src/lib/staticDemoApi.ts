import { CREDIT_COSTS, CREDIT_PACKS, INTEGRATION_PROVIDERS, SUBSCRIPTION_PLANS } from '@ekiddy/shared';
import { useAppStore } from '@/stores/appStore';

interface StaticState {
  onboarding: { currentStep: number; completed: boolean; websiteUrl?: string; researchId?: string };
  researches: Array<Record<string, unknown>>;
  competitors: Array<Record<string, unknown>>;
  icps: Array<Record<string, unknown>>;
  companies: Array<Record<string, unknown>>;
  contacts: Array<Record<string, unknown>>;
  lists: Array<Record<string, unknown>>;
  templates: Array<Record<string, unknown>>;
  campaigns: Array<Record<string, unknown>>;
  sendingAccounts: Array<Record<string, unknown>>;
  suppressions: Array<Record<string, unknown>>;
  threads: Array<Record<string, unknown>>;
  messagesByThread: Record<string, Array<Record<string, unknown>>>;
  meetings: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
}

const STORAGE_KEY = 'ekiddy-static-workspace-v1';

function loadState(): StaticState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StaticState;
  } catch {
    // ignore storage errors
  }
  return {
    onboarding: { currentStep: 1, completed: false },
    researches: [],
    competitors: [],
    icps: [],
    companies: [],
    contacts: [],
    lists: [],
    templates: [],
    campaigns: [],
    sendingAccounts: [
      {
        _id: 'snd_sandbox_1',
        email: 'outreach@sandbox.ekiddy.local',
        fromName: 'ekiddy Workspace',
        domain: 'sandbox.ekiddy.local',
        provider: 'sandbox',
        dailyLimit: 50,
        sentToday: 0,
        verified: true,
        status: 'active',
        dnsStatus: {
          spfValid: true,
          dkimConfigured: true,
          dmarcValid: true,
          guidance: ['Static preview Sandbox Outbox active.']
        }
      }
    ],
    suppressions: [],
    threads: [],
    messagesByThread: {},
    meetings: [],
    transactions: [
      {
        _id: 'tx_welcome',
        type: 'grant',
        operation: 'welcome_credits',
        amount: 500,
        balanceAfter: 500,
        description: 'Welcome credit grant for ekiddy Workspace',
        createdAt: new Date().toISOString()
      }
    ],
    invoices: [],
    notifications: []
  };
}

function saveState(state: StaticState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function isStaticOnlyHost(): boolean {
  if (typeof window === 'undefined') return false;
  return !import.meta.env.VITE_API_URL && window.location.hostname.endsWith('github.io');
}

export function initStaticDemoSession(websiteUrl?: string) {
  const store = useAppStore.getState();
  const state = loadState();
  if (websiteUrl) {
    state.onboarding.websiteUrl = websiteUrl;
    saveState(state);
  }
  const org = {
    _id: 'static_demo_org',
    name: 'ekiddy Workspace (Preview)',
    slug: 'ekiddy-preview',
    website: websiteUrl || state.onboarding.websiteUrl,
    creditBalance: store.organization?.creditBalance ?? 500,
    plan: 'free' as const,
    dailySendLimit: 50,
    bookingSlug: 'ekiddy-preview',
    onboarding: state.onboarding
  };
  store.setSession({
    token: 'static-demo-token',
    user: {
      id: 'static_demo_user',
      fullName: 'Workspace Owner',
      email: 'preview@ekiddy.local',
      emailVerified: true
    },
    organization: org,
    organizations: [{ organization: org, role: 'owner' }],
    role: 'owner'
  });
}

function spendCredits(state: StaticState, cost: number, operation: string, description: string) {
  const store = useAppStore.getState();
  const current = store.organization?.creditBalance ?? 500;
  const next = Math.max(0, current - cost);
  store.updateCreditBalance(next);
  state.transactions.unshift({
    _id: `tx_${Date.now()}`,
    type: 'usage',
    operation,
    amount: -cost,
    balanceAfter: next,
    description,
    createdAt: new Date().toISOString()
  });
}

export async function handleStaticDemoApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const method = (options.method || 'GET').toUpperCase();
  const body =
    typeof options.body === 'string' && options.body ? (JSON.parse(options.body) as Record<string, unknown>) : {};
  const [cleanPath, queryStr = ''] = path.split('?');
  const params = new URLSearchParams(queryStr);
  const state = loadState();
  const store = useAppStore.getState();

  const reply = (data: unknown, meta?: Record<string, unknown>) => {
    saveState(state);
    return { data: data as T, meta };
  };

  if (cleanPath === '/api/credits/balance') {
    return reply({
      creditBalance: store.organization?.creditBalance ?? 500,
      plan: store.organization?.plan ?? 'free',
      dailySendLimit: 50,
      costs: CREDIT_COSTS
    });
  }

  if (cleanPath === '/api/credits/transactions') {
    return reply(state.transactions, { page: 1, limit: 20, total: state.transactions.length, totalPages: 1 });
  }

  if (cleanPath.endsWith('/onboarding')) {
    if (method === 'PATCH') {
      state.onboarding = { ...state.onboarding, ...body };
      if (body.approved) {
        state.onboarding.completed = true;
        state.onboarding.currentStep = 8;
      }
    }
    return reply(state.onboarding);
  }

  if (cleanPath === '/api/research/company' && method === 'GET') return reply(state.researches);
  if (cleanPath === '/api/research/company' && method === 'POST') {
    const rawUrl = String(body.websiteUrl || 'https://example.com');
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const host = new URL(url).hostname.replace(/^www\./, '');
    const companyName = host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
    const doc = {
      _id: `res_${Date.now()}`,
      websiteUrl: url,
      status: 'completed',
      progress: 100,
      companyName,
      industry: 'B2B SaaS & Technology',
      companyOverview: `${companyName} delivers modern B2B workflow software accessible via ${url}.`,
      productSummary: `${companyName} core cloud platform and automation suite.`,
      serviceSummary: 'Onboarding, customer success, and API integrations.',
      pricingSummary: 'Transparent self-serve & team subscription plans.',
      targetMarket: 'Growth-stage B2B revenue and operations leaders.',
      businessPositioning: `Positioned around fast deployment and measurable ROI for ${companyName} buyers.`,
      uniqueSellingPoints: ['Rapid self-serve onboarding', 'Unified automation workflows'],
      customerPersonas: [{ role: 'VP of Revenue Operations', painPoints: ['Manual outreach'], goals: ['Booked demos'] }],
      suggestedSegments: [{ name: 'Mid-Market SaaS', description: '25-250 employee software companies', rationale: 'High velocity' }],
      suggestedOpportunities: [`Target VP Revenue Ops teams with ${companyName} positioning`],
      aiMode: 'demo',
      aiProvider: 'static-preview',
      createdAt: new Date().toISOString()
    };
    state.researches.unshift(doc);
    spendCredits(state, CREDIT_COSTS.company_research, 'company_research', `Research ${host}`);
    return reply({ research: doc });
  }
  if (cleanPath.startsWith('/api/research/company/') && method === 'PATCH') {
    const id = cleanPath.split('/').pop();
    const item = state.researches.find((r) => r._id === id);
    if (item) Object.assign(item, body);
    return reply(item || state.researches[0]);
  }

  if (cleanPath === '/api/competitors' && method === 'GET') return reply(state.competitors);
  if (cleanPath === '/api/competitors/discover' && method === 'POST') {
    const item = {
      _id: `comp_${Date.now()}`,
      name: 'Enterprise Legacy Suite',
      website: 'https://example-competitor.com',
      industry: 'B2B SaaS',
      positioning: 'Heavyweight multi-month enterprise implementation.',
      targetAudience: 'Fortune 1000 IT procurement',
      comparisonNotes: 'ekiddy customers win on rapid onboarding and unified automation.',
      opportunities: ['Target mid-market teams seeking faster time-to-value'],
      source: 'ai'
    };
    state.competitors.unshift(item);
    spendCredits(state, CREDIT_COSTS.competitor_discovery, 'competitor_discovery', 'AI competitor discovery');
    return reply({ competitors: state.competitors });
  }
  if (cleanPath === '/api/competitors' && method === 'POST') {
    const item = { _id: `comp_${Date.now()}`, ...body, opportunities: [], source: 'manual' };
    state.competitors.unshift(item);
    return reply(item);
  }

  if (cleanPath === '/api/icp' && method === 'GET') return reply(state.icps);
  if (cleanPath === '/api/icp/generate' && method === 'POST') {
    const item = {
      _id: `icp_${Date.now()}`,
      name: 'Growth-Stage B2B Revenue Leaders',
      industries: ['B2B SaaS', 'FinTech'],
      locations: ['United States', 'United Kingdom', 'India'],
      companySizes: ['11-50', '51-200'],
      jobTitles: ['VP of Sales', 'Head of Growth'],
      departments: ['Sales', 'Revenue Operations'],
      businessChallenges: ['Low reply velocity', 'Fragmented prospecting tools'],
      relevanceScore: 92,
      segmentTag: 'Mid-Market SaaS'
    };
    state.icps.unshift(item);
    spendCredits(state, CREDIT_COSTS.icp_generation, 'icp_generation', 'AI ICP generation');
    return reply({ icps: state.icps });
  }

  if (cleanPath === '/api/companies' && method === 'GET') {
    return reply(state.companies, { page: 1, limit: 15, total: state.companies.length, totalPages: 1 });
  }
  if (cleanPath === '/api/companies/search' && method === 'POST') {
    const demo = [
      {
        _id: 'cmp_1',
        name: 'Northstar Revenue Cloud',
        domain: 'northstarcloud.example',
        industry: 'B2B SaaS',
        location: 'Austin, TX',
        employeeRange: '51-200',
        source: 'demo',
        isDemoData: true
      }
    ];
    if (state.companies.length === 0) state.companies.push(...demo);
    spendCredits(state, CREDIT_COSTS.company_search, 'company_search', 'Company search');
    return reply({ mode: 'demo', provider: 'sample-directory', companies: state.companies });
  }

  if (cleanPath === '/api/people' && method === 'GET') {
    return reply(state.contacts, { page: 1, limit: 15, total: state.contacts.length, totalPages: 1 });
  }
  if (cleanPath === '/api/people/search' && method === 'POST') {
    const demo = [
      {
        _id: 'ppl_1',
        fullName: 'Maya Lin',
        jobTitle: 'VP of Revenue Operations',
        companyName: 'Northstar Revenue Cloud',
        email: 'maya.lin@northstarcloud.example',
        emailStatus: 'unverified',
        leadScore: 91,
        stage: 'new',
        isDemoData: true
      }
    ];
    if (state.contacts.length === 0) state.contacts.push(...demo);
    spendCredits(state, CREDIT_COSTS.people_search, 'people_search', 'People search');
    return reply({ mode: 'demo', contacts: state.contacts });
  }

  if (cleanPath === '/api/leads/lists' && method === 'GET') return reply(state.lists);
  if (cleanPath === '/api/leads/lists' && method === 'POST') {
    const item = { _id: `lst_${Date.now()}`, ...body, contactIds: [] };
    state.lists.unshift(item);
    return reply(item);
  }

  if (cleanPath === '/api/emails/generate' && method === 'POST') {
    spendCredits(state, CREDIT_COSTS.ai_email_generation, 'ai_email_generation', 'AI email draft');
    return reply({
      subject: `Quick idea for ${String(body.companyName || 'your team')}`,
      openingLine: `As ${String(body.prospectDesignation || 'a leader')} at ${String(body.companyName || 'your company')},`,
      body: `Hi ${String(body.prospectName || 'there')},\n\nWe help teams achieve ${String(body.campaignObjective || 'pipeline growth')} with ${String(body.productOrService || 'ekiddy Outreach AI')}.\n\nOpen to a 15-minute chat?\n\nBest,\nWorkspace Team`,
      cta: 'Open to a 15-minute chat?',
      followUpMessage: 'Following up briefly on my earlier note.',
      aiMode: 'demo',
      aiProvider: 'static-preview',
      aiModel: 'deterministic-v1'
    });
  }
  if (cleanPath === '/api/emails/templates') {
    if (method === 'POST') {
      const tpl = { _id: `tpl_${Date.now()}`, ...body };
      state.templates.unshift(tpl);
      return reply(tpl);
    }
    return reply(state.templates);
  }

  if (cleanPath === '/api/campaigns' && method === 'GET') return reply(state.campaigns);
  if (cleanPath === '/api/campaigns' && method === 'POST') {
    const camp = {
      _id: `camp_${Date.now()}`,
      ...body,
      status: body.status || 'Ready for review',
      testMode: true,
      stats: { totalContacts: 1, sent: 0, delivered: 0, bounced: 0, replied: 0, positiveReplies: 0, meetingsBooked: 0 }
    };
    state.campaigns.unshift(camp);
    return reply(camp);
  }

  if (cleanPath === '/api/sending-accounts') {
    return reply({ accounts: state.sendingAccounts, suppressions: state.suppressions });
  }

  if (cleanPath === '/api/inbox/counts') {
    return reply({
      all: state.threads.length,
      needs_reply: 0,
      interested: 0,
      not_interested: 0,
      meetings: state.threads.filter((t) => t.folder === 'meetings').length,
      out_of_office: 0,
      unsubscribed: 0,
      archived: 0
    });
  }
  if (cleanPath === '/api/inbox/threads') return reply(state.threads);
  if (cleanPath === '/api/conversations/simulate-inbound' && method === 'POST') {
    const id = `conv_${Date.now()}`;
    const conv = {
      _id: id,
      subject: String(body.subject || 'Re: Outreach'),
      folder: 'meetings',
      classification: 'Meeting request',
      unreadCount: 1,
      lastMessageAt: new Date().toISOString(),
      lastMessageSnippet: String(body.bodyText || '').slice(0, 120),
      contactId: { _id: 'ppl_1', fullName: String(body.fromEmail || 'Prospect'), email: String(body.fromEmail || '') }
    };
    state.threads.unshift(conv);
    state.messagesByThread[id] = [
      {
        _id: `msg_${Date.now()}`,
        direction: 'inbound',
        fromEmail: String(body.fromEmail || ''),
        toEmail: 'outreach@sandbox.ekiddy.local',
        subject: conv.subject,
        bodyText: String(body.bodyText || ''),
        status: 'received',
        isAiDraft: false,
        createdAt: new Date().toISOString()
      }
    ];
    return reply({ conversation: conv, classification: 'Meeting request' });
  }
  if (cleanPath.startsWith('/api/conversations/')) {
    const id = cleanPath.split('/')[3];
    const conv = state.threads.find((t) => t._id === id);
    return reply({ conversation: conv, messages: state.messagesByThread[id] || [] });
  }

  if (cleanPath === '/api/meetings/availability') {
    const dateStr = params.get('date') || new Date().toISOString().slice(0, 10);
    return reply({
      date: dateStr,
      timezone: params.get('timezone') || 'UTC',
      calendarProvider: 'local',
      slots: ['09', '10', '11', '14', '15'].map((h) => ({
        startTime: `${dateStr}T${h}:00:00.000Z`,
        endTime: `${dateStr}T${h}:30:00.000Z`,
        available: true
      }))
    });
  }
  if (cleanPath === '/api/meetings' && method === 'GET') {
    return reply({ bookingSlug: 'ekiddy-preview', meetings: state.meetings });
  }
  if (cleanPath === '/api/meetings' && method === 'POST') {
    const m = { _id: `mtg_${Date.now()}`, ...body, status: 'scheduled', calendarProvider: 'local' };
    state.meetings.push(m);
    return reply(m);
  }

  if (cleanPath === '/api/analytics/overview') {
    return reply({
      companiesResearched: state.researches.length,
      companiesDiscovered: state.companies.length,
      contactsDiscovered: state.contacts.length,
      verifiedContacts: state.contacts.filter((c) => c.emailStatus === 'verified').length,
      emailsSent: 0,
      deliveredEmails: 0,
      bouncedEmails: 0,
      replies: state.threads.length,
      positiveReplies: state.threads.length,
      meetingsBooked: state.meetings.length,
      campaignConversionRate: 0,
      creditsUsed: Math.max(0, 500 - (store.organization?.creditBalance ?? 500)),
      estimatedSpendUsd: 0
    });
  }
  if (cleanPath === '/api/analytics/trends') return reply([]);
  if (cleanPath === '/api/analytics/campaigns') return reply(state.campaigns);
  if (cleanPath === '/api/analytics/autopilot/recommendations') {
    return reply({
      autopilotSettings: {
        enabled: false,
        requireApprovalForCampaignLaunch: true,
        requireApprovalForSpendChange: true,
        requireApprovalForReplies: true
      },
      aiMode: 'demo',
      recommendations: [
        {
          id: 'rec_1',
          category: 'segment',
          priority: 'high',
          title: 'Complete onboarding and launch your first sandbox campaign',
          rationale: 'Guided onboarding maps competitors and ICPs before outreach begins.',
          suggestedAction: 'Run website research and approve a starter campaign.',
          requiresApproval: true
        }
      ]
    });
  }

  if (cleanPath === '/api/billing/plans') {
    return reply({ plans: SUBSCRIPTION_PLANS, creditPacks: CREDIT_PACKS, razorpayMode: 'test_sandbox' });
  }
  if (cleanPath === '/api/billing/invoices') return reply(state.invoices);
  if (cleanPath === '/api/billing/razorpay/order' && method === 'POST') {
    const pack = CREDIT_PACKS.find((p) => p.id === body.packId) || CREDIT_PACKS[0];
    return reply({
      mode: 'test',
      keyId: 'rzp_test_static',
      orderId: `order_static_${Date.now()}`,
      amountInPaise: pack.amountInPaise,
      description: pack.name,
      testPaymentPreview: { paymentId: `pay_static_${Date.now()}`, signature: 'static_test_sig' }
    });
  }
  if (cleanPath === '/api/billing/razorpay/verify' && method === 'POST') {
    const pack = CREDIT_PACKS.find((p) => p.id === body.packId) || CREDIT_PACKS[0];
    const next = (store.organization?.creditBalance ?? 500) + pack.credits;
    store.updateCreditBalance(next);
    state.transactions.unshift({
      _id: `tx_${Date.now()}`,
      type: 'purchase',
      operation: 'credit_pack_purchase',
      amount: pack.credits,
      balanceAfter: next,
      description: `Purchased ${pack.name}`,
      createdAt: new Date().toISOString()
    });
    state.invoices.unshift({
      invoiceNumber: `INV-${Date.now()}`,
      amountInPaise: pack.amountInPaise,
      status: 'paid',
      description: `Purchased ${pack.name}`,
      issuedAt: new Date().toISOString()
    });
    return reply({ verified: true, balanceAfter: next, creditsAdded: pack.credits });
  }

  if (cleanPath === '/api/integrations') {
    return reply(
      INTEGRATION_PROVIDERS.map((provider) => ({
        provider,
        status: 'disconnected',
        configuredBy: 'none',
        maskedPreview: ''
      }))
    );
  }
  if (cleanPath === '/api/settings/notifications') return reply(state.notifications);
  if (cleanPath === '/api/settings/audit-logs') return reply([]);
  if (cleanPath.includes('/members')) return reply([]);

  return reply({});
}
