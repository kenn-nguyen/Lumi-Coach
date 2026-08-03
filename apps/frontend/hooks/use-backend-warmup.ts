'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pingBackend } from '@/lib/api/warmup';

export type BackendWarmState = 'checking' | 'cold' | 'ready';

export interface BackendWarmup {
  state: BackendWarmState;
  elapsedMs: number;
  /** True once polling has been stopped after GIVE_UP_MS without a response. */
  gaveUp: boolean;
  retry: () => void;
}

// A warm backend answers the first probe well under a second, so callers can
// keep the normal UI during 'checking' and only react to 'cold'.
const FIRST_PROBE_TIMEOUT_MS = 2_000;
const POLL_TIMEOUT_MS = 4_000;
const POLL_INTERVAL_MS = 2_500;
// Ping every 10 minutes while healthy to keep Render's free tier from spinning
// down, and to detect a backend that has gone down.
const KEEPALIVE_MS = 10 * 60 * 1_000;
// Stop hammering a backend that hasn't come up after 3 minutes; require a
// manual retry. A Render cold start almost always completes well before this.
const GIVE_UP_MS = 3 * 60 * 1_000;

/**
 * Continuously monitors backend health (Render free tier spins down when idle).
 * On mount it probes /api/v1/health; while healthy it keep-alive pings every
 * 10 min and re-probes when the tab regains focus; when a probe fails it enters
 * 'cold' and polls until the backend answers (then 'ready') or until 3 minutes
 * pass (then `gaveUp` and polling stops). `retry()` restarts the probe loop.
 */
export function useBackendWarmup(): BackendWarmup {
  const [state, setState] = useState<BackendWarmState>('checking');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const phaseRef = useRef<BackendWarmState>('checking');

  const retry = useCallback(() => {
    setGaveUp(false);
    setState('checking');
    setAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let keepAlive: ReturnType<typeof setInterval> | undefined;
    let ticker: ReturnType<typeof setInterval> | undefined;
    let coldStartedAt = 0;

    const stopTimers = () => {
      if (pollTimer) clearTimeout(pollTimer);
      if (keepAlive) clearInterval(keepAlive);
      if (ticker) clearInterval(ticker);
    };

    const goReady = () => {
      if (cancelled) return;
      if (ticker) clearInterval(ticker);
      phaseRef.current = 'ready';
      setGaveUp(false);
      setState('ready');
      if (keepAlive) clearInterval(keepAlive);
      keepAlive = setInterval(() => {
        void pingBackend(POLL_TIMEOUT_MS).then((ok) => {
          if (!cancelled && !ok) goCold();
        });
      }, KEEPALIVE_MS);
    };

    const goCold = () => {
      if (cancelled) return;
      if (keepAlive) clearInterval(keepAlive);
      phaseRef.current = 'cold';
      coldStartedAt = Date.now();
      setElapsedMs(0);
      setGaveUp(false);
      setState('cold');
      if (ticker) clearInterval(ticker);
      ticker = setInterval(() => {
        if (!cancelled) setElapsedMs(Date.now() - coldStartedAt);
      }, 500);
      const poll = () => {
        void pingBackend(POLL_TIMEOUT_MS).then((ok) => {
          if (cancelled) return;
          if (ok) {
            goReady();
            return;
          }
          if (Date.now() - coldStartedAt >= GIVE_UP_MS) {
            // Give up: stop polling and freeze the elapsed counter until retry.
            if (ticker) clearInterval(ticker);
            setGaveUp(true);
            return;
          }
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
        });
      };
      poll();
    };

    // Initial probe.
    void pingBackend(FIRST_PROBE_TIMEOUT_MS).then((ok) => {
      if (cancelled) return;
      if (ok) goReady();
      else goCold();
    });

    // Re-probe when the tab becomes visible again — catches a backend that went
    // down while the tab was hidden, without waiting for the 10-min keep-alive.
    const recheck = () => {
      if (cancelled || document.visibilityState !== 'visible' || phaseRef.current !== 'ready') {
        return;
      }
      void pingBackend(FIRST_PROBE_TIMEOUT_MS).then((ok) => {
        if (!cancelled && !ok) goCold();
      });
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);

    return () => {
      cancelled = true;
      stopTimers();
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [attempt]);

  return { state, elapsedMs, gaveUp, retry };
}
