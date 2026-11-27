import React, { useState } from 'react';
import { CheckCircle2, Mail, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Modal,
  PageSkeleton,
  Select,
  StatusIndicator
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface SendingAccountItem {
  _id: string;
  email: string;
  fromName: string;
  domain: string;
  provider: 'sandbox' | 'smtp' | 'resend';
  dailyLimit: number;
  sentToday: number;
  verified: boolean;
  status: string;
  dnsStatus: {
    spfValid: boolean;
    dkimConfigured: boolean;
    dmarcValid: boolean;
    guidance?: string[];
  };
}

export function SendingAccountsPage() {
  const { organization, addToast } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [suppressEmail, setSuppressEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: '',
    fromName: '',
    provider: 'sandbox' as 'sandbox' | 'smtp' | 'resend',
    dailyLimit: 50,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    apiKey: ''
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sending-accounts', organization?._id],
    queryFn: () =>
      apiRequest<{
        accounts: SendingAccountItem[];
        suppressions: Array<{ _id: string; email: string; reason: string }>;
      }>('/api/sending-accounts'),
    enabled: Boolean(organization?._id)
  });

  const accounts = data?.accounts || [];
  const suppressions = data?.suppressions || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/api/sending-accounts', { method: 'POST', body: JSON.stringify(form) });
      setModalOpen(false);
      await refetch();
      addToast({ type: 'success', title: 'Sending account added' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleCheckDns = async (id: string) => {
    setBusy(true);
    try {
      await apiRequest(`/api/sending-accounts/${id}/check-dns`, { method: 'POST' });
      await refetch();
      addToast({ type: 'info', title: 'DNS SPF/DKIM/DMARC check finished' });
    } finally {
      setBusy(false);
    }
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppressEmail.trim()) return;
    await apiRequest('/api/sending-accounts/suppressions', {
      method: 'POST',
      body: JSON.stringify({ email: suppressEmail, reason: 'manual' })
    });
    setSuppressEmail('');
    await refetch();
    addToast({ type: 'success', title: 'Added to suppression list' });
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Email Infrastructure & DNS Compliance</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage sender accounts, inspect live SPF/DKIM/DMARC records, daily limits, and opt-out suppression lists.
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Connect Sender Account
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {accounts.map((acc) => (
          <Card key={acc._id}>
            <CardHeader
              title={acc.email}
              description={`${acc.fromName} • Provider: ${acc.provider}`}
              actions={
                <div className="flex items-center gap-1.5">
                  <StatusIndicator status={acc.status} />
                  <Button variant="outline" size="sm" onClick={() => handleCheckDns(acc._id)} loading={busy}>
                    Check DNS
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await apiRequest(`/api/sending-accounts/${acc._id}`, { method: 'DELETE' });
                      await refetch();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                </div>
              }
            />
            <CardContent className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-2">
                <Badge tone={acc.dnsStatus.spfValid ? 'success' : 'warning'}>
                  SPF: {acc.dnsStatus.spfValid ? 'Valid' : 'Missing'}
                </Badge>
                <Badge tone={acc.dnsStatus.dkimConfigured ? 'success' : 'warning'}>
                  DKIM: {acc.dnsStatus.dkimConfigured ? 'Configured' : 'Unverified'}
                </Badge>
                <Badge tone={acc.dnsStatus.dmarcValid ? 'success' : 'warning'}>
                  DMARC: {acc.dnsStatus.dmarcValid ? 'Valid' : 'Missing'}
                </Badge>
              </div>
              <div className="text-slate-500">
                Daily sending usage: <strong>{acc.sentToday}</strong> / {acc.dailyLimit}
              </div>
              {acc.dnsStatus.guidance && acc.dnsStatus.guidance.length > 0 && (
                <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  {acc.dnsStatus.guidance.map((g, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      {acc.verified ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Suppression List */}
      <Card>
        <CardHeader
          title="Opt-Out & Bounce Suppression List"
          description="Contacts on this list are automatically skipped across all outbound campaigns and replies."
        />
        <CardContent className="space-y-4">
          <form onSubmit={handleAddSuppression} className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="prospect@domain.com"
              value={suppressEmail}
              onChange={(e) => setSuppressEmail(e.target.value)}
            />
            <Button type="submit" variant="outline">
              <Mail className="h-4 w-4" />
              Add Suppression
            </Button>
          </form>
          <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {suppressions.map((s) => (
              <div key={s._id} className="flex items-center justify-between py-2">
                <span className="font-mono">{s.email}</span>
                <Badge tone="danger">{s.reason}</Badge>
              </div>
            ))}
            {suppressions.length === 0 && <p className="text-slate-400">No suppressed addresses yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Connect Sending Account">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Sender Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Display From Name" required value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} />
          <Select
            label="Sending Provider"
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value as typeof form.provider })}
            options={[
              { label: 'Sandbox Test Mode', value: 'sandbox' },
              { label: 'Resend API', value: 'resend' },
              { label: 'Custom SMTP', value: 'smtp' }
            ]}
          />
          {form.provider === 'resend' && (
            <Input label="Resend API Key" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
          )}
          {form.provider === 'smtp' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="SMTP Host" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} />
              <Input label="SMTP Port" type="number" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })} />
              <Input label="SMTP Username" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} />
              <Input label="SMTP Password" type="password" value={form.smtpPass} onChange={(e) => setForm({ ...form, smtpPass: e.target.value })} />
            </div>
          )}
          <Input label="Daily Limit" type="number" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: Number(e.target.value) })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Save Account</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
