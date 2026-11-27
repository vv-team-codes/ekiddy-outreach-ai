import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@ekiddy/shared';

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  emailVerified: boolean;
  jobTitle?: string;
  timezone?: string;
  defaultOrganizationId?: string;
  preferences?: {
    theme: 'light' | 'dark' | 'system';
    notificationsEnabled: boolean;
  };
}

export interface OrganizationSummary {
  _id: string;
  name: string;
  slug: string;
  website?: string;
  industry?: string;
  creditBalance: number;
  plan: 'free' | 'starter' | 'growth' | 'scale';
  dailySendLimit: number;
  bookingSlug?: string;
  onboarding?: {
    currentStep: number;
    completed: boolean;
    websiteUrl?: string;
    projectId?: string;
    researchId?: string;
  };
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}

interface AppState {
  token: string | null;
  user: UserSummary | null;
  organization: OrganizationSummary | null;
  organizations: Array<{ organization: OrganizationSummary; role: UserRole }>;
  role: UserRole;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  pendingWebsiteUrl: string;
  toasts: ToastMessage[];
  setSession: (payload: {
    token: string;
    user: UserSummary;
    organization: OrganizationSummary | null;
    organizations?: Array<{ organization: OrganizationSummary; role: UserRole }>;
    role?: UserRole;
  }) => void;
  setOrganization: (org: OrganizationSummary, role?: UserRole) => void;
  updateCreditBalance: (balance: number) => void;
  clearSession: () => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setPendingWebsiteUrl: (url: string) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      organization: null,
      organizations: [],
      role: 'owner',
      theme: 'light',
      sidebarCollapsed: false,
      pendingWebsiteUrl: '',
      toasts: [],
      setSession: ({ token, user, organization, organizations, role }) =>
        set((state) => ({
          token,
          user,
          organization,
          organizations: organizations ?? state.organizations,
          role: role ?? state.role
        })),
      setOrganization: (org, role) =>
        set((state) => ({
          organization: org,
          role: role ?? state.role
        })),
      updateCreditBalance: (balance) =>
        set((state) => ({
          organization: state.organization ? { ...state.organization, creditBalance: balance } : null
        })),
      clearSession: () =>
        set({
          token: null,
          user: null,
          organization: null,
          organizations: [],
          role: 'owner'
        }),
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light';
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next === 'dark');
          }
          return { theme: next };
        }),
      setTheme: (theme) => {
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
        }
        set({ theme });
      },
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setPendingWebsiteUrl: (pendingWebsiteUrl) => set({ pendingWebsiteUrl }),
      addToast: (toast) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
        }, 4500);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }),
    {
      name: 'ekiddy-app-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        organization: state.organization,
        organizations: state.organizations,
        role: state.role,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        pendingWebsiteUrl: state.pendingWebsiteUrl
      })
    }
  )
);
