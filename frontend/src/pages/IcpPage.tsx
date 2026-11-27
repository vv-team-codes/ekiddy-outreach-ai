import React, { useState } from 'react';
import { Copy, Plus, Sparkles, Target, Trash2 } from 'lucide-react';
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
  PageSkeleton
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface IcpItem {
  _id: string;
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
}

export function IcpPage() {
  const queryClient = useQueryClient();
  const { organization, addToast } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    industries: 'B2B SaaS, FinTech',
    locations: 'United States, United Kingdom',
    companySizes: '11-50, 51-200',
    jobTitles: 'VP of Sales, Head of Growth',
    departments: 'Sales, Growth',
    businessChallenges: 'Low outbound reply velocity',
    relevanceScore: 88
  });

  const { data: icps = [], isLoading, refetch } = useQuery({
    queryKey: ['icps', organization?._id],
    queryFn: () => apiRequest<IcpItem[]>('/api/icp'),
    enabled: Boolean(organization?._id)
  });

  const handleGenerate = async () => {
    setBusy(true);
    try {
      await apiRequest('/api/icp/generate', { method: 'POST', body: JSON.stringify({}) });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({ type: 'success', title: 'ICPs generated' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const splitCsv = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/api/icp', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          industries: splitCsv(form.industries),
          locations: splitCsv(form.locations),
          companySizes: splitCsv(form.companySizes),
          jobTitles: splitCsv(form.jobTitles),
          departments: splitCsv(form.departments),
          businessChallenges: splitCsv(form.businessChallenges),
          relevanceScore: Number(form.relevanceScore)
        })
      });
      setModalOpen(false);
      await refetch();
      addToast({ type: 'success', title: 'ICP saved' });
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    await apiRequest(`/api/icp/${id}/duplicate`, { method: 'POST' });
    await refetch();
    addToast({ type: 'success', title: 'ICP duplicated' });
  };

  const handleDelete = async (id: string) => {
    await apiRequest(`/api/icp/${id}`, { method: 'DELETE' });
    await refetch();
    addToast({ type: 'info', title: 'ICP deleted' });
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Ideal Customer Profile (ICP) Engine</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define scored target customer segments by industry, geography, firmographics, and buyer personas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New ICP
          </Button>
          <Button size="sm" onClick={handleGenerate} loading={busy}>
            <Sparkles className="h-4 w-4" />
            Generate ICPs (5 credits)
          </Button>
        </div>
      </div>

      {icps.length === 0 ? (
        <EmptyState
          icon={<Target className="h-5 w-5" />}
          title="No Ideal Customer Profiles yet"
          description="Generate ICPs automatically from your company research or create custom buyer segments."
          action={<Button onClick={handleGenerate} loading={busy}>Generate ICPs</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {icps.map((icp) => (
            <Card key={icp._id}>
              <CardHeader
                title={icp.name}
                description={icp.segmentTag || 'Target Segment'}
                actions={
                  <div className="flex items-center gap-1.5">
                    <Badge tone={icp.relevanceScore >= 85 ? 'success' : 'indigo'}>
                      Fit: {icp.relevanceScore}/100
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(icp._id)} aria-label="Duplicate ICP">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(icp._id)} aria-label="Delete ICP">
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </div>
                }
              />
              <CardContent className="space-y-2 text-xs">
                <div><strong>Industries:</strong> {icp.industries.join(', ') || '—'}</div>
                <div><strong>Locations:</strong> {icp.locations.join(', ') || '—'}</div>
                <div><strong>Company Size:</strong> {icp.companySizes.join(', ') || '—'}</div>
                <div><strong>Job Titles:</strong> {icp.jobTitles.join(', ') || '—'}</div>
                <div><strong>Departments:</strong> {icp.departments.join(', ') || '—'}</div>
                <div><strong>Challenges:</strong> {icp.businessChallenges.join('; ') || '—'}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Ideal Customer Profile">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Profile Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Industries (comma-separated)" value={form.industries} onChange={(e) => setForm({ ...form, industries: e.target.value })} />
          <Input label="Locations" value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} />
          <Input label="Company Sizes" value={form.companySizes} onChange={(e) => setForm({ ...form, companySizes: e.target.value })} />
          <Input label="Target Job Titles" value={form.jobTitles} onChange={(e) => setForm({ ...form, jobTitles: e.target.value })} />
          <Input label="Departments" value={form.departments} onChange={(e) => setForm({ ...form, departments: e.target.value })} />
          <Input label="Business Challenges" value={form.businessChallenges} onChange={(e) => setForm({ ...form, businessChallenges: e.target.value })} />
          <Input
            label="Relevance Score (0-100)"
            type="number"
            min={0}
            max={100}
            value={form.relevanceScore}
            onChange={(e) => setForm({ ...form, relevanceScore: Number(e.target.value) })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Create ICP</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
