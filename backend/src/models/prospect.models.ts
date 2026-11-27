import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { EMAIL_VERIFICATION_STATUSES, type EmailVerificationStatus } from '@ekiddy/shared';

export interface ICompany extends Document {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  category?: string;
  location?: string;
  country?: string;
  employeeRange?: string;
  revenueRange?: string;
  description?: string;
  source: 'provider' | 'csv' | 'manual' | 'demo';
  isDemoData: boolean;
  enrichmentStatus: 'none' | 'enriched' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    name: { type: String, required: true, trim: true },
    domain: { type: String, lowercase: true, trim: true },
    website: { type: String, trim: true },
    industry: { type: String, trim: true },
    category: { type: String, trim: true },
    location: { type: String, trim: true },
    country: { type: String, trim: true },
    employeeRange: { type: String, trim: true },
    revenueRange: { type: String, trim: true },
    description: { type: String, trim: true },
    source: { type: String, enum: ['provider', 'csv', 'manual', 'demo'], default: 'manual' },
    isDemoData: { type: Boolean, default: false },
    enrichmentStatus: { type: String, enum: ['none', 'enriched', 'failed'], default: 'none' }
  },
  { timestamps: true }
);

companySchema.index(
  { organizationId: 1, domain: 1 },
  { unique: true, partialFilterExpression: { domain: { $type: 'string', $gt: '' } } }
);
companySchema.index({ organizationId: 1, createdAt: -1 });

export interface IContact extends Document {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  companyId?: Types.ObjectId;
  fullName: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  department?: string;
  companyName?: string;
  companyDomain?: string;
  location?: string;
  linkedinUrl?: string;
  email?: string;
  emailStatus: EmailVerificationStatus;
  verificationDetails?: {
    provider: string;
    checkedAt: Date;
    mxValid: boolean;
    syntaxValid: boolean;
    disposable: boolean;
    reason?: string;
  };
  leadScore: number;
  stage: 'new' | 'contacted' | 'replied' | 'interested' | 'meeting_booked' | 'unqualified' | 'unsubscribed';
  source: 'provider' | 'csv' | 'manual' | 'demo';
  isDemoData: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    fullName: { type: String, required: true, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    department: { type: String, trim: true },
    companyName: { type: String, trim: true },
    companyDomain: { type: String, lowercase: true, trim: true },
    location: { type: String, trim: true },
    linkedinUrl: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    emailStatus: { type: String, enum: EMAIL_VERIFICATION_STATUSES, default: 'unknown' },
    verificationDetails: {
      provider: String,
      checkedAt: Date,
      mxValid: Boolean,
      syntaxValid: Boolean,
      disposable: Boolean,
      reason: String
    },
    leadScore: { type: Number, default: 50, min: 0, max: 100 },
    stage: {
      type: String,
      enum: ['new', 'contacted', 'replied', 'interested', 'meeting_booked', 'unqualified', 'unsubscribed'],
      default: 'new'
    },
    source: { type: String, enum: ['provider', 'csv', 'manual', 'demo'], default: 'manual' },
    isDemoData: { type: Boolean, default: false },
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
);

contactSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } }
);
contactSchema.index({ organizationId: 1, emailStatus: 1, createdAt: -1 });

export interface ILeadList extends Document {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  name: string;
  description?: string;
  contactIds: Types.ObjectId[];
  companyIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const leadListSchema = new Schema<ILeadList>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    contactIds: [{ type: Schema.Types.ObjectId, ref: 'Contact' }],
    companyIds: [{ type: Schema.Types.ObjectId, ref: 'Company' }]
  },
  { timestamps: true }
);

leadListSchema.index({ organizationId: 1, name: 1 });

export const Company = mongoose.model<ICompany>('Company', companySchema);
export const Contact = mongoose.model<IContact>('Contact', contactSchema);
export const LeadList = mongoose.model<ILeadList>('LeadList', leadListSchema);
