'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';

type SignInRedirectClientProps = {
  callbackUrl?: string;
};

function normalizeCallbackUrl(callbackUrl?: string): string | null {
  if (!callbackUrl) return null;

  if (callbackUrl.startsWith('/')) {
    return callbackUrl;
  }

  try {
    const parsed = new URL(callbackUrl);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizePassiveRedirectTarget(callbackUrl?: string): string | null {
  const normalized = normalizeCallbackUrl(callbackUrl);
  if (!normalized) {
    return '/dashboard';
  }
  if (normalized === '/sign-in') {
    return '/dashboard';
  }
  return normalized;
}

export function SignInRedirectClient({ callbackUrl }: SignInRedirectClientProps) {
  const { status } = useSession();
  const capturedRef = useRef(false);

  const fallbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/';

    const normalizedCallbackUrl = normalizePassiveRedirectTarget(callbackUrl);
    return normalizedCallbackUrl || '/dashboard';
  }, [callbackUrl]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!capturedRef.current) {
      capturedRef.current = true;
      captureEvent(POSTHOG_EVENTS.AUTH_SIGN_IN_SUCCEEDED, {
        target_path: fallbackUrl,
      });
    }
    window.location.replace(fallbackUrl);
  }, [fallbackUrl, status]);

  return null;
}
