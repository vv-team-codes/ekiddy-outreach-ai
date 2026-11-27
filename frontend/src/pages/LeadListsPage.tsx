import React, { useState } from 'react';
import { Download, ListChecks, Plus, Trash2, Upload } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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

interface LeadListItem {
  _id: string;
  name: string;
  description?: string;
  contactIds: Array<{ _id: string; fullName: string; email?: string; emailStatus: string }>;
}

export function LeadListsPage() {
  const { token, organization, addToast } = useAppStore();
  const [listName, setListName] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('fullName,email,jobTitle,companyName\nJane Doe,jane@acme.com,VP Growth,Acme Inc');
  const [selectedListId, setSelectedListId] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: lists = [], isLoading, refetch } = useQuery({
    queryKey: ['lead-lists', organization?._id],
    queryFn: () => apiRequest<LeadListItem[]>('/api/leads/lists'),
    enabled: Boolean(organization?._id)
  });

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) return;
    setBusy(true);
    try {
      await apiRequest('/api/leads/lists', { method: 'POST', body: JSON.stringify({ name: listName }) });
      setListName('');
      await refetch();
      addToast({ type: 'success', title: 'Lead list created' });
    } finally {
      setBusy(false);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest<{ imported: number; duplicatesSkipped: number }>('/api/leads/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csvText, listId: selectedListId || undefined })
      });
      setImportOpen(false);
      await refetch();
      addToast({
        type: 'success',
        title: `Imported ${res.imported} contacts`,
        description: `${res.duplicatesSkipped} duplicate emails skipped.`
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Import failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = async () => {
    const res = await fetch('/api/leads/export-csv', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(organization?._id ? { 'x-organization-id': organization._id } : {})
      }
    });
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ekiddy-contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Lead Lists & CSV Data</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organize target contacts into lists, import CSVs with automatic duplicate detection, and export records.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleCreateList} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Create New Lead List"
                placeholder="e.g. Q4 US SaaS VP Sales"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
              />
            </div>
            <Button type="submit" loading={busy}>
              <Plus className="h-4 w-4" />
              Create List
            </Button>
          </form>
        </CardContent>
      </Card>

      {lists.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-5 w-5" />}
          title="No lead lists yet"
          description="Create a list above or import a CSV of contacts."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {lists.map((list) => (
            <Card key={list._id}>
              <CardHeader
                title={list.name}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge tone="indigo">{list.contactIds?.length || 0} contacts</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await apiRequest(`/api/leads/lists/${list._id}`, { method: 'DELETE' });
                        await refetch();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </div>
                }
              />
              <CardContent className="space-y-1.5 text-xs">
                {list.contactIds.slice(0, 5).map((c) => (
                  <div key={c._id} className="flex items-center justify-between">
                    <span>{c.fullName}</span>
                    <span className="text-slate-500">{c.email || '—'}</span>
                  </div>
                ))}
                {list.contactIds.length === 0 && (
                  <p className="text-slate-400">No contacts assigned yet.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import Contacts via CSV">
        <form onSubmit={handleImportCsv} className="space-y-3.5">
          {lists.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium">Assign to List (optional)</label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">None</option>
                {lists.map((l) => (
                  <option key={l._id} value={l._id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
          <Textarea
            label="CSV Content (headers: fullName, email, jobTitle, companyName, location)"
            rows={7}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Import Contacts</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
