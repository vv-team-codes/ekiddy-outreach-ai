# ekiddy Outreach AI

An independent, full-stack AI-powered B2B sales intelligence, prospecting, email outreach automation, AI reply management, meeting scheduling, and analytics SaaS platform.

---

## Key Capabilities

- **Website-First Onboarding & Company Research AI**: Enter your website URL to extract products, services, pricing, positioning, and USPs via SSRF-safe crawling + Gemini/OpenRouter structured JSON analysis.
- **Competitor Discovery & Comparison**: Discover and compare competitors, refresh analyses, and uncover positioning gaps.
- **Ideal Customer Profile (ICP) Engine**: Generate, score, customize, and duplicate segmented ICPs.
- **Company & People Search**: Search B2B datasets (with transparent Demo Sample mode when paid data providers are unconfigured), import/export CSVs, enrich profiles, detect duplicates, and verify email addresses (`verified`, `unverified`, `unknown`, `invalid`).
- **AI Email Writer & 11-Step Campaign Builder**: Generate research-grounded emails in 5 tones, construct multi-step follow-up sequences, enforce explicit approval gates, and verify SPF/DKIM/DMARC DNS records.
- **Background Automation (Redis + BullMQ)**: Asynchronous queues for research, enrichment, verification, scheduled campaign sending, follow-ups, and inbox sync.
- **AI Inbox & Meeting Booking**: Classify replies, enforce opt-out suppressions immediately, draft approval-gated replies, and schedule meetings via Google Calendar or built-in shareable booking links (`/book/:slug`).
- **Analytics, AI Autopilot & Razorpay Billing**: Real MongoDB-backed metrics and Recharts visualizations, permission-controlled AI recommendations, idempotent credit wallet, and Razorpay checkout + webhook verification.

---

## Documentation Index

- [Project Plan & Roadmap](PROJECT_PLAN.md)
- [Technical Architecture](ARCHITECTURE.md)
- [Database Schema](DATABASE_SCHEMA.md)
- [API Documentation](API_DOCUMENTATION.md)
- [External Integrations](INTEGRATIONS.md)
- [Development Log](DEVELOPMENT_LOG.md)
- [Deployment & Backup Guide](docs/DEPLOYMENT.md)

---

## Quick Start (Local Development)

1. Copy `.env.example` to `.env` and fill in optional credentials (local mode works out of the box with embedded MongoDB and in-process queue fallback if MongoDB/Redis URLs are omitted):
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build shared types and start backend + frontend in development:
   ```bash
   npm run build:shared
   npm run dev
   ```
4. Run full test suites:
   ```bash
   npm test
   ```

## Docker Production Deployment (`app.ekiddy.com`)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for `docker-compose.yml` and Caddy HTTPS setup.
