import mongoose, { Schema, type Document, type Types } from 'mongoose';
import {
  CAMPAIGN_STATUSES,
  EMAIL_TONES,
  type CampaignStatus,
  type EmailTone
} from '@ekiddy/shared';

export interface IEmailTemplate extends Document {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  name: string;
  objective?: string;
  tone: EmailTone;
  subject: string;
  openingLine?: string;
  body: string;
  cta?: string;
  followUpBody?: string;
  variables: string[];
  isAiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<IEmailTemplate>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    name: { type: String, required: true, trim: true },
    objective: { type: String, trim: true },
    tone: { type: String, enum: EMAIL_TONES, default: 'Professional' },
    subject: { type: String, required: true },
    openingLine: { type: String },
    body: { type: String, required: true },
    cta: { type: String },
    followUpBody: { type: String },
    variables: { type: [String], default: [] },
    isAiGenerated: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export interface IEmailSequence extends Document {
  organizationId: Types.ObjectId;
  campaignId: Types.ObjectId;
  steps: Array<{
    stepOrder: number;
    delayDays: number;
    subject: string;
    body: string;
    templateId?: Types.ObjectId;
    condition: 'always' | 'no_reply';
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const emailSequenceSchema = new Schema<IEmailSequence>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, unique: true },
    steps: {
      type: [
        {
          stepOrder: { type: Number, required: true },
          delayDays: { type: Number, default: 0 },
          subject: { type: String, required: true },
          body: { type: String, required: true },
          templateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate' },
          condition: { type: String, enum: ['always', 'no_reply'], default: 'no_reply' }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

export interface ICampaign extends Document {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  icpId?: Types.ObjectId;
  sendingAccountId?: Types.ObjectId;
  sequenceId?: Types.ObjectId;
  name: string;
  segment?: string;
  geography: string[];
  industries: string[];
  jobTitles: string[];
  targetCompanyIds: Types.ObjectId[];
  targetContactIds: Types.ObjectId[];
  objective: string;
  status: CampaignStatus;
  testMode: boolean;
  dailySendLimit: number;
  scheduleWindow: {
    timezone: string;
    daysOfWeek: number[];
    startHour: number;
    endHour: number;
  };
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  stats: {
    totalContacts: number;
    sent: number;
    delivered: number;
    bounced: number;
    replied: number;
    positiveReplies: number;
    meetingsBooked: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    icpId: { type: Schema.Types.ObjectId, ref: 'ICP' },
    sendingAccountId: { type: Schema.Types.ObjectId, ref: 'SendingAccount' },
    sequenceId: { type: Schema.Types.ObjectId, ref: 'EmailSequence' },
    name: { type: String, required: true, trim: true },
    segment: { type: String, trim: true },
    geography: { type: [String], default: [] },
    industries: { type: [String], default: [] },
    jobTitles: { type: [String], default: [] },
    targetCompanyIds: [{ type: Schema.Types.ObjectId, ref: 'Company' }],
    targetContactIds: [{ type: Schema.Types.ObjectId, ref: 'Contact' }],
    objective: { type: String, required: true },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: 'Draft' },
    testMode: { type: Boolean, default: true },
    dailySendLimit: { type: Number, default: 30, min: 1 },
    scheduleWindow: {
      timezone: { type: String, default: 'UTC' },
      daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5] },
      startHour: { type: Number, default: 8 },
      endHour: { type: Number, default: 18 }
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    stats: {
      totalContacts: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      replied: { type: Number, default: 0 },
      positiveReplies: { type: Number, default: 0 },
      meetingsBooked: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

campaignSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

export interface ISendingAccount extends Document {
  organizationId: Types.ObjectId;
  email: string;
  fromName: string;
  domain: string;
  provider: 'sandbox' | 'smtp' | 'resend';
  encryptedConfig?: string;
  dailyLimit: number;
  sentToday: number;
  lastResetDate: string;
  dnsStatus: {
    spfValid: boolean;
    dkimConfigured: boolean;
    dmarcValid: boolean;
    checkedAt?: Date;
    spfRecord?: string;
    dmarcRecord?: string;
    guidance?: string[];
  };
  verified: boolean;
  status: 'active' | 'paused' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

const sendingAccountSchema = new Schema<ISendingAccount>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    fromName: { type: String, required: true, trim: true },
    domain: { type: String, required: true, lowercase: true, trim: true },
    provider: { type: String, enum: ['sandbox', 'smtp', 'resend'], default: 'sandbox' },
    encryptedConfig: { type: String, select: false },
    dailyLimit: { type: Number, default: 50, min: 1 },
    sentToday: { type: Number, default: 0, min: 0 },
    lastResetDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    dnsStatus: {
      spfValid: { type: Boolean, default: false },
      dkimConfigured: { type: Boolean, default: false },
      dmarcValid: { type: Boolean, default: false },
      checkedAt: Date,
      spfRecord: String,
      dmarcRecord: String,
      guidance: { type: [String], default: [] }
    },
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'paused', 'error'], default: 'active' }
  },
  { timestamps: true }
);

sendingAccountSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export interface IEmailEvent extends Document {
  organizationId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  contactId?: Types.ObjectId;
  sendingAccountId?: Types.ObjectId;
  conversationId?: Types.ObjectId;
  stepOrder: number;
  idempotencyKey: string;
  providerMessageId?: string;
  toEmail: string;
  subject: string;
  bodyPreview?: string;
  eventType:
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'clicked'
    | 'bounced'
    | 'replied'
    | 'failed'
    | 'suppressed';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const emailEventSchema = new Schema<IEmailEvent>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', index: true },
    sendingAccountId: { type: Schema.Types.ObjectId, ref: 'SendingAccount' },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    stepOrder: { type: Number, default: 1 },
    idempotencyKey: { type: String, required: true },
    providerMessageId: { type: String, index: true },
    toEmail: { type: String, required: true, lowercase: true },
    subject: { type: String, required: true },
    bodyPreview: { type: String },
    eventType: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'replied', 'failed', 'suppressed'],
      required: true
    },
    errorMessage: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

emailEventSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
emailEventSchema.index({ organizationId: 1, campaignId: 1, eventType: 1 });

export interface ISuppressionRecord extends Document {
  organizationId: Types.ObjectId;
  email: string;
  reason: 'unsubscribe' | 'bounce' | 'manual' | 'complaint';
  sourceCampaignId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const suppressionRecordSchema = new Schema<ISuppressionRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    reason: { type: String, enum: ['unsubscribe', 'bounce', 'manual', 'complaint'], required: true },
    sourceCampaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' }
  },
  { timestamps: true }
);

suppressionRecordSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', emailTemplateSchema);
export const EmailSequence = mongoose.model<IEmailSequence>('EmailSequence', emailSequenceSchema);
export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);
export const SendingAccount = mongoose.model<ISendingAccount>('SendingAccount', sendingAccountSchema);
export const EmailEvent = mongoose.model<IEmailEvent>('EmailEvent', emailEventSchema);
export const SuppressionRecord = mongoose.model<ISuppressionRecord>('SuppressionRecord', suppressionRecordSchema);
