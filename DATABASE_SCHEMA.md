# Ekiddy Outreach AI — Database Schema Specification (MongoDB / Mongoose)

All tenant-owned collections include `organizationId: ObjectId` (indexed) and Mongoose `timestamps: true` (`createdAt`, `updatedAt`).

---

## 1. Identity, Organizations & Projects

### 1.1 `User`
- `email` (String, unique, lowercase, required)
- `passwordHash` (String, select: false)
- `firebaseUid` (String, sparse unique)
- `fullName` (String, required)
- `avatarUrl` (String)
- `jobTitle` (String)
- `timezone` (String, default: `"UTC"`)
- `emailVerified` (Boolean, default: `false`)
- `emailVerificationTokenHash` (String, select: false)
- `passwordResetTokenHash` (String, select: false)
- `passwordResetExpiresAt` (Date, select: false)
- `defaultOrganizationId` (ObjectId -> `Organization`)
- `lastLoginAt` (Date)
- `preferences` (`{ theme: 'light'|'dark'|'system', notificationsEnabled: Boolean }`)

### 1.2 `Organization`
- `name` (String, required)
- `slug` (String, unique, required)
- `website` (String)
- `industry` (String)
- `creditBalance` (Number, default: `500`, min: `0`)
- `plan` (`'free' | 'starter' | 'growth' | 'scale'`, default: `'free'`)
- `dailySendLimit` (Number, default: `50`)
- `aiSettings` (`{ provider: 'gemini'|'openrouter'|'auto', model: String, fallbackEnabled: Boolean }`)
- `autopilotSettings` (`{ enabled: Boolean, requireApprovalForCampaignLaunch: Boolean, requireApprovalForSpendChange: Boolean, requireApprovalForReplies: Boolean }`)
- `onboarding` (`{ currentStep: Number, completed: Boolean, websiteUrl: String, projectId: ObjectId, approvedAt: Date }`)
- `bookingSlug` (String, unique sparse)

### 1.3 `Membership`
- `organizationId` (ObjectId -> `Organization`, indexed)
- `userId` (ObjectId -> `User`, indexed)
- `role` (`'owner' | 'admin' | 'member' | 'viewer'`)
- `status` (`'active' | 'invited' | 'suspended'`)
- `inviteEmail` (String)
- `inviteTokenHash` (String, select: false)
- `invitedBy` (ObjectId -> `User`)
- **Indexes**: unique `(organizationId, userId)` (partial on `userId`), `(organizationId, inviteEmail)`

### 1.4 `Project`
- `organizationId` (ObjectId -> `Organization`, indexed)
- `name` (String, required)
- `websiteUrl` (String)
- `description` (String)
- `status` (`'active' | 'archived'`)
- `createdBy` (ObjectId -> `User`)

---

## 2. Research, Competitors & ICPs

### 2.1 `CompanyResearch`
- `organizationId`, `projectId`
- `websiteUrl` (String, required)
- `status` (`'queued' | 'running' | 'completed' | 'failed'`)
- `progress` (Number, 0–100)
- `companyName`, `industry`, `companyOverview`, `productSummary`, `serviceSummary`, `pricingSummary`
- `targetMarket`, `businessPositioning`
- `uniqueSellingPoints` ([String])
- `customerPersonas` ([`{ role, painPoints, goals }`])
- `suggestedSegments` ([`{ name, description, rationale }`])
- `suggestedOpportunities` ([String])
- `rawExtractedPages` ([`{ url, title, textExcerpt, fetchedAt }`])
- `aiMode` (`'live' | 'demo'`)
- `aiProvider` (String), `aiModel` (String)
- `errorMessage` (String)
- **Indexes**: `(organizationId, createdAt: -1)`, `(organizationId, websiteUrl)`

### 2.2 `Competitor`
- `organizationId`, `projectId`, `researchId`
- `name` (String, required), `website` (String), `industry` (String)
- `products` ([String]), `services` ([String])
- `positioning` (String), `targetAudience` (String)
- `comparisonNotes` (String), `opportunities` ([String])
- `source` (`'ai' | 'manual'`), `status` (`'pending' | 'researched' | 'failed'`)
- **Indexes**: `(organizationId, projectId)`

### 2.3 `ICP`
- `organizationId`, `projectId`, `researchId`
- `name` (String, required)
- `industries` ([String]), `locations` ([String]), `companySizes` ([String]), `revenueRanges` ([String])
- `jobTitles` ([String]), `departments` ([String]), `buyerRoles` ([String]), `companyTypes` ([String])
- `customerNeeds` ([String]), `businessChallenges` ([String])
- `relevanceScore` (Number, 0–100)
- `segmentTag` (String)
- **Indexes**: `(organizationId, relevanceScore: -1)`

---

## 3. Prospecting & Lead Management

