# Ekiddy Outreach AI — Project Plan & Development Roadmap

## 1. Product Overview

**Ekiddy Outreach AI** is a full-stack B2B sales intelligence, prospecting, AI email outreach, reply management, meeting booking, and analytics SaaS platform inspired by the publicly observable workflows of Explee (`https://explee.com/`).

A business owner enters their company website URL and the platform orchestrates a connected end-to-end revenue workflow:

1. **Company Research** — SSRF-safe website crawl and AI analysis of products, services, pricing, positioning, and USPs.
2. **Competitor Discovery** — Competitor identification, comparison matrix, and differentiation opportunities.
3. **ICP Engine** — Multi-segment Ideal Customer Profiles with buyer roles, pain points, and relevance scoring.
4. **Company & People Search** — Licensed B2B data provider integration (plus transparent Sample Dataset mode and CSV import/export), contact enrichment, duplicate detection, lead scoring, and email verification (`verified`, `unverified`, `unknown`, `invalid`).
5. **AI Email Writer** — Research-grounded personalized email and follow-up generation across 5 selectable tones.
6. **Campaign Builder & Outreach Engine** — 11-step campaign wizard, approval gate, sending account & DNS (SPF/DKIM/DMARC) guidance/checks, BullMQ rate-limited delivery queues, suppression enforcement, and delivery/bounce webhooks.
7. **AI Inbox** — CRM-style conversation center with AI reply classification, opt-out auto-suppression, and approval-gated AI reply drafts.
8. **Meeting Booking** — Google Calendar OAuth integration (plus local test calendar mode), timezone-aware availability, shareable booking links, rescheduling, and cancellations.
9. **AI Autopilot & Analytics** — Database-backed metrics/charts and AI recommendations gated by explicit organization authorization controls.
10. **Billing & Credit Wallet** — Atomic idempotent credit wallet, cost previews, subscription plans, invoices, and Razorpay checkout + webhook verification.

---

## 2. Repository Discovery & Baseline State

- **Initial Workspace State**: Empty directory (`c:\Users\iyapp\OneDrive - ELCOT\vv\EKIDDY OUTREACH AI`). No pre-existing source code, packages, or databases were present.
- **Runtime Environment**: Windows (`win32 x64`), Node.js `v24.13.0`, npm `11.6.2`, pnpm `11.5.1`, Git installed. Docker, `mongod`, and `redis-server` are not pre-installed globally on the host, so local development supports embedded `mongodb-memory-server` and an in-process BullMQ-compatible queue fallback when `MONGODB_URI` / `REDIS_URL` are unset, while production and Docker Compose use MongoDB, Redis + BullMQ workers, and Caddy.

---

## 3. Phased Development Roadmap

| Phase | Scope | Key Deliverables |
|---|---|---|
| **Phase 1** | Repository Inspection, Architecture & Planning | Monorepo layout (`frontend/`, `backend/`, `shared/`, `docs/`, `infrastructure/`), `PROJECT_PLAN.md`, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`, `INTEGRATIONS.md`, `DEVELOPMENT_LOG.md`, `README.md`, `.env.example` |
| **Phase 2** | Shared Contracts, Database & Backend Core | `@ekiddy/shared` Zod types/constants, Express + TS server, Mongoose connection + all 24 schemas & indexes, AES-256-GCM encryption, SSRF validator, structured logger, rate limiter, error middleware |
| **Phase 3** | Design System & Frontend Shell | Vite + React + TS + Tailwind CSS, light/dark themes, reusable UI component library (`Button`, `Input`, `Dropdown`, `Modal`, `Table`, `Sidebar`, `Chart`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`), Landing page, App Shell |
| **Phase 4** | Auth, Onboarding, Company Research & Competitors | Signup/login/logout, email verification, forgot/reset password, org & team invites, RBAC, 8-step persistent onboarding, SSRF-safe web scraper, Gemini/OpenRouter + Demo AI engine, BullMQ worker, Competitor module |
| **Phase 5** | ICP Engine, Company Search & People Search | ICP generator/editor/duplicator/scorer, Company Search, People Search, Lead Lists, CSV import/export, enrichment, DNS MX + provider email verification, duplicate detection |
| **Phase 6** | AI Email Writer | Research-grounded AI email & follow-up writer, 5 tones, variable previews, regenerate/alternatives, templates & drafts |
| **Phase 7** | Campaign Builder & Email Outreach Engine | 11-step campaign builder, approval lifecycle, SendingAccount + SPF/DKIM/DMARC DNS checker, SMTP/Resend/Sandbox sender, BullMQ sequence scheduler, rate limiting, idempotency, suppression list, webhooks |
| **Phase 8** | AI Inbox & Conversation Management | CRM inbox folders, threaded messages, contact/company sidebar, notes, AI reply classification, immediate opt-out suppression, approval-gated AI reply drafts, inbound webhook simulator |
| **Phase 9** | Meeting Booking & Google Calendar | Google OAuth2 + Calendar API integration, local test calendar fallback, availability slot engine, timezone support, public `/book/:slug` flow, reschedule/cancel |
| **Phase 10** | AI Autopilot & Analytics | Real MongoDB aggregation analytics + Recharts dashboards, AI Autopilot campaign diagnostic recommendations & permission gates |
| **Phase 11** | Credits, Razorpay Billing & Settings | Credit wallet, idempotent deduction, pre-operation cost estimates, Razorpay orders + HMAC verification + webhooks, subscription plans, invoices, Settings pages (Profile, Org, Team, Billing, API Keys, AI Model, Email, Calendar, Data Provider, Notifications, Security, Theme, Usage) |
| **Phase 12** | QA Testing & Docker Deployment | Vitest + Supertest (18 core scenarios), React Testing Library, Playwright E2E, `Dockerfile`s, `docker-compose.yml`, `Caddyfile` (`app.ekiddy.com`), backup/deploy docs |

---

## 4. Engineering Assumptions & Principles

1. **No Fabricated Data**: Sample/demo datasets and heuristic AI fallbacks are explicitly flagged (`isDemo: true`, visible UI banners). Live B2B searches never invent email addresses or LinkedIn URLs.
2. **Idempotent Credit Accounting**: Every paid operation uses a deterministic or caller-supplied `idempotencyKey` enforced via a unique MongoDB compound index `(organizationId, idempotencyKey)` on `CreditTransaction`.
3. **Human-in-the-Loop Safety**: Campaigns require explicit user approval prior to activation; AI inbox reply drafts require approval before dispatch by default; unsubscribe requests immediately add the email to `SuppressionRecord`.
4. **Tenant Isolation**: Every domain model is scoped by `organizationId`, enforced in middleware and Mongoose queries.
