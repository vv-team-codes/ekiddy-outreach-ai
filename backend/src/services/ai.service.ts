import { z } from 'zod';
import {
  EMAIL_TONES,
  REPLY_CLASSIFICATIONS,
  type EmailTone,
  type GeneratedEmailResult,
  type ReplyClassification
} from '@ekiddy/shared';
import { env } from '../config/env.js';
import { Integration, Organization } from '../models/index.js';
import { decryptObject } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

interface AIProviderConfig {
  geminiKey: string;
  openRouterKey: string;
  preferredProvider: 'auto' | 'gemini' | 'openrouter';
  model: string;
  fallbackEnabled: boolean;
}

async function resolveAIConfig(organizationId?: string): Promise<AIProviderConfig> {
  let geminiKey = env.geminiApiKey;
  let openRouterKey = env.openRouterApiKey;
  let preferredProvider: 'auto' | 'gemini' | 'openrouter' = 'auto';
  let model = env.geminiDefaultModel;
  let fallbackEnabled = true;

  if (organizationId) {
    const org = await Organization.findById(organizationId);
    if (org?.aiSettings) {
      preferredProvider = org.aiSettings.provider || 'auto';
      model = org.aiSettings.model || model;
      fallbackEnabled = org.aiSettings.fallbackEnabled ?? true;
    }

    const integrations = await Integration.find({
      organizationId,
      provider: { $in: ['gemini', 'openrouter'] }
    }).select('+encryptedCredentials');

    for (const item of integrations) {
      if (!item.encryptedCredentials) continue;
      try {
        const creds = decryptObject(item.encryptedCredentials);
        if (item.provider === 'gemini' && creds.apiKey) geminiKey = creds.apiKey;
        if (item.provider === 'openrouter' && creds.apiKey) openRouterKey = creds.apiKey;
      } catch {
        // Ignore malformed encrypted creds
      }
    }
  }

  return { geminiKey, openRouterKey, preferredProvider, model, fallbackEnabled };
}

async function callGeminiJson<T>(
  apiKey: string,
  model: string,
  prompt: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const effectiveModel = model.includes('/') ? env.geminiDefaultModel : model;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    effectiveModel
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API returned status ${res.status}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini returned an empty response');
  return schema.parse(JSON.parse(rawText));
}

