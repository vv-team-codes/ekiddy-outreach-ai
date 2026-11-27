import React, { useState } from 'react';
import { Copy, PenTool, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EMAIL_TONES, type EmailTone, type GeneratedEmailResult } from '@ekiddy/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Select,
  Textarea
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface TemplateItem {
  _id: string;
  name: string;
  tone: EmailTone;
  subject: string;
  body: string;
  followUpBody?: string;
}

export function EmailWriterPage() {
  const queryClient = useQueryClient();
  const { organization, addToast } = useAppStore();
  const [busy, setBusy] = useState(false);

  const [inputs, setInputs] = useState({
    prospectName: 'Maya Lin',
    prospectDesignation: 'VP of Revenue Operations',
    companyName: 'Northstar Revenue Cloud',
    companyWebsite: 'https://northstarcloud.example',
    companyInformation: 'Pipeline intelligence and forecasting software for B2B revenue teams.',
    campaignObjective: 'Book a 15-minute outbound pipeline review',
    productOrService: 'AI-driven personalized B2B outreach and meeting booking',
    tone: 'Professional' as EmailTone
  });

  const [draft, setDraft] = useState<GeneratedEmailResult | null>(null);
  const [alternatives, setAlternatives] = useState<GeneratedEmailResult[]>([]);

  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['email-templates', organization?._id],
    queryFn: () => apiRequest<TemplateItem[]>('/api/emails/templates'),
    enabled: Boolean(organization?._id)
  });

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest<GeneratedEmailResult>('/api/emails/generate', {
        method: 'POST',
        body: JSON.stringify(inputs)
      });
      setDraft(res);
      await queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      addToast({ type: 'success', title: 'Email draft generated' });
    } catch (err) {
      addToast({ type: 'error', title: 'Generation failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateAlternatives = async () => {
    setBusy(true);
    try {
      const res = await apiRequest<GeneratedEmailResult[]>('/api/emails/alternatives', {
        method: 'POST',
        body: JSON.stringify(inputs)
      });
      setAlternatives(res);
      addToast({ type: 'info', title: `Generated ${res.length} alternative angles` });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!draft) return;
    await apiRequest('/api/emails/templates', {
      method: 'POST',
      body: JSON.stringify({
        name: `${inputs.companyName} — ${inputs.tone}`,
        objective: inputs.campaignObjective,
        tone: inputs.tone,
        subject: draft.subject,
        openingLine: draft.openingLine,
        body: draft.body,
        cta: draft.cta,
        followUpBody: draft.followUpMessage
      })
    });
    await refetchTemplates();
    addToast({ type: 'success', title: 'Saved to Email Templates' });
  };

  const handleCopy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    addToast({ type: 'info', title: 'Copied email to clipboard' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">AI Email Writer</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Crafts personalized emails grounded strictly in actual research data across 5 tones (2 credits/generation).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader title="Prospect & Context" />
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Prospect Name"
                  value={inputs.prospectName}
                  onChange={(e) => setInputs({ ...inputs, prospectName: e.target.value })}
                />
                <Input
                  label="Designation / Title"
                  value={inputs.prospectDesignation}
                  onChange={(e) => setInputs({ ...inputs, prospectDesignation: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Company Name"
                  value={inputs.companyName}
                  onChange={(e) => setInputs({ ...inputs, companyName: e.target.value })}
                />
                <Input
                  label="Company Website"
                  value={inputs.companyWebsite}
                  onChange={(e) => setInputs({ ...inputs, companyWebsite: e.target.value })}
                />
              </div>
              <Textarea
                label="Verified Company Context"
                value={inputs.companyInformation}
                onChange={(e) => setInputs({ ...inputs, companyInformation: e.target.value })}
              />
              <Input
                label="Product or Service Offered"
                value={inputs.productOrService}
                onChange={(e) => setInputs({ ...inputs, productOrService: e.target.value })}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Campaign Objective"
                  value={inputs.campaignObjective}
                  onChange={(e) => setInputs({ ...inputs, campaignObjective: e.target.value })}
                />
                <Select
                  label="Email Tone"
                  value={inputs.tone}
                  onChange={(e) => setInputs({ ...inputs, tone: e.target.value as EmailTone })}
                  options={EMAIL_TONES.map((t) => ({ label: t, value: t }))}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" loading={busy}>
                  <Sparkles className="h-4 w-4" />
                  Generate Email (2 cr)
                </Button>
                <Button type="button" variant="outline" onClick={handleGenerateAlternatives} loading={busy}>
                  <RefreshCw className="h-4 w-4" />
                  3 Alternatives
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Preview & Editor */}
        <Card>
          <CardHeader
            title="Generated Email & Follow-up"
            actions={
              draft && (
                <div className="flex items-center gap-1.5">
                  <Badge tone={draft.aiMode === 'live' ? 'success' : 'indigo'}>
                    {draft.aiMode === 'live' ? draft.aiProvider : 'Demo AI'}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button size="sm" onClick={handleSaveTemplate}>
                    <Save className="h-3.5 w-3.5" />
                    Save Draft
                  </Button>
                </div>
              )
            }
          />
          <CardContent>
            {!draft ? (
              <div className="flex flex-col items-center py-12 text-center text-xs text-slate-500">
                <PenTool className="mb-2 h-6 w-6 text-slate-400" />
                Fill out prospect context and click Generate Email to draft personalized copy.
              </div>
            ) : (
              <div className="space-y-3.5">
                <Input
                  label="Subject Line"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
                <Input
                  label="Opening Hook"
                  value={draft.openingLine}
                  onChange={(e) => setDraft({ ...draft, openingLine: e.target.value })}
                />
                <Textarea
                  label="Email Body"
                  rows={7}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
                <Textarea
                  label="Follow-up Message"
                  rows={4}
                  value={draft.followUpMessage}
                  onChange={(e) => setDraft({ ...draft, followUpMessage: e.target.value })}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {alternatives.length > 0 && (
        <Card>
          <CardHeader title="Alternative Variations" description="Click any variation to load it into the editor." />
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {alternatives.map((alt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setDraft(alt)}
                className="rounded-lg border border-slate-200 p-3 text-left text-xs hover:border-indigo-400 dark:border-slate-800"
              >
                <div className="font-semibold text-indigo-600">Variant {i + 1}: {alt.subject}</div>
                <p className="mt-1.5 line-clamp-4 text-slate-500">{alt.body}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {templates.length > 0 && (
        <Card>
          <CardHeader title="Saved Email Templates" />
          <CardContent className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {templates.map((tpl) => (
              <div key={tpl._id} className="flex items-center justify-between px-5 py-3 text-xs">
                <div>
                  <div className="font-semibold">{tpl.name}</div>
                  <div className="text-slate-500">Subject: {tpl.subject} • Tone: {tpl.tone}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await apiRequest(`/api/emails/templates/${tpl._id}`, { method: 'DELETE' });
                    await refetchTemplates();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
