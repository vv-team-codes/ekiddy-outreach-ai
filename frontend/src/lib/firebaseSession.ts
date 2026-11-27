import { apiRequest, ApiClientError } from '@/lib/api';
import { signOutFirebase } from '@/lib/firebase';
import { useAppStore, type OrganizationSummary, type UserSummary } from '@/stores/appStore';

export interface AuthPayload {
  token: string;
  user: UserSummary;
  organization: OrganizationSummary | null;
  organizations: Array<{ organization: OrganizationSummary; role: 'owner' | 'admin' | 'member' | 'viewer' }>;
}

export interface FirebaseExchangeExtra {
  fullName?: string;
  organizationName?: string;
  websiteUrl?: string;
}

/**
 * Exchanges a verified Firebase ID token for the backend JWT + workspace.
 * The Firebase ID token is never stored and never sent as the API token —
 * api.ts keeps sending the backend JWT returned here.
 * On 401 (e.g. email not verified yet) both sessions are cleared.
 */
export async function exchangeFirebaseSession(
  idToken: string,
  extra: FirebaseExchangeExtra = {}
): Promise<AuthPayload> {
  try {
    const res = await apiRequest<AuthPayload>('/api/auth/firebase', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ idToken, ...extra })
    });
    useAppStore.getState().setSession({
      token: res.token,
      user: res.user,
      organization: res.organization,
      organizations: res.organizations,
      role: res.organizations?.[0]?.role || 'owner'
    });
    return res;
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) {
      useAppStore.getState().clearSession();
      await signOutFirebase();
    }
    throw err;
  }
}