async function callOpenRouterJson<T>(
  apiKey: string,
  model: string,
  prompt: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const effectiveModel = model.includes('/') ? model : env.openRouterDefaultModel;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': env.appUrl,
      'X-Title': 'ekiddy Outreach AI'
    },
    body: JSON.stringify({
      model: effectiveModel,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return strictly valid JSON matching the requested schema.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`OpenRouter API returned status ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawText = data.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('OpenRouter returned an empty response');
  return schema.parse(JSON.parse(rawText));
}

async function runStructuredAI<T>(params: {
  organizationId?: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  demoFallback: () => T;
}): Promise<{ result: T; aiMode: 'live' | 'demo'; aiProvider: string; aiModel: string }> {
  const cfg = await resolveAIConfig(params.organizationId);
  const providers: Array<'gemini' | 'openrouter'> = [];

  if (cfg.preferredProvider === 'gemini') {
    if (cfg.geminiKey) providers.push('gemini');
    if (cfg.fallbackEnabled && cfg.openRouterKey) providers.push('openrouter');
  } else if (cfg.preferredProvider === 'openrouter') {
    if (cfg.openRouterKey) providers.push('openrouter');
    if (cfg.fallbackEnabled && cfg.geminiKey) providers.push('gemini');
  } else {
    if (cfg.geminiKey) providers.push('gemini');
    if (cfg.openRouterKey) providers.push('openrouter');
  }

  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        const result = await callGeminiJson(cfg.geminiKey, cfg.model, params.prompt, params.schema);
        return { result, aiMode: 'live', aiProvider: 'gemini', aiModel: cfg.model };
      }
      const result = await callOpenRouterJson(cfg.openRouterKey, cfg.model, params.prompt, params.schema);
      return {
        result,
        aiMode: 'live',
        aiProvider: 'openrouter',
        aiModel: cfg.model.includes('/') ? cfg.model : env.openRouterDefaultModel
      };
    } catch (err) {
      logger.warn({ err, provider }, 'AI provider call failed; attempting fallback');
    }
  }

  return {
    result: params.demoFallback(),
    aiMode: 'demo',
    aiProvider: 'local-heuristic',
    aiModel: 'deterministic-v1'
  };
}

const companyResearchOutputSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  companyOverview: z.string(),
  productSummary: z.string(),
  serviceSummary: z.string(),
  pricingSummary: z.string(),
  targetMarket: z.string(),
  businessPositioning: z.string(),
  uniqueSellingPoints: z.array(z.string()),
  customerPersonas: z.array(
    z.object({
      role: z.string(),
      painPoints: z.array(z.string()),
      goals: z.array(z.string())
    })
  ),
  suggestedSegments: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      rationale: z.string()
    })
  ),
  suggestedOpportunities: z.array(z.string())
});

export async function analyzeCompanyWithAI(params: {
  organizationId: string;
  websiteUrl: string;
  companyNameHint?: string;
  extractedText: string;
  pageTitles: string[];
}) {
  const domain = new URL(params.websiteUrl).hostname.replace(/^www\./, '');
  const fallbackName =
    params.companyNameHint ||
    domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

  const prompt = `Analyze the following company website content and produce strictly valid JSON matching:
{
  "companyName": string,
  "industry": string,
  "companyOverview": string,
  "productSummary": string,
  "serviceSummary": string,
  "pricingSummary": string,
  "targetMarket": string,
  "businessPositioning": string,
  "uniqueSellingPoints": string[],
  "customerPersonas": [{ "role": string, "painPoints": string[], "goals": string[] }],
  "suggestedSegments": [{ "name": string, "description": string, "rationale": string }],
  "suggestedOpportunities": string[]
}
Only state facts supported by the provided website text; if pricing is not published, explicitly state "Pricing not publicly listed on inspected pages."
Website URL: ${params.websiteUrl}
Page Titles: ${params.pageTitles.join(' | ')}
Content Excerpt:
${params.extractedText.slice(0, 8000)}`;

  return runStructuredAI({
    organizationId: params.organizationId,
    prompt,
    schema: companyResearchOutputSchema,
    demoFallback: () => {
      const lower = params.extractedText.toLowerCase();
      const hasPricing = lower.includes('pricing') || lower.includes('$') || lower.includes('/mo');
      const inferredIndustry = lower.includes('ai') || lower.includes('software') || lower.includes('platform')
        ? 'B2B SaaS & Software'
        : lower.includes('agency') || lower.includes('consulting')
          ? 'B2B Professional Services'
          : 'B2B Technology & Solutions';

      const snippet = params.extractedText.replace(/\s+/g, ' ').trim().slice(0, 320);

      return {
        companyName: fallbackName,
        industry: inferredIndustry,
        companyOverview: snippet
          ? `${fallbackName} operates at ${params.websiteUrl}. Extracted positioning summary: ${snippet}`
          : `${fallbackName} provides B2B solutions accessible via ${params.websiteUrl}.`,
        productSummary: `${fallbackName} offers core digital products and workflow capabilities showcased on ${domain}.`,
        serviceSummary: `Onboarding, implementation support, and customer success around ${fallbackName}'s core platform.`,
        pricingSummary: hasPricing
          ? `Public pricing cues were detected on ${domain}. Review extracted page notes to verify tier details.`
          : 'Pricing not publicly listed on inspected pages.',
        targetMarket: 'Mid-market and growth-stage B2B decision-makers evaluating modern operational software.',
        businessPositioning: `Positioned around measurable efficiency, rapid onboarding, and ROI for B2B teams.`,
        uniqueSellingPoints: [
          `Direct self-serve web presence at ${domain}`,
          'Streamlined workflow adoption for operational teams',
          'Focused value proposition tailored to B2B buyers'
        ],
        customerPersonas: [
          {
            role: 'VP of Growth / Head of Revenue',
            painPoints: ['Slow manual pipeline workflows', 'Low outbound conversion visibility'],
            goals: ['Increase qualified demo pipeline', 'Standardize repeatable GTM execution']
          },
          {
            role: 'Founder / Managing Director',
            painPoints: ['Limited bandwidth for outbound prospecting', 'Rising customer acquisition cost'],
            goals: ['Predictable B2B customer acquisition', 'Faster time-to-value']
          }
        ],
        suggestedSegments: [
          {
            name: 'High-Growth B2B SaaS Teams',
            description: '20–250 employee software companies scaling outbound revenue.',
            rationale: 'High readiness for workflow automation and clear buyer ownership.'
          },
          {
            name: 'B2B Agencies & Consultancies',
            description: 'Boutique agencies seeking repeatable client acquisition.',
            rationale: 'Short sales cycles and strong ROI sensitivity.'
          }
        ],
        suggestedOpportunities: [
          `Run a founder-led outbound campaign referencing ${fallbackName}'s primary value proposition`,
          'Segment verified VP/Head-level buyers by industry and geography before outreach'
        ]
      };
    }
  });
}

