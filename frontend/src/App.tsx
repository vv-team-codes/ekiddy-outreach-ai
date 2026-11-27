import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { ToastContainer } from '@/components/ui';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '@/pages/AuthPages';
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
import { useAppStore } from '@/stores/appStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000
    }
  }
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAppStore((s) => s.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Sign-in gate for the landing page (user rule): a signed-out visitor may
// look at the page, but no action button works without an account — their
// work must auto-save to an account so it is still there when they return.
// Allowed without an account: the theme toggle, in-page anchor links, the
// logo, the Sign In / Start Free links, and the website form (its submit
// handler saves the typed website and routes to sign-up). Every other
// button or control sends the visitor to /login instead of acting.
function LandingGate({ children }: { children: React.ReactNode }) {
  const token = useAppStore((s) => s.token);
  const navigate = useNavigate();
  if (token) {
    return <>{children}</>;
  }
  return (
    <div
      onClickCapture={(e) => {
        const el = (e.target as HTMLElement).closest('a,button,input,select,textarea');
        if (!el) return;
        if (el.getAttribute('aria-label') === 'Toggle theme') return;
        if (el.closest('form')) return;
        const href = el.getAttribute('href');
        if (href === '/login' || href === '/register' || href === '/' || (href && href.startsWith('#'))) return;
        e.preventDefault();
        e.stopPropagation();
        navigate('/login');
      }}
    >
      {children}
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/ekiddy-outreach-ai">
        <Routes>
          <Route
            path="/"
            element={
              <LandingGate>
                <LandingPage />
              </LandingGate>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/book/:slug" element={<PublicBookingPage />} />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
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
