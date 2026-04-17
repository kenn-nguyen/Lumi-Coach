export type PostHogEventProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    posthog?: {
      init?: (
        apiKey: string,
        options?: Record<string, string | number | boolean | null | undefined>
      ) => void;
      capture?: (eventName: string, properties?: PostHogEventProperties) => void;
      identify?: (distinctId: string, properties?: PostHogEventProperties) => void;
      reset?: () => void;
    };
  }
}

export function captureEvent(eventName: string, properties?: PostHogEventProperties) {
  if (typeof window === 'undefined') return;
  window.posthog?.capture?.(eventName, properties);
}
