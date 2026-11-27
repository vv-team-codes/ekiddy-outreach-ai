import { z } from 'zod';
import {
  CAMPAIGN_STATUSES,
  EMAIL_TONES,
  INBOX_FOLDERS,
  INTEGRATION_PROVIDERS,
  USER_ROLES
} from './constants.js';

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
  organizationName: z.string().trim().min(2).max(100).optional(),
  websiteUrl: z.string().trim().url().optional().or(z.literal(''))
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1)
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(128)
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  website: z.string().trim().url().optional().or(z.literal('')),
  industry: z.string().trim().max(100).optional()
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(USER_ROLES).exclude(['owner'])
});

export const companyResearchRequestSchema = z.object({
  websiteUrl: z.string().trim().min(4).max(500),
  projectId: z.string().optional(),
  companyNameHint: z.string().trim().max(150).optional()
});

export const updateCompanyResearchSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  industry: z.string().trim().max(150).optional(),
  companyOverview: z.string().trim().max(4000).optional(),
  productSummary: z.string().trim().max(3000).optional(),
  serviceSummary: z.string().trim().max(3000).optional(),
  pricingSummary: z.string().trim().max(2000).optional(),
  targetMarket: z.string().trim().max(2000).optional(),
  businessPositioning: z.string().trim().max(2000).optional(),
  uniqueSellingPoints: z.array(z.string().trim().max(500)).optional(),
  suggestedOpportunities: z.array(z.string().trim().max(500)).optional()
});

export const competitorCreateSchema = z.object({
  projectId: z.string().optional(),
  researchId: z.string().optional(),
  name: z.string().trim().min(1).max(200),
  website: z.string().trim().max(500).optional(),
  industry: z.string().trim().max(150).optional(),
  products: z.array(z.string()).optional(),
  services: z.array(z.string()).optional(),
  positioning: z.string().max(2000).optional(),
  targetAudience: z.string().max(1000).optional()
});

export const icpCreateSchema = z.object({
  projectId: z.string().optional(),
  researchId: z.string().optional(),
  name: z.string().trim().min(2).max(150),
  industries: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  companySizes: z.array(z.string()).default([]),
  revenueRanges: z.array(z.string()).default([]),
  jobTitles: z.array(z.string()).default([]),
  departments: z.array(z.string()).default([]),
  buyerRoles: z.array(z.string()).default([]),
  companyTypes: z.array(z.string()).default([]),
  customerNeeds: z.array(z.string()).default([]),
  businessChallenges: z.array(z.string()).default([]),
  relevanceScore: z.number().min(0).max(100).default(80),
  segmentTag: z.string().trim().max(100).optional()
});

export const companySearchSchema = z.object({
  query: z.string().trim().max(300).optional(),
  name: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(150).optional(),
  location: z.string().trim().max(150).optional(),
  domain: z.string().trim().max(200).optional(),
  employeeRange: z.string().trim().max(100).optional(),
  category: z.string().trim().max(150).optional(),
  projectId: z.string().optional(),
  saveResults: z.boolean().optional().default(true)
});

export const peopleSearchSchema = z.object({
  query: z.string().trim().max(300).optional(),
  fullName: z.string().trim().max(200).optional(),
  jobTitle: z.string().trim().max(150).optional(),
  department: z.string().trim().max(150).optional(),
  companyName: z.string().trim().max(200).optional(),
  location: z.string().trim().max(150).optional(),
  linkedinUrl: z.string().trim().max(500).optional(),
  projectId: z.string().optional(),
  saveResults: z.boolean().optional().default(true)
});

export const generateEmailSchema = z.object({
  prospectName: z.string().trim().min(1).max(150),
  prospectDesignation: z.string().trim().max(150).default('Decision Maker'),
  companyName: z.string().trim().min(1).max(200),
  companyWebsite: z.string().trim().max(500).optional(),
  companyInformation: z.string().trim().max(4000).optional(),
  campaignObjective: z.string().trim().min(2).max(500),
  productOrService: z.string().trim().min(2).max(1000),
  tone: z.enum(EMAIL_TONES).default('Professional'),
  senderName: z.string().trim().max(150).optional(),
  researchId: z.string().optional()
});

export const sequenceStepSchema = z.object({
  stepOrder: z.number().int().min(1).max(10),
  delayDays: z.number().int().min(0).max(60),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(10000),
  condition: z.enum(['always', 'no_reply']).default('no_reply')
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2).max(200),
  projectId: z.string().optional(),
  icpId: z.string().optional(),
  segment: z.string().trim().max(200).optional(),
  geography: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  jobTitles: z.array(z.string()).default([]),
  targetCompanyIds: z.array(z.string()).default([]),
  targetContactIds: z.array(z.string()).default([]),
  objective: z.string().trim().min(2).max(500),
  sendingAccountId: z.string().optional(),
  testMode: z.boolean().default(true),
  dailySendLimit: z.number().int().min(1).max(2000).default(30),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  steps: z.array(sequenceStepSchema).min(1).max(10).optional()
});

export const sendingAccountCreateSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  fromName: z.string().trim().min(1).max(120),
  provider: z.enum(['sandbox', 'smtp', 'resend']).default('sandbox'),
  dailyLimit: z.number().int().min(1).max(5000).default(50),
  smtpHost: z.string().trim().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().trim().optional(),
  smtpPass: z.string().optional(),
  smtpSecure: z.boolean().optional(),
  apiKey: z.string().optional()
});

export const inboxReplySchema = z.object({
  bodyText: z.string().trim().min(1).max(10000),
  subject: z.string().trim().max(300).optional(),
  approveAiDraft: z.boolean().optional().default(true)
});

export const inboxFolderSchema = z.enum(INBOX_FOLDERS);

export const createMeetingSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  attendeeName: z.string().trim().min(1).max(150),
  attendeeEmail: z.string().trim().email().toLowerCase(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string().trim().min(1).max(100).default('UTC'),
  contactId: z.string().optional(),
  campaignId: z.string().optional(),
  conversationId: z.string().optional()
});

export const upsertIntegrationSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDERS),
  credentials: z.record(z.string(), z.string()),
  publicConfig: z.record(z.string(), z.unknown()).optional()
});

export const createCreditOrderSchema = z.object({
  packId: z.enum(['pack_500', 'pack_2500', 'pack_10000']).optional(),
  planId: z.enum(['starter', 'growth', 'scale']).optional()
});

export const verifyRazorpaySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  packId: z.string().optional(),
  planId: z.string().optional()
});
