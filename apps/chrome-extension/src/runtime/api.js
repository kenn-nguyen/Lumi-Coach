import { DEFAULT_API_ORIGIN, DEFAULT_APP_ORIGIN } from "./constants.js";
import { logError, logInfo, logWarn } from "./log.js";
import {
  clearExtensionAuth,
  getExtensionAuth,
  getUserAssets,
} from "./storage.js";

function normalizeOrigin(value, fallback) {
  const normalized = (value || fallback).trim().replace(/\/+$/, "");
  return normalized || fallback;
}

function toApiBase(apiOrigin) {
  const normalized = normalizeOrigin(apiOrigin, DEFAULT_API_ORIGIN);
  return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
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
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `${appOrigin}${url}`;
}

export async function verifyWebsiteSession() {
  const { appOrigin } = await getRuntimeEndpoints();
  const endpoint = `${appOrigin}/api/auth/session-status`;
  logInfo("ExtensionAuth", "Checking website session status.", { endpoint });

  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("ExtensionAuth", "Website session check failed before response.", {
      endpoint,
      error: message,
    });
    throw new Error(
      `Website session check failed before response at ${endpoint}: ${message}`,
    );
  }

  if (response.status === 401) {
    await clearExtensionAuth();
    logWarn("ExtensionAuth", "Website session is not authenticated.", {
      endpoint,
    });
    return {
      authenticated: false,
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError(
      "ExtensionAuth",
      "Website session check returned a non-OK status.",
      {
        endpoint,
        status: response.status,
        body: text,
      },
    );
    throw new Error(
      `Failed to verify website session (status ${response.status}): ${text}`,
    );
  }

  const payload = await response.json().catch(() => ({ authenticated: true }));
  return {
    authenticated: payload?.authenticated !== false,
    user: payload?.user ?? null,
  };
}

export async function fetchExtensionAccessToken() {
  const { appOrigin } = await getRuntimeEndpoints();
  const endpoint = `${appOrigin}/api/auth/extension-token`;
  logInfo(
    "ExtensionAuth",
    "Requesting extension access token from website session.",
    { endpoint },
  );

  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(
      "ExtensionAuth",
      "Extension token request failed before response.",
      {
        endpoint,
        error: message,
      },
    );
    throw new Error(
      `Extension token request failed before response at ${endpoint}: ${message}`,
    );
  }

  if (response.status === 401) {
    await clearExtensionAuth();
    logWarn(
      "ExtensionAuth",
      "Website refused extension token request because the session is unauthenticated.",
      {
        endpoint,
      },
    );
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError(
      "ExtensionAuth",
      "Extension token request returned a non-OK status.",
      {
        endpoint,
        status: response.status,
        body: text,
      },
    );
    throw new Error(
      `Failed to fetch extension token (status ${response.status}): ${text}`,
    );
  }

  return response.json();
}

