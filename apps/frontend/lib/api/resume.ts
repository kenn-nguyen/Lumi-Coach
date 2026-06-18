import { ImprovedResult } from '@/components/common/resume_previewer_context';
import type { ResumeData } from '@/components/dashboard/resume-component';
import {
  type FitOnePageMode,
  type ResumeTemplateSettings,
  type TemplateSettings,
} from '@/lib/types/template-settings';
import { type Locale } from '@/i18n/config';
import {
  API_BASE,
  apiDelete,
  apiFetch,
  apiPatch,
  apiPost,
  isApiRequestTimeoutError,
  readApiErrorMessage,
} from './client';

// Matches backend schemas/models.py ResumeData
interface ProcessedResume {
  personalInfo?: {
    name?: string;
    title?: string;
    customTagline?: string | null;
    email?: string;
    phone?: string;
    location?: string;
    website?: string | null;
    linkedin?: string | null;
    github?: string | null;
  };
  summary?: string;
  workExperience?: Array<{
    id: number;
    title?: string;
    company?: string;
    website?: string | null;
    location?: string | null;
    context?: string | null;
    years?: string;
    description?: string[];
  }>;
  education?: Array<{
    id: number;
    institution?: string;
    degree?: string;
    years?: string;
    description?: string | null;
  }>;
  personalProjects?: Array<{
    id: number;
    name?: string;
    role?: string;
    years?: string;
    github?: string | null;
    website?: string | null;
    description?: string[];
  }>;
  additional?: {
    technicalSkills?: string[];
    languages?: string[];
    certificationsTraining?: string[];
    awards?: string[];
  };
}

export interface ResumePdfRenderLayout {
  fitMode?: FitOnePageMode;
  fitOnePageVerticalScale?: number;
}

interface ResumePdfWarmResponse {
  request_id: string;
  status: 'ready' | 'warming';
}

export interface GenerationFeedback {
  summary?: string;
  pros?: string[];
  cons?: string[];
  caveats?: string[];
  prompt_setup?: {
    prompt_profile_id?: string | null;
    prompt1_version_id?: string | null;
    prompt2_version_id?: string | null;
    prompt3_version_id?: string | null;
    system_prompt_version_id?: string | null;
  } | null;
}

export interface GenerationArtifacts {
  prompt1?: Record<string, unknown> | null;
  prompt2?: Record<string, unknown> | null;
}

export interface ResumeImportContext {
  mode: 'json_child_import' | 'imported_tailored_json';
  jd_url?: string | null;
  jd_text?: string | null;
}

interface ResumeResponse {
  request_id: string;
  data: {
    resume_id: string;
    filename?: string | null;
    raw_resume: {
      id: number | null;
      content: string;
      content_type: string;
      created_at: string;
      processing_status: 'pending' | 'processing' | 'ready' | 'failed';
    };
    processed_resume: ProcessedResume | null;
    generation_feedback?: GenerationFeedback | null;
    generation_artifacts?: GenerationArtifacts | null;
    cover_letter?: string | null;
    outreach_message?: string | null;
    parent_id?: string | null; // For determining if resume is tailored
    linked_master_resume_id?: string | null;
    import_context?: ResumeImportContext | null;
    title?: string | null;
    template_settings?: ResumeTemplateSettings | null;
  };
}

/** Response from resume upload endpoint */
export interface ResumeUploadResponse {
  message: string;
  request_id: string;
  resume_id: string;
  processing_status: 'pending' | 'processing' | 'ready' | 'failed';
  is_master: boolean;
}

interface ImproveResumeConfirmRequest {
  resume_id: string;
  job_id: string;
  improved_data: ResumeData;
  improvements: Array<{
    suggestion: string;
    lineNumber?: number | null;
  }>;
}

function normalizeResumeId(resumeId: string): string {
  const normalized = resumeId.trim();
  if (!normalized) {
    throw new Error('Resume ID is required.');
  }
  return normalized;
}

export interface ResumeListItem {
  resume_id: string;
  filename: string | null;
  is_master: boolean;
  parent_id: string | null;
  processing_status: 'pending' | 'processing' | 'ready' | 'failed';
  created_at: string;
  updated_at: string;
  title?: string | null;
  job_source_url?: string | null;
  // Optional lightweight snippet of associated job description (populated client-side)
  jobSnippet?: string;
}

