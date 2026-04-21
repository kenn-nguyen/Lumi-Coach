'use client';

import { useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { broadcastSessionInvalidation, markSignOutInProgress } from '@/lib/auth/cross-tab-session';
import { replaySignOutDebug, recordSignOutDebug } from '@/lib/auth/signout-debug';

export function SignOutForm() {
  const attemptedRef = useRef(false);
  const { status } = useSession();

  useEffect(() => {
    replaySignOutDebug();
    recordSignOutDebug('signout-effect-start', {
      status,
      attempted: attemptedRef.current,
    });

    if (status === 'loading' || attemptedRef.current) return;

    attemptedRef.current = true;

    if (status === 'unauthenticated') {
      recordSignOutDebug('signout-already-unauthenticated');
      window.location.replace('/sign-in');
      return;
    }

    void (async () => {
      recordSignOutDebug('signout-request-start', {
        callbackUrl: '/signed-out',
        redirectMode: 'next-auth-default',
      });
      markSignOutInProgress();
      broadcastSessionInvalidation();
      await signOut({ callbackUrl: '/signed-out' });
    })();
  }, [status]);

  return (
    <div className="rounded-[28px] border border-border bg-white/90 p-8 shadow-sw-card backdrop-blur-[10px]">
      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Lumi Coach
        </p>
        <h1 className="font-serif text-4xl tracking-[-0.04em] text-foreground">Signing out</h1>
        <p className="text-sm text-muted-foreground">Closing your Google session.</p>
      </div>
    </div>
  );
}
