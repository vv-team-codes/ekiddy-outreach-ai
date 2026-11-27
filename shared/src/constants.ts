export const USER_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CAMPAIGN_STATUSES = [
  'Draft',
  'Researching',
  'Ready for review',
  'Approved',
  'Active',
  'Paused',
  'Completed',
  'Failed'
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const EMAIL_TONES = [
  'Professional',
  'Friendly',
  'Formal',
  'Conversational',
  'Short and direct'
] as const;
export type EmailTone = (typeof EMAIL_TONES)[number];

export const EMAIL_VERIFICATION_STATUSES = [
  'verified',
  'unverified',
  'unknown',
  'invalid'
] as const;
export type EmailVerificationStatus = (typeof EMAIL_VERIFICATION_STATUSES)[number];

export const INBOX_FOLDERS = [
  'all',
  'needs_reply',
  'interested',
  'not_interested',
  'meetings',
  'out_of_office',
  'unsubscribed',
  'archived'
] as const;
export type InboxFolder = (typeof INBOX_FOLDERS)[number];

export const REPLY_CLASSIFICATIONS = [
  'Positive response',
  'Negative response',
  'Interested',
  'Meeting request',
  'Question',
  'Out of office',
  'Unsubscribe',
  'Other'
] as const;
export type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number];

export const INTEGRATION_PROVIDERS = [
  'gemini',
  'openrouter',
  'apollo',
  'hunter',
  'google_calendar',
  'resend',
  'smtp',
  'razorpay'
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const QUEUE_NAMES = {
  COMPANY_RESEARCH: 'company-research',
  COMPETITOR_DISCOVERY: 'competitor-discovery',
  ICP_GENERATION: 'icp-generation',
  COMPANY_SEARCH: 'company-search',
  PEOPLE_SEARCH: 'people-search',
  CONTACT_ENRICHMENT: 'contact-enrichment',
  EMAIL_VERIFICATION: 'email-verification',
  AI_EMAIL_GENERATION: 'ai-email-generation',
  CAMPAIGN_SCHEDULER: 'campaign-scheduler',
  EMAIL_DELIVERY: 'email-delivery',
  FOLLOW_UP_SEQUENCE: 'follow-up-sequence',
  INBOX_SYNC: 'inbox-sync',
  ANALYTICS_AGGREGATION: 'analytics-aggregation'
} as const;

export const CREDIT_COSTS = {
  company_research: 10,
  competitor_discovery: 5,
  icp_generation: 5,
  company_search: 2,
  people_search: 2,
  contact_enrichment: 3,
  email_verification: 1,
  ai_email_generation: 2,
  email_send: 1,
  ai_reply_draft: 1,
  autopilot_analysis: 3
} as const;
export type CreditOperation = keyof typeof CREDIT_COSTS;

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Starter Trial',
    monthlyPriceInr: 0,
    monthlyPriceUsd: 0,
    monthlyCredits: 500,
    dailySendLimit: 50,
    maxTeamMembers: 2,
    features: [
      '500 welcome AI & outreach credits',
      'Website research & competitor discovery',
      '1 active campaign in Sandbox or Live mode',
      'AI inbox classification & shareable booking link'
    ]
  },
  {
    id: 'starter',
    name: 'Growth Starter',
    monthlyPriceInr: 2499,
    monthlyPriceUsd: 29,
    monthlyCredits: 2500,
    dailySendLimit: 250,
    maxTeamMembers: 5,
    features: [
      '2,500 monthly AI & outreach credits',
      'Custom SMTP / Resend sending accounts + DNS checks',
      'Google Calendar synchronization',
      'Up to 5 team members'
    ]
  },
  {
    id: 'growth',
    name: 'Scale Outbound',
    monthlyPriceInr: 6499,
    monthlyPriceUsd: 79,
    monthlyCredits: 8000,
    dailySendLimit: 1000,
    maxTeamMembers: 15,
    features: [
      '8,000 monthly AI & outreach credits',
      'Multi-provider LLM fallback (Gemini + OpenRouter)',
      'AI Autopilot diagnostics & optimization',
      'Priority background worker concurrency'
    ]
  },
  {
    id: 'scale',
    name: 'Enterprise Revenue',
    monthlyPriceInr: 14999,
    monthlyPriceUsd: 179,
    monthlyCredits: 25000,
    dailySendLimit: 5000,
    maxTeamMembers: 50,
    features: [
      '25,000 monthly AI & outreach credits',
      'Dedicated sending limits & full audit trail',
      'Custom B2B enrichment connectors',
      'Unlimited projects and ICP segments'
    ]
  }
] as const;

export const CREDIT_PACKS = [
  { id: 'pack_500', name: '500 Credits Pack', credits: 500, amountInPaise: 49900, currency: 'INR' },
  { id: 'pack_2500', name: '2,500 Credits Pack', credits: 2500, amountInPaise: 199900, currency: 'INR' },
  { id: 'pack_10000', name: '10,000 Credits Pack', credits: 10000, amountInPaise: 699900, currency: 'INR' }
] as const;
