/**
 * Centralized API Client
 *
 * Single source of truth for API configuration and base fetch utilities.
 */

const DEFAULT_PUBLIC_API_URL = '/';
const INTERNAL_API_ORIGIN = process.env.INTERNAL_API_ORIGIN ?? 'http://localhost:8000';
const BACKEND_TOKEN_ENDPOINT = '/api/auth/backend-token';

let cachedBackendToken: string | null = null;
let cachedBackendTokenExpiry = 0;

export class ApiRequestTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    this.name = 'ApiRequestTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export function isApiRequestTimeoutError(error: unknown): error is ApiRequestTimeoutError {
  return error instanceof ApiRequestTimeoutError;
}

function normalizeApiErrorDetail(detail: unknown): string | null {
  if (typeof detail === 'string') {
    return detail;
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const message = (detail as { message?: unknown }).message;
    return typeof message === 'string' ? message : null;
  }
  return null;
}

export async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
    return (
      normalizeApiErrorDetail(parsed.detail) ?? normalizeApiErrorDetail(parsed.message) ?? fallback
    );
  } catch {
    return text || fallback;
  }
}

export function isSharedFreeLlmLimitMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('free website mode') ||
    lower.includes('shared basic gemini') ||
    lower.includes('free gemini key') ||
    lower.includes("lumi coach's free gemini")
  );
}

export function isUserLlmConfigMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('your api key could not complete this request') ||
    (lower.includes('api key') &&
      (lower.includes('quota') ||
        lower.includes('selected model') ||
        lower.includes('valid') ||
        lower.includes('authentication') ||
        lower.includes('unauthorized')))
  );
}

async function getBackendAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedBackendToken && cachedBackendTokenExpiry - 30 > now) {
    return cachedBackendToken;
  }

  const response = await fetch(BACKEND_TOKEN_ENDPOINT, {
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    cachedBackendToken = null;
    cachedBackendTokenExpiry = 0;
    return null;
  }

  const payload = (await response.json()) as {
    token?: string;
    expiresAt?: number;
  };

  if (!payload.token || !payload.expiresAt) {
    cachedBackendToken = null;
    cachedBackendTokenExpiry = 0;
    return null;
  }

  cachedBackendToken = payload.token;
  cachedBackendTokenExpiry = payload.expiresAt;
  return cachedBackendToken;
}

function normalizeApiUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  return trimmed.replace(/\/+$/, '');
}

function toApiBase(apiUrl: string): string {
  if (apiUrl === '/') {
    return '/api/v1';
  }
  return `${apiUrl}/api/v1`;
}

function resolveRuntimeApiBase(apiBase: string): string {
  if (typeof window !== 'undefined' || !apiBase.startsWith('/')) {
    return apiBase;
  }
  return `${INTERNAL_API_ORIGIN}${apiBase}`;
}

export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_PUBLIC_API_URL);
export const API_BASE = resolveRuntimeApiBase(toApiBase(API_URL));

/**
 * Standard fetch wrapper with common error handling.
 * Returns the Response object for flexibility.
 *
 * @param endpoint - API endpoint path or absolute URL
 * @param options - Standard RequestInit options
 * @param timeoutMs - Optional request timeout in milliseconds (default: 240_000)
 */
export async function apiFetch(
  endpoint: string,
  options?: RequestInit,
  timeoutMs?: number
): Promise<Response> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isAbsoluteUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://');
  const isApiPath = normalizedEndpoint.startsWith('/api/');
  let url = `${API_BASE}${normalizedEndpoint}`;

  if (isAbsoluteUrl) {
    url = endpoint;
  } else if (isApiPath) {
    url = resolveRuntimeApiBase(normalizedEndpoint);
  }

  // Matches the backend's 240s hard limit (resumes.py wait_for timeout)
  const timeout = timeoutMs ?? 240_000;
  const controller = new AbortController();
  const timeoutError = new ApiRequestTimeoutError(timeout);
  const timer = setTimeout(() => controller.abort(timeoutError), timeout);

  try {
    const headers = new Headers(options?.headers);
    const isBackendAbsoluteUrl = isAbsoluteUrl && endpoint.startsWith(API_BASE);
    const shouldAttachAuth =
      normalizedEndpoint !== BACKEND_TOKEN_ENDPOINT &&
      !headers.has('Authorization') &&
      (!isAbsoluteUrl || isBackendAbsoluteUrl);

    if (shouldAttachAuth) {
      const token = await getBackendAuthToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    try {
      return await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason === timeoutError) {
        throw timeoutError;
      }
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST request with JSON body.
 */
export async function apiPost<T>(endpoint: string, body: T, timeoutMs?: number): Promise<Response> {
  return apiFetch(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
}

/**
 * PATCH request with JSON body.
 */
export async function apiPatch<T>(endpoint: string, body: T): Promise<Response> {
  return apiFetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * PUT request with JSON body.
 */
export async function apiPut<T>(endpoint: string, body: T): Promise<Response> {
  return apiFetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request.
 */
export async function apiDelete(endpoint: string): Promise<Response> {
  return apiFetch(endpoint, { method: 'DELETE' });
}

/**
 * Builds the full upload URL for file uploads.
 */
export function getUploadUrl(): string {
  return `${API_BASE}/resumes/upload`;
}
