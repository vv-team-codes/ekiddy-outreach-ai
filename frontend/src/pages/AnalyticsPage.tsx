import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, MetricCard, PageSkeleton } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

export function AnalyticsPage() {
  const { organization } = useAppStore();

  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics-overview', organization?._id],
    queryFn: () =>
      apiRequest<{
        companiesResearched: number;
        contactsDiscovered: number;
        verifiedContacts: number;
        emailsSent: number;
        deliveredEmails: number;
        bouncedEmails: number;
        replies: number;
        positiveReplies: number;
        meetingsBooked: number;
        campaignConversionRate: number;
        creditsUsed: number;
        estimatedSpendUsd: number;
      }>('/api/analytics/overview'),
    enabled: Boolean(organization?._id)
  });

  const { data: trends = [] } = useQuery({
    queryKey: ['analytics-trends', organization?._id],
    queryFn: () =>
      apiRequest<Array<{ date: string; sent: number; delivered: number; replies: number; leads: number }>>(
        '/api/analytics/trends'
      ),
    enabled: Boolean(organization?._id)
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['analytics-campaigns', organization?._id],
    queryFn: () =>
      apiRequest<
        Array<{
          _id: string;
          name: string;
          stats: { sent: number; delivered: number; replied: number; meetingsBooked: number };
        }>
      >('/api/analytics/campaigns'),
    enabled: Boolean(organization?._id)
  });

  if (isLoading) return <PageSkeleton />;

  const funnelData = [
    { stage: 'Contacts', count: overview?.contactsDiscovered ?? 0 },
    { stage: 'Verified', count: overview?.verifiedContacts ?? 0 },
    { stage: 'Sent', count: overview?.emailsSent ?? 0 },
    { stage: 'Delivered', count: overview?.deliveredEmails ?? 0 },
    { stage: 'Replies', count: overview?.replies ?? 0 },
    { stage: 'Meetings', count: overview?.meetingsBooked ?? 0 }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Outreach Analytics</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Real-time database aggregations — zero fabricated metrics.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Researched" value={overview?.companiesResearched ?? 0} />
        <MetricCard label="Contacts" value={overview?.contactsDiscovered ?? 0} />
        <MetricCard label="Verified" value={overview?.verifiedContacts ?? 0} />
        <MetricCard label="Sent / Delivered" value={`${overview?.emailsSent ?? 0} / ${overview?.deliveredEmails ?? 0}`} />
        <MetricCard label="Replies (+ve)" value={`${overview?.replies ?? 0} (${overview?.positiveReplies ?? 0})`} />
        <MetricCard label="Meetings / Conv." value={`${overview?.meetingsBooked ?? 0} (${overview?.campaignConversionRate ?? 0}%)`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Daily Sending & Reply Trends" description="Last 14 days from EmailEvent records." />
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="sent" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.18} />
                <Area type="monotone" dataKey="replies" stroke="#10b981" fill="#10b981" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Conversion Funnel" description="Prospect discovery through booked meetings." />
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Campaign Comparison & Spend" description={`Credits used: ${overview?.creditsUsed ?? 0} (~$${overview?.estimatedSpendUsd ?? 0})`} />
        <CardContent className="divide-y divide-slate-100 p-0 text-xs dark:divide-slate-800">
          {campaigns.map((c) => (
            <div key={c._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span className="font-semibold">{c.name}</span>
              <span className="text-slate-500">
                Sent: {c.stats?.sent ?? 0} • Delivered: {c.stats?.delivered ?? 0} • Replies: {c.stats?.replied ?? 0} • Meetings: {c.stats?.meetingsBooked ?? 0}
              </span>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div className="p-6 text-center text-slate-500">No campaigns tracked yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
