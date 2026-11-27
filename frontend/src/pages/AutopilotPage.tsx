import { Bot, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  PageSkeleton
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface AutopilotPayload {
  autopilotSettings?: {
    enabled: boolean;
    requireApprovalForCampaignLaunch: boolean;
    requireApprovalForSpendChange: boolean;
    requireApprovalForReplies: boolean;
  };
  aiMode: 'live' | 'demo';
  recommendations: Array<{
    id: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    rationale: string;
    suggestedAction: string;
    requiresApproval: boolean;
  }>;
}

export function AutopilotPage() {
  const queryClient = useQueryClient();
  const { organization, addToast } = useAppStore();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['autopilot', organization?._id],
    queryFn: () => apiRequest<AutopilotPayload>('/api/analytics/autopilot/recommendations'),
    enabled: Boolean(organization?._id)
  });

  const updatePerm = async (patch: Record<string, boolean>) => {
    await apiRequest('/api/settings/autopilot', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
    await refetch();
    addToast({ type: 'success', title: 'Autopilot permissions updated' });
  };

  const applyRecommendation = async (id: string) => {
    try {
      await apiRequest(`/api/analytics/autopilot/recommendations/${id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ approved: true })
      });
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({ type: 'success', title: 'Recommendation authorized and logged' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed', description: err instanceof Error ? err.message : '' });
    }
  };

  if (isLoading) return <PageSkeleton />;

  const settings = data?.autopilotSettings;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AI Autopilot & Optimization</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitors delivery, bounce thresholds, and reply conversion — controlled by explicit authorization gates.
          </p>
        </div>
        <Badge tone={data?.aiMode === 'live' ? 'success' : 'indigo'}>
          {data?.aiMode === 'live' ? 'Live LLM Analysis' : 'Deterministic Diagnostics'}
        </Badge>
      </div>

      <Card>
        <CardHeader title="Autopilot Permission Guardrails" description="Require explicit user sign-off before sensitive outbound or spend actions." />
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            { key: 'enabled', label: 'Enable AI Autopilot continuous diagnostics', val: settings?.enabled },
            {
              key: 'requireApprovalForCampaignLaunch',
              label: 'Require approval before launching campaigns',
              val: settings?.requireApprovalForCampaignLaunch
            },
            {
              key: 'requireApprovalForSpendChange',
              label: 'Require approval before credit/spend changes',
              val: settings?.requireApprovalForSpendChange
            },
            {
              key: 'requireApprovalForReplies',
              label: 'Require approval before sending AI inbox replies',
              val: settings?.requireApprovalForReplies
            }
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"
            >
              <span className="inline-flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                {item.label}
              </span>
              <input
                type="checkbox"
                checked={Boolean(item.val)}
                onChange={(e) => updatePerm({ [item.key]: e.target.checked })}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {data?.recommendations.map((rec) => (
          <Card key={rec.id}>
            <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-semibold">{rec.title}</span>
                  <Badge tone={rec.priority === 'high' ? 'danger' : 'indigo'}>{rec.priority}</Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{rec.rationale}</p>
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  Suggested: {rec.suggestedAction}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => applyRecommendation(rec.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve & Apply (3 cr)
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
