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

const PROBE_TIMEOUT_MS = 2_000;
// Require this many consecutive failed probes before showing the overlay, so a
// single transient blip on a healthy backend never triggers a false alarm.
const CONFIRM_ATTEMPTS = 3;
const CONFIRM_INTERVAL_MS = 800;
// While cold (overlay shown), keep polling for recovery at this cadence.
const POLL_TIMEOUT_MS = 4_000;
const POLL_INTERVAL_MS = 2_500;
// Ping every 10 minutes while healthy to keep Render's free tier from spinning
// down, and to detect a backend that has gone down.
const KEEPALIVE_MS = 10 * 60 * 1_000;
// Stop polling (and show the terminal state) after this long without recovery.
const GIVE_UP_MS = 3 * 60 * 1_000;

/**
 * Continuously monitors backend health (Render free tier spins down when idle).
 * A failed probe does NOT immediately show the overlay — it first re-probes up
 * to CONFIRM_ATTEMPTS times, and only shows the "waking up" overlay if every
 * one fails, so a transient blip on a healthy backend never causes a false
 * alarm. Once cold, it polls until the backend answers ('ready') or GIVE_UP_MS
 * passes ('gaveUp', polling stops). While healthy it keep-alive pings every
 * 10 min and re-probes on tab focus. `retry()` restarts the loop.
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    let keepAlive: ReturnType<typeof setInterval> | undefined;
    let ticker: ReturnType<typeof setInterval> | undefined;
    let coldStartedAt = 0;

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const stopAll = () => {
      clearTimer();
      if (keepAlive) clearInterval(keepAlive);
      if (ticker) clearInterval(ticker);
    };

    const goReady = () => {
      if (cancelled) return;
      clearTimer();
      if (ticker) clearInterval(ticker);
      phaseRef.current = 'ready';
      setGaveUp(false);
      setState('ready');
      if (keepAlive) clearInterval(keepAlive);
      keepAlive = setInterval(() => {
        void pingBackend(POLL_TIMEOUT_MS).then((ok) => {
          if (!cancelled && !ok) confirmDown();
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
            if (ticker) clearInterval(ticker);
            setGaveUp(true);
            return;
          }
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        });
      };
      poll();
    };

    // Probe up to CONFIRM_ATTEMPTS times without showing the overlay; only go
    // cold if every attempt fails. Any success returns to 'ready'.
    const confirmDown = (attemptsLeft = CONFIRM_ATTEMPTS) => {
      if (cancelled) return;
      void pingBackend(PROBE_TIMEOUT_MS).then((ok) => {
        if (cancelled) return;
        if (ok) {
          goReady();
          return;
        }
        if (attemptsLeft <= 1) {
          goCold();
          return;
        }
        timer = setTimeout(() => confirmDown(attemptsLeft - 1), CONFIRM_INTERVAL_MS);
      });
    };

    confirmDown();

    // Re-probe when the tab becomes visible again — catches a backend that went
    // down while the tab was hidden, without waiting for the 10-min keep-alive.
    const recheck = () => {
      if (cancelled || document.visibilityState !== 'visible' || phaseRef.current !== 'ready') {
        return;
      }
      void pingBackend(PROBE_TIMEOUT_MS).then((ok) => {
        if (!cancelled && !ok) confirmDown();
      });
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);

    return () => {
      cancelled = true;
      stopAll();
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [attempt]);

  return { state, elapsedMs, gaveUp, retry };
}