async function postImprove(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<ImprovedResult> {
  let response: Response;
  try {
    response = await apiPost(endpoint, payload, 240_000);
  } catch (networkError) {
    console.error(`Network error during ${endpoint}:`, networkError);
    throw networkError;
  }

  const text = await response.text();
  if (!response.ok) {
    console.error('Improve failed response body:', text);
    let message = text || `Improve failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { detail?: string | { message?: string } };
      if (typeof parsed.detail === 'string') {
        message = parsed.detail;
      } else if (parsed.detail?.message) {
        message = parsed.detail.message;
      }
    } catch {
      // Keep the raw text when the backend did not return JSON.
    }
    throw new Error(message);
  }

  try {
    return JSON.parse(text) as ImprovedResult;
  } catch (parseError) {
    console.error('Failed to parse improve response:', parseError, 'Raw response:', text);
    throw parseError;
  }
}

/** Uploads job descriptions and returns a job_id */
export async function uploadJobDescriptions(
  descriptions: string[],
  resumeId: string
): Promise<string> {
  const res = await apiPost('/jobs/upload', {
    job_descriptions: descriptions,
    resume_id: resumeId,
  });
  if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
  const data = await res.json();
  return data.job_id[0];
}

/** Improves the resume and returns the full preview object */
export async function improveResume(
  resumeId: string,
  jobId: string,
  promptId?: string
): Promise<ImprovedResult> {
  return postImprove('/resumes/improve', {
    resume_id: resumeId,
    job_id: jobId,
    prompt_id: promptId ?? null,
  });
}

/** Previews the resume improvement without saving */
export async function previewImproveResume(
  resumeId: string,
  jobId: string,
  promptId?: string
): Promise<ImprovedResult> {
  return postImprove('/resumes/improve/preview', {
    resume_id: resumeId,
    job_id: jobId,
    prompt_id: promptId ?? null,
  });
}

/** Confirms and saves a tailored resume */
export async function confirmImproveResume(
  payload: ImproveResumeConfirmRequest
): Promise<ImprovedResult> {
  return postImprove('/resumes/improve/confirm', payload as unknown as Record<string, unknown>);
}

/** Fetches a raw resume record for previewing the original upload */
export async function fetchResume(resumeId: string): Promise<ResumeResponse['data']> {
  const res = await apiFetch(`/resumes?resume_id=${encodeURIComponent(resumeId)}`);
  if (!res.ok) {
    throw new Error(`Failed to load resume (status ${res.status}).`);
  }
  const payload = (await res.json()) as ResumeResponse;
  // Support both raw_resume content (initial) and processed_resume (if available)
  // The viewer/builder logic should prioritize processed data if present
  return payload.data;
}

export async function fetchResumeList(
  includeMaster = false,
  limit?: number,
  search?: string
): Promise<ResumeListItem[]> {
  const params = new URLSearchParams({
    include_master: includeMaster ? 'true' : 'false',
  });
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(limit));
  }
  if (typeof search === 'string' && search.trim()) {
    params.set('search', search.trim());
  }
  const res = await apiFetch(`/resumes/list?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load resumes list (status ${res.status}).`);
  }
  const payload = (await res.json()) as { data: ResumeListItem[] };
  return payload.data;
}

export async function importTailoredResumeJson(
  file: File,
  jdUrl?: string,
  jdText?: string
): Promise<ResumeUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (typeof jdUrl === 'string' && jdUrl.trim()) {
    formData.append('jd_url', jdUrl.trim());
  }
  if (typeof jdText === 'string' && jdText.trim()) {
    formData.append('jd_text', jdText.trim());
  }

  const res = await apiFetch('/resumes/import-tailored-json', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(
      await readApiErrorMessage(res, `Failed to import resume JSON (status ${res.status}).`)
    );
  }

  return (await res.json()) as ResumeUploadResponse;
}

export async function importMasterResume(file: File): Promise<ResumeUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiFetch('/resumes/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(
      await readApiErrorMessage(res, `Failed to import master resume (status ${res.status}).`)
    );
  }

  return (await res.json()) as ResumeUploadResponse;
}

export async function updateResume(
  resumeId: string,
  resumeData: ProcessedResume,
  generationFeedback?: GenerationFeedback | null,
  generationArtifacts?: GenerationArtifacts | null
): Promise<ResumeResponse['data']> {
  const body =
    generationFeedback === undefined && generationArtifacts === undefined
      ? resumeData
      : {
          resume_data: resumeData,
          generation_feedback: generationFeedback,
          generation_artifacts: generationArtifacts,
        };
  const res = await apiPatch(`/resumes/${encodeURIComponent(resumeId)}`, body);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to update resume (status ${res.status}): ${text}`);
  }
  const payload = (await res.json()) as ResumeResponse;
  return payload.data;
}

