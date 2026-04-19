export type PostHogPrimitive = string | number | boolean | null | undefined;
export type PostHogEventProperties = Record<string, PostHogPrimitive>;

export const POSTHOG_EVENTS = {
  PAGEVIEW: '$pageview',
  LANDING_VIEWED: 'landing_viewed',
  STORY_BANK_VIEWED: 'story_bank_viewed',
  STORY_BANK_PROMPT_COPIED: 'story_bank_prompt_copied',
  HERO_CTA_CLICKED: 'hero_cta_clicked',
  PUBLIC_SIGN_IN_CLICKED: 'public_sign_in_clicked',
  AUTH_SIGN_IN_GOOGLE_CLICKED: 'auth_sign_in_google_clicked',
  AUTH_SIGN_IN_SUCCEEDED: 'auth_sign_in_succeeded',
  AUTH_SIGN_OUT_CLICKED: 'auth_sign_out_clicked',
  DASHBOARD_VIEWED: 'dashboard_viewed',
  MASTER_RESUME_UPLOAD_SUCCEEDED: 'master_resume_upload_succeeded',
  RESUME_WORKSPACE_OPENED: 'resume_workspace_opened',
  SESSION_INVALIDATED_CROSS_TAB: 'session_invalidated_cross_tab',
} as const;

export type PostHogEventName = (typeof POSTHOG_EVENTS)[keyof typeof POSTHOG_EVENTS];
export type PostHogEnvironment = 'test' | 'uat' | 'production';
export type PostHogPlatform = 'landing_web' | 'app_web';

type AnalyticsContext = {
  env: PostHogEnvironment;
  platform: PostHogPlatform;
  surface: string;
  analytics_host: string | null;
  analytics_origin: string | null;
  release: string | null;
  anonymous_id: string | null;
  session_id: string | null;
  run_id: string | null;
};

const ANONYMOUS_ID_STORAGE_KEY = 'resume_matcher_posthog_anonymous_id';
const SESSION_ID_STORAGE_KEY = 'resume_matcher_posthog_session_id';

declare global {
  interface Window {
    posthog?: {
      init?: (apiKey: string, options?: Record<string, PostHogPrimitive>) => void;
      capture?: (eventName: string, properties?: PostHogEventProperties) => void;
      identify?: (distinctId: string, properties?: PostHogEventProperties) => void;
      register?: (properties?: PostHogEventProperties) => void;
      reset?: () => void;
    };
  }
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEnvironment(value?: string | null): PostHogEnvironment | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'test' || normalized === 'uat' || normalized === 'production') {
    return normalized;
  }
  return null;
}

export function resolveAnalyticsEnvironment(
  hostname: string | null,
  explicitEnv?: string | null
): PostHogEnvironment {
  const normalizedExplicit = normalizeEnvironment(explicitEnv);
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  if (!hostname) return 'test';
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local')
  ) {
    return 'test';
  }
  if (hostname.endsWith('.vercel.app')) {
    return 'uat';
  }
  return 'production';
}

function resolvePlatform(pathname: string): PostHogPlatform {
  return pathname === '/' || pathname.startsWith('/story-bank') ? 'landing_web' : 'app_web';
}

function resolveSurface(pathname: string): string {
  if (pathname === '/') return 'homepage';
  if (pathname.startsWith('/story-bank')) return 'story_bank';
  if (pathname.startsWith('/sign-in')) return 'sign_in';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/resumes/')) return 'resume_workspace';
  if (pathname.startsWith('/builder')) return 'resume_builder';
  if (pathname.startsWith('/tailor')) return 'tailor';
  if (pathname.startsWith('/settings')) return 'settings';
  return pathname.replace(/^\/+/, '') || 'unknown';
}

function getStoredValue(storage: Storage, key: string): string | null {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const next = createUuid();
  storage.setItem(key, next);
  return next;
}

function getAnonymousId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return getStoredValue(window.localStorage, ANONYMOUS_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return getStoredValue(window.sessionStorage, SESSION_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getRunIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URL(window.location.href).searchParams.get('runId');
  } catch {
    return null;
  }
}

export function getAnalyticsContext(pathname?: string): AnalyticsContext {
  if (typeof window === 'undefined') {
    return {
      env: 'test',
      platform: 'landing_web',
      surface: 'unknown',
      analytics_host: null,
      analytics_origin: null,
      release: process.env.NEXT_PUBLIC_RELEASE_VERSION?.trim() || null,
      anonymous_id: null,
      session_id: null,
      run_id: null,
    };
  }

  const currentPathname = pathname || window.location.pathname;
  const { hostname, origin } = window.location;

  return {
    env: resolveAnalyticsEnvironment(hostname, process.env.NEXT_PUBLIC_POSTHOG_ENV),
    platform: resolvePlatform(currentPathname),
    surface: resolveSurface(currentPathname),
    analytics_host: hostname || null,
    analytics_origin: origin || null,
    release: process.env.NEXT_PUBLIC_RELEASE_VERSION?.trim() || null,
    anonymous_id: getAnonymousId(),
    session_id: getSessionId(),
    run_id: getRunIdFromUrl(),
  };
}

export function registerAnalyticsContext(pathname?: string) {
  if (typeof window === 'undefined') return;
  window.posthog?.register?.(getAnalyticsContext(pathname));
}

export function captureEvent(
  eventName: PostHogEventName,
  properties?: PostHogEventProperties,
  pathname?: string
) {
  if (typeof window === 'undefined') return;
  window.posthog?.capture?.(eventName, {
    ...getAnalyticsContext(pathname),
    ...properties,
  });
}
