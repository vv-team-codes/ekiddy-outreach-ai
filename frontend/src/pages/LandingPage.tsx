import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Globe,
  Inbox,
  MailCheck,
  Moon,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Target,
  Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CREDIT_COSTS, SUBSCRIPTION_PLANS } from '@ekiddy/shared';
import { Badge, Button } from '@/components/ui';
import { useAppStore } from '@/stores/appStore';
import { getSiteUrl } from '@/lib/siteBase';

type PreviewTab = 'brief' | 'icp' | 'email' | 'calendar';

const SAMPLE_PRESETS = [
  {
    domain: 'https://stripe.com',
    label: 'stripe.com',
    company: 'Stripe',
    industry: 'FinTech & Payments Infrastructure',
    positioning: 'Programmable financial infrastructure for internet businesses from startups to global enterprises.',
    icpTitle: 'VP of Finance / Head of Platform',
    icpScore: 95,
    subject: 'Reducing checkout drop-off across Stripe markets',
    emailBody:
      'Hi Elena,\n\nSaw Stripe expanding multi-currency treasury tooling for global SaaS teams. We help finance leaders turn automated outbound research into qualified enterprise demos without adding SDR headcount.\n\nOpen to comparing notes for 12 minutes Thursday?'
  },
  {
    domain: 'https://linear.app',
    label: 'linear.app',
    company: 'Linear',
    industry: 'B2B Developer & Product Software',
    positioning: 'Purpose-built issue tracking and product planning engineered for high-velocity software teams.',
    icpTitle: 'VP of Engineering / Head of Product Ops',
    icpScore: 93,
    subject: 'Outbound workflow for Linear enterprise teams',
    emailBody:
      'Hi Marcus,\n\nWith Linear powering high-velocity product orgs, reaching engineering VPs at 100–500 person SaaS firms takes verified domain signals rather than generic blasts.\n\nWorth a quick walkthrough this week?'
  },
  {
    domain: 'https://notion.so',
    label: 'notion.so',
    company: 'Notion',
    industry: 'Connected Workspace & AI Docs',
    positioning: 'Unified wiki, docs, and project workspace enhanced with built-in AI knowledge retrieval.',
    icpTitle: 'Chief of Staff / VP of Operations',
    icpScore: 91,
    subject: 'Scaling ops team adoption around Notion',
    emailBody:
      'Hi Priya,\n\nNoticed Notion rolling out deeper enterprise knowledge workflows. Our AI agent identifies operations leaders actively consolidating internal tools and books warm discovery slots.\n\nOpen to a 10-min intro?'
  }
];