export async function updateResumeTemplateSettings(
  resumeId: string,
  settings: ResumeTemplateSettings
): Promise<ResumeTemplateSettings> {
  const normalizedId = normalizeResumeId(resumeId);
  const res = await apiPatch(
    `/resumes/${encodeURIComponent(normalizedId)}/template-settings`,
    settings
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to update resume settings (status ${res.status}): ${text}`);
  }
  const payload = (await res.json()) as {
    data: ResumeTemplateSettings;
  };
  return payload.data;
}

export function getResumePdfUrl(
  resumeId: string,
  settings?: TemplateSettings,
  locale?: Locale,
  filename?: string,
  renderLayout?: ResumePdfRenderLayout
): string {
  const normalizedId = normalizeResumeId(resumeId);
  const params = new URLSearchParams();

  if (settings) {
    params.set('template', settings.template);
    params.set('pageSize', settings.pageSize);
    params.set('marginTop', String(settings.margins.top));
    params.set('marginBottom', String(settings.margins.bottom));
    params.set('marginLeft', String(settings.margins.left));
    params.set('marginRight', String(settings.margins.right));
    params.set('sectionSpacing', String(settings.spacing.section));
    params.set('itemSpacing', String(settings.spacing.item));
    params.set('lineHeight', String(settings.spacing.lineHeight));
    params.set('fontSize', String(settings.fontSize.base));
    params.set('headerScale', String(settings.fontSize.headerScale));
    params.set('headerFont', settings.fontSize.headerFont);
    params.set('bodyFont', settings.fontSize.bodyFont);
    params.set('compactMode', String(settings.compactMode));
    params.set('showContactIcons', String(settings.showContactIcons));
    params.set('accentColor', settings.accentColor);
    params.set('dateDisplay', settings.dateDisplay);
    params.set('experienceHeaderOrder', settings.experienceHeaderOrder);
    params.set('fitOnePage', String(settings.fitOnePage));
  } else {
    params.set('template', 'swiss-single');
    params.set('pageSize', 'A4');
  }
  if (renderLayout?.fitMode) {
    params.set('fitMode', renderLayout.fitMode);
  }
  if (
    typeof renderLayout?.fitOnePageVerticalScale === 'number' &&
    Number.isFinite(renderLayout.fitOnePageVerticalScale)
  ) {
    params.set('fitOnePageVerticalScale', String(renderLayout.fitOnePageVerticalScale));
  }
  if (locale) {
    params.set('lang', locale);
  }
  if (filename?.trim()) {
    params.set('filename', filename.trim());
  }

  return `${API_BASE}/resumes/${encodeURIComponent(normalizedId)}/pdf?${params.toString()}`;
}

export async function downloadResumePdf(
  resumeId: string,
  settings?: TemplateSettings,
  locale?: Locale,
  filename?: string,
  renderLayout?: ResumePdfRenderLayout
): Promise<Blob> {
  const url = getResumePdfUrl(resumeId, settings, locale, filename, renderLayout);
  let res: Response;
  try {
    res = await apiFetch(url);
  } catch (error) {
    if (isApiRequestTimeoutError(error)) {
      throw new Error(
        `Resume PDF generation timed out after ${Math.round(error.timeoutMs / 1000)} seconds. Please try again.`
      );
    }
    throw error;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to download resume (status ${res.status}): ${text}`);
  }
  return await res.blob();
}

export async function warmResumePdf(
  resumeId: string,
  settings?: TemplateSettings,
  locale?: Locale,
  renderLayout?: ResumePdfRenderLayout
): Promise<ResumePdfWarmResponse> {
  const normalizedId = normalizeResumeId(resumeId);
  const res = await apiPost(
    `/resumes/${encodeURIComponent(normalizedId)}/pdf/warm`,
    {
      template_settings: settings,
      render_layout: renderLayout,
      lang: locale,
    },
    30_000
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to warm resume PDF (status ${res.status}): ${text}`);
  }
  return res.json();
}

/** Deletes a resume by ID */
export async function deleteResume(resumeId: string): Promise<void> {
  const res = await apiDelete(`/resumes/${encodeURIComponent(resumeId)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to delete resume (status ${res.status}): ${text}`);
  }
}

/** Updates the cover letter for a resume */
export async function updateCoverLetter(resumeId: string, content: string): Promise<void> {
  const res = await apiPatch(`/resumes/${encodeURIComponent(resumeId)}/cover-letter`, { content });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to update cover letter (status ${res.status}): ${text}`);
  }
}

