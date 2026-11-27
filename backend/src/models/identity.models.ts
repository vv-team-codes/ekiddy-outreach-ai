import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { USER_ROLES, type UserRole } from '@ekiddy/shared';

export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  firebaseUid?: string;
  fullName: string;
  avatarUrl?: string;
  jobTitle?: string;
  timezone: string;
  emailVerified: boolean;
  emailVerificationTokenHash?: string;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  defaultOrganizationId?: Types.ObjectId;
  lastLoginAt?: Date;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notificationsEnabled: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    firebaseUid: { type: String, sparse: true, unique: true },
    fullName: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    jobTitle: { type: String, trim: true },
    timezone: { type: String, default: 'UTC' },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    defaultOrganizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    lastLoginAt: { type: Date },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
      notificationsEnabled: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

export interface IOrganization extends Document {
  name: string;
  slug: string;
  website?: string;
  industry?: string;
  creditBalance: number;
  plan: 'free' | 'starter' | 'growth' | 'scale';
  dailySendLimit: number;
  aiSettings: {
    provider: 'auto' | 'gemini' | 'openrouter';
    model: string;
    fallbackEnabled: boolean;
  };
  autopilotSettings: {
    enabled: boolean;
    requireApprovalForCampaignLaunch: boolean;
    requireApprovalForSpendChange: boolean;
    requireApprovalForReplies: boolean;
  };
  onboarding: {
    currentStep: number;
    completed: boolean;
    websiteUrl?: string;
    projectId?: Types.ObjectId;
    researchId?: Types.ObjectId;
    approvedAt?: Date;
  };
  bookingSlug?: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    website: { type: String, trim: true },
    industry: { type: String, trim: true },
    creditBalance: { type: Number, default: 500, min: 0 },
    plan: { type: String, enum: ['free', 'starter', 'growth', 'scale'], default: 'free' },
    dailySendLimit: { type: Number, default: 50, min: 1 },
    aiSettings: {
      provider: { type: String, enum: ['auto', 'gemini', 'openrouter'], default: 'auto' },
      model: { type: String, default: 'gemini-2.5-flash' },
      fallbackEnabled: { type: Boolean, default: true }
    },
    autopilotSettings: {
      enabled: { type: Boolean, default: false },
      requireApprovalForCampaignLaunch: { type: Boolean, default: true },
      requireApprovalForSpendChange: { type: Boolean, default: true },
      requireApprovalForReplies: { type: Boolean, default: true }
    },
    onboarding: {
      currentStep: { type: Number, default: 1, min: 1, max: 8 },
      completed: { type: Boolean, default: false },
      websiteUrl: { type: String },
      projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
      researchId: { type: Schema.Types.ObjectId, ref: 'CompanyResearch' },
      approvedAt: { type: Date }
    },
    bookingSlug: { type: String, sparse: true, unique: true, lowercase: true, trim: true }
  },
  { timestamps: true }
);

export interface IMembership extends Document {
  organizationId: Types.ObjectId;
  userId?: Types.ObjectId;
  role: UserRole;
  status: 'active' | 'invited' | 'suspended';
  inviteEmail?: string;
  inviteTokenHash?: string;
  invitedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IMembership>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    role: { type: String, enum: USER_ROLES, default: 'member' },
    status: { type: String, enum: ['active', 'invited', 'suspended'], default: 'active' },
    inviteEmail: { type: String, lowercase: true, trim: true },
    inviteTokenHash: { type: String, select: false },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

membershipSchema.index(
  { organizationId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } }
);
membershipSchema.index({ organizationId: 1, inviteEmail: 1 });

export interface IProject extends Document {
  organizationId: Types.ObjectId;
  name: string;
  websiteUrl?: string;
  description?: string;
  status: 'active' | 'archived';
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    websiteUrl: { type: String, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, createdAt: -1 });

export const User = mongoose.model<IUser>('User', userSchema);
export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
export const Membership = mongoose.model<IMembership>('Membership', membershipSchema);
export const Project = mongoose.model<IProject>('Project', projectSchema);