### 3.1 `Company`
- `organizationId`, `projectId`
- `name` (String, required), `domain` (String, lowercase), `website` (String)
- `industry` (String), `category` (String), `location` (String), `country` (String)
- `employeeRange` (String), `revenueRange` (String), `description` (String)
- `source` (`'provider' | 'csv' | 'manual' | 'demo'`)
- `isDemoData` (Boolean, default: `false`)
- `enrichmentStatus` (`'none' | 'enriched' | 'failed'`)
- **Indexes**: unique `(organizationId, domain)` (sparse), text index on `(name, industry, location)`

### 3.2 `Contact`
- `organizationId`, `projectId`, `companyId` (-> `Company`)
- `fullName` (String, required), `firstName` (String), `lastName` (String)
- `jobTitle` (String), `department` (String), `companyName` (String), `companyDomain` (String)
- `location` (String), `linkedinUrl` (String)
- `email` (String, lowercase)
- `emailStatus` (`'verified' | 'unverified' | 'unknown' | 'invalid'`, default: `'unknown'`)
- `verificationDetails` (`{ provider, checkedAt, mxValid, syntaxValid, disposable, reason }`)
- `leadScore` (Number, 0–100, default: `50`)
- `stage` (`'new' | 'contacted' | 'replied' | 'interested' | 'meeting_booked' | 'unqualified' | 'unsubscribed'`)
- `source` (`'provider' | 'csv' | 'manual' | 'demo'`)
- `isDemoData` (Boolean, default: `false`)
- `tags` ([String])
- **Indexes**: unique `(organizationId, email)` (sparse), `(organizationId, companyId)`, `(organizationId, emailStatus)`

### 3.3 `LeadList`
- `organizationId`, `projectId`
- `name` (String, required), `description` (String)
- `contactIds` ([ObjectId -> `Contact`])
- `companyIds` ([ObjectId -> `Company`])
- **Indexes**: `(organizationId, name)`

---

## 4. Campaigns, Sequences & Sending

### 4.1 `EmailTemplate`
- `organizationId`, `projectId`
- `name` (String, required), `objective` (String), `tone` (String)
- `subject` (String, required), `openingLine` (String), `body` (String, required), `cta` (String), `followUpBody` (String)
- `variables` ([String]), `isAiGenerated` (Boolean)

### 4.2 `EmailSequence`
- `organizationId`, `campaignId`
- `steps` ([`{ stepOrder, delayDays, subject, body, templateId, condition: 'always'|'no_reply' }`])

### 4.3 `Campaign`
- `organizationId`, `projectId`, `icpId`, `sendingAccountId`, `sequenceId`
- `name` (String, required)
- `segment` (String), `geography` ([String]), `industries` ([String]), `jobTitles` ([String])
- `targetCompanyIds` ([ObjectId]), `targetContactIds` ([ObjectId])
- `objective` (String)
- `status` (`'Draft' | 'Researching' | 'Ready for review' | 'Approved' | 'Active' | 'Paused' | 'Completed' | 'Failed'`)
- `testMode` (Boolean, default: `true`)
- `dailySendLimit` (Number, default: `30`)
- `scheduleWindow` (`{ timezone, daysOfWeek: [Number], startHour: Number, endHour: Number }`)
- `approvedBy` (ObjectId -> `User`), `approvedAt` (Date)
- `stats` (`{ totalContacts, sent, delivered, bounced, replied, positiveReplies, meetingsBooked }`)
- **Indexes**: `(organizationId, status, createdAt: -1)`

### 4.4 `SendingAccount`
- `organizationId`
- `email` (String, required), `fromName` (String, required), `domain` (String, required)
- `provider` (`'sandbox' | 'smtp' | 'resend'`)
- `encryptedConfig` (String, select: false)
- `dailyLimit` (Number, default: `50`), `sentToday` (Number, default: `0`), `lastResetDate` (String)
- `dnsStatus` (`{ spfValid: Boolean, dkimConfigured: Boolean, dmarcValid: Boolean, checkedAt: Date, details: Object }`)
- `verified` (Boolean, default: `false`), `status` (`'active' | 'paused' | 'error'`)

### 4.5 `EmailEvent`
- `organizationId`, `campaignId`, `contactId`, `sendingAccountId`, `conversationId`
- `stepOrder` (Number), `idempotencyKey` (String, required)
- `providerMessageId` (String), `toEmail` (String, required), `subject` (String), `bodyPreview` (String)
- `eventType` (`'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'replied' | 'failed' | 'suppressed'`)
- `errorMessage` (String), `metadata` (Mixed)
- **Indexes**: unique `(organizationId, idempotencyKey)`, `(campaignId, eventType)`, `(providerMessageId)`

