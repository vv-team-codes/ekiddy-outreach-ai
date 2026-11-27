# Ekiddy Outreach AI — Security, Privacy & Compliance Architecture

## 1. Tenant Isolation & Role-Based Access Control (RBAC)
- Every business document (`Project`, `CompanyResearch`, `Competitor`, `ICP`, `Company`, `Contact`, `LeadList`, `EmailTemplate`, `EmailSequence`, `Campaign`, `SendingAccount`, `EmailEvent`, `Conversation`, `Message`, `Meeting`, `CreditTransaction`, `Subscription`, `Integration`, `Notification`, `AuditLog`, `SuppressionRecord`, `BackgroundJob`) carries an indexed `organizationId`.
- The `authenticate` middleware verifies the JWT signature and validates active `Membership` for the requested `x-organization-id` before any controller runs.
- Every query and update filters explicitly by `organizationId: req.auth!.organizationId`.
- Sensitive endpoints (`billing`, `integrations`, `team invitations`, `settings`, `audit-logs`) enforce role checks (`owner`, `admin`).

## 2. SSRF Protection on Company Research
Implemented in `backend/src/utils/urlSecurity.ts`:
- Allows only `http:` and `https:` URLs and blocks embedded credentials (`user:pass@`).
- Rejects `.local`, `.internal`, `.localhost`, and `localhost`.
- Resolves target DNS (`dns.lookup(..., { all: true })`) and validates every returned IPv4/IPv6 address against RFC1918, loopback (`127.0.0.0/8`, `::1`), link-local / cloud metadata (`169.254.0.0/16`), CGNAT (`100.64.0.0/10`), and IPv6 ULA (`fc00::/7`, `fe80::/10`).
- Fetches manually without blind auto-redirects, validating every redirect hop's resolved IP before following, capping response size (`1.5 MB`) and timeout (`8s`).

## 3. Secrets & Credential Encryption at Rest
- Third-party integration keys (`gemini`, `openrouter`, `apollo`, `hunter`, `google_calendar`, `resend`, `smtp`, `razorpay`) and `SendingAccount` configs are encrypted using **AES-256-GCM** with unique random 12-byte IVs and authentication tags.
- Mongoose schemas mark `encryptedCredentials`, `encryptedConfig`, `passwordHash`, and token hashes as `select: false`.
- API responses only expose masked key previews (`maskedPreview`) and connection statuses.

## 4. Email Deliverability & Opt-Out Compliance
- Automated outbound campaigns require explicit user approval (`campaign.status = 'Approved'`) prior to activation.
- All outbound dispatches check `SuppressionRecord` first and skip opted-out, bounced, or complained emails.
- Inbound replies classified as `Unsubscribe` immediately append the sender email to `SuppressionRecord` and update contact stage to `unsubscribed`.
- Live DNS inspection checks `SPF`, `DMARC`, and `DKIM` TXT records and provides setup guidance.

## 5. Webhook & Billing Integrity
- Razorpay payment verification checks `HMAC-SHA256(orderId + "|" + paymentId, secret)`.
- Razorpay and Email webhooks validate signatures with constant-time comparison (`crypto.timingSafeEqual`) against the raw request buffer.
- Credit grants and usage deductions require a unique `(organizationId, idempotencyKey)` pair enforced by a MongoDB unique compound index, preventing double deductions or double credit grants.
