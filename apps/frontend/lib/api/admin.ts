import { apiFetch, readApiErrorMessage } from './client';

export interface ExtensionRunPromptSetup {
  prompt_profile_id?: string | null;
  prompt1_version_id?: string | null;
  prompt2_version_id?: string | null;
  prompt3_version_id?: string | null;
  system_prompt_version_id?: string | null;
}

export interface ExtensionRunAdminItem {
  user_id: string;
  user_email?: string | null;
  run_id: string;
  status: string;
  run_status?: string | null;
  title?: string | null;
  resume_title?: string | null;
  company?: string | null;
  location?: string | null;
  source_url?: string | null;
  job_source?: string | null;
  resume_id?: string | null;
  preview_url?: string | null;
  provider_id?: string | null;
  provider_label?: string | null;
  generated_at?: string | null;
  total_duration_ms?: number | null;
  summary?: Record<string, unknown>;
  prompt_setup?: ExtensionRunPromptSetup | null;
  prompt_artifacts?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ExtensionRunAdminListResponse {
  items: ExtensionRunAdminItem[];
  total: number;
}

export interface ExtensionRunAdminFilters {
  status?: string;
  prompt_profile_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      typeof value !== 'string' &&
      typeof value !== 'number'
    ) {
      return;
    }
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchAdminExtensionRuns(
  filters: ExtensionRunAdminFilters
): Promise<ExtensionRunAdminListResponse> {
  const response = await apiFetch(`/admin/extension-runs${buildQuery(filters)}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'Failed to load extension runs.'));
  }
  return response.json();
}

export async function fetchAdminExtensionRunItem(
  userId: string,
  runId: string
): Promise<ExtensionRunAdminItem> {
  const response = await apiFetch(
    `/admin/extension-runs/item${buildQuery({ user_id: userId, run_id: runId })}`,
    {
      credentials: 'include',
    }
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'Failed to load extension run.'));
  }
  return response.json();
}

export async function downloadAdminExtensionRunsExport(
  filters: ExtensionRunAdminFilters
): Promise<Blob> {
  const response = await apiFetch(`/admin/extension-runs/export${buildQuery(filters)}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'Failed to export extension runs.'));
  }
  return response.blob();
}
