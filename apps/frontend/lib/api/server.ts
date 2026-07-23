import 'server-only';

import { auth } from '@/auth';
import { createBackendAccessToken } from '@/lib/auth/backend-token';
import type { ResumeListItem } from '@/lib/api/resume';

// The Next.js server reaches the FastAPI backend directly on the loopback origin.
// Override with INTERNAL_API_ORIGIN when the backend only answers on a specific
// address (e.g. Docker Desktop on macOS publishes IPv6-only: set http://[::1]:8000).
const INTERNAL_API_ORIGIN = process.env.INTERNAL_API_ORIGIN ?? 'http://localhost:8000';
const INTERNAL_API_BASE = `${INTERNAL_API_ORIGIN}/api/v1`;

type DashboardProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'loading';

export interface DashboardInitialData {
  masterResumeId: string | null;
  masterResumeItem: ResumeListItem | null;
  tailoredResumes: ResumeListItem[];
  processingStatus: DashboardProcessingStatus;
}

/**
 * Mint a short-lived backend JWT from the current NextAuth session.
 * Mirrors app/api/auth/backend-token/route.ts but runs in-process (no HTTP round-trip).
 * Returns null when unauthenticated or misconfigured.
 */
async function mintBackendToken(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return null;
  }

  const secret = process.env.BACKEND_AUTH_SHARED_SECRET;
  if (!secret) {
    console.error('[dashboard] Missing BACKEND_AUTH_SHARED_SECRET — cannot prefetch dashboard.');
    return null;
  }

  const { token } = createBackendAccessToken(
    {
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name ?? undefined,
      picture: session.user.image ?? undefined,
    },
    secret
  );
  return token;
}

const DASHBOARD_RESUME_LIST_LIMIT = 10;

/**
 * Server-side prefetch of the dashboard's first-paint state. Fetches the resume
 * list and system status in parallel so the page can render fully-formed HTML
 * (no client-side localStorage flash on refresh).
 *
 * Returns null when the request is unauthenticated or the backend is unreachable;
 * the client component then falls back to its own data loading.
 */
export async function fetchDashboardInitialData(): Promise<DashboardInitialData | null> {
  const token = await mintBackendToken();
  if (!token) {
    return null;
  }

  const headers = { Authorization: `Bearer ${token}` };

  try {
    const listRes = await fetch(
      `${INTERNAL_API_BASE}/resumes/list?include_master=true&limit=${DASHBOARD_RESUME_LIST_LIMIT}`,
      { headers, cache: 'no-store' }
    );

    const resumes: ResumeListItem[] = listRes.ok
      ? (((await listRes.json()) as { data?: ResumeListItem[] }).data ?? [])
      : [];

    const master = resumes.find((r) => r.is_master) ?? null;
    const rawStatus = master?.processing_status;
    // Match DashboardClient's lazy-init logic exactly so SSR and client agree.
    const processingStatus: DashboardProcessingStatus = !master
      ? 'loading'
      : rawStatus === 'pending' || rawStatus === 'processing'
        ? 'loading'
        : (rawStatus as DashboardProcessingStatus);

    return {
      masterResumeId: master?.resume_id ?? null,
      masterResumeItem: master,
      tailoredResumes: resumes.filter((r) => !r.is_master),
      processingStatus,
    } satisfies DashboardInitialData;
  } catch (err) {
    console.error('[dashboard] Server prefetch failed:', err);
    return null;
  }
}