### 4.6 `SuppressionRecord`
- `organizationId`
- `email` (String, lowercase, required)
- `reason` (`'unsubscribe' | 'bounce' | 'manual' | 'complaint'`)
- `sourceCampaignId` (ObjectId)
- **Indexes**: unique `(organizationId, email)`

---

## 5. Inbox, Meetings & Autopilot

### 5.1 `Conversation`
- `organizationId`, `campaignId`, `contactId`, `companyId`, `sendingAccountId`
- `subject` (String)
- `folder` (`'all' | 'needs_reply' | 'interested' | 'not_interested' | 'meetings' | 'out_of_office' | 'unsubscribed' | 'archived'`)
- `classification` (`'Positive response' | 'Negative response' | 'Interested' | 'Meeting request' | 'Question' | 'Out of office' | 'Unsubscribe' | 'Other'`)
- `unreadCount` (Number, default: `0`)
- `lastMessageAt` (Date), `lastMessageSnippet` (String)
- `internalNotes` ([`{ authorId, authorName, text, createdAt }`])
- **Indexes**: `(organizationId, folder, lastMessageAt: -1)`

### 5.2 `Message`
- `organizationId`, `conversationId`
- `direction` (`'outbound' | 'inbound'`)
- `fromEmail` (String), `toEmail` (String), `subject` (String), `bodyText` (String), `bodyHtml` (String)
- `status` (`'draft' | 'pending_approval' | 'sent' | 'received' | 'failed'`)
- `isAiDraft` (Boolean, default: `false`), `approvedBy` (ObjectId), `providerMessageId` (String)
- **Indexes**: `(conversationId, createdAt: 1)`

### 5.3 `Meeting`
- `organizationId`, `projectId`, `contactId`, `campaignId`, `conversationId`, `hostUserId`
- `title` (String, required), `description` (String)
- `attendeeName` (String, required), `attendeeEmail` (String, required)
- `startTime` (Date, required), `endTime` (Date, required), `timezone` (String, default: `"UTC"`)
- `status` (`'scheduled' | 'rescheduled' | 'cancelled' | 'completed'`)
- `calendarProvider` (`'google' | 'local'`), `externalEventId` (String), `meetingLink` (String)
- **Indexes**: `(organizationId, startTime: 1)`

---

## 6. Billing, Integrations, System & Audit

### 6.1 `CreditTransaction`
- `organizationId`, `userId`
- `type` (`'grant' | 'purchase' | 'usage' | 'refund' | 'adjustment'`)
- `operation` (String, e.g. `'company_research'`, `'email_send'`, `'lead_enrichment'`)
- `amount` (Number, signed), `balanceAfter` (Number, required)
- `idempotencyKey` (String, required)
- `referenceId` (String), `description` (String)
- **Indexes**: unique `(organizationId, idempotencyKey)`, `(organizationId, createdAt: -1)`

### 6.2 `Subscription`
- `organizationId`
- `planId` (`'free' | 'starter' | 'growth' | 'scale'`)
- `status` (`'active' | 'past_due' | 'cancelled' | 'trialing'`)
- `billingProvider` (`'razorpay' | 'test'`)
- `razorpayOrderId` (String), `razorpayPaymentId` (String), `razorpaySubscriptionId` (String)
- `amountInPaise` (Number), `currency` (String, default: `'INR'`)
- `invoices` ([`{ invoiceNumber, amount, currency, status, issuedAt, paymentId }`])

### 6.3 `Integration`
- `organizationId`
- `provider` (`'gemini' | 'openrouter' | 'apollo' | 'hunter' | 'google_calendar' | 'resend' | 'smtp' | 'razorpay'`)
- `status` (`'connected' | 'disconnected' | 'error' | 'test_mode'`)
- `encryptedCredentials` (String, select: false)
- `maskedPreview` (String), `publicConfig` (Mixed), `lastCheckedAt` (Date)
- **Indexes**: unique `(organizationId, provider)`

### 6.4 `Notification`
- `organizationId`, `userId`
- `type` (`'info' | 'success' | 'warning' | 'error'`)
- `title` (String), `message` (String), `link` (String), `read` (Boolean, default: `false`)

### 6.5 `AuditLog`
- `organizationId`, `actorUserId`
- `action` (String, required), `resourceType` (String), `resourceId` (String)
- `metadata` (Mixed), `ipAddress` (String)
- **Indexes**: `(organizationId, createdAt: -1)`

### 6.6 `BackgroundJob` (Operational Queue Tracking)
- `organizationId`, `createdBy`
- `queueName` (String, required), `jobKey` (String, required)
- `status` (`'queued' | 'active' | 'completed' | 'failed' | 'cancelled'`)
- `progress` (Number, default: `0`), `attempts` (Number, default: `0`)
- `payload` (Mixed), `result` (Mixed), `errorMessage` (String)
- **Indexes**: unique `(organizationId, queueName, jobKey)`
