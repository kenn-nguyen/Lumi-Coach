'use client';

import { useEffect, useRef } from 'react';
import {
  clearSignOutDebug,
  recordSignOutDebug,
  replaySignOutDebug,
} from '@/lib/auth/signout-debug';

export default function ExtensionSignOutPage() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    clearSignOutDebug();
    replaySignOutDebug();
    recordSignOutDebug('extension-signout-opened');

    const timeoutId = window.setTimeout(() => {
      recordSignOutDebug('extension-signout-redirect-to-signout');
      window.location.replace('/sign-out');
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <main className="skin-page-brand min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-white/90 p-8 shadow-sw-card backdrop-blur-[10px]">
        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Lumi Coach
          </p>
          <h1 className="font-serif text-4xl tracking-[-0.04em] text-foreground">
            Preparing sign out
          </h1>
          <p className="text-sm text-muted-foreground">
            Syncing open tabs before ending your Google session.
          </p>
        </div>
      </div>
    </main>
  );
}
