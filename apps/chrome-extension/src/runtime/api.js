import { DEFAULT_API_ORIGIN, DEFAULT_APP_ORIGIN } from './constants.js';
import { logError, logInfo } from './log.js';
import { getUserAssets } from './storage.js';

function normalizeOrigin(value, fallback) {
  const normalized = (value || fallback).trim().replace(/\/+$/, '');
  return normalized || fallback;
}

function toApiBase(apiOrigin) {
  const normalized = normalizeOrigin(apiOrigin, DEFAULT_API_ORIGIN);
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

async function getRuntimeEndpoints() {
  const { appOrigin, apiOrigin } = await getUserAssets();
  const resolvedAppOrigin = normalizeOrigin(appOrigin, DEFAULT_APP_ORIGIN);
  const resolvedApiOrigin = normalizeOrigin(apiOrigin, DEFAULT_API_ORIGIN);
  return {
    appOrigin: resolvedAppOrigin,
    apiOrigin: resolvedApiOrigin,
    apiBase: toApiBase(resolvedApiOrigin),
  };
}

function toAbsoluteUrl(url, appOrigin) {
  return url.startsWith('http://') || url.startsWith('https://') ? url : `${appOrigin}${url}`;
}

export async function listResumes(includeMaster = false) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes/list${includeMaster ? '?include_master=true' : ''}`;
  logInfo('ResumeApi', 'Listing resumes.', { endpoint, includeMaster });
  let response;
  try {
    response = await fetch(endpoint);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ResumeApi', 'List resumes request failed before response.', { endpoint, error: message });
    throw new Error(`List resumes request failed before response at ${endpoint}: ${message}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logError('ResumeApi', 'List resumes request returned a non-OK status.', {
      endpoint,
      status: response.status,
      body: text,
    });
    throw new Error(`Failed to list resumes (status ${response.status}): ${text}`);
  }
  const payload = await response.json();
  logInfo('ResumeApi', 'List resumes succeeded.', { count: payload?.data?.length ?? 0, includeMaster });
  return payload;
}

export async function cloneResume(resumeId) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes/${encodeURIComponent(resumeId)}/clone`;
  logInfo('ResumeApi', 'Cloning resume.', { resumeId, endpoint });
  let response;
  try {
    response = await fetch(endpoint, { method: 'POST' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ResumeApi', 'Clone request failed before response.', { resumeId, endpoint, error: message });
    throw new Error(`Clone request failed before response at ${endpoint}: ${message}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logError('ResumeApi', 'Clone request returned a non-OK status.', {
      resumeId,
      endpoint,
      status: response.status,
      body: text,
    });
    throw new Error(`Failed to clone resume ${resumeId} (status ${response.status}): ${text}`);
  }
  const payload = await response.json();
  logInfo('ResumeApi', 'Clone resume succeeded.', {
    sourceResumeId: resumeId,
    clonedResumeId: payload?.data?.resume_id ?? null,
  });
  return payload;
}

export async function fetchResumeById(resumeId) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes?resume_id=${encodeURIComponent(resumeId)}`;
  logInfo('ResumeApi', 'Fetching resume by id.', { resumeId, endpoint });
  let response;
  try {
    response = await fetch(endpoint);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ResumeApi', 'Fetch resume request failed before response.', {
      resumeId,
      endpoint,
      error: message,
    });
    throw new Error(`Fetch resume request failed before response at ${endpoint}: ${message}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logError('ResumeApi', 'Fetch resume request returned a non-OK status.', {
      resumeId,
      status: response.status,
      body: text,
    });
    throw new Error(`Failed to fetch resume ${resumeId} (status ${response.status}): ${text}`);
  }
  const payload = await response.json();
  logInfo('ResumeApi', 'Fetch resume succeeded.', { resumeId });
  return payload;
}

export async function patchResume(resumeId, resumeData, generationFeedback = null) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes/${encodeURIComponent(resumeId)}`;
  const requestPayload = {
    resume_data: resumeData,
    generation_feedback: generationFeedback,
  };
  logInfo('ResumeApi', 'Patching resume.', {
    resumeId,
    endpoint,
    hasGenerationFeedback: Boolean(generationFeedback),
  });
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ResumeApi', 'Patch request failed before response.', {
      resumeId,
      endpoint,
      error: message,
    });
    throw new Error(`Patch request failed before response at ${endpoint}: ${message}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logError('ResumeApi', 'Patch request returned a non-OK status.', {
      resumeId,
      status: response.status,
      body: text,
    });
    throw new Error(`Failed to patch resume ${resumeId} (status ${response.status}): ${text}`);
  }
  const payload = await response.json();
  logInfo('ResumeApi', 'Patch resume succeeded.', { resumeId });
  return payload;
}

export async function renameResume(resumeId, title) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes/${encodeURIComponent(resumeId)}/title`;
  logInfo('ResumeApi', 'Renaming resume.', { resumeId, endpoint, title });
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ResumeApi', 'Rename request failed before response.', {
      resumeId,
      endpoint,
      error: message,
    });
    throw new Error(`Rename request failed before response at ${endpoint}: ${message}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logError('ResumeApi', 'Rename request returned a non-OK status.', {
      resumeId,
      status: response.status,
      body: text,
    });
    throw new Error(`Failed to rename resume ${resumeId} (status ${response.status}): ${text}`);
  }
  const payload = await response.json().catch(() => null);
  logInfo('ResumeApi', 'Rename resume succeeded.', { resumeId, title });
  return payload;
}

export async function buildPreviewUrl(resumeId) {
  const { appOrigin } = await getRuntimeEndpoints();
  return `${appOrigin}/resumes/${encodeURIComponent(resumeId)}`;
}

export async function openPreviewTab(previewUrl) {
  if (!previewUrl) {
    throw new Error('Preview URL is required.');
  }
  const { appOrigin } = await getRuntimeEndpoints();
  await chrome.tabs.create({ url: toAbsoluteUrl(previewUrl, appOrigin) });
}
