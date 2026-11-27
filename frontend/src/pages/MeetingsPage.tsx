import React, { useState } from 'react';
import { Calendar, Copy, ExternalLink, Plus, XCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
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
  StatusIndicator
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';

interface MeetingItem {
  _id: string;
  title: string;
  attendeeName: string;
  attendeeEmail: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: string;
  calendarProvider: 'google' | 'local';
  meetingLink?: string;
}

export function MeetingsPage() {
  const { organization, addToast } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [timezone, setTimezone] = useState('UTC');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: 'Product Discovery Demo',
    attendeeName: 'Maya Lin',
    attendeeEmail: 'maya.lin@northstarcloud.example',
    startTime: new Date(Date.now() + 86400000).toISOString().slice(0, 11) + '10:00:00.000Z',
    endTime: new Date(Date.now() + 86400000).toISOString().slice(0, 11) + '10:30:00.000Z',
    timezone: 'UTC'
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['meetings', organization?._id],
    queryFn: () => apiRequest<{ bookingSlug?: string; meetings: MeetingItem[] }>('/api/meetings'),
    enabled: Boolean(organization?._id)
  });

  const { data: availability } = useQuery({
    queryKey: ['availability', organization?._id, dateFilter, timezone],
    queryFn: () =>
      apiRequest<{ calendarProvider: string; slots: Array<{ startTime: string; endTime: string; available: boolean }> }>(
        `/api/meetings/availability?date=${dateFilter}&timezone=${encodeURIComponent(timezone)}`
      ),
    enabled: Boolean(organization?._id)
  });

  const bookingUrl = data?.bookingSlug ? `${window.location.origin}/book/${data.bookingSlug}` : '';

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/api/meetings', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setModalOpen(false);
      await refetch();
      addToast({ type: 'success', title: 'Meeting booked' });
    } catch (err) {
      addToast({ type: 'error', title: 'Scheduling failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Meeting Booking & Calendar Sync</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Google Calendar OAuth + conflict-checked availability and shareable booking links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bookingUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(bookingUrl);
                addToast({ type: 'info', title: 'Booking link copied' });
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Booking Link
            </Button>
          )}
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Availability Preview */}
      <Card>
        <CardHeader
          title="Availability Checker"
          description={`Mode: ${availability?.calendarProvider === 'google' ? 'Google Calendar Connected' : 'Built-in Local Calendar Mode'}`}
          actions={
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Timezone"
                className="h-8 w-28 text-xs"
              />
            </div>
          }
        />
        <CardContent className="flex flex-wrap gap-2">
          {(availability?.slots || []).map((slot) => (
            <button
              key={slot.startTime}
              type="button"
              disabled={!slot.available}
              onClick={() => {
                setForm({
                  ...form,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  timezone
                });
                setModalOpen(true);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                slot.available
                  ? 'border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              {new Date(slot.startTime).toISOString().slice(11, 16)} UTC
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Meetings List */}
      {(data?.meetings || []).length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-5 w-5" />}
          title="No meetings scheduled yet"
          description="Click any open availability slot above or share your booking link with prospects."
        />
      ) : (
        <div className="space-y-3">
          {data?.meetings.map((m) => (
            <Card key={m._id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{m.title}</span>
                    <StatusIndicator status={m.status} />
                    <Badge tone="neutral">{m.calendarProvider}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {m.attendeeName} ({m.attendeeEmail}) • {formatDateTime(m.startTime)} ({m.timezone})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {m.meetingLink && (
                    <a href={m.meetingLink} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600 inline-flex items-center gap-1 hover:underline">
                      Join Link <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {m.status !== 'cancelled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await apiRequest(`/api/meetings/${m._id}/cancel`, { method: 'POST' });
                        await refetch();
                        addToast({ type: 'info', title: 'Meeting cancelled' });
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule Meeting">
        <form onSubmit={handleSchedule} className="space-y-3">
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Attendee Name" required value={form.attendeeName} onChange={(e) => setForm({ ...form, attendeeName: e.target.value })} />
          <Input label="Attendee Email" type="email" required value={form.attendeeEmail} onChange={(e) => setForm({ ...form, attendeeEmail: e.target.value })} />
          <Input label="Start Time (ISO)" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <Input label="End Time (ISO)" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          <Input label="Timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Confirm Meeting</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function PublicBookingPage() {
  const { slug } = useParams();
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [booked, setBooked] = useState(false);

  const { data } = useQuery({
    queryKey: ['public-booking', slug, date],
    queryFn: () =>
      apiRequest<{
        organizationName: string;
        slots: Array<{ startTime: string; endTime: string; available: boolean }>;
      }>(`/api/meetings/public/${slug}?date=${date}`, { skipAuth: true }),
    enabled: Boolean(slug)
  });

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !slug) return;
    await apiRequest(`/api/meetings/public/${slug}/book`, {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({
        attendeeName: name,
        attendeeEmail: email,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      })
    });
    setBooked(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-xl">
        <CardHeader
          title={`Book a Meeting with ${data?.organizationName || slug}`}
          description="Select an available 30-minute time slot."
        />
        <CardContent>
          {booked ? (
            <div className="py-6 text-center text-sm">
              <p className="font-semibold text-emerald-600">Your meeting is confirmed!</p>
              <p className="mt-1 text-xs text-slate-500">Calendar invitation details have been saved.</p>
            </div>
          ) : (
            <form onSubmit={handleBook} className="space-y-4">
              <Input label="Select Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {(data?.slots || []).map((slot) => (
                  <button
                    key={slot.startTime}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      selectedSlot?.startTime === slot.startTime
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : slot.available
                          ? 'border-slate-300 hover:border-indigo-500 dark:border-slate-700'
                          : 'cursor-not-allowed opacity-40'
                    }`}
                  >
                    {new Date(slot.startTime).toISOString().slice(11, 16)} UTC
                  </button>
                ))}
              </div>
              <Input label="Your Name" required value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Work Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" disabled={!selectedSlot} className="w-full">
                Confirm Booking
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
