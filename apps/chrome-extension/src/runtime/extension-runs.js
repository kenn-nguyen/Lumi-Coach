import { saveExtensionRun } from "./api.js";
import { logWarn } from "./log.js";

const DEFAULT_SYNC_TIMEOUT_MS = 4000;
const TEXT_LIMITS = {
  company: 500,
  job_source: 64,
  location: 500,
  preview_url: 2000,
  provider_id: 128,
  provider_label: 256,
  resume_id: 128,
  run_id: 128,
  source_url: 2000,
  status: 64,
  title: 500,
};

function textOrNull(value, maxLength = 500) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength)
    : normalized;
}

function numberOrNull(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function dateStringOrNull(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function addSummaryField(summary, key, value) {
  if (value === null || value === undefined) return;
  summary[key] = value;
}

function cloneJsonValue(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return null;
  }
}

function hasArtifactValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function addArtifactField(target, key, value) {
  if (!hasArtifactValue(value)) return;
  target[key] = cloneJsonValue(value);
}

function buildPromptArtifacts(entry) {
  const artifacts = {};
  const prompt4 = {};
  const prompt1 = {};
  const prompt2 = {};
  const prompt3 = {};

  addArtifactField(artifacts, "metadata", entry?.promptMetadata);
  addArtifactField(prompt4, "input", entry?.prompt4Input);
  addArtifactField(prompt4, "raw", entry?.prompt4Raw);
  addArtifactField(prompt4, "result", entry?.prompt4Result);
  addArtifactField(prompt1, "input", entry?.prompt1Input);
  addArtifactField(prompt1, "raw", entry?.prompt1Raw);
  addArtifactField(prompt1, "result", entry?.prompt1Result);
  addArtifactField(prompt2, "input", entry?.prompt2Input);
  addArtifactField(prompt2, "raw", entry?.prompt2Raw);
  addArtifactField(prompt2, "result", entry?.prompt2Result);
  addArtifactField(prompt3, "input", entry?.prompt3Input);
  addArtifactField(prompt3, "raw", entry?.prompt3Raw);
  addArtifactField(prompt3, "parsed", entry?.prompt3Parsed);
  addArtifactField(prompt3, "feedback", entry?.prompt3Feedback);

  addArtifactField(artifacts, "prompt4", prompt4);
  addArtifactField(artifacts, "prompt1", prompt1);
  addArtifactField(artifacts, "prompt2", prompt2);
  addArtifactField(artifacts, "prompt3", prompt3);
  return artifacts;
}

function buildSafeSummary(entry) {
  const summary = {};
  addSummaryField(
    summary,
    "job_key",
    textOrNull(entry?.jobKey, TEXT_LIMITS.source_url),
  );
  addSummaryField(
    summary,
    "date_posted",
    textOrNull(entry?.datePosted, 128),
  );
  addSummaryField(
    summary,
    "job_readiness",
    textOrNull(entry?.jobReadiness, 64),
  );
  addSummaryField(
    summary,
    "description_provenance",
    textOrNull(entry?.descriptionProvenance, 64),
  );
  addSummaryField(
    summary,
    "description_length",
    numberOrNull(entry?.descriptionLength),
  );
  addSummaryField(
    summary,
    "scrape_confidence",
    numberOrNull(entry?.scrapeConfidence),
  );
  addSummaryField(
    summary,
    "manual_job_input_used",
    booleanOrNull(entry?.manualJobInputUsed),
  );
  addSummaryField(
    summary,
    "custom_context_provided",
    booleanOrNull(entry?.customContextProvided),
  );
  addSummaryField(
    summary,
    "custom_context_length",
    numberOrNull(entry?.customContextLength),
  );
  addSummaryField(
    summary,
    "storyboard_present",
    booleanOrNull(entry?.storyboardPresent),
  );
  addSummaryField(
    summary,
    "prompt1_duration_ms",
    numberOrNull(entry?.prompt1DurationMs),
  );
  addSummaryField(
    summary,
    "prompt2_duration_ms",
    numberOrNull(entry?.prompt2DurationMs),
  );
  addSummaryField(
    summary,
    "prompt3_duration_ms",
    numberOrNull(entry?.prompt3DurationMs),
  );
  addSummaryField(
    summary,
    "patch_duration_ms",
    numberOrNull(entry?.patchDurationMs),
  );
  addSummaryField(
    summary,
    "prompt3_validation_error_count",
    numberOrNull(entry?.prompt3ValidationErrorCount),
  );
  addSummaryField(
    summary,
    "provider_vendor",
    textOrNull(entry?.providerVendor, 64),
  );
  addSummaryField(
    summary,
    "provider_mode",
    textOrNull(entry?.providerMode, 64),
  );
  addSummaryField(
    summary,
    "cancel_reason",
    textOrNull(entry?.cancelReason, 64),
  );
  addSummaryField(
    summary,
    "cancel_phase",
    textOrNull(entry?.cancelPhase, 64),
  );
  return summary;
}

export function toServerRunSummary(entry) {
  const runId = textOrNull(entry?.runId, TEXT_LIMITS.run_id);
  if (!runId) return null;

  return {
    run_id: runId,
    status: textOrNull(entry?.status, TEXT_LIMITS.status) || "unknown",
    title: textOrNull(entry?.title, TEXT_LIMITS.title),
    company: textOrNull(entry?.company, TEXT_LIMITS.company),
    location: textOrNull(entry?.location, TEXT_LIMITS.location),
    source_url: textOrNull(entry?.sourceUrl, TEXT_LIMITS.source_url),
    job_source: textOrNull(entry?.jobSource, TEXT_LIMITS.job_source),
    resume_id: textOrNull(entry?.resumeId, TEXT_LIMITS.resume_id),
    preview_url: textOrNull(entry?.previewUrl, TEXT_LIMITS.preview_url),
    provider_id: textOrNull(entry?.providerId, TEXT_LIMITS.provider_id),
    provider_label: textOrNull(
      entry?.providerLabel,
      TEXT_LIMITS.provider_label,
    ),
    generated_at: dateStringOrNull(entry?.generatedAt),
    total_duration_ms: numberOrNull(entry?.totalDurationMs),
    summary: buildSafeSummary(entry),
    prompt_artifacts: buildPromptArtifacts(entry),
  };
}

export async function syncExtensionRun(entry, requestOptions = {}) {
  const payload = toServerRunSummary(entry);
  if (!payload) {
    return { ok: false, skipped: true, reason: "missing_run_id" };
  }

  const timeoutMs =
    typeof requestOptions.timeoutMs === "number"
      ? requestOptions.timeoutMs
      : DEFAULT_SYNC_TIMEOUT_MS;
  const controller =
    requestOptions.signal || !Number.isFinite(timeoutMs) || timeoutMs <= 0
      ? null
      : new AbortController();
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  const fetchOptions = { ...requestOptions };
  delete fetchOptions.timeoutMs;

  try {
    return await saveExtensionRun(payload, {
      ...fetchOptions,
      signal: requestOptions.signal || controller?.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn("ExtensionRunSync", "Failed to sync extension run summary.", {
      runId: payload.run_id,
      status: payload.status,
      error: message,
    });
    return { ok: false, error: message };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
