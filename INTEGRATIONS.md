# ekiddy Outreach AI — External Integrations Guide

Every external integration follows a strict contract:
1. Encrypted credential storage at rest (`AES-256-GCM`).
2. Never return raw API keys, secrets, or tokens to frontend clients.
3. Explicitly report whether the provider is running in **Live Mode** or **Test / Demo Mode** — never pretend an unconfigured service is live.

---

## 1. AI / LLM Providers

### 1.1 Google Gemini API
- **Env Variable**: `GEMINI_API_KEY` (or per-org encrypted credential in Settings -> Integrations).
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Features**: Structured JSON generation (`responseMimeType: "application/json"`) for company research, competitor analysis, ICP generation, personalized email writing, inbox reply classification, AI reply drafting, and autopilot insights.

### 1.2 OpenRouter API
- **Env Variable**: `OPENROUTER_API_KEY`
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Features**: Model selection across OpenAI, Anthropic, Mistral, and Llama families plus automatic fallback if primary Gemini requests fail or quota-limit.

### 1.3 Unconfigured / Demo Fallback
- If neither Gemini nor OpenRouter keys are configured, the backend executes deterministic heuristic structuring flagged with `aiMode: "demo"` and displays a clear warning indicator in the UI.

---

## 2. Email Sending & Inbound Providers

### 2.1 Resend / SMTP (`nodemailer`)
- **Env Variables**: `EMAIL_PROVIDER_API_KEY` (Resend) or per-`SendingAccount` SMTP (`host`, `port`, `user`, `pass`, `secure`) encrypted in MongoDB.
- **DNS Readiness**: Live `dns.resolveTxt` checks inspect `SPF` (`v=spf1`), `DMARC` (`_dmarc.<domain>`), and `DKIM` selector records and surface actionable DNS setup instructions.
- **Test / Sandbox Outbox Mode**: When `provider === 'sandbox'` or `campaign.testMode === true`, emails render completely, enforce suppression checks, assign deterministic `providerMessageId`s, and record full `EmailEvent` logs without dispatching external mail.

### 2.2 Provider Webhooks (`/api/webhooks/email`)
- Accepts delivery, bounce, open, click, complaint, and reply events signed with `EMAIL_WEBHOOK_SECRET` (HMAC-SHA256).
- Hard bounces and unsubscribe/complaint signals automatically append the recipient email to `SuppressionRecord`.

---

## 3. Licensed B2B Lead Data & Email Verification

- **Env Variable**: `DATA_PROVIDER_API_KEY`, `DATA_PROVIDER_TYPE` (`apollo` | `hunter` | `custom`), `EMAIL_VERIFIER_API_KEY`.
- **Supported Adapters**:
  - **Apollo / Hunter Compatible REST Adapter**: Real query & enrichment when configured.
  - **DNS MX + Syntax Verification**: Real verification of email syntax, disposable domain detection, and live DNS MX record checks (`dns.resolveMx`) combined with third-party SMTP verification when `EMAIL_VERIFIER_API_KEY` is configured.
  - **Demo Sample Directory**: When no paid B2B provider key is configured, searches return clearly marked `isDemoData: true` sample companies/contacts alongside any user-imported CSV/manual leads. Real user contacts are never fabricated.

---

## 4. Google Calendar Integration

- **Env Variables**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **OAuth Scopes**: `https://www.googleapis.com/auth/calendar.readonly`, `https://www.googleapis.com/auth/calendar.events`
- **Capabilities**: OAuth connect flow, calendar list, free/busy slot availability, event creation/rescheduling/cancellation, and timezone conversion.
- **Local Test Calendar Mode**: When Google OAuth credentials are not set, meetings persist in MongoDB with conflict-checked availability slots and shareable `/book/:slug` links marked `calendarProvider: 'local'`.

---

## 5. Payments & Credits (Razorpay)

- **Env Variables**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- **Flows**:
  1. **Create Order**: Backend creates an order via Razorpay Orders API (or Test Mode synthetic order when keys are absent/test-mode).
  2. **Payment Verification**: Verifies `HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)` and atomically credits the organization wallet using a unique idempotency key.
  3. **Webhooks (`/api/webhooks/razorpay`)**: Verifies `X-Razorpay-Signature` header (`HMAC-SHA256` over raw request body) for `payment.captured`, `payment.failed`, `refund.created`, and subscription lifecycle events.

---

## 6. Optional Firebase Authentication Exchange

- **Env Variable**: `FIREBASE_PROJECT_ID`
- Allows verifying Firebase ID tokens on `/api/auth/firebase` when configured alongside native JWT email/password authentication.
