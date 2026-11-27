# Ekiddy Outreach AI — REST API Documentation

Base URL: `/api`  
Content-Type: `application/json`  
Authentication: `Authorization: Bearer <accessToken>`  
Tenant Header: `x-organization-id: <organizationId>` (defaults to user's `defaultOrganizationId`)

Standard Response Envelope:
```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```
Error Envelope:
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] }
}
```

---

## 1. Endpoint Groups

| Prefix | Responsibilities |
|---|---|
| `/api/health` | Liveness & readiness checks (MongoDB, Redis/Queue mode, version) |
| `/api/auth` | `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `POST /verify-email`, `POST /forgot-password`, `POST /reset-password`, `POST /firebase` |
| `/api/users` | `GET /profile`, `PATCH /profile`, `PATCH /password`, `PATCH /preferences` |
| `/api/organizations` | `GET /`, `POST /`, `PATCH /:id`, `GET /:id/members`, `POST /:id/invitations`, `POST /invitations/accept`, `PATCH /:id/members/:memberId`, `GET /:id/onboarding`, `PATCH /:id/onboarding` |
| `/api/projects` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| `/api/research` | `POST /company`, `GET /company`, `GET /company/:id`, `PATCH /company/:id`, `POST /company/:id/retry`, `GET /jobs/:jobId` |
| `/api/competitors` | `GET /`, `POST /discover`, `POST /`, `PATCH /:id`, `POST /:id/refresh`, `DELETE /:id`, `POST /compare` |
| `/api/icp` | `GET /`, `POST /generate`, `POST /`, `PATCH /:id`, `POST /:id/duplicate`, `DELETE /:id` |
| `/api/companies` | `GET /`, `POST /search`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /bulk` |
| `/api/people` | `GET /`, `POST /search`, `POST /`, `POST /:id/enrich`, `POST /:id/verify-email`, `PATCH /:id`, `DELETE /:id`, `POST /bulk` |
| `/api/leads` | `GET /lists`, `POST /lists`, `PATCH /lists/:id`, `DELETE /lists/:id`, `POST /import-csv`, `GET /export-csv` |
| `/api/campaigns` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/duplicate`, `POST /:id/approve`, `POST /:id/activate`, `POST /:id/pause`, `POST /:id/resume`, `DELETE /:id`, `GET /:id/events` |
| `/api/emails` | `POST /generate`, `POST /alternatives`, `GET /templates`, `POST /templates`, `PATCH /templates/:id`, `DELETE /templates/:id` |
| `/api/sequences` | `GET /:campaignId`, `PUT /:campaignId` |
| `/api/sending-accounts` | `GET /`, `POST /`, `PATCH /:id`, `POST /:id/check-dns`, `POST /:id/verify`, `DELETE /:id` |
| `/api/inbox` | `GET /counts`, `GET /threads`, `POST /sync` |
| `/api/conversations` | `GET /:id`, `POST /:id/draft-ai-reply`, `POST /:id/reply`, `POST /:id/notes`, `PATCH /:id`, `POST /simulate-inbound` |
| `/api/meetings` | `GET /`, `GET /availability`, `POST /`, `PATCH /:id`, `POST /:id/cancel`, `GET /public/:slug`, `POST /public/:slug/book` |
| `/api/analytics` | `GET /overview`, `GET /trends`, `GET /campaigns`, `GET /autopilot/recommendations`, `POST /autopilot/recommendations/:id/apply` |
| `/api/billing` | `GET /plans`, `GET /subscription`, `POST /razorpay/order`, `POST /razorpay/verify`, `GET /invoices`, `GET /refunds` |
| `/api/credits` | `GET /balance`, `GET /estimate`, `GET /transactions`, `POST /purchase-order` |
| `/api/integrations` | `GET /`, `PUT /:provider`, `POST /:provider/test`, `DELETE /:provider`, `GET /google-calendar/auth-url`, `GET /google-calendar/callback` |
| `/api/settings` | `GET /`, `PATCH /ai`, `PATCH /autopilot`, `GET /notifications`, `PATCH /notifications/:id/read`, `GET /audit-logs` |
| `/api/webhooks` | `POST /email`, `POST /razorpay` |

---

## 2. Authentication, RBAC & Validation Rules

- Protected routes validate JWT Bearer tokens and check organization membership.
- Privileged mutations (`owner` / `admin`):
  - Modifying billing/credits, integration credentials, sending accounts, team memberships, and autopilot permissions.
- Every endpoint validates `body`, `query`, and `params` with Zod schemas from `@ekiddy/shared` or backend module validators.
- Pagination defaults: `page=1`, `limit=20` (capped at `100`).
