import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton, ToastContainer } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { getSiteBasePath } from '@/lib/siteBase';
import { initStaticDemoSession, isStaticOnlyHost } from '@/lib/staticDemoApi';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AutopilotPage } from '@/pages/AutopilotPage';
import { BillingPage } from '@/pages/BillingPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { CompaniesPage } from '@/pages/CompaniesPage';
import { CompanyResearchPage } from '@/pages/CompanyResearchPage';
import { CompetitorsPage } from '@/pages/CompetitorsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmailWriterPage } from '@/pages/EmailWriterPage';
import { IcpPage } from '@/pages/IcpPage';
import { InboxPage } from '@/pages/InboxPage';
import { LandingPage } from '@/pages/LandingPage';
import { LeadListsPage } from '@/pages/LeadListsPage';
import { MeetingsPage, PublicBookingPage } from '@/pages/MeetingsPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { PeoplePage } from '@/pages/PeoplePage';
import { SendingAccountsPage } from '@/pages/SendingAccountsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useAppStore, type OrganizationSummary, type UserSummary } from '@/stores/appStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000
    }
  }
});

function EnsureWorkspaceSession({ children }: { children: React.ReactNode }) {
  const { token, pendingWebsiteUrl, setSession } = useAppStore();
  const [initializing, setInitializing] = useState(!token);

  useEffect(() => {
    let active = true;
    if (token) {
      setInitializing(false);
      return;
    }

    const bootstrapWorkspace = async () => {
      if (isStaticOnlyHost()) {
        initStaticDemoSession(pendingWebsiteUrl || undefined);
        if (active) setInitializing(false);
        return;
      }
      try {
        const res = await apiRequest<{
          token: string;
          user: UserSummary;
          organization: OrganizationSummary | null;
          organizations: Array<{ organization: OrganizationSummary; role: 'owner' | 'admin' | 'member' | 'viewer' }>;
        }>('/api/auth/guest', {
          method: 'POST',
          skipAuth: true,
          body: JSON.stringify({
            websiteUrl: pendingWebsiteUrl || undefined
          })
        });
        if (!active) return;
        setSession({
          token: res.token,
          user: res.user,
          organization: res.organization,
          organizations: res.organizations,
          role: res.organizations?.[0]?.role || 'owner'
        });
      } catch {
        // Fallback cleanly to local workspace mode if backend is unreachable
        if (active) {
          initStaticDemoSession(pendingWebsiteUrl || undefined);
        }
      } finally {
        if (active) setInitializing(false);
      }
    };

    void bootstrapWorkspace();
    return () => {
      active = false;
    };
  }, [token, pendingWebsiteUrl, setSession]);

  if (initializing && !token) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <PageSkeleton />
      </div>
    );
  }

  return <>{children}</>;
}

export function App() {
  const routerBasename = getSiteBasePath() || '/';
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {/* Auth routes removed per user request; redirect directly to home page */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/forgot-password" element={<Navigate to="/" replace />} />
          <Route path="/reset-password" element={<Navigate to="/" replace />} />
          <Route path="/book/:slug" element={<PublicBookingPage />} />

          <Route
            path="/app"
            element={
              <EnsureWorkspaceSession>
                <AppShell />
              </EnsureWorkspaceSession>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="research" element={<CompanyResearchPage />} />
            <Route path="competitors" element={<CompetitorsPage />} />
            <Route path="icps" element={<IcpPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="lists" element={<LeadListsPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="email-writer" element={<EmailWriterPage />} />
            <Route path="sending" element={<SendingAccountsPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="meetings" element={<MeetingsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="autopilot" element={<AutopilotPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
