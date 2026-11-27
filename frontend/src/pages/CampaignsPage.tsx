import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Pause,
  Play,
  Plus,
  Rocket,
  Send,
  Trash2
} from 'lucide-react';
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
  Select,
  StatusIndicator,
  Textarea
} from '@/components/ui';
import { apiRequest, apiRequestWithMeta } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface CampaignItem {
  _id: string;
  name: string;
  segment?: string;
  objective: string;
  status: string;
  testMode: boolean;
  dailySendLimit: number;
  approvedAt?: string;
  stats: {
    totalContacts: number;
    sent: number;
    delivered: number;
    bounced: number;
    replied: number;
    positiveReplies: number;
    meetingsBooked: number;
  };
}

const WIZARD_STEPS = [
  '1. Name',
  '2. ICP',
  '3. Segment',
  '4. Geography',
  '5. Industry',
  '6. Job Titles',
  '7. Targets',
  '8. Objective',
  '9. Sequence',
  '10. Review',
  '11. Approve'
];

export function CampaignsPage() {
  const queryClient = useQueryClient();
  const { organization, addToast } = useAppStore();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [eventsCampaignId, setEventsCampaignId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: 'Q4 Outbound SaaS Leaders',
    icpId: '',
    segment: 'Mid-Market SaaS',
    geography: 'United States, United Kingdom',
    industries: 'B2B SaaS, FinTech',
    jobTitles: 'VP of Sales, Head of Growth',
    targetCompanyIds: [] as string[],
    targetContactIds: [] as string[],
    objective: 'Book 15-minute qualified discovery calls',
    sendingAccountId: '',
    testMode: true,
    dailySendLimit: 30,
    step1Subject: 'Quick question for {{companyName}}',
    step1Body:
      'Hi {{firstName}},\n\nNoticed your leadership role as {{jobTitle}} at {{companyName}} and wanted to share how ekiddy Outreach AI streamlines pipeline generation.\n\nOpen to a brief chat?\n\nBest,\nTeam',
    step2Subject: 'Re: Quick question for {{companyName}}',
    step2Body:
      'Hi {{firstName}},\n\nFollowing up briefly in case this got buried. Happy to send a 2-minute overview tailored to {{companyName}}.\n\nBest,\nTeam'
  });

  const { data: campaigns = [], isLoading, refetch } = useQuery({
    queryKey: ['campaigns', organization?._id],
    queryFn: () => apiRequest<CampaignItem[]>('/api/campaigns'),
    enabled: Boolean(organization?._id)
  });

  const { data: icps = [] } = useQuery({
    queryKey: ['icps', organization?._id],
    queryFn: () => apiRequest<Array<{ _id: string; name: string }>>('/api/icp'),
    enabled: Boolean(organization?._id)
  });

  const { data: peopleRes } = useQuery({
    queryKey: ['people-picker', organization?._id],
    queryFn: () =>
      apiRequestWithMeta<Array<{ _id: string; fullName: string; email?: string; companyName?: string }>>(
        '/api/people?limit=50'
      ),
    enabled: Boolean(organization?._id)
  });

  const { data: companiesRes } = useQuery({
    queryKey: ['companies-picker', organization?._id],
    queryFn: () =>
      apiRequestWithMeta<Array<{ _id: string; name: string }>>('/api/companies?limit=50'),
    enabled: Boolean(organization?._id)
  });

  const { data: sendingData } = useQuery({
    queryKey: ['sending-accounts', organization?._id],
    queryFn: () => apiRequest<{ accounts: Array<{ _id: string; email: string; provider: string }> }>('/api/sending-accounts'),
    enabled: Boolean(organization?._id)
  });

  const { data: events = [] } = useQuery({
    queryKey: ['campaign-events', eventsCampaignId],
    queryFn: () =>
      apiRequest<Array<{ _id: string; toEmail: string; eventType: string; subject: string; errorMessage?: string }>>(
        `/api/campaigns/${eventsCampaignId}/events`
      ),
    enabled: Boolean(eventsCampaignId)
  });

  const splitCsv = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const handleCreateAndApprove = async (activateImmediately: boolean) => {
    setBusy(true);
    try {
      const created = await apiRequest<CampaignItem>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          icpId: form.icpId || undefined,
          segment: form.segment,
          geography: splitCsv(form.geography),
          industries: splitCsv(form.industries),
          jobTitles: splitCsv(form.jobTitles),
          targetCompanyIds: form.targetCompanyIds,
          targetContactIds: form.targetContactIds,
          objective: form.objective,
          sendingAccountId: form.sendingAccountId || undefined,
          testMode: form.testMode,
          dailySendLimit: Number(form.dailySendLimit),
          steps: [
            { stepOrder: 1, delayDays: 0, subject: form.step1Subject, body: form.step1Body, condition: 'always' },
            { stepOrder: 2, delayDays: 3, subject: form.step2Subject, body: form.step2Body, condition: 'no_reply' }
          ]
        })
      });

      await apiRequest(`/api/campaigns/${created._id}/approve`, { method: 'POST' });
      if (activateImmediately) {
        await apiRequest(`/api/campaigns/${created._id}/activate`, { method: 'POST' });
      }
      setBuilderOpen(false);
      setStep(1);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({
        type: 'success',
        title: activateImmediately ? 'Campaign approved & launched' : 'Campaign approved'
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Campaign action failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const runCampaignAction = async (id: string, action: 'approve' | 'activate' | 'pause' | 'resume' | 'duplicate') => {
    setBusy(true);
    try {
      await apiRequest(`/api/campaigns/${id}/${action}`, { method: 'POST' });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({ type: 'success', title: `Campaign ${action}d` });
    } catch (err) {
      addToast({ type: 'error', title: `Could not ${action}`, description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Outreach Campaigns</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            11-step campaign builder with explicit approval gates, sandbox outbox, and rate-limited BullMQ delivery.
          </p>
        </div>
        <Button size="sm" onClick={() => setBuilderOpen(true)}>
          <Plus className="h-4 w-4" />
          New Campaign (11-Step Builder)
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Send className="h-5 w-5" />}
          title="No campaigns created yet"
          description="Launch the 11-step builder to configure your ICP segment, target contacts, sequence, and approval."
          action={<Button onClick={() => setBuilderOpen(true)}>Open Campaign Builder</Button>}
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c._id}>
              <CardContent className="flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{c.name}</h3>
                    <StatusIndicator status={c.status} />
                    <Badge tone={c.testMode ? 'indigo' : 'success'}>
                      {c.testMode ? 'Test / Sandbox Mode' : 'Live Sending'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Objective: {c.objective} • Contacts: {c.stats?.totalContacts ?? 0} • Sent: {c.stats?.sent ?? 0} •
                    Delivered: {c.stats?.delivered ?? 0} • Replies: {c.stats?.replied ?? 0}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!c.approvedAt && (
                    <Button variant="outline" size="sm" onClick={() => runCampaignAction(c._id, 'approve')}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                  )}
                  {(c.status === 'Approved' || c.status === 'Ready for review') && (
                    <Button size="sm" onClick={() => runCampaignAction(c._id, 'activate')} loading={busy}>
                      <Rocket className="h-3.5 w-3.5" />
                      Launch
                    </Button>
                  )}
                  {c.status === 'Active' && (
                    <Button variant="outline" size="sm" onClick={() => runCampaignAction(c._id, 'pause')}>
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </Button>
                  )}
                  {c.status === 'Paused' && (
                    <Button size="sm" onClick={() => runCampaignAction(c._id, 'resume')}>
                      <Play className="h-3.5 w-3.5" />
                      Resume
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEventsCampaignId(c._id)}>
                    Events
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => runCampaignAction(c._id, 'duplicate')} aria-label="Duplicate">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await apiRequest(`/api/campaigns/${c._id}`, { method: 'DELETE' });
                      await refetch();
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 11-Step Builder Modal */}
      <Modal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title={`Campaign Builder — ${WIZARD_STEPS[step - 1]}`}
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {WIZARD_STEPS.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(idx + 1)}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  step === idx + 1
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {step === 1 && (
            <Input label="Step 1: Campaign Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          )}
          {step === 2 && (
            <Select
              label="Step 2: Choose Ideal Customer Profile"
              value={form.icpId}
              onChange={(e) => setForm({ ...form, icpId: e.target.value })}
              options={[
                { label: 'Select an ICP (optional)', value: '' },
                ...icps.map((i) => ({ label: i.name, value: i._id }))
              ]}
            />
          )}
          {step === 3 && (
            <Input label="Step 3: Customer Segment" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} />
          )}
          {step === 4 && (
            <Input label="Step 4: Target Geography (comma-separated)" value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} />
          )}
          {step === 5 && (
            <Input label="Step 5: Target Industries" value={form.industries} onChange={(e) => setForm({ ...form, industries: e.target.value })} />
          )}
          {step === 6 && (
            <Input label="Step 6: Decision-Maker Job Titles" value={form.jobTitles} onChange={(e) => setForm({ ...form, jobTitles: e.target.value })} />
          )}
          {step === 7 && (
            <div className="space-y-3">
              <div className="text-xs font-medium">Step 7: Select Target People & Companies</div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                {(peopleRes?.data || []).map((person) => (
                  <label key={person._id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={form.targetContactIds.includes(person._id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.targetContactIds, person._id]
                          : form.targetContactIds.filter((id) => id !== person._id);
                        setForm({ ...form, targetContactIds: next });
                      }}
                    />
                    <span>{person.fullName}</span>
                    <span className="text-slate-400">({person.email || 'no email'})</span>
                  </label>
                ))}
                {(peopleRes?.data || []).length === 0 && (
                  <p className="text-xs text-slate-400">No saved contacts yet — add contacts in People Search.</p>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Companies available: {(companiesRes?.data || []).length}
              </div>
            </div>
          )}
          {step === 8 && (
            <div className="space-y-3">
              <Input label="Step 8: Campaign Objective" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
              <Select
                label="Sending Account"
                value={form.sendingAccountId}
                onChange={(e) => setForm({ ...form, sendingAccountId: e.target.value })}
                options={[
                  { label: 'Default Active Account', value: '' },
                  ...(sendingData?.accounts || []).map((a) => ({ label: `${a.email} (${a.provider})`, value: a._id }))
                ]}
              />
            </div>
          )}
          {step === 9 && (
            <div className="space-y-3">
              <Input label="Step 1 Subject" value={form.step1Subject} onChange={(e) => setForm({ ...form, step1Subject: e.target.value })} />
              <Textarea label="Step 1 Body" rows={5} value={form.step1Body} onChange={(e) => setForm({ ...form, step1Body: e.target.value })} />
              <Input label="Follow-up (Day +3) Subject" value={form.step2Subject} onChange={(e) => setForm({ ...form, step2Subject: e.target.value })} />
              <Textarea label="Follow-up Body" rows={3} value={form.step2Body} onChange={(e) => setForm({ ...form, step2Body: e.target.value })} />
            </div>
          )}
          {step === 10 && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950">
              <p><strong>Name:</strong> {form.name}</p>
              <p><strong>Segment:</strong> {form.segment}</p>
              <p><strong>Selected Contacts:</strong> {form.targetContactIds.length}</p>
              <p><strong>Objective:</strong> {form.objective}</p>
              <label className="mt-2 flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={form.testMode}
                  onChange={(e) => setForm({ ...form, testMode: e.target.checked })}
                />
                Run in Sandbox Test Mode (records deliveries without external SMTP dispatch)
              </label>
            </div>
          )}
          {step === 11 && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Explicit approval is required before launching outbound delivery. Opted-out addresses are
                automatically suppressed.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleCreateAndApprove(false)} loading={busy}>
                  Approve Only (Save Ready)
                </Button>
                <Button onClick={() => handleCreateAndApprove(true)} loading={busy}>
                  <Rocket className="h-4 w-4" />
                  Approve & Launch Campaign
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
            <Button variant="outline" size="sm" disabled={step <= 1} onClick={() => setStep((s) => s - 1)}>
              Previous Step
            </Button>
            {step < 11 && (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next Step
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Events History Modal */}
      <Modal
        open={Boolean(eventsCampaignId)}
        onClose={() => setEventsCampaignId(null)}
        title="Campaign Delivery & Event History"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-2 text-xs">
          {events.length === 0 ? (
            <p className="py-6 text-center text-slate-500">No sending events recorded yet.</p>
          ) : (
            events.map((ev) => (
              <div key={ev._id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
                <div>
                  <div className="font-medium">{ev.toEmail}</div>
                  <div className="text-slate-500">{ev.subject} {ev.errorMessage ? `— ${ev.errorMessage}` : ''}</div>
                </div>
                <StatusIndicator status={ev.eventType} />
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
