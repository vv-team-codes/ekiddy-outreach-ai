import dns from 'node:dns/promises';
import type { EmailVerificationStatus } from '@ekiddy/shared';
import { env } from '../config/env.js';
import { Integration } from '../models/index.js';
import { decryptObject } from '../utils/crypto.js';

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'yopmail.com',
  'throwawaymail.com'
]);

const SAMPLE_COMPANIES = [
  {
    name: 'Northstar Revenue Cloud',
    domain: 'northstarcloud.example',
    website: 'https://northstarcloud.example',
    industry: 'B2B SaaS',
    category: 'Revenue Operations',
    location: 'Austin, TX',
    country: 'United States',
    employeeRange: '51-200',
    revenueRange: '$10M-$50M',
    description: 'Sample directory entry: Pipeline intelligence and forecasting software for B2B revenue teams.',
    isDemoData: true
  },
  {
    name: 'BluePeak Logistics Tech',
    domain: 'bluepeaktech.example',
    website: 'https://bluepeaktech.example',
    industry: 'Supply Chain Software',
    category: 'Logistics & Fleet',
    location: 'Chicago, IL',
    country: 'United States',
    employeeRange: '201-500',
    revenueRange: '$50M-$100M',
    description: 'Sample directory entry: Freight visibility and warehouse automation platform.',
    isDemoData: true
  },
  {
    name: 'Veridian FinOps',
    domain: 'veridianfinops.example',
    website: 'https://veridianfinops.example',
    industry: 'FinTech',
    category: 'Cloud Cost & Finance',
    location: 'London',
    country: 'United Kingdom',
    employeeRange: '11-50',
    revenueRange: '$1M-$10M',
    description: 'Sample directory entry: Automated SaaS spend governance and cloud unit economics.',
    isDemoData: true
  },
  {
    name: 'Kestrel Digital Advisory',
    domain: 'kestreladvisory.example',
    website: 'https://kestreladvisory.example',
    industry: 'IT Consulting',
    category: 'Digital Transformation',
    location: 'Bengaluru',
    country: 'India',
    employeeRange: '51-200',
    revenueRange: '$5M-$25M',
    description: 'Sample directory entry: B2B product engineering and cloud modernization consultancy.',
    isDemoData: true
  }
];

const SAMPLE_PEOPLE = [
  {
    fullName: 'Maya Lin',
    firstName: 'Maya',
    lastName: 'Lin',
    jobTitle: 'VP of Revenue Operations',
    department: 'Revenue Operations',
    companyName: 'Northstar Revenue Cloud',
    companyDomain: 'northstarcloud.example',
    location: 'Austin, TX',
    linkedinUrl: undefined,
    email: 'maya.lin@northstarcloud.example',
    emailStatus: 'unverified' as EmailVerificationStatus,
    leadScore: 91,
    isDemoData: true
  },
  {
    fullName: 'Daniel Mercer',
    firstName: 'Daniel',
    lastName: 'Mercer',
    jobTitle: 'Head of Growth',
    department: 'Marketing & Growth',
    companyName: 'Veridian FinOps',
    companyDomain: 'veridianfinops.example',
    location: 'London, UK',
    linkedinUrl: undefined,
    email: 'daniel.mercer@veridianfinops.example',
    emailStatus: 'unverified' as EmailVerificationStatus,
    leadScore: 87,
    isDemoData: true
  },
  {
    fullName: 'Priya Nair',
    firstName: 'Priya',
    lastName: 'Nair',
    jobTitle: 'Managing Director',
    department: 'Executive',
    companyName: 'Kestrel Digital Advisory',
    companyDomain: 'kestreladvisory.example',
    location: 'Bengaluru, India',
    linkedinUrl: undefined,
    email: 'priya.nair@kestreladvisory.example',
    emailStatus: 'unverified' as EmailVerificationStatus,
    leadScore: 89,
    isDemoData: true
  },
  {
    fullName: 'Carlos Ortega',
    firstName: 'Carlos',
    lastName: 'Ortega',
    jobTitle: 'Director of Operations',
    department: 'Operations',
    companyName: 'BluePeak Logistics Tech',
    companyDomain: 'bluepeaktech.example',
    location: 'Chicago, IL',
    linkedinUrl: undefined,
    email: 'carlos.ortega@bluepeaktech.example',
    emailStatus: 'unverified' as EmailVerificationStatus,
    leadScore: 82,
    isDemoData: true
  }
];

