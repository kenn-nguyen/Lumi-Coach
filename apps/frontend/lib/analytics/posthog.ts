export type PostHogEventProperties = Record<string, string | number | boolean | null | undefined>;

export const POSTHOG_EVENTS = {
  PAGEVIEW: '$pageview',
  AUTH_SIGN_IN_GOOGLE_CLICKED: 'auth_sign_in_google_clicked',
  AUTH_SIGN_OUT_CLICKED: 'auth_sign_out_clicked',
  EXTENSION_CONNECT_STARTED: 'extension_connect_started',
  EXTENSION_CONNECT_SUCCEEDED: 'extension_connect_succeeded',
  EXTENSION_CONNECT_FAILED: 'extension_connect_failed',
} as const;

export type PostHogEventName = (typeof POSTHOG_EVENTS)[keyof typeof POSTHOG_EVENTS];

export type PostHogEnvironment = 'local' | 'preview' | 'production' | 'unknown';

type AnalyticsContext = {
  app_surface: 'website';
  analytics_environment: PostHogEnvironment;
  analytics_host: string | null;
  analytics_origin: string | null;
};

declare global {
  interface Window {
    posthog?: {
      init?: (
        apiKey: string,
        options?: Record<string, string | number | boolean | null | undefined>
      ) => void;
      capture?: (eventName: string, properties?: PostHogEventProperties) => void;
      identify?: (distinctId: string, properties?: PostHogEventProperties) => void;
      register?: (properties?: PostHogEventProperties) => void;
      reset?: () => void;
    };
  }
}

function resolveAnalyticsEnvironment(hostname: string | null): PostHogEnvironment {
  if (!hostname) return 'unknown';
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local')
  ) {
    return 'local';
  }
  if (hostname.endsWith('.vercel.app')) {
    return 'preview';
  }
  return 'production';
}

export function getAnalyticsContext(): AnalyticsContext {
  if (typeof window === 'undefined') {
    return {
      app_surface: 'website',
      analytics_environment: 'unknown',
      analytics_host: null,
      analytics_origin: null,
    };
  }
  const { hostname, origin } = window.location;
  return {
    app_surface: 'website',
    analytics_environment: resolveAnalyticsEnvironment(hostname),
    analytics_host: hostname || null,
    analytics_origin: origin || null,
  };
}

export function registerAnalyticsContext() {
  if (typeof window === 'undefined') return;
  window.posthog?.register?.(getAnalyticsContext());
}

export function captureEvent(eventName: PostHogEventName, properties?: PostHogEventProperties) {
  if (typeof window === 'undefined') return;
  window.posthog?.capture?.(eventName, {
    ...getAnalyticsContext(),
    ...properties,
  });
}
