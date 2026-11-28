import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Compass,
  CreditCard,
  FolderKanban,
  Home,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Mail,
  Menu,
  Moon,
  PenTool,
  Send,
  Settings,
  Sparkles,
  Sun,
  Swords,
  Target,
  Users,
  X
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';

interface NavSection {
  title: string;
  items: Array<{ to: string; label: string; icon: React.ReactNode; end?: boolean }>;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { to: '/app', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
      { to: '/app/onboarding', label: 'Onboarding Wizard', icon: <Compass className="h-4 w-4" /> }
    ]
  },
  {
    title: 'Intelligence',
    items: [
      { to: '/app/research', label: 'Company Research', icon: <Sparkles className="h-4 w-4" /> },
      { to: '/app/competitors', label: 'Competitors', icon: <Swords className="h-4 w-4" /> },
      { to: '/app/icps', label: 'Customer Profiles (ICP)', icon: <Target className="h-4 w-4" /> }
    ]
  },
  {
    title: 'Prospecting',
    items: [
      { to: '/app/companies', label: 'Company Search', icon: <Building2 className="h-4 w-4" /> },
      { to: '/app/people', label: 'People Search', icon: <Users className="h-4 w-4" /> },
      { to: '/app/lists', label: 'Lead Lists & CSV', icon: <ListChecks className="h-4 w-4" /> }
    ]
  },
  {
    title: 'Outreach',
    items: [
      { to: '/app/campaigns', label: 'Campaigns', icon: <Send className="h-4 w-4" /> },
      { to: '/app/email-writer', label: 'AI Email Writer', icon: <PenTool className="h-4 w-4" /> },
      { to: '/app/sending', label: 'Sending & DNS', icon: <Mail className="h-4 w-4" /> }
    ]
  },
  {
    title: 'Engagement',
    items: [
      { to: '/app/inbox', label: 'AI Inbox', icon: <Inbox className="h-4 w-4" /> },
      { to: '/app/meetings', label: 'Meetings & Calendar', icon: <Calendar className="h-4 w-4" /> }
    ]
  },
  {
    title: 'Growth & Control',
    items: [
      { to: '/app/analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
      { to: '/app/autopilot', label: 'AI Autopilot', icon: <Bot className="h-4 w-4" /> },
      { to: '/app/billing', label: 'Credits & Billing', icon: <CreditCard className="h-4 w-4" /> },
      { to: '/app/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> }
    ]
  }
];

export function AppShell() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const {
    user,
    token,
    organization,
    organizations,
    theme,
    sidebarCollapsed,
    toggleTheme,
    toggleSidebar,
    setOrganization,
    updateCreditBalance
  } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const { data: creditData } = useQuery({
    queryKey: ['credits-balance', organization?._id],
    queryFn: () => apiRequest<{ creditBalance: number }>('/api/credits/balance'),
    enabled: Boolean(organization?._id),
    refetchInterval: 30000
  });

  useEffect(() => {
    if (typeof creditData?.creditBalance === 'number') {
      updateCreditBalance(creditData.creditBalance);
    }
  }, [creditData, updateCreditBalance]);

  const { data: notifications = [], refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications', organization?._id],
    queryFn: () =>
      apiRequest<Array<{ _id: string; title: string; message: string; read: boolean; link?: string }>>(
        '/api/settings/notifications'
      ),
    enabled: Boolean(organization?._id)
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b border-stone-200/90 px-3.5 dark:border-slate-800">
        <Link to="/app" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white dark:bg-blue-600">
            e
          </div>
          {!sidebarCollapsed && (
            <div className="truncate">
              <div className="font-display text-sm font-bold tracking-tight text-slate-950 dark:text-white">
                ekiddy Outreach
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Revenue OS
              </div>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="hidden rounded-md p-1 text-slate-400 hover:bg-stone-100 hover:text-slate-700 lg:inline-flex dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {!sidebarCollapsed && (
              <div className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-slate-950 text-white shadow-2xs dark:bg-blue-600/20 dark:text-blue-300 dark:ring-1 dark:ring-blue-500/40'
                        : 'text-slate-600 hover:bg-stone-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
                      sidebarCollapsed && 'justify-center px-2'
                    )
                  }
                >
                  {item.icon}
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-stone-200/90 p-3 dark:border-slate-800">
        {!sidebarCollapsed ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 p-2 dark:bg-slate-900">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                {user?.fullName || 'Workspace Owner'}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {token === 'static-demo-token' ? 'Static Preview Mode' : organization?.name || 'Active Workspace'}
              </p>
            </div>
            <Link
              to="/"
              aria-label="Go to home page"
              title="Go to Home Page"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-blue-700 dark:hover:bg-slate-800"
            >
              <Home className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <Link
            to="/"
            aria-label="Go to home page"
            title="Go to Home Page"
            className="flex w-full justify-center rounded-lg p-1.5 text-slate-500 hover:bg-stone-100 hover:text-blue-700 dark:hover:bg-slate-800"
          >
            <Home className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#FAF9F6] text-[#111318] dark:bg-[#0A0D12] dark:text-slate-100">
      <aside
        className={cn(
          'hidden shrink-0 border-r border-stone-200/90 bg-white transition-all duration-200 lg:block dark:border-slate-800 dark:bg-[#0F141E]',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="sticky top-0 h-screen">{SidebarContent}</div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-64 bg-white dark:bg-[#0F141E]">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation"
              className="absolute top-3.5 right-3 rounded-lg p-1 text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-stone-200/90 bg-white/90 px-4 backdrop-blur-md lg:px-6 dark:border-slate-800 dark:bg-[#0F141E]/90">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-stone-100 lg:hidden dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative flex items-center gap-2 rounded-lg border border-stone-200 bg-[#FAF9F6] px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">
              <FolderKanban className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <select
                aria-label="Switch organization"
                value={organization?._id || ''}
                onChange={(e) => {
                  const found = organizations.find((o) => o.organization._id === e.target.value);
                  if (found) setOrganization(found.organization, found.role);
                }}
                className="bg-transparent pr-4 font-medium text-slate-800 focus:outline-none dark:text-slate-200"
              >
                {organizations.length > 0 ? (
                  organizations.map((item) => (
                    <option key={item.organization._id} value={item.organization._id} className="dark:bg-slate-900">
                      {item.organization.name} ({item.role})
                    </option>
                  ))
                ) : (
                  <option value={organization?._id || ''}>{organization?.name || 'Workspace'}</option>
                )}
              </select>
              <ChevronDown className="pointer-events-none h-3 w-3 text-slate-400" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/app/billing"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              <Coins className="h-3.5 w-3.5" />
              <span>{organization?.creditBalance ?? 0} credits</span>
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative rounded-lg p-2 text-slate-500 hover:bg-stone-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-stone-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-[#111622]">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                    <span>Notifications</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-500">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n._id}
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/settings/notifications/${n._id}/read`, { method: 'PATCH' });
                            await refetchNotifs();
                            if (n.link) {
                              setNotifOpen(false);
                              navigate(`/app${n.link}`);
                            }
                          }}
                          className={cn(
                            'w-full rounded-lg border p-2 text-left text-xs transition-colors',
                            n.read
                              ? 'border-stone-100 bg-stone-50/50 dark:border-slate-800 dark:bg-slate-950/40'
                              : 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30'
                          )}
                        >
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{n.title}</div>
                          <div className="mt-0.5 text-slate-500 dark:text-slate-400">{n.message}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="rounded-lg p-2 text-slate-500 hover:bg-stone-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