export async function getActiveDataProvider(organizationId: string): Promise<{
  provider: 'apollo' | 'hunter' | 'demo';
  apiKey?: string;
}> {
  const integrations = await Integration.find({
    organizationId,
    provider: { $in: ['apollo', 'hunter'] },
    status: 'connected'
  }).select('+encryptedCredentials');

  for (const item of integrations) {
    if (!item.encryptedCredentials) continue;
    try {
      const creds = decryptObject(item.encryptedCredentials);
      if (creds.apiKey) {
        return { provider: item.provider as 'apollo' | 'hunter', apiKey: creds.apiKey };
      }
    } catch {
      // ignore invalid encrypted config
    }
  }

  if (env.dataProviderApiKey && (env.dataProviderType === 'apollo' || env.dataProviderType === 'hunter')) {
    return { provider: env.dataProviderType, apiKey: env.dataProviderApiKey };
  }

  return { provider: 'demo' };
}

export async function searchCompaniesFromProvider(
  organizationId: string,
  filters: {
    query?: string;
    name?: string;
    industry?: string;
    location?: string;
    domain?: string;
    employeeRange?: string;
    category?: string;
  }
) {
  const active = await getActiveDataProvider(organizationId);

  if (active.provider === 'apollo' && active.apiKey) {
    try {
      const res = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': active.apiKey
        },
        body: JSON.stringify({
          q_organization_name: filters.name || filters.query,
          organization_locations: filters.location ? [filters.location] : undefined,
          per_page: 10
        })
      });
      if (res.ok) {
        const data = (await res.json()) as {
          organizations?: Array<{
            name?: string;
            primary_domain?: string;
            website_url?: string;
            industry?: string;
            city?: string;
            country?: string;
            estimated_num_employees?: number;
          }>;
        };
        const companies = (data.organizations || []).map((org) => ({
          name: org.name || 'Unknown Company',
          domain: org.primary_domain || '',
          website: org.website_url || (org.primary_domain ? `https://${org.primary_domain}` : ''),
          industry: org.industry || filters.industry || 'B2B',
          category: filters.category || org.industry || '',
          location: [org.city, org.country].filter(Boolean).join(', '),
          country: org.country || '',
          employeeRange: org.estimated_num_employees ? `${org.estimated_num_employees}` : '',
          revenueRange: '',
          description: '',
          isDemoData: false,
          source: 'provider' as const
        }));
        return { mode: 'live' as const, provider: 'apollo', companies };
      }
    } catch {
      // Fallback to demo clearly flagged below
    }
  }

  const terms = [filters.query, filters.name, filters.industry, filters.location, filters.domain, filters.category]
    .filter(Boolean)
    .map((t) => t!.toLowerCase());

  const matched = SAMPLE_COMPANIES.filter((company) => {
    if (terms.length === 0) return true;
    const haystack = `${company.name} ${company.domain} ${company.industry} ${company.category} ${company.location} ${company.country} ${company.employeeRange}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });

  return {
    mode: 'demo' as const,
    provider: 'sample-directory',
    companies: (matched.length > 0 ? matched : SAMPLE_COMPANIES).map((c) => ({
      ...c,
      source: 'demo' as const
    }))
  };
}

export async function searchPeopleFromProvider(
  organizationId: string,
  filters: {
    query?: string;
    fullName?: string;
    jobTitle?: string;
    department?: string;
    companyName?: string;
    location?: string;
  }
) {
  const active = await getActiveDataProvider(organizationId);

  if (active.provider === 'apollo' && active.apiKey) {
    try {
      const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': active.apiKey
        },
        body: JSON.stringify({
          q_keywords: filters.query || filters.fullName,
          person_titles: filters.jobTitle ? [filters.jobTitle] : undefined,
          person_locations: filters.location ? [filters.location] : undefined,
          per_page: 10
        })
      });
      if (res.ok) {
        const data = (await res.json()) as {
          people?: Array<{
            name?: string;
            first_name?: string;
            last_name?: string;
            title?: string;
            email?: string;
            linkedin_url?: string;
            city?: string;
            country?: string;
            organization?: { name?: string; primary_domain?: string };
          }>;
        };
        const people = (data.people || []).map((person) => ({
          fullName: person.name || 'Decision Maker',
          firstName: person.first_name || '',
          lastName: person.last_name || '',
          jobTitle: person.title || '',
          department: filters.department || '',
          companyName: person.organization?.name || '',
          companyDomain: person.organization?.primary_domain || '',
          location: [person.city, person.country].filter(Boolean).join(', '),
          linkedinUrl: person.linkedin_url,
          email: person.email,
          emailStatus: (person.email ? 'unverified' : 'unknown') as EmailVerificationStatus,
          leadScore: 80,
          isDemoData: false,
          source: 'provider' as const
        }));
        return { mode: 'live' as const, provider: 'apollo', people };
      }
    } catch {
      // Fall through to clearly marked sample directory
    }
  }

  const terms = [filters.query, filters.fullName, filters.jobTitle, filters.department, filters.companyName, filters.location]
    .filter(Boolean)
    .map((t) => t!.toLowerCase());

  const matched = SAMPLE_PEOPLE.filter((p) => {
    if (terms.length === 0) return true;
    const haystack = `${p.fullName} ${p.jobTitle} ${p.department} ${p.companyName} ${p.location}`.toLowerCase();
    return terms.some((t) => haystack.includes(t));
  });

  return {
    mode: 'demo' as const,
    provider: 'sample-directory',
    people: (matched.length > 0 ? matched : SAMPLE_PEOPLE).map((p) => ({
      ...p,
      source: 'demo' as const
    }))
  };
}

export async function verifyEmailAddress(email?: string): Promise<{
  status: EmailVerificationStatus;
  details: {
    provider: string;
    checkedAt: Date;
    mxValid: boolean;
    syntaxValid: boolean;
    disposable: boolean;
    reason: string;
  };
}> {
  const checkedAt = new Date();
  if (!email) {
    return {
      status: 'unknown',
      details: {
        provider: 'dns-syntax',
        checkedAt,
        mxValid: false,
        syntaxValid: false,
        disposable: false,
        reason: 'No email address present on contact record'
      }
    };
  }

  const normalized = email.trim().toLowerCase();
  const syntaxValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
  if (!syntaxValid) {
    return {
      status: 'invalid',
      details: {
        provider: 'dns-syntax',
        checkedAt,
        mxValid: false,
        syntaxValid: false,
        disposable: false,
        reason: 'Email format is syntactically invalid'
      }
    };
  }

  const domain = normalized.split('@')[1];
  const disposable = DISPOSABLE_DOMAINS.has(domain);
  if (disposable) {
    return {
      status: 'invalid',
      details: {
        provider: 'dns-syntax',
        checkedAt,
        mxValid: false,
        syntaxValid: true,
        disposable: true,
        reason: 'Disposable email domains are rejected'
      }
    };
  }

  if (domain.endsWith('.example') || domain.endsWith('.test')) {
    return {
      status: 'unverified',
      details: {
        provider: 'sample-domain-check',
        checkedAt,
        mxValid: false,
        syntaxValid: true,
        disposable: false,
        reason: 'Sample/reserved .example domain cannot accept external mail'
      }
    };
  }

  if (env.emailVerifierApiKey) {
    try {
      const res = await fetch(
        `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(normalized)}&api_key=${encodeURIComponent(
          env.emailVerifierApiKey
        )}`
      );
      if (res.ok) {
        const payload = (await res.json()) as { data?: { status?: string; mx_records?: boolean } };
        const hunterStatus = payload.data?.status;
        const mapped: EmailVerificationStatus =
          hunterStatus === 'valid'
            ? 'verified'
            : hunterStatus === 'invalid' || hunterStatus === 'disposable'
              ? 'invalid'
              : 'unverified';
        return {
          status: mapped,
          details: {
            provider: 'hunter',
            checkedAt,
            mxValid: Boolean(payload.data?.mx_records ?? true),
            syntaxValid: true,
            disposable: hunterStatus === 'disposable',
            reason: `Hunter verification status: ${hunterStatus}`
          }
        };
      }
    } catch {
      // Fallback to live DNS MX lookup
    }
  }

  try {
    const mx = await dns.resolveMx(domain);
    if (mx && mx.length > 0) {
      return {
        status: 'verified',
        details: {
          provider: 'dns-mx',
          checkedAt,
          mxValid: true,
          syntaxValid: true,
          disposable: false,
          reason: `Valid MX records found (${mx[0].exchange})`
        }
      };
    }
    return {
      status: 'invalid',
      details: {
        provider: 'dns-mx',
        checkedAt,
        mxValid: false,
        syntaxValid: true,
        disposable: false,
        reason: 'Domain has no MX mail exchange records'
      }
    };
  } catch {
    return {
      status: 'unverified',
      details: {
        provider: 'dns-mx',
        checkedAt,
        mxValid: false,
        syntaxValid: true,
        disposable: false,
        reason: 'DNS MX lookup inconclusive or offline'
      }
    };
  }
}

export function computeLeadScore(contact: {
  emailStatus?: EmailVerificationStatus;
  jobTitle?: string;
  companyName?: string;
  linkedinUrl?: string;
}): number {
  let score = 40;
  if (contact.emailStatus === 'verified') score += 25;
  else if (contact.emailStatus === 'unverified') score += 10;
  else if (contact.emailStatus === 'invalid') score -= 20;

  const title = (contact.jobTitle || '').toLowerCase();
  if (/(founder|ceo|cto|cro|cmo|vp|vice president|head|director|partner)/.test(title)) {
    score += 20;
  } else if (/(manager|lead)/.test(title)) {
    score += 10;
  }
  if (contact.companyName) score += 8;
  if (contact.linkedinUrl) score += 7;
  return Math.max(0, Math.min(100, score));
}
