// Backend warm-up helpers for Render's free tier, which spins the service down
// after idle and takes ~30-60s to cold-start on the next request. We nudge it
// awake early (homepage load, sign-in click) so it's usually ready by the time
// the user reaches the dashboard.
//
// The browser reaches the backend through a Next.js rewrite (next.config.ts),
// so a relative '/api/v1/health' hits the backend with no CORS setup. The
// health route is unauthenticated and touches no DB — ideal for a cheap ping.

const HEALTH_URL = '/api/v1/health';
const WARMUP_THROTTLE_MS = 30_000;

let lastWarmupAt = 0;

/**
 * Fire-and-forget ping to wake a spun-down backend. Throttled so repeated calls
 * (e.g. homepage remount) don't stack up. `keepalive` lets the request survive a
 * navigation such as the sign-in redirect. No-ops on the server.
 */
export function warmupBackend(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastWarmupAt < WARMUP_THROTTLE_MS) return;
  lastWarmupAt = now;
  fetch(HEALTH_URL, { method: 'GET', cache: 'no-store', keepalive: true }).catch(() => {});
}

/**
 * Single health probe with a short timeout. Resolves `true` if the backend
 * answered (awake), `false` on timeout/error (likely still cold-starting).
 */
export async function pingBackend(timeoutMs: number): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