export function LandingPage() {
  const [websiteInput, setWebsiteInput] = useState('');
  const [activeTab, setActiveTab] = useState<PreviewTab>('brief');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [monthlyProspects, setMonthlyProspects] = useState(250);
  const navigate = useNavigate();
  const { token, theme, toggleTheme, setPendingWebsiteUrl } = useAppStore();

  const activePreview = useMemo(() => {
    const clean = websiteInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const preset = SAMPLE_PRESETS[selectedPresetIdx];
    if (!clean) return preset;
    const brand = clean.split('.')[0];
    const companyName = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : preset.company;
    return {
      ...preset,
      label: clean,
      company: companyName,
      subject: `Quick pipeline idea for ${companyName}`,
      emailBody: `Hi Alex,\n\nReviewed ${clean}'s positioning and mapped high-fit decision-makers across your target segment. Our outreach engine handles verified enrichment, personalized follow-ups, and calendar handoff.\n\nOpen to a 15-minute walkthrough?`
    };
  }, [websiteInput, selectedPresetIdx]);

  const estimatedCredits = useMemo(() => {
    const researchCost = CREDIT_COSTS.company_research + CREDIT_COSTS.competitor_discovery + CREDIT_COSTS.icp_generation;
    const perLeadCost =
      CREDIT_COSTS.email_verification + CREDIT_COSTS.ai_email_generation + CREDIT_COSTS.email_send;
    return researchCost + monthlyProspects * perLeadCost;
  }, [monthlyProspects]);

  const handleStartResearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (websiteInput.trim()) {
      setPendingWebsiteUrl(websiteInput.trim());
    }
    navigate(token ? '/app/onboarding' : '/register');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111318] dark:bg-[#0A0D12] dark:text-slate-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-stone-200/90 bg-[#FAF9F6]/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#0A0D12]/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white dark:bg-blue-600">
              e
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight">ekiddy Outreach AI</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-wider text-slate-600 md:flex dark:text-slate-300">
            <a href="#workflow" className="hover:text-slate-950 dark:hover:text-white">
              Workflow
            </a>
            <a href="#capabilities" className="hover:text-slate-950 dark:hover:text-white">
              Security
            </a>
            <a href="#pricing" className="hover:text-slate-950 dark:hover:text-white">
              Credits & Plans
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="rounded-lg p-2 text-slate-500 hover:bg-stone-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {token ? (
              <Link to="/app">
                <Button size="sm">Open Workspace</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Start Free</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Split Editorial Hero */}
      <section className="bg-ekiddy-grid border-b border-stone-200/80 dark:border-slate-800">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
          {/* Left Hero Column */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Autonomous B2B Revenue Engine
            </div>

            <h1 className="font-display mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              Enter your website. Let AI research, prospect, and book meetings.
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
              Paste your URL and ekiddy runs SSRF-safe company analysis, competitor benchmarking,
              verified decision-maker discovery, approval-gated sequences, AI reply triage, and
              calendar booking in one connected workspace.
            </p>

            {/* Primary URL Launch Bar */}
            <form
              onSubmit={handleStartResearch}
              className="mt-7 flex flex-col gap-2 rounded-2xl border border-stone-300 bg-white p-2 shadow-sm sm:flex-row dark:border-slate-700 dark:bg-[#111622]"
            >
              <div className="flex flex-1 items-center gap-2.5 px-3">
                <Globe className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <input
                  type="text"
                  value={websiteInput}
                  onChange={(e) => setWebsiteInput(e.target.value)}
                  placeholder="Enter your company website (e.g. https://yourcompany.com)"
                  className="w-full bg-transparent py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
              </div>
              <Button type="submit" size="lg" className="shrink-0">
                Analyze Company & Start
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {/* Quick Sample Domain Pills */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Preview with:</span>
              {SAMPLE_PRESETS.map((preset, idx) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setSelectedPresetIdx(idx);
                    setWebsiteInput(preset.domain);
                  }}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    selectedPresetIdx === idx && websiteInput === preset.domain
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'border-stone-300 bg-white hover:border-stone-400 dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                500 free welcome credits
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Sandbox outbox & demo mode
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Zero fabricated contacts
              </span>
            </div>
          </div>

          {/* Right Live Interactive Pipeline Preview */}
          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-lg dark:border-slate-700 dark:bg-[#111622]">
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  pipeline-preview://{activePreview.label}
                </span>
                <Badge tone="success">Live Interactive</Badge>
              </div>

              {/* Interactive Tabs */}
              <div className="grid grid-cols-4 border-b border-stone-200 bg-stone-50/50 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-950/40">
                {(
                  [
                    ['brief', '1. Brief'],
                    ['icp', '2. ICP'],
                    ['email', '3. Email'],
                    ['calendar', '4. Meeting']
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`py-2.5 transition-colors ${
                      activeTab === key
                        ? 'border-b-2 border-blue-700 bg-white text-blue-700 dark:border-blue-400 dark:bg-[#111622] dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Preview Body */}
              <div className="min-h-[260px] p-5 text-xs">
                {activeTab === 'brief' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-display text-base font-bold">{activePreview.company}</div>
                        <div className="text-slate-500">{activePreview.industry}</div>
                      </div>
                      <Badge tone="indigo">SSRF Verified</Badge>
                    </div>
                    <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      {activePreview.positioning}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-stone-200 p-2.5 dark:border-slate-800">
                        <div className="text-[10px] uppercase text-slate-400">Competitors</div>
                        <div className="mt-0.5 font-semibold">Mapped</div>
                      </div>
                      <div className="rounded-lg border border-stone-200 p-2.5 dark:border-slate-800">
                        <div className="text-[10px] uppercase text-slate-400">Personas</div>
                        <div className="mt-0.5 font-semibold">2 Identified</div>
                      </div>
                      <div className="rounded-lg border border-stone-200 p-2.5 dark:border-slate-800">
                        <div className="text-[10px] uppercase text-slate-400">Segments</div>
                        <div className="mt-0.5 font-semibold">Ready</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'icp' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold">Primary Ideal Customer Profile</span>
                      <Badge tone="success">Relevance {activePreview.icpScore}/100</Badge>
                    </div>
                    <div className="space-y-2 rounded-lg border border-stone-200 p-3 dark:border-slate-800">
                      <div><strong>Target Titles:</strong> {activePreview.icpTitle}</div>
                      <div><strong>Company Size:</strong> 51–200, 201–500 employees</div>
                      <div><strong>Verification Policy:</strong> DNS MX + SMTP status tagged</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="success">verified</Badge>
                      <Badge tone="warning">unverified</Badge>
                      <Badge tone="neutral">unknown</Badge>
                      <Badge tone="danger">invalid</Badge>
                    </div>
                  </div>
                )}

                {activeTab === 'email' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Subject: {activePreview.subject}
                      </span>
                      <Badge tone="indigo">Approval Gate</Badge>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 p-3 font-sans text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      {activePreview.emailBody}
                    </pre>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>SPF • DKIM • DMARC checked</span>
                      <span>Auto opt-out suppression active</span>
                    </div>
                  </div>
                )}

                {activeTab === 'calendar' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold">Shareable Booking Link</span>
                      <Badge tone="success">Google Calendar / Local</Badge>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[11px] text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-blue-400">
                      {getSiteUrl(`/book/${activePreview.company.toLowerCase()}`)}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {['09:30 UTC', '11:00 UTC', '14:30 UTC'].map((slot) => (
                        <div
                          key={slot}
                          className="rounded-lg border border-blue-200 bg-blue-50 py-2 text-center font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"
                        >
                          {slot}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Asymmetric Bento Workflow Section */}
      <section id="workflow" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Connected Architecture
          </span>
          <h2 className="font-display mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
            Every outbound stage persisted in MongoDB & BullMQ
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No disconnected spreadsheets. Each stage feeds structured intelligence into the next.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#111622]">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <Badge tone="indigo">Steps 1–4</Badge>
            </div>
            <h3 className="font-display mt-4 text-lg font-bold">
              SSRF-Safe Company Research & Competitor Benchmarking
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Validates DNS resolution against private IP ranges, crawls public pages, extracts pricing and
              positioning via Gemini or OpenRouter, and benchmarks competitors automatically.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              <Badge tone="neutral">Private IP Blocking</Badge>
              <Badge tone="neutral">Model Fallback</Badge>
              <Badge tone="neutral">Editable Briefs</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#111622]">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Target className="h-5 w-5" />
              </div>
              <Badge tone="success">MX Checked</Badge>
            </div>
            <h3 className="font-display mt-4 text-lg font-bold">
              ICP Engine & Honest Lead Verification
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Integrates licensed B2B data providers, CSV import/export with deduplication, lead scoring, and
              DNS MX verification—never inventing fake contacts.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#111622]">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Inbox className="h-5 w-5" />
              </div>
              <Badge tone="warning">Auto-Suppression</Badge>
            </div>
            <h3 className="font-display mt-4 text-lg font-bold">
              AI CRM Inbox & Reply Triage
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Classifies replies into Interested, Meeting Request, Question, OOO, or Unsubscribe. Opt-outs
              immediately add contacts to the suppression table; AI drafts wait for human approval.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#111622]">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                <MailCheck className="h-5 w-5" />
              </div>
              <Badge tone="neutral">11-Step Builder</Badge>
            </div>
            <h3 className="font-display mt-4 text-lg font-bold">
              Approval-Gated Campaigns & Deliverability Infrastructure
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Draft personalized emails in 5 tones, inspect live SPF/DKIM/DMARC DNS records, test safely in
              Sandbox Outbox mode, and dispatch rate-limited BullMQ sequences with webhook tracking.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-mono dark:border-slate-800">
                SPF: Checked
              </div>
              <div className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-mono dark:border-slate-800">
                DKIM: Guided
              </div>
              <div className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-mono dark:border-slate-800">
                DMARC: Checked
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-[#111622]">
            <div className="flex items-center gap-2.5">
              <CalendarCheck className="h-5 w-5 text-blue-600" />
              <h3 className="font-display text-base font-bold">Google Calendar & Shareable Booking Links</h3>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Connect Google Calendar via OAuth or run conflict-checked local availability slots with `/book/:slug`.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-[#111622]">
            <div className="flex items-center gap-2.5">
              <Bot className="h-5 w-5 text-emerald-600" />
              <h3 className="font-display text-base font-bold">Real Analytics & Permissioned AI Autopilot</h3>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Aggregates genuine MongoDB email, reply, and booking events with explicit authorization guardrails.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Interactive Credit Estimator */}
      <section
        id="capabilities"
        className="border-y border-stone-200/80 bg-white py-16 dark:border-slate-800 dark:bg-[#111622]/50"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-4 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              <ShieldCheck className="h-4 w-4" />
              Security & Tenant Integrity
            </div>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Transparent metering & enterprise-grade isolation
            </h2>
            <ul className="mt-5 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  AES-256-GCM encryption for API keys & SMTP credentials; zero secrets serialized to browsers.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  Idempotent credit deduction enforced by compound unique MongoDB indexes—never double-billed.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  HMAC-SHA256 verified Razorpay & Email provider webhooks with tenant-scoped audit trails.
                </span>
              </li>
            </ul>
          </div>

          {/* Interactive Credit Estimator */}
          <div className="rounded-2xl border border-stone-200 bg-[#FAF9F6] p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <h3 className="font-display text-sm font-bold">Interactive Credit Estimator</h3>
              </div>
              <Badge tone="success">500 Free Welcome Credits Included</Badge>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Target Verified Prospects / Month
                </span>
                <span className="font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
                  {monthlyProspects} prospects
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={2000}
                step={50}
                value={monthlyProspects}
                onChange={(e) => setMonthlyProspects(Number(e.target.value))}
                className="mt-2 w-full accent-blue-700"
                aria-label="Target prospects per month"
              />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-slate-800 dark:bg-[#111622]">
                  <div className="text-[10px] uppercase text-slate-400">Estimated Credits</div>
                  <div className="font-display mt-1 text-lg font-bold">{estimatedCredits.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-slate-800 dark:bg-[#111622]">
                  <div className="text-[10px] uppercase text-slate-400">Research + ICP</div>
                  <div className="font-display mt-1 text-lg font-bold">
                    {CREDIT_COSTS.company_research + CREDIT_COSTS.competitor_discovery + CREDIT_COSTS.icp_generation} cr
                  </div>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-slate-800 dark:bg-[#111622]">
                  <div className="text-[10px] uppercase text-slate-400">Per Prospect</div>
                  <div className="font-display mt-1 text-lg font-bold">
                    {CREDIT_COSTS.email_verification + CREDIT_COSTS.ai_email_generation + CREDIT_COSTS.email_send} cr
                  </div>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-slate-800 dark:bg-[#111622]">
                  <div className="text-[10px] uppercase text-slate-400">Free Trial Covers</div>
                  <div className="font-display mt-1 text-lg font-bold text-emerald-600">~120 leads</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Pay-as-you-grow plans
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Start with 500 welcome credits, buy packs via Razorpay, or subscribe as your team scales.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const featured = plan.id === 'growth';
            return (
              <div
                key={plan.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 ${
                  featured
                    ? 'border-slate-950 bg-slate-950 text-white shadow-lg dark:border-blue-500 dark:bg-[#141d2e]'
                    : 'border-stone-200 bg-white dark:border-slate-800 dark:bg-[#111622]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold">{plan.name}</h3>
                    {featured && <Badge tone="indigo">Recommended</Badge>}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold">
                      {plan.monthlyPriceInr === 0 ? 'Free' : `₹${plan.monthlyPriceInr.toLocaleString('en-IN')}`}
                    </span>
                    {plan.monthlyPriceInr > 0 && (
                      <span className={`text-xs ${featured ? 'text-slate-300' : 'text-slate-500'}`}>/mo</span>
                    )}
                  </div>
                  <div
                    className={`mt-1 text-xs font-medium ${
                      featured ? 'text-blue-300' : 'text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {plan.monthlyCredits.toLocaleString()} credits • {plan.dailySendLimit} emails/day
                  </div>
                  <ul
                    className={`mt-4 space-y-2 text-xs ${
                      featured ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link to="/register" className="mt-6 block">
                  <Button variant={featured ? 'secondary' : 'outline'} className="w-full" size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-stone-200 py-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        ekiddy Outreach AI — Independent B2B Sales Intelligence & Outreach Automation Platform.
      </footer>
    </div>
  );
}
