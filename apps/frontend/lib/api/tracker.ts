/**
 * Tracker API client.
 *
 * Uses the app's authenticated fetch when a session exists, and falls back to a
 * plain request when it does not. The fallback is what lets the tracker run
 * headless against a local backend with the dev bypass on; in production the
 * backend rejects an unauthenticated call regardless of what the browser sends.
 */

import { apiFetch } from '@/lib/api/client';

export interface TrackerJob {
  job_id: string;
  priority: string | null;
  score: number | null;
  us_visa: string | null;
  company: string | null;
  title: string | null;
  title_level: string | null;
  jd_implied_level: string | null;
  status: string;
  owner: string;
  action: string;
  location: string | null;
  posted: string | null;
  applicants: string | null;
  notes: string | null;
  applied_at: string | null;
  merged_job_ids: string[];
  dead_links: Record<string, boolean>;
  resume_file: string | null;
  referral_contact: string | null;
  sort_key: string;
  in_assigned_queue: boolean;
}

export interface TrackerJobDetail extends TrackerJob {
  summary: string | null;
  why: string | null;
  us_visa_reason: string | null;
  jd_text: string | null;
  imported_at: string | null;
  scored_at: string | null;
}

export interface QueueCounts {
  flagged: number;
  assigned: number;
  submitted: number;
  unowned_top: number;
  total: number;
}

export interface JobsResponse {
  jobs: TrackerJob[];
  total: number;
  offset: number;
  limit: number;
  counts: QueueCounts;
}

export interface TrackerMeta {
  role: 'owner' | 'assignee';
  email: string;
  statuses: string[];
  owners: string[];
  actions: string[];
  priorities: string[];
  visas: string[];
}

export interface TrackerRun {
  run_id: string;
  mode: string;
  status: string;
  phase: string;
  counters: Record<string, number>;
  errors: string[];
  started_at: string | null;
  finished_at: string | null;
  cancel_requested: boolean;
}

export interface ValidateResult {
  ok: boolean;
  problems: string[];
  route: string;
  model: string | null;
  apify_accounts: number;
  jobs: QueueCounts;
}

export interface ApifyAccount {
  label: string;
  active: boolean;
  batch_key_set: boolean;
  detail_key_set: boolean;
}

const BASE = '/api/v1/tracker';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(`${BASE}${path}`, init);
  } catch {
    // No session (dev bypass, or the auth service is unreachable). Try the same
    // call without a token rather than showing an error the user cannot act on.
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  }
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      /* a non-JSON error body is still an error */
    }
    throw new Error(String(detail));
  }
  return (await res.json()) as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchMeta(): Promise<TrackerMeta> {
  return request<TrackerMeta>('/meta');
}

export interface JobQuery {
  view: 'assigned' | 'all';
  q?: string;
  status?: string;
  priority?: string;
  us_visa?: string;
  owner?: string;
  sort?: string;
  direction?: string;
  offset?: number;
  limit?: number;
}

export function fetchJobs(query: JobQuery): Promise<JobsResponse> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  return request<JobsResponse>(`/jobs?${params.toString()}`);
}

export function fetchJob(jobId: string): Promise<TrackerJobDetail> {
  return request<TrackerJobDetail>(`/jobs/${encodeURIComponent(jobId)}`);
}

export function patchJob(jobId: string, changes: Partial<TrackerJob>): Promise<TrackerJobDetail> {
  return request<TrackerJobDetail>(`/jobs/${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
}

export type BulkOp = 'assign' | 'assign_prep' | 'take_back' | 'skip' | 'rescore' | 'unskip';

export function bulkJobs(jobIds: string[], op: BulkOp): Promise<{ updated: number; op: string }> {
  return post('/jobs/bulk', { job_ids: jobIds, op });
}

export function markLinkDead(jobId: string, linkId: string): Promise<TrackerJobDetail> {
  return post(`/jobs/${encodeURIComponent(jobId)}/dead-link`, { link_id: linkId });
}

export function fetchSettings(): Promise<{
  settings: Record<string, string>;
  apify_accounts: ApifyAccount[];
}> {
  return request('/settings');
}

export function saveSettings(values: Record<string, string>): Promise<{ written: number }> {
  return request('/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
}

export function fetchRuns(limit = 20): Promise<{ runs: TrackerRun[] }> {
  return request(`/runs?limit=${limit}`);
}

export function startRun(mode: 'import' | 'detail' | 'reevaluate', jobUrls: string[] = []) {
  return post<{ run_id: string; status: string }>('/runs', { mode, job_urls: jobUrls });
}

export function cancelRun(runId: string) {
  return post<{ run_id: string; status: string }>(`/runs/${runId}/cancel`, {});
}

export function validateSetup(): Promise<ValidateResult> {
  return post<ValidateResult>('/maintenance/validate', {});
}

export function reassignByRules(): Promise<{
  assigned: number;
  reserved: number;
  skipped: number;
}> {
  return post('/maintenance/reassign', {});
}

export function skipNoVisa(): Promise<{ updated: number }> {
  return post('/maintenance/skip-no-visa', {});
}

export function pruneOldData(payload: {
  days: number;
  posted_at: boolean;
  listed_at: boolean;
  imported_at: boolean;
}): Promise<{ pruned_jobs: number; dropped_descriptions: number; days: number }> {
  return post('/maintenance/prune', payload);
}
