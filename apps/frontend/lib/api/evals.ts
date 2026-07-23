/**
 * Evals API client — supports both admin (/admin/evals) and user-scoped (/evals) endpoints.
 */
import { apiFetch, readApiErrorMessage } from './client';

export interface EvalRunSummary {
  passed: boolean;
  scores: Record<string, unknown>;
  error: string | null;
  created_at: string;
}

export interface EvalCase {
  id: string;
  created_at: string;
  tags: string[];
  notes: string | null;
  prompt_profile_id: string;
  jd_source: string;
  jd_url: string | null;
  jd_text: string;
  source_resume_id: string;
  tailored_resume_id: string;
  tailor_job_id: string;
  latest_runs: Record<string, EvalRunSummary>;
}

export interface EvalCaseListResponse {
  items: EvalCase[];
  total: number;
}

export interface EvalRunResult {
  id: string;
  case_id: string;
  created_at: string;
  step: string;
  passed: boolean;
  scores: Record<string, unknown>;
  error: string | null;
}

export interface RunEvalStepResponse {
  results: EvalRunResult[];
}

function evalsBase(userScoped?: boolean): string {
  return userScoped ? '/evals' : '/admin/evals';
}

export async function fetchEvalCases(params?: {
  profile?: string;
  tag?: string;
  userScoped?: boolean;
}): Promise<EvalCaseListResponse> {
  const qs = new URLSearchParams();
  if (params?.profile) qs.set('profile', params.profile);
  if (params?.tag) qs.set('tag', params.tag);
  const query = qs.toString() ? `?${qs}` : '';
  const res = await apiFetch(`${evalsBase(params?.userScoped)}/cases${query}`);
  if (!res.ok) {
    const msg = await readApiErrorMessage(res, 'Failed to fetch eval cases');
    throw new Error(msg);
  }
  return res.json() as Promise<EvalCaseListResponse>;
}

export async function createEvalCase(
  payload: {
    tailored_resume_id: string;
    tags: string[];
    notes: string | null;
  },
  opts?: { userScoped?: boolean }
): Promise<EvalCase> {
  const res = await apiFetch(`${evalsBase(opts?.userScoped)}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await readApiErrorMessage(res, 'Failed to create eval case');
    throw new Error(msg);
  }
  return res.json() as Promise<EvalCase>;
}

export async function deleteEvalCase(
  caseId: string,
  opts?: { userScoped?: boolean }
): Promise<void> {
  const res = await apiFetch(`${evalsBase(opts?.userScoped)}/cases/${caseId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) {
    const msg = await readApiErrorMessage(res, 'Failed to delete eval case');
    throw new Error(msg);
  }
}

export async function runEvalStep(payload: {
  case_ids: string[];
  step: 'structural' | 'heuristics' | 'judge';
  userScoped?: boolean;
}): Promise<RunEvalStepResponse> {
  const { userScoped, ...body } = payload;
  const res = await apiFetch(`${evalsBase(userScoped)}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await readApiErrorMessage(res, 'Failed to run eval step');
    throw new Error(msg);
  }
  return res.json() as Promise<RunEvalStepResponse>;
}

export async function downloadEvalExport(): Promise<void> {
  const res = await apiFetch('/admin/evals/export');
  if (!res.ok) {
    const msg = await readApiErrorMessage(res, 'Failed to export eval cases');
    throw new Error(msg);
  }
  const blob = await res.blob();
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eval-set-${date}.jsonl`;
  a.click();
  URL.revokeObjectURL(url);
}
