import {
  ArrowRight,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Compass,
  Inbox,
  Mail,
  Send,
  Sparkles,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  MetricCard,
  PageSkeleton,
  StatusIndicator
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

export function DashboardPage() {
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
        replies: number;
        positiveReplies: number;
        meetingsBooked: number;
        creditsUsed: number;
      }>('/api/analytics/overview'),
    enabled: Boolean(organization?._id)
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', organization?._id],
    queryFn: () =>
      apiRequest<
        Array<{
          _id: string;
          name: string;
          status: string;
          testMode: boolean;
          stats: { sent: number; replied: number; meetingsBooked: number };
        }>
      >('/api/campaigns'),
    enabled: Boolean(organization?._id)
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations', organization?._id],
    queryFn: () =>
      apiRequest<Array<{ provider: string; status: string; configuredBy: string }>>('/api/integrations'),
    enabled: Boolean(organization?._id)
  });

  if (isLoading) return <PageSkeleton />;

  const checklist = [
    { label: 'Company Research', done: (overview?.companiesResearched ?? 0) > 0, to: '/app/research' },
    { label: 'Prospects Saved', done: (overview?.contactsDiscovered ?? 0) > 0, to: '/app/people' },
    { label: 'Campaigns Created', done: campaigns.length > 0, to: '/app/campaigns' },
    { label: 'Emails Sent', done: (overview?.emailsSent ?? 0) > 0, to: '/app/campaigns' },
    { label: 'Meetings Booked', done: (overview?.meetingsBooked ?? 0) > 0, to: '/app/meetings' }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-ekiddy-grid flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#111622]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-tight">Revenue Command Center</h1>
            <Badge tone="indigo">{organization?.plan?.toUpperCase() || 'FREE'}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Live MongoDB metrics across research, prospecting, outreach, and meetings for{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{organization?.name}</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/onboarding">
            <Button variant="outline" size="sm">
              <Compass className="h-3.5 w-3.5" />
              Onboarding Wizard
            </Button>
          </Link>
          <Link to="/app/research">
            <Button variant="outline" size="sm">
              <Sparkles className="h-3.5 w-3.5" />
              Research Website
            </Button>
          </Link>
          <Link to="/app/campaigns">
            <Button size="sm">
              <Send className="h-3.5 w-3.5" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Connected Workflow Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {checklist.map((step, idx) => (
          <Link
            key={step.label}
            to={step.to}
            className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-medium transition-colors hover:border-blue-500 dark:border-slate-800 dark:bg-[#111622]"
          >
            <span className="truncate">
              {idx + 1}. {step.label}
            </span>
            <CheckCircle2
              className={`h-4 w-4 shrink-0 ${
                step.done ? 'text-emerald-600' : 'text-stone-300 dark:text-slate-700'
              }`}
            />
          </Link>
        ))}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Companies Researched"
          value={overview?.companiesResearched ?? 0}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Contacts (Verified)"
          value={`${overview?.contactsDiscovered ?? 0} (${overview?.verifiedContacts ?? 0})`}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Emails Sent / Replies"
          value={`${overview?.emailsSent ?? 0} / ${overview?.replies ?? 0}`}
          sublabel={`${overview?.positiveReplies ?? 0} positive replies`}
          icon={<Mail className="h-4 w-4" />}
        />
        <MetricCard
          label="Meetings Booked"
          value={overview?.meetingsBooked ?? 0}
          sublabel={`${overview?.creditsUsed ?? 0} credits consumed`}
          icon={<Calendar className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent Campaigns"
            description="Status, sending mode, and reply performance."
            actions={
              <Link to="/app/campaigns" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
                View all
              </Link>
            }
          />
          <CardContent className="p-0">
            {campaigns.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No campaigns created yet. Complete onboarding or launch the 11-step campaign builder.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-slate-800">
                {campaigns.slice(0, 5).map((c) => (
                  <div key={c._id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{c.name}</span>
                        <StatusIndicator status={c.status} />
                        {c.testMode && <Badge tone="indigo">Sandbox</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {c.stats?.sent ?? 0} sent • {c.stats?.replied ?? 0} replies • {c.stats?.meetingsBooked ?? 0} meetings
                      </p>
                    </div>
                    <Link to="/app/campaigns">
                      <Button variant="ghost" size="sm">
                        Manage
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Integration Readiness"
            description="Real service status for this organization."
            actions={
              <Link to="/app/settings" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
                Configure
              </Link>
            }
          />
          <CardContent className="space-y-2.5">
            {integrations.map((item) => (
              <div key={item.provider} className="flex items-center justify-between text-xs">
                <span className="font-medium capitalize text-slate-700 dark:text-slate-300">
                  {item.provider.replace(/_/g, ' ')}
                </span>
                <Badge tone={item.status === 'connected' ? 'success' : 'neutral'}>
                  {item.status === 'connected' ? `Connected (${item.configuredBy})` : 'Test / Demo'}
                </Badge>
              </div>
            ))}

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-stone-100 pt-4 dark:border-slate-800">
              <Link to="/app/inbox">
                <Button variant="outline" size="sm" className="w-full">
                  <Inbox className="h-3.5 w-3.5" />
                  AI Inbox
                </Button>
              </Link>
              <Link to="/app/autopilot">
                <Button variant="outline" size="sm" className="w-full">
                  <Bot className="h-3.5 w-3.5" />
                  Autopilot
                </Button>
              </Link>
              <Link to="/app/billing" className="col-span-2">
                <Button variant="secondary" size="sm" className="w-full">
                  <Coins className="h-3.5 w-3.5" />
                  Wallet: {organization?.creditBalance ?? 0} Credits
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
