import { handleStaticDemoApi, isStaticOnlyHost } from '@/lib/staticDemoApi';
import { useAppStore } from '@/stores/appStore';

const API_BASE = import.meta.env.VITE_API_URL || '';

// True only when a backend base URL is configured (VITE_API_URL).
export const isBackendConfigured = Boolean(import.meta.env.VITE_API_URL);

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status: number, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  if (isStaticOnlyHost()) {
    const res = await handleStaticDemoApi<T>(path, options);
    return res.data;
  }

  const { token, organization } = useAppStore.getState();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!options.skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!options.skipAuth && organization?._id) {
    headers.set('x-organization-id', organization._id);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiClientError(`Request failed with status ${response.status}`, response.status);
    }
    return (await response.text()) as unknown as T;
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: T;
    meta?: Record<string, unknown>;
    error?: { code?: string; message?: string; details?: unknown };
  };

  if (!response.ok || !payload.success) {
    if (response.status === 401 && !options.skipAuth) {
      useAppStore.getState().clearSession();
    }
    throw new ApiClientError(
      payload.error?.message || `Request failed (${response.status})`,
      response.status,
      payload.error?.code || 'API_ERROR',
      payload.error?.details
    );
  }

  return payload.data;
}

export async function apiRequestWithMeta<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  if (isStaticOnlyHost()) {
    return handleStaticDemoApi<T>(path, options);
  }

  const { token, organization } = useAppStore.getState();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (organization?._id) headers.set('x-organization-id', organization._id);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = (await response.json()) as {
    success: boolean;
    data: T;
    meta?: Record<string, unknown>;
    error?: { code?: string; message?: string; details?: unknown };
  };
  if (!response.ok || !payload.success) {
    if (response.status === 401) {
      useAppStore.getState().clearSession();
    }
    throw new ApiClientError(
      payload.error?.message || `Request failed (${response.status})`,
      response.status,
      payload.error?.code,
      payload.error?.details
    );
  }
  return { data: payload.data, meta: payload.meta };
}
