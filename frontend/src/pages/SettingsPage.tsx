import React, { useState } from 'react';
import { INTEGRATION_PROVIDERS } from '@ekiddy/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  PageSkeleton,
  Select
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';

type TabKey = 'profile' | 'organization' | 'team' | 'integrations' | 'ai' | 'security' | 'theme';

export function SettingsPage() {
  const { user, organization, theme, setTheme, addToast } = useAppStore();
  const [tab, setTab] = useState<TabKey>('profile');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [aiProvider, setAiProvider] = useState<'auto' | 'gemini' | 'openrouter'>('auto');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});

  const { data: members = [], refetch: refetchMembers } = useQuery({
    queryKey: ['org-members', organization?._id],
    queryFn: () =>
      apiRequest<Array<{ _id: string; role: string; status: string; inviteEmail?: string; userId?: { fullName: string; email: string } }>>(
        `/api/organizations/${organization!._id}/members`
      ),
    enabled: Boolean(organization?._id)
  });

  const { data: integrations = [], isLoading, refetch: refetchIntegrations } = useQuery({
    queryKey: ['integrations', organization?._id],
    queryFn: () =>
      apiRequest<Array<{ provider: string; status: string; configuredBy: string; maskedPreview: string }>>(
        '/api/integrations'
      ),
    enabled: Boolean(organization?._id)
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs', organization?._id],
    queryFn: () =>
      apiRequest<Array<{ _id: string; action: string; resourceType?: string; createdAt: string }>>(
        '/api/settings/audit-logs'
      ),
    enabled: Boolean(organization?._id) && tab === 'security'
  });

  if (isLoading) return <PageSkeleton />;

  const TABS: Array<{ key: TabKey; label: string }> = [
    { key: 'profile', label: 'Profile' },
    { key: 'organization', label: 'Organization' },
    { key: 'team', label: 'Team & Roles' },
    { key: 'integrations', label: 'Integrations & Keys' },
    { key: 'ai', label: 'AI Model' },
    { key: 'security', label: 'Security & Audit' },
    { key: 'theme', label: 'Theme' }
  ];

  const handleSaveIntegration = async (provider: string) => {
    const val = apiKeyInputs[provider];
    if (!val?.trim()) return;
    await apiRequest(`/api/integrations/${provider}`, {
      method: 'PUT',
      body: JSON.stringify({ provider, credentials: { apiKey: val.trim() } })
    });
    setApiKeyInputs({ ...apiKeyInputs, [provider]: '' });
    await refetchIntegrations();
    addToast({ type: 'success', title: `${provider} key encrypted & saved` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings & Integrations</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage profile, organization, team RBAC, AES-256-GCM encrypted API keys, AI models, and theme.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === t.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <Card>
          <CardHeader title="User Profile" />
          <CardContent className="max-w-md space-y-3">
            <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input label="Job Title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            <Button
              size="sm"
              onClick={async () => {
                await apiRequest('/api/users/profile', {
                  method: 'PATCH',
                  body: JSON.stringify({ fullName, jobTitle })
                });
                addToast({ type: 'success', title: 'Profile saved' });
              }}
            >
              Save Profile
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'organization' && (
        <Card>
          <CardHeader title="Organization Details" />
          <CardContent className="max-w-md space-y-3">
            <Input label="Organization Name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <Button
              size="sm"
              onClick={async () => {
                await apiRequest(`/api/organizations/${organization!._id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ name: orgName })
                });
                addToast({ type: 'success', title: 'Organization updated' });
              }}
            >
              Save Organization
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'team' && (
        <Card>
          <CardHeader title="Team Invitations & Members" />
          <CardContent className="space-y-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiRequest(`/api/organizations/${organization!._id}/invitations`, {
                  method: 'POST',
                  body: JSON.stringify({ email: inviteEmail, role: inviteRole })
                });
                setInviteEmail('');
                await refetchMembers();
                addToast({ type: 'success', title: 'Invitation created' });
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <Input label="Teammate Email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <Select
                label="Role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                options={[
                  { label: 'Admin', value: 'admin' },
                  { label: 'Member', value: 'member' },
                  { label: 'Viewer', value: 'viewer' }
                ]}
              />
              <Button type="submit" size="sm">Invite Member</Button>
            </form>
            <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {members.map((m) => (
                <div key={m._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-medium">{m.userId?.fullName || m.inviteEmail}</div>
                    <div className="text-slate-500">{m.userId?.email || m.inviteEmail}</div>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone="indigo">{m.role}</Badge>
                    <Badge tone={m.status === 'active' ? 'success' : 'warning'}>{m.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'integrations' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {INTEGRATION_PROVIDERS.map((provider) => {
            const info = integrations.find((i) => i.provider === provider);
            return (
              <Card key={provider}>
                <CardHeader
                  title={provider.replace(/_/g, ' ').toUpperCase()}
                  actions={
                    <Badge tone={info?.status === 'connected' ? 'success' : 'neutral'}>
                      {info?.status === 'connected' ? `Connected (${info.maskedPreview})` : 'Not Connected'}
                    </Badge>
                  }
                />
                <CardContent className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      type="password"
                      label="Encrypted Credential / API Key"
                      placeholder="Enter secret key..."
                      value={apiKeyInputs[provider] || ''}
                      onChange={(e) => setApiKeyInputs({ ...apiKeyInputs, [provider]: e.target.value })}
                    />
                  </div>
                  <Button size="sm" onClick={() => handleSaveIntegration(provider)}>
                    Save
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'ai' && (
        <Card>
          <CardHeader title="AI Model & Fallback Routing" />
          <CardContent className="max-w-md space-y-3">
            <Select
              label="Primary AI Provider"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as typeof aiProvider)}
              options={[
                { label: 'Auto (Gemini then OpenRouter fallback)', value: 'auto' },
                { label: 'Google Gemini API', value: 'gemini' },
                { label: 'OpenRouter API', value: 'openrouter' }
              ]}
            />
            <Input label="Model ID" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
            <Button
              size="sm"
              onClick={async () => {
                await apiRequest('/api/settings/ai', {
                  method: 'PATCH',
                  body: JSON.stringify({ provider: aiProvider, model: aiModel, fallbackEnabled: true })
                });
                addToast({ type: 'success', title: 'AI routing settings saved' });
              }}
            >
              Save AI Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'security' && (
        <Card>
          <CardHeader title="Security & Organization Audit Trail" />
          <CardContent className="divide-y divide-slate-100 p-0 text-xs dark:divide-slate-800">
            {auditLogs.map((log) => (
              <div key={log._id} className="flex items-center justify-between px-5 py-2.5">
                <span className="font-mono font-medium">{log.action}</span>
                <span className="text-slate-500">{formatDateTime(log.createdAt)}</span>
              </div>
            ))}
            {auditLogs.length === 0 && <div className="p-6 text-center text-slate-500">No audit events recorded yet.</div>}
          </CardContent>
        </Card>
      )}

      {tab === 'theme' && (
        <Card>
          <CardHeader title="Appearance Theme" />
          <CardContent className="flex gap-3">
            <Button variant={theme === 'light' ? 'primary' : 'outline'} onClick={() => setTheme('light')}>
              Light Theme
            </Button>
            <Button variant={theme === 'dark' ? 'primary' : 'outline'} onClick={() => setTheme('dark')}>
              Dark Theme
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
