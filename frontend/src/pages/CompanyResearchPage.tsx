import React, { useEffect, useState } from 'react';
import { Globe, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  PageSkeleton,
  StatusIndicator,
  Textarea
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';

interface CompanyResearchItem {
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
  customerPersonas: Array<{ role: string; painPoints: string[]; goals: string[] }>;
  suggestedSegments: Array<{ name: string; description: string; rationale: string }>;
  suggestedOpportunities: string[];
  aiMode: 'live' | 'demo';
  aiProvider: string;
  errorMessage?: string;
  createdAt: string;
}

export function CompanyResearchPage() {
  const queryClient = useQueryClient();
  const { organization, addToast } = useAppStore();
  const [websiteUrl, setWebsiteUrl] = useState(organization?.website || '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyResearchItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['company-researches', organization?._id],
    queryFn: () => apiRequest<CompanyResearchItem[]>('/api/research/company'),
    enabled: Boolean(organization?._id)
  });

  useEffect(() => {
    if (history.length > 0) {
      const target = history.find((h) => h._id === selectedId) || history[0];
      setSelectedId(target._id);
      setDraft(target);
    }
  }, [history, selectedId]);

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ research: CompanyResearchItem }>('/api/research/company', {
        method: 'POST',
        body: JSON.stringify({ websiteUrl })
      });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      setSelectedId(res.research._id);
      setDraft(res.research);
      addToast({ type: 'success', title: 'Company research complete' });
    } catch (err) {
      addToast({ type: 'error', title: 'Research failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSubmitting(true);
    try {
      const updated = await apiRequest<CompanyResearchItem>(`/api/research/company/${draft._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: draft.companyName,
          industry: draft.industry,
          companyOverview: draft.companyOverview,
          productSummary: draft.productSummary,
          serviceSummary: draft.serviceSummary,
          pricingSummary: draft.pricingSummary,
          targetMarket: draft.targetMarket,
          businessPositioning: draft.businessPositioning,
          uniqueSellingPoints: draft.uniqueSellingPoints,
          suggestedOpportunities: draft.suggestedOpportunities
        })
      });
      setDraft(updated);
      await refetch();
      addToast({ type: 'success', title: 'Research profile saved' });
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (id: string) => {
    setSubmitting(true);
    try {
      const res = await apiRequest<{ research: CompanyResearchItem }>(`/api/research/company/${id}/retry`, {
        method: 'POST'
      });
      setDraft(res.research);
      await refetch();
      addToast({ type: 'success', title: 'Research re-executed' });
    } catch (err) {
      addToast({ type: 'error', title: 'Retry failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AI Company Research Agent</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            SSRF-protected crawler + structured AI positioning, pricing, persona, and segment extraction (10 credits/run).
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleResearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Target Company Website URL"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
            <Button type="submit" loading={submitting}>
              <Sparkles className="h-4 w-4" />
              Analyze Website (10 credits)
            </Button>
          </form>
        </CardContent>
      </Card>

      {history.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-5 w-5" />}
          title="No company research runs yet"
          description="Submit your website URL above to generate products, personas, segments, and outreach angles."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* History sidebar */}
          <Card>
            <CardHeader title="Research History" />
            <CardContent className="space-y-2 p-3">
              {history.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item._id);
                    setDraft(item);
                  }}
                  className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                    draft?._id === item._id
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{item.companyName || item.websiteUrl}</span>
                    <StatusIndicator status={item.status} />
                  </div>
                  <div className="mt-1 truncate text-[11px] text-slate-500">{item.websiteUrl}</div>
                  <div className="mt-1 text-[10px] text-slate-400">{formatDateTime(item.createdAt)}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Editable Profile */}
          {draft && (
            <Card className="lg:col-span-2">
              <CardHeader
                title={draft.companyName || draft.websiteUrl}
                description={draft.websiteUrl}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge tone={draft.aiMode === 'live' ? 'success' : 'indigo'}>
                      {draft.aiMode === 'live' ? `Live (${draft.aiProvider})` : 'Demo AI Fallback'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => handleRetry(draft._id)} loading={submitting}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                    <Button size="sm" onClick={handleSave} loading={submitting}>
                      <Save className="h-3.5 w-3.5" />
                      Save Edits
                    </Button>
                  </div>
                }
              />
              <CardContent className="space-y-4">
                {draft.errorMessage && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    {draft.errorMessage}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="Company Name"
                    value={draft.companyName}
                    onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
                  />
                  <Input
                    label="Industry Classification"
                    value={draft.industry}
                    onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
                  />
                </div>
                <Textarea
                  label="Company Overview"
                  value={draft.companyOverview}
                  onChange={(e) => setDraft({ ...draft, companyOverview: e.target.value })}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Textarea
                    label="Product Summary"
                    value={draft.productSummary}
                    onChange={(e) => setDraft({ ...draft, productSummary: e.target.value })}
                  />
                  <Textarea
                    label="Service Summary"
                    value={draft.serviceSummary}
                    onChange={(e) => setDraft({ ...draft, serviceSummary: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Textarea
                    label="Pricing Summary"
                    value={draft.pricingSummary}
                    onChange={(e) => setDraft({ ...draft, pricingSummary: e.target.value })}
                  />
                  <Textarea
                    label="Target Market & Positioning"
                    value={draft.businessPositioning}
                    onChange={(e) => setDraft({ ...draft, businessPositioning: e.target.value })}
                  />
                </div>

                {/* Personas & Segments */}
                <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-slate-800">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Customer Personas
                    </h4>
                    <div className="mt-2 space-y-2">
                      {draft.customerPersonas.map((p, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800">
                          <div className="font-semibold">{p.role}</div>
                          <div className="mt-1 text-slate-500">Pain: {p.painPoints.join(', ')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Suggested Segments & USPs
                    </h4>
                    <div className="mt-2 space-y-2">
                      {draft.suggestedSegments.map((seg, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800">
                          <div className="font-semibold">{seg.name}</div>
                          <div className="mt-0.5 text-slate-500">{seg.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
