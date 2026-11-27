import React, { useEffect, useState } from 'react';
import { Inbox, RefreshCw, Send, Sparkles, StickyNote, TestTube } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { INBOX_FOLDERS, type InboxFolder } from '@ekiddy/shared';
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
import { apiRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';

const FOLDER_LABELS: Record<InboxFolder, string> = {
  all: 'All',
  needs_reply: 'Needs reply',
  interested: 'Interested',
  not_interested: 'Not interested',
  meetings: 'Meetings',
  out_of_office: 'Out of office',
  unsubscribed: 'Unsubscribed',
  archived: 'Archived'
};

interface ThreadSummary {
  _id: string;
  subject: string;
  folder: InboxFolder;
  classification: string;
  unreadCount: number;
  lastMessageAt: string;
  lastMessageSnippet: string;
  contactId?: {
    _id: string;
    fullName: string;
    email?: string;
    jobTitle?: string;
    companyName?: string;
    stage: string;
  };
}

interface ThreadDetail {
  conversation: ThreadSummary & {
    internalNotes: Array<{ authorName: string; text: string; createdAt: string }>;
    companyId?: { name: string; domain?: string; industry?: string };
  };
  messages: Array<{
    _id: string;
    direction: 'inbound' | 'outbound';
    fromEmail: string;
    toEmail: string;
    subject: string;
    bodyText: string;
    status: string;
    isAiDraft: boolean;
    createdAt: string;
  }>;
}

export function InboxPage() {
  const { organization, addToast } = useAppStore();
  const [folder, setFolder] = useState<InboxFolder>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [simOpen, setSimOpen] = useState(false);
  const [simForm, setSimForm] = useState({
    fromEmail: 'prospect@example-company.com',
    subject: 'Re: Quick question',
    bodyText: 'Sounds interesting! Can we schedule a 15-minute call next Tuesday?'
  });
  const [busy, setBusy] = useState(false);

  const { data: counts = {} } = useQuery({
    queryKey: ['inbox-counts', organization?._id],
    queryFn: () => apiRequest<Record<string, number>>('/api/inbox/counts'),
    enabled: Boolean(organization?._id)
  });

  const { data: threads = [], isLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['inbox-threads', organization?._id, folder, search],
    queryFn: () =>
      apiRequest<ThreadSummary[]>(
        `/api/inbox/threads?folder=${folder}&q=${encodeURIComponent(search)}`
      ),
    enabled: Boolean(organization?._id)
  });

  useEffect(() => {
    if (threads.length > 0 && !selectedId) {
      setSelectedId(threads[0]._id);
    }
  }, [threads, selectedId]);

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['conversation-detail', selectedId],
    queryFn: () => apiRequest<ThreadDetail>(`/api/conversations/${selectedId}`),
    enabled: Boolean(selectedId)
  });

  useEffect(() => {
    const pendingDraft = detail?.messages?.find((m) => m.status === 'pending_approval' && m.isAiDraft);
    if (pendingDraft && !replyText) {
      setReplyText(pendingDraft.bodyText);
    }
  }, [detail]);

  const handleDraftAi = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ draft: { bodyText: string } }>(
        `/api/conversations/${selectedId}/draft-ai-reply`,
        { method: 'POST' }
      );
      setReplyText(res.draft.bodyText);
      await refetchDetail();
      addToast({ type: 'success', title: 'AI reply draft prepared (requires approval to send)' });
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/api/conversations/${selectedId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ bodyText: replyText, approveAiDraft: true })
      });
      setReplyText('');
      await Promise.all([refetchDetail(), refetchThreads()]);
      addToast({ type: 'success', title: 'Approved & sent reply' });
    } catch (err) {
      addToast({ type: 'error', title: 'Send failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedId || !noteText.trim()) return;
    await apiRequest(`/api/conversations/${selectedId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text: noteText })
    });
    setNoteText('');
    await refetchDetail();
  };

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest<{ conversation: ThreadSummary; classification: string }>(
        '/api/conversations/simulate-inbound',
        {
          method: 'POST',
          body: JSON.stringify(simForm)
        }
      );
      setSimOpen(false);
      await refetchThreads();
      setSelectedId(res.conversation._id);
      addToast({ type: 'info', title: `Inbound reply classified as "${res.classification}"` });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AI CRM Inbox</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AI reply classification, approval-gated response drafts, and immediate opt-out suppression.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSimOpen(true)}>
            <TestTube className="h-3.5 w-3.5" />
            Simulate Inbound Reply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await apiRequest('/api/inbox/sync', { method: 'POST' });
              await refetchThreads();
              addToast({ type: 'info', title: 'Inbox synchronized' });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Folders */}
        <Card className="lg:col-span-2">
          <CardContent className="space-y-1 p-2.5">
            {INBOX_FOLDERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFolder(f);
                  setSelectedId(null);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium ${
                  folder === f
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <span>{FOLDER_LABELS[f]}</span>
                <span className="text-[11px] opacity-75">{counts[f] ?? 0}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Thread List */}
        <Card className="lg:col-span-4">
          <div className="border-b border-slate-200 p-3 dark:border-slate-800">
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {threads.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No threads in this folder.</div>
            ) : (
              threads.map((t) => (
                <button
                  key={t._id}
                  type="button"
                  onClick={() => {
                    setSelectedId(t._id);
                    setReplyText('');
                  }}
                  className={`w-full p-3.5 text-left transition-colors ${
                    selectedId === t._id
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">
                      {t.contactId?.fullName || t.subject}
                    </span>
                    <StatusIndicator status={t.classification} />
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-700 dark:text-slate-300">{t.subject}</div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">{t.lastMessageSnippet}</div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Conversation View */}
        <Card className="lg:col-span-6">
          {!detail ? (
            <CardContent className="py-16">
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="Select a conversation"
                description="Choose a thread or simulate an inbound prospect reply to inspect AI classification and reply drafts."
              />
            </CardContent>
          ) : (
            <>
              <CardHeader
                title={detail.conversation.subject}
                description={
                  detail.conversation.contactId
                    ? `${detail.conversation.contactId.fullName} (${detail.conversation.contactId.email || 'no email'})`
                    : 'Prospect conversation'
                }
                actions={
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={detail.conversation.classification} />
                    <Select
                      value={detail.conversation.folder}
                      onChange={async (e) => {
                        await apiRequest(`/api/conversations/${detail.conversation._id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ folder: e.target.value })
                        });
                        await Promise.all([refetchDetail(), refetchThreads()]);
                      }}
                      options={INBOX_FOLDERS.map((f) => ({ label: FOLDER_LABELS[f], value: f }))}
                    />
                  </div>
                }
              />
              <CardContent className="space-y-4">
                <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {detail.messages.map((msg) => (
                    <div
                      key={msg._id}
                      className={`rounded-lg border p-3 text-xs ${
                        msg.status === 'pending_approval'
                          ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30'
                          : msg.direction === 'inbound'
                            ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950'
                            : 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/30'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          <strong>{msg.direction === 'inbound' ? msg.fromEmail : 'You'}</strong>
                          {msg.status === 'pending_approval' && ' • AI Draft Pending Approval'}
                        </span>
                        <span>{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{msg.bodyText}</p>
                    </div>
                  ))}
                </div>

                {/* Reply composer */}
                <form onSubmit={handleSendReply} className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Reply (User Approval Required)</span>
                    <Button type="button" variant="outline" size="sm" onClick={handleDraftAi} loading={busy}>
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Draft Reply
                    </Button>
                  </div>
                  <Textarea
                    rows={4}
                    placeholder="Write or review AI-suggested reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" loading={busy}>
                      <Send className="h-3.5 w-3.5" />
                      Approve & Send Reply
                    </Button>
                  </div>
                </form>

                {/* Internal Notes */}
                <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <StickyNote className="h-3.5 w-3.5 text-slate-400" />
                    Internal Team Notes
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add internal note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddNote}>
                      Add
                    </Button>
                  </div>
                  {detail.conversation.internalNotes?.map((note, idx) => (
                    <div key={idx} className="rounded bg-slate-50 px-2.5 py-1.5 text-[11px] dark:bg-slate-950">
                      <strong>{note.authorName}:</strong> {note.text}
                    </div>
                  ))}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <Modal open={simOpen} onClose={() => setSimOpen(false)} title="Simulate Prospect Reply (QA & Demo)">
        <form onSubmit={handleSimulateInbound} className="space-y-3">
          <Input
            label="Prospect Email"
            type="email"
            required
            value={simForm.fromEmail}
            onChange={(e) => setSimForm({ ...simForm, fromEmail: e.target.value })}
          />
          <Input
            label="Subject"
            required
            value={simForm.subject}
            onChange={(e) => setSimForm({ ...simForm, subject: e.target.value })}
          />
          <Textarea
            label="Reply Body"
            rows={4}
            required
            value={simForm.bodyText}
            onChange={(e) => setSimForm({ ...simForm, bodyText: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSimOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Ingest & Classify</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
