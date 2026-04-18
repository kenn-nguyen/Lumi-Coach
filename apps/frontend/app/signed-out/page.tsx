'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { recordSignOutDebug, replaySignOutDebug } from '@/lib/auth/signout-debug';

export default function SignedOutPage() {
  const { status } = useSession();
  const redirectedRef = useRef(false);
  const [serverStatus, setServerStatus] = useState<
    'checking' | 'authenticated' | 'unauthenticated'
  >('checking');

  useEffect(() => {
    replaySignOutDebug();
    recordSignOutDebug('signed-out-page-effect-start', { status });
  }, [status]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      recordSignOutDebug('signed-out-page-session-check-start', { clientStatus: status });

      try {
        const response = await fetch('/api/auth/session-status', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);
        const authenticated = response.ok && payload?.authenticated === true;

        setServerStatus(authenticated ? 'authenticated' : 'unauthenticated');
        recordSignOutDebug('signed-out-page-session-check-result', {
          httpStatus: response.status,
          authenticated,
          payload,
        });

        if (!authenticated && !redirectedRef.current) {
          redirectedRef.current = true;
          window.setTimeout(() => {
            recordSignOutDebug('signed-out-page-redirect-to-signin');
            window.location.replace('/sign-in');
          }, 250);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        recordSignOutDebug('signed-out-page-session-check-error', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => controller.abort();
  }, [status]);

  return (
    <main className="skin-page-brand min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-white/90 p-8 shadow-sw-card backdrop-blur-[10px]">
        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Lumi Coach
          </p>
          <h1 className="font-serif text-4xl tracking-[-0.04em] text-foreground">Signed out</h1>
          <p className="text-sm text-muted-foreground">
            Ending your session before returning to sign in.
          </p>
          <p className="text-xs text-muted-foreground">
            Client session: {status}. Server session: {serverStatus}.
          </p>
        </div>

        <div className="pt-6">
          <Link
            href="/sign-in"
            className="text-sm text-gray-700 underline underline-offset-4 transition hover:text-black"
          >
            Continue to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