const competitorsOutputSchema = z.object({
  competitors: z.array(
    z.object({
      name: z.string(),
      website: z.string(),
      industry: z.string(),
      products: z.array(z.string()),
      services: z.array(z.string()),
      positioning: z.string(),
      targetAudience: z.string(),
      comparisonNotes: z.string(),
      opportunities: z.array(z.string())
    })
  )
});

export async function discoverCompetitorsWithAI(params: {
  organizationId: string;
  companyName: string;
  industry: string;
  overview: string;
}) {
  const prompt = `Identify 3 realistic market competitors or category alternatives for the company below. Return JSON:
{ "competitors": [{ "name": string, "website": string, "industry": string, "products": string[], "services": string[], "positioning": string, "targetAudience": string, "comparisonNotes": string, "opportunities": string[] }] }
Company: ${params.companyName}
Industry: ${params.industry}
Overview: ${params.overview}`;

  return runStructuredAI({
    organizationId: params.organizationId,
    prompt,
    schema: competitorsOutputSchema,
    demoFallback: () => ({
      competitors: [
        {
          name: `${params.industry.split(' ')[0] || 'Enterprise'} Legacy Suite`,
          website: 'https://example-competitor-suite.com',
          industry: params.industry,
          products: ['Enterprise Workflow Platform', 'Reporting Add-on'],
          services: ['Long-cycle consulting implementation'],
          positioning: 'Heavyweight enterprise deployment with multi-month onboarding.',
          targetAudience: 'Fortune 1000 procurement and IT departments',
          comparisonNotes: `${params.companyName} can win on faster deployment speed and transparent workflows.`,
          opportunities: ['Target mid-market teams frustrated with long setup timelines']
        },
        {
          name: 'Manual Point Solutions',
          website: 'https://example-point-tool.com',
          industry: params.industry,
          products: ['Single-purpose utility tool'],
          services: ['Self-serve documentation'],
          positioning: 'Low-cost point tool requiring stitching multiple vendors together.',
          targetAudience: 'Early-stage operators managing fragmented spreadsheets',
          comparisonNotes: `${params.companyName} consolidates disconnected tools into one unified system.`,
          opportunities: ['Emphasize unified pipeline visibility and fewer vendor integrations']
        }
      ]
    })
  });
}

const icpOutputSchema = z.object({
  icps: z.array(
    z.object({
      name: z.string(),
      industries: z.array(z.string()),
      locations: z.array(z.string()),
      companySizes: z.array(z.string()),
      revenueRanges: z.array(z.string()),
      jobTitles: z.array(z.string()),
      departments: z.array(z.string()),
      buyerRoles: z.array(z.string()),
      companyTypes: z.array(z.string()),
      customerNeeds: z.array(z.string()),
      businessChallenges: z.array(z.string()),
      relevanceScore: z.number().min(0).max(100),
      segmentTag: z.string()
    })
  )
});

