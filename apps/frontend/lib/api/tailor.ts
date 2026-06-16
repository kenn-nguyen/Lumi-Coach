/**
 * Tailor pipeline API client.
 *
 * Three endpoints:
 *   POST /resumes/{id}/tailor        — start pipeline
 *   GET  /resumes/{id}/tailor/status — poll for progress
 *   POST /resumes/{id}/tailor/cancel — cancel
 */

import { apiFetch, readApiErrorMessage } from './client';

export type TailorStatus = 'running' | 'completed' | 'failed' | 'canceled';

export type PromptProfileId = 'profile1' | 'profile2' | 'profile3' | 'profile4';

export interface TailorStartResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface TailorStatusResponse {
  job_id: string;
  status: TailorStatus;
  progress_stage: string | null;
  prompt_profile_id: PromptProfileId;
  started_at: string;
  completed_at: string | null;
  tailored_resume_id: string | null;
  error_message: string | null;
}

export interface StartTailorRequest {
  prompt_profile_id: PromptProfileId;
  jd_url?: string | null;
  jd_text?: string | null;
}

export async function startTailor(
  resumeId: string,
  request: StartTailorRequest
): Promise<TailorStartResponse> {
  const resp = await apiFetch(`/api/v1/resumes/${resumeId}/tailor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!resp.ok) {
    const msg = await readApiErrorMessage(resp, 'Failed to start tailor job.');
    throw new Error(msg);
  }
  return resp.json() as Promise<TailorStartResponse>;
}

export async function getTailorStatus(resumeId: string): Promise<TailorStatusResponse> {
  const resp = await apiFetch(`/api/v1/resumes/${resumeId}/tailor/status`, {
    method: 'GET',
  });
  if (!resp.ok) {
    const msg = await readApiErrorMessage(resp, 'Failed to get tailor status.');
    throw new Error(msg);
  }
  return resp.json() as Promise<TailorStatusResponse>;
}

export async function cancelTailor(resumeId: string): Promise<void> {
  const resp = await apiFetch(`/api/v1/resumes/${resumeId}/tailor/cancel`, {
    method: 'POST',
  });
  if (!resp.ok) {
    const msg = await readApiErrorMessage(resp, 'Failed to cancel tailor job.');
    throw new Error(msg);
  }
}

/** Human-readable label for each pipeline progress stage. */
export function progressStageLabel(stage: string | null): string {
  switch (stage) {
    case 'apify':
      return 'Extracting job description…';
    case 'prompt1':
      return 'Analyzing job requirements…';
    case 'prompt2':
      return 'Building resume strategy…';
    case 'prompt3':
      return 'Writing tailored resume…';
    case 'postprocess':
      return 'Finalizing resume…';
    case 'starting':
      return 'Starting…';
    default:
      return 'Working…';
  }
}
