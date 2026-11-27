import React, { useState } from 'react';
import { Plus, RefreshCw, Sparkles, Swords, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageSkeleton,
  Textarea
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface CompetitorItem {
  _id: string;
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
}

export function CompetitorsPage() {
  const queryClient = useQueryClient();
  const { organization, addToast } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', website: '', industry: '', positioning: '', targetAudience: '' });

  const { data: competitors = [], isLoading, refetch } = useQuery({
    queryKey: ['competitors', organization?._id],
    queryFn: () => apiRequest<CompetitorItem[]>('/api/competitors'),
    enabled: Boolean(organization?._id)
  });

  const handleDiscover = async () => {
    setBusy(true);
    try {
      await apiRequest('/api/competitors/discover', { method: 'POST', body: JSON.stringify({}) });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({ type: 'success', title: 'Competitors discovered' });
    } catch (err) {
      addToast({ type: 'error', title: 'Discovery failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/api/competitors', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', website: '', industry: '', positioning: '', targetAudience: '' });
      setModalOpen(false);
      await refetch();
      addToast({ type: 'success', title: 'Competitor added' });
    } catch (err) {
      addToast({ type: 'error', title: 'Add failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async (id: string) => {
    setBusy(true);
    try {
      await apiRequest(`/api/competitors/${id}/refresh`, { method: 'POST' });
      await refetch();
      addToast({ type: 'success', title: 'Competitor research refreshed' });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiRequest(`/api/competitors/${id}`, { method: 'DELETE' });
    await refetch();
    addToast({ type: 'info', title: 'Competitor removed' });
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Competitor Discovery & Comparison</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Benchmark competing products, positioning, target audiences, and differentiation angles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Competitor
          </Button>
          <Button size="sm" onClick={handleDiscover} loading={busy}>
            <Sparkles className="h-4 w-4" />
            Discover via AI (5 credits)
          </Button>
        </div>
      </div>

      {competitors.length === 0 ? (
        <EmptyState
          icon={<Swords className="h-5 w-5" />}
          title="No competitors tracked yet"
          description="Use AI discovery based on your company research or add a competitor manually."
          action={
            <Button onClick={handleDiscover} loading={busy}>
              Run Competitor Discovery
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {competitors.map((comp) => (
            <Card key={comp._id}>
              <CardHeader
                title={comp.name}
                description={comp.website || comp.industry}
                actions={
                  <div className="flex items-center gap-1.5">
                    <Badge tone={comp.source === 'ai' ? 'indigo' : 'neutral'}>{comp.source}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleRefresh(comp._id)} aria-label="Refresh competitor">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(comp._id)} aria-label="Delete competitor">
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </div>
                }
              />
              <CardContent className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Positioning: </span>
                  <span className="text-slate-600 dark:text-slate-400">{comp.positioning || '—'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Target Audience: </span>
                  <span className="text-slate-600 dark:text-slate-400">{comp.targetAudience || '—'}</span>
                </div>
                {comp.comparisonNotes && (
                  <div className="rounded-lg bg-slate-50 p-2.5 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    <strong>Comparison:</strong> {comp.comparisonNotes}
                  </div>
                )}
                {comp.opportunities?.length > 0 && (
                  <div>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Opportunities:</span>
                    <ul className="mt-1 list-disc pl-4 text-slate-600 dark:text-slate-400">
                      {comp.opportunities.map((o, idx) => (
                        <li key={idx}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Competitor Manually">
        <form onSubmit={handleAdd} className="space-y-3.5">
          <Input
            label="Competitor Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Website"
            placeholder="https://competitor.com"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
          <Input
            label="Industry"
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
          />
          <Textarea
            label="Positioning"
            value={form.positioning}
            onChange={(e) => setForm({ ...form, positioning: e.target.value })}
          />
          <Input
            label="Target Audience"
            value={form.targetAudience}
            onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save Competitor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