async function fetchWithAuth(endpoint, options = {}) {
  const auth = await getExtensionAuth();
  if (!auth?.token || !auth?.expiresAt) {
    throw new Error("Connect the Lumi Coach extension before continuing.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(auth.expiresAt) - 30 <= now) {
    await clearExtensionAuth();
    throw new Error(
      "Extension session expired. Reconnect Lumi Coach and try again.",
    );
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${auth.token}`);

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await clearExtensionAuth();
    throw new Error(
      "Extension session expired. Reconnect Lumi Coach and try again.",
    );
  }

  return response;
}

export async function listResumes(includeMaster = false) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes/list${includeMaster ? "?include_master=true" : ""}`;
  logInfo("ResumeApi", "Listing resumes.", { endpoint, includeMaster });
  let response;
  try {
    response = await fetchWithAuth(endpoint);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("ResumeApi", "List resumes request failed before response.", {
      endpoint,
      error: message,
    });
    throw new Error(
      `List resumes request failed before response at ${endpoint}: ${message}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError("ResumeApi", "List resumes request returned a non-OK status.", {
      endpoint,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Failed to list resumes (status ${response.status}): ${text}`,
    );
  }
  const payload = await response.json();
  logInfo("ResumeApi", "List resumes succeeded.", {
    count: payload?.data?.length ?? 0,
    includeMaster,
  });
  return payload;
}

export async function cloneResume(resumeId) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes/${encodeURIComponent(resumeId)}/clone`;
  logInfo("ResumeApi", "Cloning resume.", { resumeId, endpoint });
  let response;
  try {
    response = await fetchWithAuth(endpoint, { method: "POST" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("ResumeApi", "Clone request failed before response.", {
      resumeId,
      endpoint,
      error: message,
    });
    throw new Error(
      `Clone request failed before response at ${endpoint}: ${message}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError("ResumeApi", "Clone request returned a non-OK status.", {
      resumeId,
      endpoint,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Failed to clone resume ${resumeId} (status ${response.status}): ${text}`,
    );
  }
  const payload = await response.json();
  logInfo("ResumeApi", "Clone resume succeeded.", {
    sourceResumeId: resumeId,
    clonedResumeId: payload?.data?.resume_id ?? null,
  });
  return payload;
}

export async function fetchResumeById(resumeId) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes?resume_id=${encodeURIComponent(resumeId)}`;
  logInfo("ResumeApi", "Fetching resume by id.", { resumeId, endpoint });
  let response;
  try {
    response = await fetchWithAuth(endpoint);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("ResumeApi", "Fetch resume request failed before response.", {
      resumeId,
      endpoint,
      error: message,
    });
    throw new Error(
      `Fetch resume request failed before response at ${endpoint}: ${message}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError("ResumeApi", "Fetch resume request returned a non-OK status.", {
      resumeId,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Failed to fetch resume ${resumeId} (status ${response.status}): ${text}`,
    );
  }
  const payload = await response.json();
  logInfo("ResumeApi", "Fetch resume succeeded.", { resumeId });
  return payload;
}

export async function uploadJobDescription(jobDescription, resumeId) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/jobs/upload`;
  logInfo("ResumeApi", "Uploading job description.", {
    endpoint,
    resumeId,
    contentLength: jobDescription?.length ?? 0,
  });
  let response;
  try {
    response = await fetchWithAuth(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_descriptions: [jobDescription],
        resume_id: resumeId,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("ResumeApi", "Job upload request failed before response.", {
      endpoint,
      resumeId,
      error: message,
    });
    throw new Error(
      `Job upload request failed before response at ${endpoint}: ${message}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError("ResumeApi", "Job upload returned a non-OK status.", {
      endpoint,
      resumeId,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Failed to upload job description (status ${response.status}): ${text}`,
    );
  }
  const payload = await response.json();
  const jobId = payload?.job_id?.[0] ?? null;
  if (!jobId) {
    throw new Error("Job upload response did not include a job id.");
  }
  logInfo("ResumeApi", "Job upload succeeded.", { resumeId, jobId });
  return payload;
}

export function normalizeBackendApifyFallbackPayload(
  payload,
  fallbackSourceUrl = "",
) {
  const rawText =
    typeof payload?.raw_text === "string" ? payload.raw_text.trim() : "";
  if (!rawText) {
    throw new Error(
      "Backend Apify fallback response did not include a readable job description.",
    );
  }

  return {
    source:
      typeof payload?.source === "string" && payload.source.trim()
        ? payload.source.trim()
        : "apify_backend",
    sourceUrl:
      typeof payload?.source_url === "string" && payload.source_url.trim()
        ? payload.source_url.trim()
        : fallbackSourceUrl,
    title: typeof payload?.title === "string" ? payload.title.trim() : "",
    company:
      typeof payload?.company === "string" ? payload.company.trim() : "",
    location:
      typeof payload?.location === "string" ? payload.location.trim() : "",
    datePosted:
      typeof payload?.date_posted === "string" && payload.date_posted.trim()
        ? payload.date_posted.trim()
        : null,
    extractedAt: new Date().toISOString(),
    rawText,
    diagnostics: {
      ...(payload?.diagnostics || {}),
      source:
        typeof payload?.source === "string" && payload.source.trim()
          ? payload.source.trim()
          : "apify_backend",
      rawTextLength: rawText.length,
    },
  };
}

export async function fetchBackendApifyLinkedInFallback(sourceUrl) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/jobs/linkedin-apify-fallback`;
  logInfo("ResumeApi", "Requesting backend Apify LinkedIn fallback.", {
    endpoint,
    sourceUrl,
  });
  let response;
  try {
    response = await fetchWithAuth(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_url: sourceUrl }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(
      "ResumeApi",
      "Backend Apify fallback request failed before response.",
      {
        endpoint,
        sourceUrl,
        error: message,
      },
    );
    throw new Error(
      `Backend Apify fallback request failed before response at ${endpoint}: ${message}`,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError("ResumeApi", "Backend Apify fallback returned a non-OK status.", {
      endpoint,
      sourceUrl,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Backend Apify fallback failed (status ${response.status}): ${text}`,
    );
  }

  const payload = await response.json();
  const normalized = normalizeBackendApifyFallbackPayload(payload, sourceUrl);
  logInfo("ResumeApi", "Backend Apify fallback succeeded.", {
    sourceUrl,
    rawTextLength: normalized.rawText.length,
    responseSource: normalized.source,
  });
  return normalized;
}

export async function linkResumeToJobContext(
  originalResumeId,
  tailoredResumeId,
  jobId,
) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes/link-job-context`;
  logInfo("ResumeApi", "Linking tailored resume to job context.", {
    endpoint,
    originalResumeId,
    tailoredResumeId,
    jobId,
  });
  let response;
  try {
    response = await fetchWithAuth(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        original_resume_id: originalResumeId,
        tailored_resume_id: tailoredResumeId,
        job_id: jobId,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("ResumeApi", "Job-context link request failed before response.", {
      endpoint,
      originalResumeId,
      tailoredResumeId,
      jobId,
      error: message,
    });
    throw new Error(
      `Job-context link request failed before response at ${endpoint}: ${message}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError("ResumeApi", "Job-context link returned a non-OK status.", {
      endpoint,
      originalResumeId,
      tailoredResumeId,
      jobId,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Failed to link job context (status ${response.status}): ${text}`,
    );
  }
  const payload = await response.json();
  logInfo("ResumeApi", "Job-context link succeeded.", {
    tailoredResumeId,
    jobId,
    requestId: payload?.request_id ?? null,
  });
  return payload;
}

export async function enableContentGenerationFeatures() {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/config/features`;
  logInfo("ResumeApi", "Enabling content-generation features.", { endpoint });
  let response;
  try {
    response = await fetchWithAuth(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enable_cover_letter: true,
        enable_outreach_message: true,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn("ResumeApi", "Feature toggle request failed before response.", {
      endpoint,
      error: message,
    });
    throw new Error(
      `Feature toggle request failed before response at ${endpoint}: ${message}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logWarn("ResumeApi", "Feature toggle returned a non-OK status.", {
      endpoint,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Failed to enable content-generation features (status ${response.status}): ${text}`,
    );
  }
  const payload = await response.json();
  logInfo("ResumeApi", "Content-generation features enabled.", payload);
  return payload;
}

export async function fetchFeatureConfig() {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/config/features`;
  logInfo("ResumeApi", "Fetching feature configuration.", { endpoint });
  let response;
  try {
    response = await fetchWithAuth(endpoint);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn(
      "ResumeApi",
      "Feature configuration request failed before response.",
      {
        endpoint,
        error: message,
      },
    );
    throw new Error(
      `Feature configuration request failed before response at ${endpoint}: ${message}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logWarn("ResumeApi", "Feature configuration returned a non-OK status.", {
      endpoint,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Failed to fetch feature configuration (status ${response.status}): ${text}`,
    );
  }
  const payload = await response.json();
  logInfo("ResumeApi", "Feature configuration fetched.", payload);
  return payload;
}

export async function patchResume(
  resumeId,
  resumeData,
  generationFeedback = null,
  generationArtifacts = null,
) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes/${encodeURIComponent(resumeId)}`;
  const requestPayload = {
    resume_data: resumeData,
    generation_feedback: generationFeedback,
    generation_artifacts: generationArtifacts,
  };
  logInfo("ResumeApi", "Patching resume.", {
    resumeId,
    endpoint,
    hasGenerationFeedback: Boolean(generationFeedback),
    hasGenerationArtifacts: Boolean(generationArtifacts),
  });
  let response;
  try {
    response = await fetchWithAuth(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("ResumeApi", "Patch request failed before response.", {
      resumeId,
      endpoint,
      error: message,
    });
    throw new Error(
      `Patch request failed before response at ${endpoint}: ${message}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError("ResumeApi", "Patch request returned a non-OK status.", {
      resumeId,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Failed to patch resume ${resumeId} (status ${response.status}): ${text}`,
    );
  }
  const payload = await response.json();
  logInfo("ResumeApi", "Patch resume succeeded.", { resumeId });
  return payload;
}

export async function overwriteMasterResume(resumeData) {
  const resumeList = await listResumes(true);
  const masterResume = resumeList?.data?.find((resume) => resume?.is_master);
  if (!masterResume?.resume_id) {
    throw new Error("No master resume was found in Lumi Coach.");
  }

  const { apiBase } = await getRuntimeEndpoints();
  const resumeId = masterResume.resume_id;
  const endpoint = `${apiBase}/resumes/${encodeURIComponent(resumeId)}`;
  const requestPayload = { resume_data: resumeData };
  logInfo("ResumeApi", "Overwriting backend master resume.", {
    resumeId,
    endpoint,
  });

  let response;
  try {
    response = await fetchWithAuth(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("ResumeApi", "Master overwrite request failed before response.", {
      resumeId,
      endpoint,
      error: message,
    });
    throw new Error(
      `Master overwrite request failed before response at ${endpoint}: ${message}`,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError(
      "ResumeApi",
      "Master overwrite request returned a non-OK status.",
      {
        resumeId,
        status: response.status,
        body: text,
      },
    );
    throw new Error(
      `Failed to overwrite master resume (status ${response.status}): ${text}`,
    );
  }

  const payload = await response.json();
  logInfo("ResumeApi", "Backend master resume overwritten.", { resumeId });
  return payload;
}

export async function renameResume(resumeId, title) {
  const { apiBase } = await getRuntimeEndpoints();
  const endpoint = `${apiBase}/resumes/${encodeURIComponent(resumeId)}/title`;
  logInfo("ResumeApi", "Renaming resume.", { resumeId, endpoint, title });
  let response;
  try {
    response = await fetchWithAuth(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("ResumeApi", "Rename request failed before response.", {
      resumeId,
      endpoint,
      error: message,
    });
    throw new Error(
      `Rename request failed before response at ${endpoint}: ${message}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError("ResumeApi", "Rename request returned a non-OK status.", {
      resumeId,
      status: response.status,
      body: text,
    });
    throw new Error(
      `Failed to rename resume ${resumeId} (status ${response.status}): ${text}`,
    );
  }
  const payload = await response.json().catch(() => null);
  logInfo("ResumeApi", "Rename resume succeeded.", { resumeId, title });
  return payload;
}

export async function buildPreviewUrl(resumeId, options = {}) {
  const { appOrigin } = await getRuntimeEndpoints();
  const url = new URL(`/resumes/${encodeURIComponent(resumeId)}`, appOrigin);
  if (options.runId) {
    url.searchParams.set("runId", String(options.runId));
  }
  if (options.source) {
    url.searchParams.set("source", String(options.source));
  }
  return url.toString();
}

export async function openPreviewTab(previewUrl) {
  if (!previewUrl) {
    throw new Error("Preview URL is required.");
  }
  const { appOrigin } = await getRuntimeEndpoints();
  await chrome.tabs.create({ url: toAbsoluteUrl(previewUrl, appOrigin) });
}

export async function openWebsiteSignInTab(extensionId, sourceTabId = null) {
  const { appOrigin } = await getRuntimeEndpoints();
  const params = new URLSearchParams({
    extensionId,
  });
  if (sourceTabId != null) {
    params.set(
      "callbackUrl",
      `/dashboard?sourceTabId=${encodeURIComponent(String(sourceTabId))}`,
    );
  } else {
    params.set("callbackUrl", "/dashboard");
  }
  const url = `${appOrigin}/sign-in?${params.toString()}`;
  return chrome.tabs.create({ url, active: true });
}

export async function openWebsiteSignOutTab() {
  const { appOrigin } = await getRuntimeEndpoints();
  const url = `${appOrigin}/extension-sign-out?ts=${Date.now()}`;
  return chrome.tabs.create({ url, active: true });
}
