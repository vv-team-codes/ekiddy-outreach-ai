import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from '@ekiddy/shared';

export interface ICreditTransaction extends Document {
  organizationId: Types.ObjectId;
  userId?: Types.ObjectId;
  type: 'grant' | 'purchase' | 'usage' | 'refund' | 'adjustment';
  operation: string;
  amount: number;
  balanceAfter: number;
  idempotencyKey: string;
  referenceId?: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const creditTransactionSchema = new Schema<ICreditTransaction>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['grant', 'purchase', 'usage', 'refund', 'adjustment'], required: true },
    operation: { type: String, required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    idempotencyKey: { type: String, required: true },
    referenceId: { type: String },
    description: { type: String, required: true }
  },
  { timestamps: true }
);

creditTransactionSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
creditTransactionSchema.index({ organizationId: 1, createdAt: -1 });

export interface ISubscription extends Document {
  organizationId: Types.ObjectId;
  planId: 'free' | 'starter' | 'growth' | 'scale';
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  billingProvider: 'razorpay' | 'test';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySubscriptionId?: string;
  amountInPaise: number;
  currency: string;
  invoices: Array<{
    invoiceNumber: string;
    amountInPaise: number;
    currency: string;
    status: 'paid' | 'refunded' | 'pending';
    issuedAt: Date;
    paymentId?: string;
    description: string;
  }>;
  refunds: Array<{
    refundId: string;
    paymentId: string;
    amountInPaise: number;
    reason?: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    planId: { type: String, enum: ['free', 'starter', 'growth', 'scale'], default: 'free' },
    status: { type: String, enum: ['active', 'past_due', 'cancelled', 'trialing'], default: 'active' },
    billingProvider: { type: String, enum: ['razorpay', 'test'], default: 'test' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySubscriptionId: { type: String },
    amountInPaise: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    invoices: {
      type: [
        {
          invoiceNumber: String,
          amountInPaise: Number,
          currency: { type: String, default: 'INR' },
          status: { type: String, enum: ['paid', 'refunded', 'pending'], default: 'paid' },
          issuedAt: { type: Date, default: Date.now },
          paymentId: String,
          description: String
        }
      ],
      default: []
    },
    refunds: {
      type: [
        {
          refundId: String,
          paymentId: String,
          amountInPaise: Number,
          reason: String,
          createdAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

export interface IIntegration extends Document {
  organizationId: Types.ObjectId;
  provider: IntegrationProvider;
  status: 'connected' | 'disconnected' | 'error' | 'test_mode';
  encryptedCredentials?: string;
  maskedPreview?: string;
  publicConfig?: Record<string, unknown>;
  lastCheckedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema<IIntegration>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    provider: { type: String, enum: INTEGRATION_PROVIDERS, required: true },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'test_mode'],
      default: 'disconnected'
    },
    encryptedCredentials: { type: String, select: false },
    maskedPreview: { type: String },
    publicConfig: { type: Schema.Types.Mixed, default: {} },
    lastCheckedAt: { type: Date }
  },
  { timestamps: true }
);

integrationSchema.index({ organizationId: 1, provider: 1 }, { unique: true });

export interface INotification extends Document {
  organizationId: Types.ObjectId;
  userId?: Types.ObjectId;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ organizationId: 1, read: 1, createdAt: -1 });

export interface IAuditLog extends Document {
  organizationId: Types.ObjectId;
  actorUserId?: Types.ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resourceType: { type: String },
    resourceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String }
  },
  { timestamps: true }
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });

export interface IBackgroundJob extends Document {
  organizationId: Types.ObjectId;
  createdBy?: Types.ObjectId;
  queueName: string;
  jobKey: string;
  status: 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  attempts: number;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const backgroundJobSchema = new Schema<IBackgroundJob>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    queueName: { type: String, required: true },
    jobKey: { type: String, required: true },
    status: {
      type: String,
      enum: ['queued', 'active', 'completed', 'failed', 'cancelled'],
      default: 'queued'
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    attempts: { type: Number, default: 0 },
    payload: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
    errorMessage: { type: String }
  },
  { timestamps: true }
);

backgroundJobSchema.index({ organizationId: 1, queueName: 1, jobKey: 1 }, { unique: true });

export const CreditTransaction = mongoose.model<ICreditTransaction>('CreditTransaction', creditTransactionSchema);
export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
export const Integration = mongoose.model<IIntegration>('Integration', integrationSchema);
export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
export const BackgroundJob = mongoose.model<IBackgroundJob>('BackgroundJob', backgroundJobSchema);