export async function generateIcpsWithAI(params: {
  organizationId: string;
  companyName: string;
  industry: string;
  targetMarket: string;
  uniqueSellingPoints: string[];
}) {
  const prompt = `Generate 2 distinct Ideal Customer Profiles (ICPs) in JSON format:
{ "icps": [{ "name", "industries", "locations", "companySizes", "revenueRanges", "jobTitles", "departments", "buyerRoles", "companyTypes", "customerNeeds", "businessChallenges", "relevanceScore", "segmentTag" }] }
Company: ${params.companyName}
Industry: ${params.industry}
Target Market: ${params.targetMarket}
USPs: ${params.uniqueSellingPoints.join('; ')}`;

  return runStructuredAI({
    organizationId: params.organizationId,
    prompt,
    schema: icpOutputSchema,
    demoFallback: () => ({
      icps: [
        {
          name: 'Growth-Stage B2B Revenue Leaders',
          industries: ['B2B SaaS', 'Technology Services', 'FinTech'],
          locations: ['United States', 'United Kingdom', 'India', 'Canada'],
          companySizes: ['11-50', '51-200'],
          revenueRanges: ['$1M-$10M', '$10M-$50M'],
          jobTitles: ['VP of Sales', 'Head of Growth', 'Chief Revenue Officer'],
          departments: ['Sales', 'Revenue Operations', 'Growth'],
          buyerRoles: ['Economic Buyer', 'Decision Maker'],
          companyTypes: ['Privately Held', 'Venture Backed'],
          customerNeeds: ['Predictable qualified pipeline', 'Faster prospect research'],
          businessChallenges: ['Low outbound reply rates', 'Fragmented prospecting tools'],
          relevanceScore: 92,
          segmentTag: 'Mid-Market SaaS'
        },
        {
          name: 'Founder-Led B2B Agencies',
          industries: ['Marketing & Advertising', 'IT Consulting', 'Digital Agencies'],
          locations: ['United States', 'Europe', 'Australia'],
          companySizes: ['1-10', '11-50'],
          revenueRanges: ['$500K-$5M'],
          jobTitles: ['Founder', 'Managing Partner', 'Business Development Director'],
          departments: ['Executive', 'Business Development'],
          buyerRoles: ['Primary Decision Maker'],
          companyTypes: ['Agency', 'Consultancy'],
          customerNeeds: ['Consistent monthly client meetings', 'Automated follow-up'],
          businessChallenges: ['Feast-or-famine pipeline', 'Lack of dedicated SDR headcount'],
          relevanceScore: 84,
          segmentTag: 'Agencies'
        }
      ]
    })
  });
}

const emailOutputSchema = z.object({
  subject: z.string(),
  openingLine: z.string(),
  body: z.string(),
  cta: z.string(),
  followUpMessage: z.string()
});

export async function generateEmailWithAI(params: {
  organizationId: string;
  prospectName: string;
  prospectDesignation: string;
  companyName: string;
  companyWebsite?: string;
  companyInformation?: string;
  campaignObjective: string;
  productOrService: string;
  tone: EmailTone;
  senderName?: string;
  variationSeed?: number;
}): Promise<GeneratedEmailResult> {
  const prompt = `Write a personalized B2B outreach email and 1 follow-up message.
Strict rules:
- Use ONLY the provided prospect and company facts. NEVER invent awards, funding rounds, mutual friends, or personal facts not in the input.
- Tone: ${params.tone} (${EMAIL_TONES.join(', ')})
- Return valid JSON: { "subject": string, "openingLine": string, "body": string, "cta": string, "followUpMessage": string }

Prospect: ${params.prospectName}, ${params.prospectDesignation} at ${params.companyName}
Website: ${params.companyWebsite || 'Not provided'}
Research Context: ${params.companyInformation || 'None provided'}
Product/Service Offered: ${params.productOrService}
Campaign Objective: ${params.campaignObjective}
Sender: ${params.senderName || 'ekiddy Team'}
Variation Hint: ${params.variationSeed || 1}`;

  const { result, aiMode, aiProvider, aiModel } = await runStructuredAI({
    organizationId: params.organizationId,
    prompt,
    schema: emailOutputSchema,
    demoFallback: () => {
      const firstName = params.prospectName.split(' ')[0] || params.prospectName;
      const toneStyle: Record<EmailTone, { subjectPrefix: string; greeting: string; closing: string }> = {
        Professional: {
          subjectPrefix: `Question regarding ${params.companyName}'s ${params.campaignObjective.toLowerCase()}`,
          greeting: `Hi ${firstName},`,
          closing: 'Would a brief 15-minute call next week make sense?'
        },
        Friendly: {
          subjectPrefix: `Quick idea for ${params.companyName}`,
          greeting: `Hey ${firstName},`,
          closing: 'Open to a quick chat sometime this week?'
        },
        Formal: {
          subjectPrefix: `Exploring ${params.campaignObjective} at ${params.companyName}`,
          greeting: `Dear ${params.prospectName},`,
          closing: 'Please let me know if you are available for a concise introductory discussion.'
        },
        Conversational: {
          subjectPrefix: `Thoughts on ${params.companyName}`,
          greeting: `Hi ${firstName} —`,
          closing: 'Worth comparing notes for 10 minutes?'
        },
        'Short and direct': {
          subjectPrefix: `${params.companyName} x ${params.productOrService.slice(0, 32)}`,
          greeting: `${firstName},`,
          closing: 'Open to a 10-min intro?'
        }
      };

      const style = toneStyle[params.tone];
      const contextLine = params.companyInformation
        ? `Based on ${params.companyName}'s focus (${params.companyInformation.slice(0, 140).trim()}), `
        : `As ${params.prospectDesignation} at ${params.companyName}, `;

      const openingLine = `${contextLine}you are likely balancing pipeline efficiency with team bandwidth.`;
      const body = `${style.greeting}\n\n${openingLine}\n\nWe help teams achieve ${params.campaignObjective.toLowerCase()} through ${params.productOrService}.\n\n${style.closing}\n\nBest,\n${params.senderName || 'Team'}`;
      const followUpMessage = `Hi ${firstName},\n\nFollowing up briefly on my note regarding ${params.campaignObjective.toLowerCase()} for ${params.companyName}. Happy to share concrete examples if helpful.\n\nBest,\n${params.senderName || 'Team'}`;

      return {
        subject: params.variationSeed && params.variationSeed > 1 ? `Re: ${style.subjectPrefix}` : style.subjectPrefix,
        openingLine,
        body,
        cta: style.closing,
        followUpMessage
      };
    }
  });

  return { ...result, aiMode, aiProvider, aiModel };
}

