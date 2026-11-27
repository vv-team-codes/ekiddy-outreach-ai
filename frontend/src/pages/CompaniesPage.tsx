import React, { useState } from 'react';
import { Building2, Plus, Search, Trash2 } from 'lucide-react';
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
  PageSkeleton
} from '@/components/ui';
import { apiRequest, apiRequestWithMeta } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface CompanyItem {
  _id: string;
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  category?: string;
  location?: string;
  employeeRange?: string;
  source: string;
  isDemoData: boolean;
}

export function CompaniesPage() {
  const queryClient = useQueryClient();
  const { organization, addToast } = useAppStore();
  const [page, setPage] = useState(1);
  const [searchFilters, setSearchFilters] = useState({
    query: '',
    industry: '',
    location: '',
    domain: '',
    employeeRange: '',
    category: ''
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    domain: '',
    industry: '',
    location: '',
    employeeRange: ''
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['companies', organization?._id, page, searchFilters.query],
    queryFn: () =>
      apiRequestWithMeta<CompanyItem[]>(
        `/api/companies?page=${page}&limit=15&q=${encodeURIComponent(searchFilters.query)}`
      ),
    enabled: Boolean(organization?._id)
  });

  const companies = data?.data || [];
  const totalPages = Number(data?.meta?.totalPages || 1);

  const handleProviderSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest<{ mode: string; provider: string; companies: CompanyItem[] }>(
        '/api/companies/search',
        {
          method: 'POST',
          body: JSON.stringify({ ...searchFilters, saveResults: true })
        }
      );
      setSearchMode(res.mode);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({
        type: 'success',
        title: `Discovered ${res.companies.length} companies`,
        description: res.mode === 'demo' ? 'Using transparent Demo Sample Directory.' : `Provider: ${res.provider}`
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Search failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/api/companies', { method: 'POST', body: JSON.stringify(manualForm) });
      setModalOpen(false);
      setManualForm({ name: '', domain: '', industry: '', location: '', employeeRange: '' });
      await refetch();
      addToast({ type: 'success', title: 'Company saved' });
    } finally {
      setBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    await apiRequest('/api/companies/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', ids: Array.from(selected) })
    });
    setSelected(new Set());
    await refetch();
    addToast({ type: 'info', title: 'Selected companies removed' });
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Company Search & Directory</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search B2B companies by industry, geography, domain, category, and size.
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="danger" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selected.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>
      </div>

      {(searchMode === 'demo' || companies.some((c) => c.isDemoData)) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Sample Dataset Mode:</strong> No external B2B data provider key is configured, so searches
          surface clearly marked sample directory records without fabricating contacts. Connect Apollo or Hunter
          in Settings for live B2B company lookups.
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleProviderSearch} className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <Input
              placeholder="Keywords or company name"
              value={searchFilters.query}
              onChange={(e) => setSearchFilters({ ...searchFilters, query: e.target.value })}
            />
            <Input
              placeholder="Industry"
              value={searchFilters.industry}
              onChange={(e) => setSearchFilters({ ...searchFilters, industry: e.target.value })}
            />
            <Input
              placeholder="Location"
              value={searchFilters.location}
              onChange={(e) => setSearchFilters({ ...searchFilters, location: e.target.value })}
            />
            <Input
              placeholder="Domain"
              value={searchFilters.domain}
              onChange={(e) => setSearchFilters({ ...searchFilters, domain: e.target.value })}
            />
            <Input
              placeholder="Size (e.g. 51-200)"
              value={searchFilters.employeeRange}
              onChange={(e) => setSearchFilters({ ...searchFilters, employeeRange: e.target.value })}
            />
            <Button type="submit" loading={busy}>
              <Search className="h-4 w-4" />
              Search (2 cr)
            </Button>
          </form>
        </CardContent>
      </Card>

      <DataTable
        data={companies}
        keyExtractor={(c) => c._id}
        selectedIds={selected}
        onToggleSelect={(id) => {
          const next = new Set(selected);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setSelected(next);
        }}
        onToggleAll={() => {
          if (selected.size === companies.length) setSelected(new Set());
          else setSelected(new Set(companies.map((c) => c._id)));
        }}
        emptyState={
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No companies saved yet"
            description="Run a company search above or add target accounts manually."
          />
        }
        columns={[
          {
            key: 'name',
            header: 'Company',
            render: (c) => (
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</div>
                <div className="text-xs text-slate-500">{c.domain || c.website || '—'}</div>
              </div>
            )
          },
          { key: 'industry', header: 'Industry', render: (c) => c.industry || '—' },
          { key: 'location', header: 'Location', render: (c) => c.location || '—' },
          { key: 'size', header: 'Size', render: (c) => c.employeeRange || '—' },
          {
            key: 'source',
            header: 'Source',
            render: (c) => (
              <Badge tone={c.isDemoData ? 'warning' : 'success'}>
                {c.isDemoData ? 'Demo Sample' : c.source}
              </Badge>
            )
          }
        ]}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Target Company">
        <form onSubmit={handleCreateManual} className="space-y-3">
          <Input label="Company Name" required value={manualForm.name} onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })} />
          <Input label="Domain" placeholder="company.com" value={manualForm.domain} onChange={(e) => setManualForm({ ...manualForm, domain: e.target.value })} />
          <Input label="Industry" value={manualForm.industry} onChange={(e) => setManualForm({ ...manualForm, industry: e.target.value })} />
          <Input label="Location" value={manualForm.location} onChange={(e) => setManualForm({ ...manualForm, location: e.target.value })} />
          <Input label="Employee Range" value={manualForm.employeeRange} onChange={(e) => setManualForm({ ...manualForm, employeeRange: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Save Company</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
