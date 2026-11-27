import React, { useState } from 'react';
import { CheckCheck, Plus, Search, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageSkeleton,
  Select,
  StatusIndicator
} from '@/components/ui';
import { apiRequest, apiRequestWithMeta } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface ContactItem {
  _id: string;
  fullName: string;
  jobTitle?: string;
  department?: string;
  companyName?: string;
  location?: string;
  email?: string;
  emailStatus: 'verified' | 'unverified' | 'unknown' | 'invalid';
  leadScore: number;
  stage: string;
  isDemoData: boolean;
}

export function PeoplePage() {
  const queryClient = useQueryClient();
  const { organization, addToast } = useAppStore();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [filters, setFilters] = useState({
    query: '',
    jobTitle: '',
    department: '',
    companyName: '',
    location: ''
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualForm, setManualForm] = useState({
    fullName: '',
    email: '',
    jobTitle: '',
    department: '',
    companyName: '',
    location: ''
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['people', organization?._id, page, filters.query, statusFilter],
    queryFn: () =>
      apiRequestWithMeta<ContactItem[]>(
        `/api/people?page=${page}&limit=15&q=${encodeURIComponent(filters.query)}&emailStatus=${encodeURIComponent(statusFilter)}`
      ),
    enabled: Boolean(organization?._id)
  });

  const contacts = data?.data || [];
  const totalPages = Number(data?.meta?.totalPages || 1);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest<{ mode: string; contacts: ContactItem[] }>('/api/people/search', {
        method: 'POST',
        body: JSON.stringify({ ...filters, saveResults: true })
      });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({
        type: 'success',
        title: `Loaded ${res.contacts.length} decision-makers`,
        description: res.mode === 'demo' ? 'Sample directory mode (connect Apollo/Hunter for live lookup).' : undefined
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Search failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOne = async (id: string) => {
    setBusy(true);
    try {
      await apiRequest(`/api/people/${id}/verify-email`, { method: 'POST' });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({ type: 'success', title: 'Email verification complete' });
    } catch (err) {
      addToast({ type: 'error', title: 'Verification failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleEnrichOne = async (id: string) => {
    setBusy(true);
    try {
      await apiRequest(`/api/people/${id}/enrich`, { method: 'POST' });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({ type: 'success', title: 'Contact enriched & scored' });
    } catch (err) {
      addToast({ type: 'error', title: 'Enrich failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleBulkAction = async (action: 'verify' | 'delete') => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await apiRequest('/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({ action, ids: Array.from(selected) })
      });
      setSelected(new Set());
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({ type: 'success', title: action === 'verify' ? 'Bulk verification complete' : 'Contacts deleted' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/api/people', { method: 'POST', body: JSON.stringify(manualForm) });
      setModalOpen(false);
      setManualForm({ fullName: '', email: '', jobTitle: '', department: '', companyName: '', location: '' });
      await refetch();
      addToast({ type: 'success', title: 'Contact added' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">People Search & Verification</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Find decision-makers, inspect verification status (verified, unverified, unknown, invalid), and score leads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleBulkAction('verify')} loading={busy}>
                <CheckCheck className="h-3.5 w-3.5" />
                Verify ({selected.size})
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleBulkAction('delete')} loading={busy}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({selected.size})
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <Input
              placeholder="Name or keyword"
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            />
            <Input
              placeholder="Job title (e.g. VP)"
              value={filters.jobTitle}
              onChange={(e) => setFilters({ ...filters, jobTitle: e.target.value })}
            />
            <Input
              placeholder="Company"
              value={filters.companyName}
              onChange={(e) => setFilters({ ...filters, companyName: e.target.value })}
            />
            <Input
              placeholder="Location"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All email statuses', value: '' },
                { label: 'Verified', value: 'verified' },
                { label: 'Unverified', value: 'unverified' },
                { label: 'Unknown', value: 'unknown' },
                { label: 'Invalid', value: 'invalid' }
              ]}
            />
            <Button type="submit" loading={busy}>
              <Search className="h-4 w-4" />
              Search (2 cr)
            </Button>
          </form>
        </CardContent>
      </Card>

      <DataTable
        data={contacts}
        keyExtractor={(c) => c._id}
        selectedIds={selected}
        onToggleSelect={(id) => {
          const next = new Set(selected);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setSelected(next);
        }}
        onToggleAll={() => {
          if (selected.size === contacts.length) setSelected(new Set());
          else setSelected(new Set(contacts.map((c) => c._id)));
        }}
        emptyState={
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No decision-makers found"
            description="Run a people search, import a CSV in Lead Lists, or add contacts manually."
          />
        }
        columns={[
          {
            key: 'name',
            header: 'Contact',
            render: (c) => (
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                  {c.fullName}
                  {c.isDemoData && <Badge tone="warning">Sample</Badge>}
                </div>
                <div className="text-xs text-slate-500">
                  {c.jobTitle || 'Role N/A'} {c.companyName ? `at ${c.companyName}` : ''}
                </div>
              </div>
            )
          },
          {
            key: 'email',
            header: 'Email & Verification',
            render: (c) => (
              <div className="space-y-1">
                <div className="text-xs font-mono">{c.email || '—'}</div>
                <StatusIndicator status={c.emailStatus} />
              </div>
            )
          },
          {
            key: 'score',
            header: 'Score',
            render: (c) => <Badge tone={c.leadScore >= 80 ? 'success' : 'neutral'}>{c.leadScore}/100</Badge>
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (c) => (
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => handleVerifyOne(c._id)} title="Verify email (1 credit)">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verify
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleEnrichOne(c._id)} title="Enrich (3 credits)">
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          }
        ]}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Decision-Maker Contact">
        <form onSubmit={handleCreateManual} className="space-y-3">
          <Input label="Full Name" required value={manualForm.fullName} onChange={(e) => setManualForm({ ...manualForm, fullName: e.target.value })} />
          <Input label="Email Address" type="email" value={manualForm.email} onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })} />
          <Input label="Job Title" value={manualForm.jobTitle} onChange={(e) => setManualForm({ ...manualForm, jobTitle: e.target.value })} />
          <Input label="Department" value={manualForm.department} onChange={(e) => setManualForm({ ...manualForm, department: e.target.value })} />
          <Input label="Company Name" value={manualForm.companyName} onChange={(e) => setManualForm({ ...manualForm, companyName: e.target.value })} />
          <Input label="Location" value={manualForm.location} onChange={(e) => setManualForm({ ...manualForm, location: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Save Contact</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