/** Updates the outreach message for a resume */
export async function updateOutreachMessage(resumeId: string, content: string): Promise<void> {
  const res = await apiPatch(`/resumes/${encodeURIComponent(resumeId)}/outreach-message`, {
    content,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to update outreach message (status ${res.status}): ${text}`);
  }
}

/** Renames a resume by updating its title */
export async function renameResume(resumeId: string, title: string): Promise<void> {
  const res = await apiPatch(`/resumes/${encodeURIComponent(resumeId)}/title`, { title });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to rename resume (status ${res.status}): ${text}`);
  }
}

/** Downloads cover letter as PDF */
export function getCoverLetterPdfUrl(
  resumeId: string,
  pageSize: 'A4' | 'LETTER' = 'A4',
  locale?: Locale,
  filename?: string
): string {
  const normalizedId = normalizeResumeId(resumeId);
  const params = new URLSearchParams({ pageSize });
  if (locale) {
    params.set('lang', locale);
  }
  if (filename?.trim()) {
    params.set('filename', filename.trim());
  }
  return `${API_BASE}/resumes/${encodeURIComponent(normalizedId)}/cover-letter/pdf?${params.toString()}`;
}

export async function downloadCoverLetterPdf(
  resumeId: string,
  pageSize: 'A4' | 'LETTER' = 'A4',
  locale?: Locale,
  filename?: string
): Promise<Blob> {
  const url = getCoverLetterPdfUrl(resumeId, pageSize, locale, filename);
  let res: Response;
  try {
    res = await apiFetch(url);
  } catch (error) {
    if (isApiRequestTimeoutError(error)) {
      throw new Error(
        `Cover letter PDF generation timed out after ${Math.round(error.timeoutMs / 1000)} seconds. Please try again.`
      );
    }
    throw error;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to download cover letter (status ${res.status}): ${text}`);
  }
  return await res.blob();
}

/** Generates a cover letter on-demand for a tailored resume */
export async function generateCoverLetter(resumeId: string): Promise<string> {
  const res = await apiPost(`/resumes/${encodeURIComponent(resumeId)}/generate-cover-letter`, {});
  if (!res.ok) {
    throw new Error(
      await readApiErrorMessage(res, `Failed to generate cover letter (status ${res.status}).`)
    );
  }
  const data = await res.json();
  return data.content;
}

/** Generates an outreach message on-demand for a tailored resume */
export async function generateOutreachMessage(resumeId: string): Promise<string> {
  const res = await apiPost(`/resumes/${encodeURIComponent(resumeId)}/generate-outreach`, {});
  if (!res.ok) {
    throw new Error(
      await readApiErrorMessage(res, `Failed to generate outreach message (status ${res.status}).`)
    );
  }
  const data = await res.json();
  return data.content;
}

/** Retries AI processing for a failed resume */
export async function retryProcessing(resumeId: string): Promise<ResumeUploadResponse> {
  const res = await apiPost(`/resumes/${encodeURIComponent(resumeId)}/retry-processing`, {});
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to retry processing (status ${res.status}): ${text}`);
  }
  return res.json();
}

/** Fetches the job description used to tailor a resume */
export async function fetchJobDescription(
  resumeId: string
): Promise<{ job_id: string; content: string }> {
  const res = await apiFetch(`/resumes/${encodeURIComponent(resumeId)}/job-description`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch job description (status ${res.status}): ${text}`);
  }
  return res.json();
}

export async function updateJobDescription(
  resumeId: string,
  content: string
): Promise<{ job_id: string; content: string; message: string }> {
  const res = await apiPatch(`/resumes/${encodeURIComponent(resumeId)}/job-description`, {
    content,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to update job description (status ${res.status}): ${text}`);
  }
  return res.json();
}

export interface RewriteBulletRequest {
  current_bullet: string;
  original_bullet?: string | null;
  role_context: {
    title?: string;
    company?: string;
    years?: string;
  };
  job_description?: string | null;
  user_instruction?: string | null;
}

export async function rewriteExperienceBullet(
  resumeId: string,
  payload: RewriteBulletRequest
): Promise<{ rewritten_bullet: string; message: string }> {
  const res = await apiPost(`/resumes/${encodeURIComponent(resumeId)}/rewrite-bullet`, payload);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to rewrite bullet (status ${res.status}): ${text}`);
  }
  return res.json();
}

export interface RewriteSummaryRequest {
  current_summary: string;
  original_summary?: string | null;
  job_description?: string | null;
  user_instruction?: string | null;
}

export async function rewriteSummary(
  resumeId: string,
  payload: RewriteSummaryRequest
): Promise<{ rewritten_summary: string; message: string }> {
  const res = await apiPost(`/resumes/${encodeURIComponent(resumeId)}/rewrite-summary`, payload);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to rewrite summary (status ${res.status}): ${text}`);
  }
  return res.json();
}
