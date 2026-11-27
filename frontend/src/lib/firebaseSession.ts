import { apiRequest, ApiClientError, isBackendConfigured } from '@/lib/api';
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
 * Thrown when there is no workspace backend to exchange the Firebase
 * session with — e.g. on the static GitHub Pages host, where POST /api/*
 * has no backend behind it and Pages answers 404/405. The Firebase
 * account itself is fine; only workspace provisioning needs the backend.
 */
export class BackendUnavailableError extends Error {
  constructor(message = 'The workspace service is not connected yet.') {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

/** True for a missing backend, including a 404/405 from a static host. */
export function isBackendUnavailableError(err: unknown): boolean {
  if (err instanceof BackendUnavailableError) return true;
  if (err instanceof ApiClientError && (err.status === 404 || err.status === 405)) return true;
  return false;
}

/**
 * Exchanges a verified Firebase ID token for the backend JWT + workspace.
 * The Firebase ID token is never stored and never sent as the API token —
 * api.ts keeps sending the backend JWT returned here.
 * On 401 (e.g. email not verified yet) both sessions are cleared.
 * When no backend is configured (VITE_API_URL unset, e.g. GitHub Pages)
 * no POST is made at all — BackendUnavailableError is thrown instead.
 */
export async function exchangeFirebaseSession(
  idToken: string,
  extra: FirebaseExchangeExtra = {}
): Promise<AuthPayload> {
  if (!isBackendConfigured) {
    throw new BackendUnavailableError();
  }
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
      throw err;
    }
    if (err instanceof ApiClientError && (err.status === 404 || err.status === 405)) {
      // Static host (e.g. GitHub Pages) with no backend behind /api/*.
      throw new BackendUnavailableError();
    }
    throw err;
  }
}