const classificationSchema = z.object({
  classification: z.enum(REPLY_CLASSIFICATIONS),
  confidence: z.number().min(0).max(1),
  suggestedDraft: z.string()
});

export async function classifyAndDraftReplyWithAI(params: {
  organizationId: string;
  incomingText: string;
  contactName: string;
  companyName?: string;
  senderName: string;
}) {
  const prompt = `Classify this B2B email reply into one of: ${REPLY_CLASSIFICATIONS.join(', ')}.
Also draft a polite, concise reply (empty string if Unsubscribe).
Return JSON: { "classification": string, "confidence": number, "suggestedDraft": string }
Prospect: ${params.contactName} (${params.companyName || 'Company'})
Reply Text:
${params.incomingText}`;

  return runStructuredAI({
    organizationId: params.organizationId,
    prompt,
    schema: classificationSchema,
    demoFallback: () => {
      const lower = params.incomingText.toLowerCase();
      let classification: ReplyClassification = 'Other';
      let suggestedDraft = `Hi ${params.contactName.split(' ')[0]},\n\nThank you for getting back to me. Happy to share any additional details whenever helpful.\n\nBest,\n${params.senderName}`;

      if (/\b(unsubscribe|opt out|remove me|stop emailing|do not contact)\b/.test(lower)) {
        classification = 'Unsubscribe';
        suggestedDraft = '';
      } else if (/\b(out of office|ooo|away from|vacation|auto-reply|automatic reply)\b/.test(lower)) {
        classification = 'Out of office';
        suggestedDraft = '';
      } else if (/\b(book|schedule|calendar|time|call|meet|tuesday|wednesday|thursday|demo)\b/.test(lower)) {
        classification = 'Meeting request';
        suggestedDraft = `Hi ${params.contactName.split(' ')[0]},\n\nGreat to hear from you! Please feel free to pick a convenient slot on my calendar link, or let me know two times that work best in your timezone.\n\nBest,\n${params.senderName}`;
      } else if (/\b(interested|sounds good|tell me more|yes|love to|curious|send info)\b/.test(lower)) {
        classification = 'Interested';
        suggestedDraft = `Hi ${params.contactName.split(' ')[0]},\n\nGlad this resonated! Would you be open to a brief 15-minute walkthrough this week so we can tailor it to ${params.companyName || 'your team'}?\n\nBest,\n${params.senderName}`;
      } else if (/\b(not interested|no thanks|pass|don't need|already have)\b/.test(lower)) {
        classification = 'Negative response';
        suggestedDraft = `Hi ${params.contactName.split(' ')[0]},\n\nUnderstood — appreciate the quick reply and wishing you and ${params.companyName || 'the team'} all the best.\n\nBest,\n${params.senderName}`;
      } else if (lower.includes('?')) {
        classification = 'Question';
        suggestedDraft = `Hi ${params.contactName.split(' ')[0]},\n\nThanks for the question! Happy to clarify how our workflow integrates with your existing setup — would a brief call or a short summary doc work better?\n\nBest,\n${params.senderName}`;
      }

      return { classification, confidence: 0.86, suggestedDraft };
    }
  });
}

const autopilotSchema = z.object({
  recommendations: z.array(
    z.object({
      id: z.string(),
      category: z.enum(['segment', 'subject_line', 'messaging', 'deliverability', 'follow_up']),
      priority: z.enum(['high', 'medium', 'low']),
      title: z.string(),
      rationale: z.string(),
      suggestedAction: z.string(),
      requiresApproval: z.boolean()
    })
  )
});

export async function generateAutopilotRecommendationsWithAI(params: {
  organizationId: string;
  metricsSummary: Record<string, unknown>;
}) {
  const prompt = `Analyze these real B2B outreach campaign metrics and return actionable optimization recommendations in JSON:
{ "recommendations": [{ "id", "category": "segment"|"subject_line"|"messaging"|"deliverability"|"follow_up", "priority": "high"|"medium"|"low", "title", "rationale", "suggestedAction", "requiresApproval": boolean }] }
Metrics:
${JSON.stringify(params.metricsSummary)}`;

  return runStructuredAI({
    organizationId: params.organizationId,
    prompt,
    schema: autopilotSchema,
    demoFallback: () => {
      const sent = Number(params.metricsSummary.emailsSent || 0);
      const bounced = Number(params.metricsSummary.emailsBounced || 0);
      const replies = Number(params.metricsSummary.replies || 0);
      const verified = Number(params.metricsSummary.verifiedContacts || 0);
      const totalContacts = Number(params.metricsSummary.contactsDiscovered || 0);

      const recs: z.infer<typeof autopilotSchema>['recommendations'] = [];

      if (sent === 0) {
        recs.push({
          id: 'rec-first-campaign',
          category: 'segment',
          priority: 'high',
          title: 'Launch your first approved test-mode campaign',
          rationale: 'No emails have been dispatched yet in this organization.',
          suggestedAction: 'Select verified contacts matching your highest-scoring ICP and approve a sandbox sequence.',
          requiresApproval: true
        });
      }

      if (totalContacts > 0 && verified < totalContacts) {
        recs.push({
          id: 'rec-verify-emails',
          category: 'deliverability',
          priority: 'high',
          title: 'Verify unverified contacts before outreach',
          rationale: `${totalContacts - verified} saved contacts do not yet have verified email status.`,
          suggestedAction: 'Run email verification across pending contacts to keep bounce rates below 3%.',
          requiresApproval: true
        });
      }

      if (sent > 0 && bounced / sent > 0.05) {
        recs.push({
          id: 'rec-bounce-guard',
          category: 'deliverability',
          priority: 'high',
          title: 'Reduce campaign bounce rate',
          rationale: `Bounce rate is ${((bounced / sent) * 100).toFixed(1)}%, exceeding the 5% safety threshold.`,
          suggestedAction: 'Pause sending to unverified addresses and validate SPF/DKIM/DMARC records.',
          requiresApproval: true
        });
      }

      if (sent > 0 && replies / sent < 0.05) {
        recs.push({
          id: 'rec-subject-test',
          category: 'subject_line',
          priority: 'medium',
          title: 'Test shorter research-anchored subject lines',
          rationale: 'Reply rate is currently below 5%; concise 3–5 word company-specific subjects typically improve open/reply velocity.',
          suggestedAction: 'Regenerate step 1 copy using the "Short and direct" tone option.',
          requiresApproval: false
        });
      }

      recs.push({
        id: 'rec-followup-cadence',
        category: 'follow_up',
        priority: 'medium',
        title: 'Add a 3-day no-reply follow-up step',
        rationale: 'Multi-step sequences consistently capture replies from prospects who miss the initial email.',
        suggestedAction: 'Ensure every active campaign has at least 2 follow-up steps triggered on no_reply.',
        requiresApproval: true
      });

      return { recommendations: recs };
    }
  });
}
