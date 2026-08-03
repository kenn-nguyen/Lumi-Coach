'use client';

import { useCallback, useEffect, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { ResumePreviewProvider } from '@/components/common/resume_previewer_context';
import { LocalizedErrorBoundary } from '@/components/common/error-boundary';
import { LanguageProvider } from '@/lib/context/language-context';
import { onSessionInvalidated } from '@/lib/auth/cross-tab-session';
import { StatusCacheProvider } from '@/lib/context/status-cache';
import { clearProtectedClientState } from '@/lib/auth/protected-client-state';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';
import { useBackendWarmup } from '@/hooks/use-backend-warmup';
import { BackendWakingScreen } from '@/components/dashboard/backend-waking-screen';

export function AuthenticatedAppShell({ children }: { children: ReactNode }) {
  const { status } = useSession();

  // App-wide backend health monitor. Shows the waking overlay whenever the
  // Render backend is unreachable — on any authed page, regardless of cached
  // data — and keep-alive pings it so it stays warm while the app is open.
  const backend = useBackendWarmup();

  const invalidateSession = useCallback(() => {
    captureEvent(POSTHOG_EVENTS.SESSION_INVALIDATED_CROSS_TAB);
    clearProtectedClientState();
    window.location.replace('/sign-in?reason=signed-out');
  }, []);

  const verifyCurrentSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session-status', {
        cache: 'no-store',
        credentials: 'same-origin',
      });

      if (response.status === 401) {
        invalidateSession();
      }
    } catch {
      // Ignore transient auth-check failures; the shell still falls back to useSession state.
    }
  }, [invalidateSession]);

  useEffect(() => {
    if (status !== 'unauthenticated') {
      return;
    }

    invalidateSession();
  }, [invalidateSession, status]);

  useEffect(() => onSessionInvalidated(() => void verifyCurrentSession()), [verifyCurrentSession]);

  // Middleware already blocks unauthenticated users — if we reach this component,
  // the user is authenticated. The 'loading' state is just NextAuth's client-side
  // session initialization. Rendering the full shell during loading avoids a
  // blank-page flash before content appears.
  if (status === 'unauthenticated') {
    return <main className="min-h-screen bg-[#F0F0E8]" />;
  }

  return (
    <StatusCacheProvider>
      <LanguageProvider>
        <ResumePreviewProvider>
          <LocalizedErrorBoundary>
            <main className="min-h-screen flex flex-col">{children}</main>
            {backend.state === 'cold' && (
              <BackendWakingScreen
                elapsedMs={backend.elapsedMs}
                gaveUp={backend.gaveUp}
                onRetry={backend.retry}
              />
            )}
          </LocalizedErrorBoundary>
        </ResumePreviewProvider>
      </LanguageProvider>
    </StatusCacheProvider>
  );
}
