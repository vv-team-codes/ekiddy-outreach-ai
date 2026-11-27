import mongoose, { Schema, type Document, type Types } from 'mongoose';
import {
  INBOX_FOLDERS,
  REPLY_CLASSIFICATIONS,
  type InboxFolder,
  type ReplyClassification
} from '@ekiddy/shared';

export interface IConversation extends Document {
  organizationId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  contactId?: Types.ObjectId;
  companyId?: Types.ObjectId;
  sendingAccountId?: Types.ObjectId;
  subject: string;
  folder: InboxFolder;
  classification: ReplyClassification;
  unreadCount: number;
  lastMessageAt: Date;
  lastMessageSnippet: string;
  internalNotes: Array<{
    authorId: Types.ObjectId;
    authorName: string;
    text: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    sendingAccountId: { type: Schema.Types.ObjectId, ref: 'SendingAccount' },
    subject: { type: String, required: true, trim: true },
    folder: { type: String, enum: INBOX_FOLDERS, default: 'needs_reply' },
    classification: { type: String, enum: REPLY_CLASSIFICATIONS, default: 'Other' },
    unreadCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSnippet: { type: String, default: '' },
    internalNotes: {
      type: [
        {
          authorId: { type: Schema.Types.ObjectId, ref: 'User' },
          authorName: String,
          text: String,
          createdAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

conversationSchema.index({ organizationId: 1, folder: 1, lastMessageAt: -1 });

export interface IMessage extends Document {
  organizationId: Types.ObjectId;
  conversationId: Types.ObjectId;
  direction: 'outbound' | 'inbound';
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  status: 'draft' | 'pending_approval' | 'sent' | 'received' | 'failed';
  isAiDraft: boolean;
  approvedBy?: Types.ObjectId;
  providerMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    direction: { type: String, enum: ['outbound', 'inbound'], required: true },
    fromEmail: { type: String, required: true, lowercase: true },
    toEmail: { type: String, required: true, lowercase: true },
    subject: { type: String, required: true },
    bodyText: { type: String, required: true },
    bodyHtml: { type: String },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'sent', 'received', 'failed'],
      default: 'sent'
    },
    isAiDraft: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    providerMessageId: { type: String }
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export interface IMeeting extends Document {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  contactId?: Types.ObjectId;
  campaignId?: Types.ObjectId;
  conversationId?: Types.ObjectId;
  hostUserId?: Types.ObjectId;
  title: string;
  description?: string;
  attendeeName: string;
  attendeeEmail: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  status: 'scheduled' | 'rescheduled' | 'cancelled' | 'completed';
  calendarProvider: 'google' | 'local';
  externalEventId?: string;
  meetingLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const meetingSchema = new Schema<IMeeting>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact' },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    hostUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    attendeeName: { type: String, required: true, trim: true },
    attendeeEmail: { type: String, required: true, lowercase: true, trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    timezone: { type: String, default: 'UTC' },
    status: {
      type: String,
      enum: ['scheduled', 'rescheduled', 'cancelled', 'completed'],
      default: 'scheduled'
    },
    calendarProvider: { type: String, enum: ['google', 'local'], default: 'local' },
    externalEventId: { type: String },
    meetingLink: { type: String }
  },
  { timestamps: true }
);

meetingSchema.index({ organizationId: 1, startTime: 1 });

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
export const Message = mongoose.model<IMessage>('Message', messageSchema);
export const Meeting = mongoose.model<IMeeting>('Meeting', meetingSchema);
