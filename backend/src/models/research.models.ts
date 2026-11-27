import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICompanyResearch extends Document {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  websiteUrl: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  companyName: string;
  industry: string;
  companyOverview: string;
  productSummary: string;
  serviceSummary: string;
  pricingSummary: string;
  targetMarket: string;
  businessPositioning: string;
  uniqueSellingPoints: string[];
  customerPersonas: Array<{ role: string; painPoints: string[]; goals: string[] }>;
  suggestedSegments: Array<{ name: string; description: string; rationale: string }>;
  suggestedOpportunities: string[];
  rawExtractedPages: Array<{ url: string; title: string; textExcerpt: string; fetchedAt: Date }>;
  aiMode: 'live' | 'demo';
  aiProvider: string;
  aiModel: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const companyResearchSchema = new Schema<ICompanyResearch>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    websiteUrl: { type: String, required: true, trim: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    companyName: { type: String, default: '' },
    industry: { type: String, default: '' },
    companyOverview: { type: String, default: '' },
    productSummary: { type: String, default: '' },
    serviceSummary: { type: String, default: '' },
    pricingSummary: { type: String, default: '' },
    targetMarket: { type: String, default: '' },
    businessPositioning: { type: String, default: '' },
    uniqueSellingPoints: { type: [String], default: [] },
    customerPersonas: {
      type: [
        {
          role: { type: String, required: true },
          painPoints: { type: [String], default: [] },
          goals: { type: [String], default: [] }
        }
      ],
      default: []
    },
    suggestedSegments: {
      type: [
        {
          name: { type: String, required: true },
          description: { type: String, default: '' },
          rationale: { type: String, default: '' }
        }
      ],
      default: []
    },
    suggestedOpportunities: { type: [String], default: [] },
    rawExtractedPages: {
      type: [
        {
          url: String,
          title: String,
          textExcerpt: String,
          fetchedAt: Date
        }
      ],
      default: []
    },
    aiMode: { type: String, enum: ['live', 'demo'], default: 'demo' },
    aiProvider: { type: String, default: 'local-heuristic' },
    aiModel: { type: String, default: 'deterministic-v1' },
    errorMessage: { type: String }
  },
  { timestamps: true }
);

companyResearchSchema.index({ organizationId: 1, createdAt: -1 });
companyResearchSchema.index({ organizationId: 1, websiteUrl: 1 });

export interface ICompetitor extends Document {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  researchId?: Types.ObjectId;
  name: string;
  website?: string;
  industry?: string;
  products: string[];
  services: string[];
  positioning?: string;
  targetAudience?: string;
  comparisonNotes?: string;
  opportunities: string[];
  source: 'ai' | 'manual';
  status: 'pending' | 'researched' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const competitorSchema = new Schema<ICompetitor>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    researchId: { type: Schema.Types.ObjectId, ref: 'CompanyResearch' },
    name: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    industry: { type: String, trim: true },
    products: { type: [String], default: [] },
    services: { type: [String], default: [] },
    positioning: { type: String, default: '' },
    targetAudience: { type: String, default: '' },
    comparisonNotes: { type: String, default: '' },
    opportunities: { type: [String], default: [] },
    source: { type: String, enum: ['ai', 'manual'], default: 'ai' },
    status: { type: String, enum: ['pending', 'researched', 'failed'], default: 'researched' }
  },
  { timestamps: true }
);

competitorSchema.index({ organizationId: 1, projectId: 1, createdAt: -1 });

export interface IICP extends Document {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  researchId?: Types.ObjectId;
  name: string;
  industries: string[];
  locations: string[];
  companySizes: string[];
  revenueRanges: string[];
  jobTitles: string[];
  departments: string[];
  buyerRoles: string[];
  companyTypes: string[];
  customerNeeds: string[];
  businessChallenges: string[];
  relevanceScore: number;
  segmentTag?: string;
  createdAt: Date;
  updatedAt: Date;
}

const icpSchema = new Schema<IICP>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    researchId: { type: Schema.Types.ObjectId, ref: 'CompanyResearch' },
    name: { type: String, required: true, trim: true },
    industries: { type: [String], default: [] },
    locations: { type: [String], default: [] },
    companySizes: { type: [String], default: [] },
    revenueRanges: { type: [String], default: [] },
    jobTitles: { type: [String], default: [] },
    departments: { type: [String], default: [] },
    buyerRoles: { type: [String], default: [] },
    companyTypes: { type: [String], default: [] },
    customerNeeds: { type: [String], default: [] },
    businessChallenges: { type: [String], default: [] },
    relevanceScore: { type: Number, default: 80, min: 0, max: 100 },
    segmentTag: { type: String, trim: true }
  },
  { timestamps: true }
);

icpSchema.index({ organizationId: 1, relevanceScore: -1 });

export const CompanyResearch = mongoose.model<ICompanyResearch>('CompanyResearch', companyResearchSchema);
export const Competitor = mongoose.model<ICompetitor>('Competitor', competitorSchema);
export const ICP = mongoose.model<IICP>('ICP', icpSchema);
