import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Compass, Globe, Loader2, Sparkles, Swords, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Textarea
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

const STEPS = [
  '1. Website URL',
  '2. AI Research',
  '3. Company Profile',
  '4. Competitors',
  '5. Target ICPs',
  '6. Suggested Campaigns',
  '7. Review & Approve',
  '8. Enter Dashboard'
];

interface ResearchDoc {
  _id: string;
  websiteUrl: string;
  status: string;
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
  suggestedSegments: Array<{ name: string; description: string; rationale: string }>;
  aiMode: 'live' | 'demo';
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization, pendingWebsiteUrl, addToast, setOrganization } = useAppStore();

  const [step, setStep] = useState(1);
  const [websiteUrl, setWebsiteUrl] = useState(
    organization?.onboarding?.websiteUrl || organization?.website || pendingWebsiteUrl || ''
  );
  const [loading, setLoading] = useState(false);
  const [research, setResearch] = useState<ResearchDoc | null>(null);
  const [campaignName, setCampaignName] = useState('Outbound Growth Sequence #1');
  const [campaignObjective, setCampaignObjective] = useState('Book 15-minute product discovery demos');

  const { data: onboardingState } = useQuery({
    queryKey: ['onboarding', organization?._id],
    queryFn: () =>
      apiRequest<{ currentStep: number; completed: boolean; websiteUrl?: string; researchId?: string }>(
        `/api/organizations/${organization!._id}/onboarding`
      ),
    enabled: Boolean(organization?._id)
  });

  const { data: researches = [] } = useQuery({
    queryKey: ['company-researches', organization?._id],
    queryFn: () => apiRequest<ResearchDoc[]>('/api/research/company'),
    enabled: Boolean(organization?._id)
  });

  const { data: competitors = [], refetch: refetchCompetitors } = useQuery({
    queryKey: ['competitors', organization?._id],
    queryFn: () =>
      apiRequest<Array<{ _id: string; name: string; positioning: string; website?: string }>>('/api/competitors'),
    enabled: Boolean(organization?._id)
  });

  const { data: icps = [], refetch: refetchIcps } = useQuery({
    queryKey: ['icps', organization?._id],
    queryFn: () =>
      apiRequest<Array<{ _id: string; name: string; relevanceScore: number; jobTitles: string[] }>>('/api/icp'),
    enabled: Boolean(organization?._id)
  });

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (onboardingState && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (onboardingState.currentStep && onboardingState.currentStep >= 1) {
        if (onboardingState.currentStep === 2 && researches.length === 0) {
          setStep(1);
        } else {
          setStep(onboardingState.currentStep);
        }
      }
      if (onboardingState.websiteUrl && !websiteUrl) {
        setWebsiteUrl(onboardingState.websiteUrl);
      }
    }
  }, [onboardingState, researches.length, websiteUrl]);

  useEffect(() => {
    if (researches.length > 0 && !research) {
      setResearch(researches[0]);
    }
  }, [researches, research]);

  const persistStep = async (nextStep: number, extra: Record<string, unknown> = {}) => {
    setStep(nextStep);
    if (!organization?._id) return;
    const updated = await apiRequest(`/api/organizations/${organization._id}/onboarding`, {
      method: 'PATCH',
      body: JSON.stringify({ currentStep: nextStep, ...extra })
    });
    queryClient.setQueryData(['onboarding', organization._id], updated);
  };

  const handleRunResearch = async () => {
    if (!websiteUrl.trim()) {
      addToast({ type: 'error', title: 'Website required', description: 'Enter a valid public website URL.' });
      return;
    }
    setLoading(true);
    try {
      await persistStep(2, { websiteUrl });
      const res = await apiRequest<{ research: ResearchDoc }>('/api/research/company', {
        method: 'POST',
        body: JSON.stringify({ websiteUrl })
      });
      let latest = res.research;
      for (let i = 0; i < 15 && latest.status !== 'completed' && latest.status !== 'failed'; i++) {
        await new Promise((r) => setTimeout(r, 800));
        latest = await apiRequest<ResearchDoc>(`/api/research/company/${latest._id}`);
      }
      setResearch(latest);
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      await persistStep(3, { researchId: latest._id });
      addToast({ type: 'success', title: 'Company research complete' });
    } catch (err) {
      addToast({ type: 'error', title: 'Research failed', description: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfileAndNext = async () => {
    if (!research) return;
    setLoading(true);
    try {
      const updated = await apiRequest<ResearchDoc>(`/api/research/company/${research._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: research.companyName,
          industry: research.industry,
          companyOverview: research.companyOverview,
          productSummary: research.productSummary,
          businessPositioning: research.businessPositioning
        })
      });
      setResearch(updated);
      if (competitors.length === 0) {
        await apiRequest('/api/competitors/discover', {
          method: 'POST',
          body: JSON.stringify({ researchId: updated._id })
        });
        await refetchCompetitors();
      }
      await persistStep(4);
    } catch (err) {
      addToast({ type: 'error', title: 'Could not advance', description: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverIcpsAndNext = async () => {
    setLoading(true);
    try {
      if (icps.length === 0) {
        await apiRequest('/api/icp/generate', {
          method: 'POST',
          body: JSON.stringify({ researchId: research?._id })
        });
        await refetchIcps();
      }
      await persistStep(5);
    } catch (err) {
      addToast({ type: 'error', title: 'ICP generation failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOnboarding = async () => {
    setLoading(true);
    try {
      await apiRequest('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName,
          icpId: icps[0]?._id,
          segment: icps[0]?.name || research?.suggestedSegments?.[0]?.name || 'Core ICP',
          objective: campaignObjective,
          testMode: true,
          status: 'Ready for review'
        })
      });
      if (organization?._id) {
        await apiRequest(`/api/organizations/${organization._id}/onboarding`, {
          method: 'PATCH',
          body: JSON.stringify({ approved: true, completed: true, currentStep: 8 })
        });
        setOrganization({
          ...organization,
          onboarding: { ...organization.onboarding, currentStep: 8, completed: true }
        });
      }
      await persistStep(8);
      addToast({ type: 'success', title: 'Onboarding approved!', description: 'Suggested draft campaign created.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Approval failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  };

  const pct = Math.round((step / 8) * 100);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#111622]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Guided AI Onboarding</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Progress is persisted step-by-step so you can pause and resume anytime.
            </p>
          </div>
          <Badge tone="indigo">
            Step {step} of 8 ({pct}%)
          </Badge>
        </div>

        {/* Continuous Progress Bar */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-blue-700 transition-all duration-300 dark:bg-blue-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Stepper Rail */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {STEPS.map((label, idx) => {
            const num = idx + 1;
            const active = step === num;
            const done = step > num;
            return (
              <button
                key={label}
                type="button"
                onClick={() => num <= Math.max(step, onboardingState?.currentStep || 1) && setStep(num)}
                className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-colors ${
                  active
                    ? 'border-slate-950 bg-slate-950 text-white dark:border-blue-500 dark:bg-blue-600/20 dark:text-blue-300'
                    : done
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'border-stone-200 bg-[#FAF9F6] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 1: Enter Company Website */}
      {step === 1 && (
        <Card>
          <CardHeader title="Step 1: Enter Your Company Website" description="Our SSRF-safe AI agent inspects public pages to understand what you sell." />
          <CardContent className="space-y-4">
            <Input
              label="Company Website URL"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">Estimated cost: 10 credits</span>
              <Button onClick={handleRunResearch} loading={loading}>
                <Globe className="h-4 w-4" />
                Start AI Company Research
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Researching */}
      {step === 2 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-700 dark:text-blue-400" />
            <h3 className="font-display mt-4 text-base font-bold">Researching {websiteUrl}...</h3>
            <p className="mt-1 text-xs text-slate-500">
              Validating domain, extracting public page content, and synthesizing positioning.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px]">
              <Badge tone="success">1. SSRF DNS Validation</Badge>
              <Badge tone="indigo">2. Extracting Pages</Badge>
              <Badge tone="neutral">3. Structuring Profile</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Company Profile */}
      {step === 3 && research && (
        <Card>
          <CardHeader
            title="Step 3: Review Your AI Company Profile"
            description="Edit any details before discovering competitors."
            actions={<Badge tone={research.aiMode === 'live' ? 'success' : 'indigo'}>{research.aiMode === 'live' ? 'Live AI' : 'Demo AI Mode'}</Badge>}
          />
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Company Name"
                value={research.companyName}
                onChange={(e) => setResearch({ ...research, companyName: e.target.value })}
              />
              <Input
                label="Industry"
                value={research.industry}
                onChange={(e) => setResearch({ ...research, industry: e.target.value })}
              />
            </div>
            <Textarea
              label="Company Overview"
              value={research.companyOverview}
              onChange={(e) => setResearch({ ...research, companyOverview: e.target.value })}
            />
            <Textarea
              label="Business Positioning"
              value={research.businessPositioning}
              onChange={(e) => setResearch({ ...research, businessPositioning: e.target.value })}
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleSaveProfileAndNext} loading={loading}>
                Save & Discover Competitors (5 credits)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Competitors */}
      {step === 4 && (
        <Card>
          <CardHeader title="Step 4: Discovered Competitors" description="Review market alternatives and differentiation gaps." />
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {competitors.map((comp) => (
                <div key={comp._id} className="rounded-xl border border-stone-200 p-4 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Swords className="h-4 w-4 text-blue-600" />
                    {comp.name}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{comp.positioning}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button onClick={handleDiscoverIcpsAndNext} loading={loading}>
                Generate Target ICPs (5 credits)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: ICPs */}
      {step === 5 && (
        <Card>
          <CardHeader title="Step 5: Ideal Customer Profiles" description="AI-scored buyer segments ready for prospecting." />
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {icps.map((icp) => (
                <div key={icp._id} className="rounded-xl border border-stone-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                      <Target className="h-4 w-4 text-blue-600" />
                      {icp.name}
                    </span>
                    <Badge tone="success">Score: {icp.relevanceScore}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Titles: {icp.jobTitles.join(', ')}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)}>
                Back
              </Button>
              <Button onClick={() => persistStep(6)}>Preview Suggested Campaign</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Suggested Campaigns */}
      {step === 6 && (
        <Card>
          <CardHeader title="Step 6: Suggested Starter Campaign" description="Customize your draft campaign before approval." />
          <CardContent className="space-y-4">
            <Input
              label="Campaign Name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
            <Input
              label="Campaign Objective"
              value={campaignObjective}
              onChange={(e) => setCampaignObjective(e.target.value)}
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(5)}>
                Back
              </Button>
              <Button onClick={() => persistStep(7)}>Continue to Review</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 7: Edit & Approve */}
      {step === 7 && (
        <Card>
          <CardHeader title="Step 7: Approve Onboarding Plan" description="Your campaign will be created in Ready for review status (safe Sandbox mode by default)." />
          <CardContent className="space-y-4">
            <div className="space-y-1.5 rounded-xl border border-stone-200 bg-[#FAF9F6] p-4 text-xs dark:border-slate-800 dark:bg-slate-950">
              <p><strong>Company:</strong> {research?.companyName || websiteUrl}</p>
              <p><strong>Competitors Mapped:</strong> {competitors.length}</p>
              <p><strong>ICPs Generated:</strong> {icps.length}</p>
              <p><strong>Draft Campaign:</strong> {campaignName} ({campaignObjective})</p>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(6)}>
                Back
              </Button>
              <Button onClick={handleApproveOnboarding} loading={loading}>
                <Sparkles className="h-4 w-4" />
                Approve & Create Draft Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 8: Done */}
      {step === 8 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="font-display mt-4 text-lg font-bold">Your Ekiddy Outreach AI workspace is ready!</h3>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Head to your main dashboard to search decision-makers, verify emails, and launch your approved campaign.
            </p>
            <Button className="mt-5" onClick={() => navigate('/app')}>
              <Compass className="h-4 w-4" />
              Enter Main Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
