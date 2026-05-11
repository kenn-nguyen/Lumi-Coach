import { SESSION_STATUS } from "./constants.js";
import { runApifyLinkedInFallback } from "./apify.js";
import {
  extractJsonFromText,
  extractPrompt3PayloadFromText,
  extractPrompt4PayloadFromText,
  extractPrompt4ResumeDataFromText,
} from "./json.js";
import { evaluateJobDescriptionGuardrail } from "./job-guardrail.js";
import {
  buildPromptRunMetadata,
  loadSystemPromptGuardrailsWithMetadata,
  renderPrompt1WithMetadata,
  renderPrompt2WithMetadata,
  renderPrompt3WithMetadata,
  renderPrompt4WithMetadata,
} from "./prompt-loader.js";
import { scrapeLinkedInJob } from "./linkedin.js";
import {
  validatePrompt1Data,
  validatePrompt2Data,
  validateResumeData,
} from "./validation.js";
import {
  buildPreviewUrl,
  cloneResume,
  fetchBackendApifyLinkedInFallback,
  fetchFeatureConfig,
  enableContentGenerationFeatures,
  fetchResumeById,
  linkResumeToJobContext,
  listResumes,
  openPreviewTab,
  overwriteMasterResume,
  patchResume,
  renameResume,
  uploadStructuredResume,
  uploadJobDescription,
} from "./api.js";
import { logError, logInfo } from "./log.js";
import { logWarn } from "./log.js";
import {
  getExtensionState,
  getUserAssets,
  setExtensionState,
  setStoryboardAsset,
} from "./storage.js";
import { alignSectionMetaToSourceResume } from "./resume-structure.js";
import { captureExtensionEvent } from "./analytics.js";
import { getActiveLlmProfile } from "./llm/profiles.js";
import { runPrompt } from "./llm/runners.js";
import {
  formatApiProviderErrorForUser,
  isApiProviderError,
} from "./llm/api-errors.js";
import {
  createRunAbortSignal,
  isRunCanceledError,
  markRunPreviewHandoffStarted,
  throwIfRunCanceled,
} from "./run-control.js";
import { syncExtensionRun } from "./extension-runs.js";

export async function saveStoryboardAsset(payload) {
  await setStoryboardAsset({
    filename: payload.filename,
    content: payload.content,
    uploadedAt: new Date().toISOString(),
  });
}

async function upsertAndSyncHistoryEntry(entry) {
  await syncExtensionRun(entry);
}

function createCancelHelpers(runId) {
  return {
    signal() {
      return runId ? createRunAbortSignal(runId) : undefined;
    },
    throwIfCanceled(stage) {
      if (runId) {
        throwIfRunCanceled(runId, stage);
      }
    },
  };
}

async function getActiveLinkedInTabId(tabId) {
  if (tabId) return tabId;
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const activeTab = tabs[0];
  if (
    !activeTab?.id ||
    !activeTab.url?.startsWith("https://www.linkedin.com/jobs/")
  ) {
    throw new Error(
      "Open a LinkedIn job page in the active tab before generating a tailored resume.",
    );
  }
  return activeTab.id;
}

async function getResolvableTabId(tabId) {
  if (typeof tabId === "number") {
    return tabId;
  }
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tabs[0]?.id ?? null;
}

async function buildJobSnapshot(activeTabId, jobInput = null) {
  const manualRawText = jobInput?.rawText?.trim();
  if (manualRawText) {
    const tab = await chrome.tabs.get(activeTabId).catch(() => null);
    const pageUrl = tab?.url || "";
    const jobIdMatch = pageUrl.match(/\/jobs\/view\/(\d+)/);
    const sourceUrl =
      jobInput?.sourceUrl?.trim() ||
      (jobIdMatch
        ? `${new URL(pageUrl).origin}/jobs/view/${jobIdMatch[1]}/`
        : pageUrl);

    return {
      source: jobInput?.source || "manual_text",
      sourceUrl,
      title: jobInput?.title?.trim() || "",
      company: jobInput?.company?.trim() || "",
      location: jobInput?.location?.trim() || "",
      datePosted: jobInput?.datePosted?.trim() || null,
      extractedAt: new Date().toISOString(),
      rawText: manualRawText,
      diagnostics: {
        source: jobInput?.source || "manual_text",
        manualOverride: true,
        rawTextLength: manualRawText.length,
      },
    };
  }

  return scrapeLinkedInJob(activeTabId);
}

async function getSourceUrlForTab(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  return typeof tab?.url === "string" ? tab.url : "";
}

function hasExtensionApifyFallback(settings) {
  return Boolean(settings?.enabled && settings?.apiToken);
}

function hasBackendApifyFallback(settings) {
  return Boolean(settings?.enabled && !settings?.apiToken);
}

export function shouldAcceptLocalSnapshot({
  snapshot,
  guardrail,
  isManualInput = false,
}) {
  if (isManualInput) return Boolean(guardrail?.is_job_description);
  if (!guardrail?.is_job_description) return false;

  if (snapshot?.readiness === "full_jd_ready") return true;

  const localConfidence = snapshot?.quality?.confidence;
  if (localConfidence === "high") return true;

  if (localConfidence !== "medium") return false;

  const descriptionLength = snapshot?.quality?.descriptionLength ?? 0;
  const rawTextLength = snapshot?.rawText?.length ?? 0;
  const guardrailConfidence = guardrail?.confidence;
  const minimumLength = guardrailConfidence === "high" ? 900 : 1400;

  return descriptionLength >= minimumLength && rawTextLength >= minimumLength;
}

function buildManualEntryRequiredError(reason = "") {
  const detail = reason ? ` ${reason}` : "";
  return new Error(
    `This does not look like a usable job description yet. Paste the full job description manually to continue.${detail}`,
  );
}

async function resolveValidatedJobSnapshot({
  activeTabId,
  jobInput,
  activeLlmProfile,
  systemPrompt,
  apifyFallbackSettings,
}) {
  const isManualInput = Boolean(jobInput?.rawText?.trim());
  const extensionApifyEnabled = hasExtensionApifyFallback(
    apifyFallbackSettings,
  );
  const backendApifyEnabled = hasBackendApifyFallback(apifyFallbackSettings);
  const sourceUrlHint = isManualInput
    ? jobInput?.sourceUrl?.trim() || (await getSourceUrlForTab(activeTabId))
    : await getSourceUrlForTab(activeTabId);

  let localSnapshot = null;
  let localFailure = null;
  let resolvedSourceUrlHint = sourceUrlHint;

  try {
    localSnapshot = await buildJobSnapshot(activeTabId, jobInput);
  } catch (error) {
    localFailure = error instanceof Error ? error : new Error(String(error));
    if (
      localFailure?.snapshot?.sourceUrl &&
      typeof localFailure.snapshot.sourceUrl === "string"
    ) {
      resolvedSourceUrlHint = localFailure.snapshot.sourceUrl;
    }
    logWarn("Orchestrator", "Primary job extraction failed.", {
      message: localFailure.message,
      sourceUrlHint: resolvedSourceUrlHint,
      isManualInput,
    });
  }

  if (localSnapshot) {
    if (
      typeof localSnapshot.sourceUrl === "string" &&
      localSnapshot.sourceUrl
    ) {
      resolvedSourceUrlHint = localSnapshot.sourceUrl;
    }
    const guardrail = await evaluateJobDescriptionGuardrail(
      localSnapshot,
      activeLlmProfile,
      systemPrompt,
    );
    localSnapshot.diagnostics = {
      ...(localSnapshot.diagnostics || {}),
      guardrail,
    };
    if (
      shouldAcceptLocalSnapshot({
        snapshot: localSnapshot,
        guardrail,
        isManualInput,
      })
    ) {
      return localSnapshot;
    }

    logInfo(
      "Orchestrator",
      "Primary extraction did not meet acceptance threshold.",
      {
        source: localSnapshot.source,
        localConfidence: localSnapshot?.quality?.confidence || "unknown",
        confidence: guardrail.confidence,
        reason: guardrail.reason,
      },
    );

    if (isManualInput) {
      throw buildManualEntryRequiredError(guardrail.reason);
    }
  }

  if (extensionApifyEnabled && resolvedSourceUrlHint) {
    try {
      const apifySnapshot = await runApifyLinkedInFallback(
        resolvedSourceUrlHint,
        apifyFallbackSettings,
      );
      const apifyGuardrail = await evaluateJobDescriptionGuardrail(
        apifySnapshot,
        activeLlmProfile,
        systemPrompt,
      );
      apifySnapshot.diagnostics = {
        ...(apifySnapshot.diagnostics || {}),
        guardrail: apifyGuardrail,
        localFailure:
          localFailure?.message ||
          localSnapshot?.diagnostics?.guardrail?.reason ||
          null,
      };

      if (apifyGuardrail.is_job_description) {
        return apifySnapshot;
      }

      logInfo("Orchestrator", "Apify fallback failed JD guardrail.", {
        confidence: apifyGuardrail.confidence,
        reason: apifyGuardrail.reason,
      });
      throw buildManualEntryRequiredError(apifyGuardrail.reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn("Orchestrator", "Extension Apify fallback failed.", {
        message,
        sourceUrlHint: resolvedSourceUrlHint,
      });
      throw buildManualEntryRequiredError(message);
    }
  }

  if (backendApifyEnabled && resolvedSourceUrlHint) {
    try {
      const backendApifySnapshot = await fetchBackendApifyLinkedInFallback(
        resolvedSourceUrlHint,
      );
      const backendApifyGuardrail = await evaluateJobDescriptionGuardrail(
        backendApifySnapshot,
        activeLlmProfile,
        systemPrompt,
      );
      backendApifySnapshot.diagnostics = {
        ...(backendApifySnapshot.diagnostics || {}),
        guardrail: backendApifyGuardrail,
        localFailure:
          localFailure?.message ||
          localSnapshot?.diagnostics?.guardrail?.reason ||
          null,
      };

      if (backendApifyGuardrail.is_job_description) {
        return backendApifySnapshot;
      }

      logInfo("Orchestrator", "Backend Apify fallback failed JD guardrail.", {
        confidence: backendApifyGuardrail.confidence,
        reason: backendApifyGuardrail.reason,
      });
      throw buildManualEntryRequiredError(backendApifyGuardrail.reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn("Orchestrator", "Backend Apify fallback failed.", {
        message,
        sourceUrlHint: resolvedSourceUrlHint,
      });
      throw buildManualEntryRequiredError(message);
    }
  }

  if (localFailure) {
    throw buildManualEntryRequiredError(localFailure.message);
  }

  throw buildManualEntryRequiredError(
    localSnapshot?.diagnostics?.guardrail?.reason || "",
  );
}

function toResumeSource(resumePayload) {
  return (
    resumePayload.data.processed_resume ??
    resumePayload.data.raw_resume?.content ??
    ""
  );
}

function ensureStoryboardContent(storyboardAsset) {
  return storyboardAsset?.content?.trim() ?? "";
}

function resolveCurrentResumeSource(masterResumeContextAsset, fetchedResume) {
  const backendResume = toResumeSource(fetchedResume);
  if (backendResume) {
    return backendResume;
  }
  const localContext = masterResumeContextAsset?.content?.trim();
  if (localContext) {
    return localContext;
  }
  return "";
}

function buildResumeTitle(jobTitle, company) {
  const normalizedTitle = jobTitle?.trim();
  const normalizedCompany = company?.trim();
  if (normalizedTitle && normalizedCompany) {
    return `${normalizedCompany} - ${normalizedTitle}`;
  }
  return normalizedCompany || normalizedTitle || null;
}

function buildStoredJobDescription(jobSnapshot) {
  const parts = [
    jobSnapshot?.title ? `Title: ${jobSnapshot.title}` : null,
    jobSnapshot?.company ? `Company: ${jobSnapshot.company}` : null,
    jobSnapshot?.location ? `Location: ${jobSnapshot.location}` : null,
    jobSnapshot?.sourceUrl ? `Source URL: ${jobSnapshot.sourceUrl}` : null,
    null,
    jobSnapshot?.rawText?.trim() || "",
  ].filter((part) => part !== null);
  return parts.join("\n").trim();
}

function logPromptDebug(label, stage, payload) {
  logInfo("PromptDebug", `${label} ${stage}.`, {
    label,
    stage,
    payload,
  });
}

const PRESERVED_PERSONAL_INFO_FIELDS = [
  "name",
  "customTagline",
  "email",
  "phone",
  "location",
  "website",
  "linkedin",
  "github",
];

const PRESERVED_EXPERIENCE_FIELDS = [
  "title",
  "company",
  "context",
  "website",
  "years",
];

const RESUME_EXTRACTION_FAILED_MESSAGE =
  "Resume extraction failed. Check that the file contains resume text, then try again.";
const NON_RESUME_UPLOAD_MESSAGE =
  "This file does not look like a resume. Choose a resume file and try again.";
const MASTER_IMPORT_PROVIDER_SETUP_MESSAGE =
  "AI setup needs attention. Save or change your provider, then upload your Master Resume again.";

export function getMasterResumeImportProviderIssue(profile) {
  if (!profile?.id) {
    return "Choose and save your AI setup before uploading your Master Resume.";
  }
  if (profile.mode === "web_automation") {
    return typeof profile.targetUrl === "string" && profile.targetUrl.trim()
      ? ""
      : MASTER_IMPORT_PROVIDER_SETUP_MESSAGE;
  }
  if (profile.mode === "api") {
    const hasApiBaseUrl =
      typeof profile.apiBaseUrl === "string" && profile.apiBaseUrl.trim();
    const hasModel = typeof profile.model === "string" && profile.model.trim();
    const hasApiKey =
      typeof profile.apiKey === "string" && profile.apiKey.trim();
    return hasApiBaseUrl && hasModel && hasApiKey
      ? ""
      : MASTER_IMPORT_PROVIDER_SETUP_MESSAGE;
  }
  return MASTER_IMPORT_PROVIDER_SETUP_MESSAGE;
}

function getPromptRunProviderIssue(message) {
  const normalized = String(message || "");
  if (isApiProviderError(normalized)) {
    return formatApiProviderErrorForUser(normalized);
  }
  if (
    /active LLM profile|LLM runner|API key|required for the active runner|auth_required|Please log into|provider/i.test(
      normalized,
    )
  ) {
    return MASTER_IMPORT_PROVIDER_SETUP_MESSAGE;
  }
  return "";
}

export function getPrompt4ResumeRejectionMessage(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "";
  }
  if (parsed.error !== "not_resume") {
    return "";
  }
  return NON_RESUME_UPLOAD_MESSAGE;
}

function preserveExperienceFacts(masterExperience, generatedExperience) {
  if (!Array.isArray(masterExperience) || !Array.isArray(generatedExperience)) {
    return generatedExperience;
  }

  const masterById = new Map(
    masterExperience
      .filter(
        (item) => item && typeof item === "object" && Number.isInteger(item.id),
      )
      .map((item) => [item.id, item]),
  );

  return generatedExperience.map((item, index) => {
    if (!item || typeof item !== "object") {
      return item;
    }
    let masterItem = Number.isInteger(item.id) ? masterById.get(item.id) : null;
    if (!masterItem && index < masterExperience.length) {
      const fallback = masterExperience[index];
      if (fallback && typeof fallback === "object") {
        masterItem = fallback;
      }
    }
    if (!masterItem || typeof masterItem !== "object") {
      return item;
    }

    const nextItem = { ...item };
    PRESERVED_EXPERIENCE_FIELDS.forEach((field) => {
      if (field in masterItem) {
        nextItem[field] = masterItem[field];
      }
    });
    return nextItem;
  });
}

export function preserveGeneratedResumeFacts(
  masterResumeData,
  generatedResumeData,
  enabled,
) {
  if (
    !enabled ||
    !masterResumeData ||
    typeof masterResumeData !== "object" ||
    !generatedResumeData ||
    typeof generatedResumeData !== "object"
  ) {
    return generatedResumeData;
  }

  const nextResume = { ...generatedResumeData };
  const masterPersonalInfo = masterResumeData.personalInfo;
  const generatedPersonalInfo = nextResume.personalInfo;
  if (masterPersonalInfo && typeof masterPersonalInfo === "object") {
    const nextPersonalInfo =
      generatedPersonalInfo && typeof generatedPersonalInfo === "object"
        ? { ...generatedPersonalInfo }
        : {};
    PRESERVED_PERSONAL_INFO_FIELDS.forEach((field) => {
      if (field in masterPersonalInfo) {
        nextPersonalInfo[field] = masterPersonalInfo[field];
      }
    });
    nextResume.personalInfo = nextPersonalInfo;
  }

  nextResume.workExperience = preserveExperienceFacts(
    masterResumeData.workExperience,
    generatedResumeData.workExperience,
  );

  return nextResume;
}

function replaceEmDashCharacters(value) {
  if (typeof value === "string") {
    return value.replace(/—/g, "-");
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceEmDashCharacters(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        replaceEmDashCharacters(nested),
      ]),
    );
  }
  return value;
}

function stripBulletTerminalPeriod(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trimEnd();
  if (!trimmed.endsWith(".")) {
    return value;
  }

  return `${trimmed.slice(0, -1)}${value.slice(trimmed.length)}`;
}

function normalizeBulletStringArray(items) {
  if (!Array.isArray(items)) {
    return items;
  }
  return items.map((item) => stripBulletTerminalPeriod(item));
}

function normalizePrompt3ResumeData(resumeData) {
  const normalized = replaceEmDashCharacters(resumeData);
  if (!normalized || typeof normalized !== "object") {
    return normalized;
  }

  const nextResume = { ...normalized };

  if (Array.isArray(nextResume.workExperience)) {
    nextResume.workExperience = nextResume.workExperience.map((item) => ({
      ...item,
      description: normalizeBulletStringArray(item?.description),
    }));
  }

  if (Array.isArray(nextResume.personalProjects)) {
    nextResume.personalProjects = nextResume.personalProjects.map((item) => ({
      ...item,
      description: normalizeBulletStringArray(item?.description),
    }));
  }

  if (
    nextResume.customSections &&
    typeof nextResume.customSections === "object"
  ) {
    nextResume.customSections = Object.fromEntries(
      Object.entries(nextResume.customSections).map(([key, section]) => {
        if (
          section &&
          typeof section === "object" &&
          section.sectionType === "itemList" &&
          Array.isArray(section.items)
        ) {
          return [
            key,
            {
              ...section,
              items: section.items.map((item) => ({
                ...item,
                description: normalizeBulletStringArray(item?.description),
              })),
            },
          ];
        }
        return [key, section];
      }),
    );
  }

  return nextResume;
}

function stripPromptFlexNotesFromResumeData(resumeData) {
  if (!resumeData || typeof resumeData !== "object" || Array.isArray(resumeData)) {
    return resumeData;
  }

  const { flex_notes: _flexNotes, ...resumeDataWithoutFlexNotes } = resumeData;
  return resumeDataWithoutFlexNotes;
}

export function stripPromptFlexNotesFromServerArtifact(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return artifact;
  }

  const { flex_notes: _flexNotes, ...artifactWithoutFlexNotes } = artifact;
  return artifactWithoutFlexNotes;
}

function normalizePrompt3Feedback(feedback) {
  const normalized = replaceEmDashCharacters(feedback);
  if (!normalized || typeof normalized !== "object") {
    return normalized;
  }

  return normalized;
}

function buildBasePromptContext({
  jobSnapshot,
  currentResume,
  storyboard,
  customInstruction,
  systemPrompt,
}) {
  return {
    jobSnapshot,
    jobTitle: jobSnapshot?.title ?? "",
    company: jobSnapshot?.company ?? "",
    location: jobSnapshot?.location ?? "",
    sourceUrl: jobSnapshot?.sourceUrl ?? "",
    extractedAt: jobSnapshot?.extractedAt ?? "",
    jobDescriptionRawText: jobSnapshot?.rawText ?? "",
    currentResume,
    storyboard,
    customInstruction,
    systemPrompt,
    prompt1Json: null,
    prompt2Json: null,
  };
}

function prefixGenerationFeedbackSummary(feedback, profile) {
  if (!feedback || typeof feedback !== "object") {
    return feedback;
  }

  const providerLabel =
    typeof profile?.label === "string"
      ? profile.label.trim().toUpperCase()
      : "";
  if (!providerLabel) {
    return feedback;
  }

  const summary =
    typeof feedback.summary === "string" ? feedback.summary.trim() : "";
  const prefix = `${providerLabel}:`;
  if (summary.startsWith(prefix)) {
    return feedback;
  }

  return {
    ...feedback,
    summary: summary ? `${prefix} ${summary}` : prefix,
  };
}

function buildStructuredPromptValidationResult(
  rawText,
  validator,
  extractor = null,
) {
  try {
    const parsed =
      typeof extractor === "function"
        ? extractor(rawText)
        : extractJsonFromText(rawText, {
            validate: (candidate) => validator(candidate).length === 0,
          });
    const validationErrors = validator(parsed);
    if (validationErrors.length > 0) {
      return {
        valid: false,
        message: validationErrors.join(" | "),
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to parse JSON from model output.",
    };
  }
}

function formatPreviousInvalidOutput(previousRawText) {
  const content =
    typeof previousRawText === "string" && previousRawText.trim()
      ? previousRawText.trim()
      : "(empty response)";
  return ["Previous invalid response:", content].join("\n");
}

function validatePrompt1RawOutput(rawText) {
  return buildStructuredPromptValidationResult(rawText, validatePrompt1Data);
}

function buildPrompt1RepairPrompt({
  validationMessage,
  promptLabel,
  attempt,
  previousRawText,
}) {
  return [
    `Your previous ${promptLabel ?? "Prompt 1"} response was invalid.`,
    `Validation issue: ${validationMessage}`,
    "Return corrected JSON only.",
    "Do not include markdown fences, commentary, or prose before or after the JSON.",
    "Return exactly one JSON object that matches the Prompt 1 output contract.",
    "Keep the same JD analysis and ATS extraction intent; only fix the schema/content contract issues.",
    formatPreviousInvalidOutput(previousRawText),
    `This is repair attempt ${attempt}.`,
  ].join("\n\n");
}

function validatePrompt2RawOutput(rawText) {
  return buildStructuredPromptValidationResult(rawText, validatePrompt2Data);
}

function buildPrompt2RepairPrompt({
  validationMessage,
  promptLabel,
  attempt,
  previousRawText,
}) {
  return [
    `Your previous ${promptLabel ?? "Prompt 2"} response was invalid.`,
    `Validation issue: ${validationMessage}`,
    "Return corrected JSON only.",
    "Do not include markdown fences, commentary, or prose before or after the JSON.",
    "Return exactly one JSON object that matches the Prompt 2 output contract.",
    "Keep the same positioning strategy and evidence constraints; only fix the schema/content contract issues.",
    formatPreviousInvalidOutput(previousRawText),
    `This is repair attempt ${attempt}.`,
  ].join("\n\n");
}

function validatePrompt3RawOutput(rawText) {
  try {
    const prompt3Result = extractPrompt3PayloadFromText(rawText);
    if (
      !prompt3Result.usedLegacyShape &&
      prompt3Result.parsed?.flex_notes != null &&
      typeof prompt3Result.parsed.flex_notes !== "string"
    ) {
      return {
        valid: false,
        message: "prompt3.flex_notes must be a string or null.",
      };
    }
    const validationErrors = validateResumeData(prompt3Result.resumeData);
    if (validationErrors.length > 0) {
      return {
        valid: false,
        message: validationErrors.join(" | "),
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to parse JSON from model output.",
    };
  }
}

function buildPrompt3RepairPrompt({
  validationMessage,
  promptLabel,
  attempt,
  previousRawText,
}) {
  return [
    `Your previous ${promptLabel ?? "Prompt 3"} response was invalid.`,
    `Validation issue: ${validationMessage}`,
    "Return corrected JSON only.",
    "Do not include markdown fences, commentary, or prose before or after the JSON.",
    "The top-level object must contain `resume_data`.",
    "`generation_feedback` is optional, but if present it must be valid JSON with `summary`, `pros`, `cons`, and `caveats`.",
    "`flex_notes` is optional, but if present it must be a string or null.",
    "Do not use the em dash character `—`; use a normal hyphen `-` instead.",
    "Do not end resume bullet strings with a period `.`.",
    "Do not return the empty schema template. Reuse the same resume content you already generated, but fix the JSON format and schema issues.",
    formatPreviousInvalidOutput(previousRawText),
    `This is repair attempt ${attempt}.`,
  ].join("\n\n");
}

function validatePrompt4RawOutput(rawText) {
  try {
    const prompt4Result = extractPrompt4PayloadFromText(rawText);
    if (
      !prompt4Result.usedLegacyShape &&
      prompt4Result.parsed?.flex_notes != null &&
      typeof prompt4Result.parsed.flex_notes !== "string"
    ) {
      return {
        valid: false,
        message: "prompt4.flex_notes must be a string or null.",
      };
    }
    const resumeData = prompt4Result.resumeData;
    const rejectionMessage = getPrompt4ResumeRejectionMessage(resumeData);
    if (rejectionMessage) {
      return { valid: true };
    }
    const validationErrors = validateResumeData(
      stripPromptFlexNotesFromResumeData(normalizePrompt3ResumeData(resumeData)),
    );
    if (validationErrors.length > 0) {
      return {
        valid: false,
        message: validationErrors.join(" | "),
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to parse JSON from model output.",
    };
  }
}

function buildPrompt4RepairPrompt({
  validationMessage,
  promptLabel,
  attempt,
  previousRawText,
}) {
  return [
    `Your previous ${promptLabel ?? "Prompt 4"} response was invalid.`,
    `Validation issue: ${validationMessage}`,
    "Return corrected JSON only.",
    "Do not include markdown fences, commentary, or prose before or after the JSON.",
    "If the previous output was a `not_resume` error object, return that same error object unchanged.",
    "Otherwise return one object with `resume_data` containing the ResumeData object.",
    "`flex_notes` is optional as a top-level prompt note, but if present it must be a string or null.",
    "Do not place `flex_notes` inside `resume_data`; it is prompt metadata only.",
    "Do not include `generation_feedback`, explanations, notes, or any other top-level keys outside `resume_data` and optional `flex_notes`.",
    "Do not use the em dash character `—`; use a normal hyphen `-` instead.",
    "Every `sectionMeta` item must be a full object with these fields: `id`, `key`, `displayName`, `sectionType`, `isDefault`, `isVisible`, `order`.",
    "`sectionMeta[].id`, `sectionMeta[].key`, and `sectionMeta[].displayName` must be strings.",
    "`sectionMeta[].sectionType` must be one of `personalInfo`, `text`, `itemList`, or `stringList`.",
    "`sectionMeta[].isDefault` and `sectionMeta[].isVisible` must be booleans.",
    "`sectionMeta[].order` must be an integer.",
    "Do not return the empty schema template. Reuse the same resume facts you already extracted, but fix the JSON format and schema issues.",
    formatPreviousInvalidOutput(previousRawText),
    `This is repair attempt ${attempt}.`,
  ].join("\n\n");
}

function buildBootstrappedMasterFilename(asset) {
  const originalName =
    typeof asset?.filename === "string" && asset.filename.trim()
      ? asset.filename.trim()
      : "master-resume.md";
  const withoutExtension = /\.[^.]+$/.test(originalName)
    ? originalName.replace(/\.[^.]+$/, "")
    : originalName;
  return `${withoutExtension}.json`;
}

async function bootstrapMasterResumeFromMarkdown({
  masterResumeContextAsset,
  activeLlmProfile,
  systemPrompt,
  activeRunJob,
  sourceTabId,
  runId,
}) {
  const cancel = createCancelHelpers(runId);
  const localResumeMarkdown = masterResumeContextAsset?.content?.trim();
  if (!localResumeMarkdown) {
    const message =
      "No master resume was found in Lumi Coach. Upload your Markdown resume in the extension first.";
    await setExtensionState({
      sourceTabId,
      activeRunJob,
      patchError: message,
      status: SESSION_STATUS.error,
    });
    throw new Error(message);
  }

  await setExtensionState({
    sourceTabId,
    activeRunJob,
    patchError: null,
    status: SESSION_STATUS.bootstrapMaster,
    prompt4Input: null,
    prompt4Raw: null,
    prompt4Result: null,
  });

  try {
    cancel.throwIfCanceled("base resume setup");
    const prompt4Rendered = await renderPrompt4WithMetadata(
      {
        currentResume: localResumeMarkdown,
        systemPrompt,
      },
      activeLlmProfile,
    );
    const prompt4 = prompt4Rendered.text;
    await setExtensionState({
      prompt4Input: prompt4,
      prompt4Raw: null,
      prompt4Result: null,
    });
    logPromptDebug("Prompt 4", "input", prompt4);
    logInfo("Orchestrator", "Running Prompt 4.");

    const prompt4Run = await runPrompt(prompt4, {
      profile: activeLlmProfile,
      promptLabel: "Prompt 4",
      systemPrompt,
      runId,
      signal: cancel.signal(),
      validateResponse: validatePrompt4RawOutput,
      buildRepairPrompt: buildPrompt4RepairPrompt,
      maxRepairAttempts: 1,
    });
    cancel.throwIfCanceled("Prompt 4");

    const prompt4Raw =
      prompt4Run.status === "success"
        ? prompt4Run.rawText
        : (prompt4Run.partialRawText ?? "");
    await setExtensionState({
      prompt4Input: prompt4,
      prompt4Raw,
    });

    if (prompt4Run.status === "canceled") {
      throwIfRunCanceled(runId, "Prompt 4");
    }
    if (prompt4Run.status !== "success") {
      logError("Orchestrator", "Prompt 4 failed.", prompt4Run);
      if (isApiProviderError(prompt4Run)) {
        throw new Error(
          formatApiProviderErrorForUser(
            prompt4Run,
            activeLlmProfile?.label || "AI API",
          ),
        );
      }
      throw new Error(RESUME_EXTRACTION_FAILED_MESSAGE);
    }

    if (prompt4Run.validationError) {
      logError("Orchestrator", "Prompt 4 failed validation after repair.", {
        validationError: prompt4Run.validationError,
        conversationUrl: prompt4Run.conversationUrl ?? null,
      });
      throw new Error(RESUME_EXTRACTION_FAILED_MESSAGE);
    }

    logInfo("Orchestrator", "Parsing Prompt 4 output.");
    logPromptDebug("Prompt 4", "output", prompt4Raw);
    const prompt4Parsed = extractPrompt4ResumeDataFromText(prompt4Raw);
    const rejectionMessage = getPrompt4ResumeRejectionMessage(prompt4Parsed);
    if (rejectionMessage) {
      throw new Error(rejectionMessage);
    }
    const parsedResumeData = stripPromptFlexNotesFromResumeData(
      normalizePrompt3ResumeData(prompt4Parsed),
    );
    await setExtensionState({
      prompt4Result: parsedResumeData,
    });
    const validationErrors = validateResumeData(parsedResumeData);
    if (validationErrors.length > 0) {
      logError("Orchestrator", "Prompt 4 produced invalid ResumeData.", {
        validationErrors,
      });
      throw new Error(RESUME_EXTRACTION_FAILED_MESSAGE);
    }

    const uploadResponse = await uploadStructuredResume(
      buildBootstrappedMasterFilename(masterResumeContextAsset),
      parsedResumeData,
      { signal: cancel.signal() },
    );
    cancel.throwIfCanceled("base resume upload");
    if (!uploadResponse?.resume_id) {
      throw new Error(
        "Resume extraction finished, but Lumi Coach did not return a master resume id.",
      );
    }

    logInfo("Orchestrator", "Created backend master resume from Prompt 4.", {
      resumeId: uploadResponse.resume_id,
      processingStatus: uploadResponse.processing_status ?? null,
    });
    return {
      resumeId: uploadResponse.resume_id,
      prompt4Input: prompt4,
      prompt4Raw,
      prompt4Result: parsedResumeData,
      prompt4Metadata: prompt4Rendered.metadata,
    };
  } catch (error) {
    if (isRunCanceledError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    await setExtensionState({
      patchError: message,
      status: SESSION_STATUS.error,
    });
    throw error instanceof Error ? error : new Error(message);
  }
}

function buildMasterResumeTitle(filename) {
  const normalized =
    typeof filename === "string" && filename.trim()
      ? filename.trim()
      : "Master Resume";
  return normalized.replace(/\.[^.]+$/, "") || "Master Resume";
}

export async function importMasterResumeFromTextAsset({
  filename,
  content,
  replaceExisting = true,
} = {}) {
  const localResumeMarkdown = typeof content === "string" ? content.trim() : "";
  if (!localResumeMarkdown) {
    throw new Error("Upload a resume file with text content.");
  }

  const { llmSettings } = await getUserAssets();
  const activeLlmProfile = getActiveLlmProfile(llmSettings);
  const providerIssue = getMasterResumeImportProviderIssue(activeLlmProfile);
  if (providerIssue) {
    throw new Error(providerIssue);
  }
  const systemPromptRendered = await loadSystemPromptGuardrailsWithMetadata();
  const systemPrompt = systemPromptRendered.text;
  const prompt4Rendered = await renderPrompt4WithMetadata(
    {
      currentResume: localResumeMarkdown,
      systemPrompt,
    },
    activeLlmProfile,
  );
  const prompt4 = prompt4Rendered.text;

  logPromptDebug("Prompt 4", "input", prompt4);
  logInfo("Orchestrator", "Running Prompt 4 for Master Resume import.");
  const prompt4Run = await runPrompt(prompt4, {
    profile: activeLlmProfile,
    promptLabel: "Prompt 4",
    systemPrompt,
    runId: null,
    validateResponse: validatePrompt4RawOutput,
    buildRepairPrompt: buildPrompt4RepairPrompt,
    maxRepairAttempts: 1,
  });

  const prompt4Raw =
    prompt4Run.status === "success"
      ? prompt4Run.rawText
      : (prompt4Run.partialRawText ?? "");

  if (prompt4Run.status !== "success") {
    logError("Orchestrator", "Prompt 4 Master Resume import failed.", prompt4Run);
    const providerRunIssue = isApiProviderError(prompt4Run)
      ? formatApiProviderErrorForUser(
          prompt4Run,
          activeLlmProfile?.label || "AI API",
        )
      : getPromptRunProviderIssue(prompt4Run.message);
    if (providerRunIssue) {
      throw new Error(providerRunIssue);
    }
    throw new Error(RESUME_EXTRACTION_FAILED_MESSAGE);
  }
  if (prompt4Run.validationError) {
    logError("Orchestrator", "Prompt 4 Master Resume import failed validation.", {
      validationError: prompt4Run.validationError,
      conversationUrl: prompt4Run.conversationUrl ?? null,
    });
    throw new Error(RESUME_EXTRACTION_FAILED_MESSAGE);
  }

  logPromptDebug("Prompt 4", "output", prompt4Raw);
  const prompt4Parsed = extractPrompt4ResumeDataFromText(prompt4Raw);
  const rejectionMessage = getPrompt4ResumeRejectionMessage(prompt4Parsed);
  if (rejectionMessage) {
    throw new Error(rejectionMessage);
  }
  const parsedResumeData = stripPromptFlexNotesFromResumeData(
    normalizePrompt3ResumeData(prompt4Parsed),
  );
  const validationErrors = validateResumeData(parsedResumeData);
  if (validationErrors.length > 0) {
    logError("Orchestrator", "Prompt 4 Master Resume import produced invalid ResumeData.", {
      validationErrors,
    });
    throw new Error(RESUME_EXTRACTION_FAILED_MESSAGE);
  }

  const resumeList = await listResumes(true);
  const masterResume = resumeList?.data?.find((resume) => resume?.is_master);
  let resumeId = masterResume?.resume_id ?? null;
  let uploadResponse = null;

  if (resumeId && replaceExisting) {
    await overwriteMasterResume(parsedResumeData);
  } else {
    uploadResponse = await uploadStructuredResume(
      buildBootstrappedMasterFilename({ filename }),
      parsedResumeData,
    );
    resumeId = uploadResponse?.resume_id ?? null;
  }

  if (!resumeId) {
    throw new Error("Master Resume was extracted, but Lumi Coach did not return a resume id.");
  }

  const title = buildMasterResumeTitle(filename);
  await renameResume(resumeId, title);

  return {
    resumeId,
    filename: typeof filename === "string" ? filename : null,
    title,
    prompt4Raw,
    prompt4Result: parsedResumeData,
    processingStatus: uploadResponse?.processing_status ?? "ready",
  };
}

async function resolveBaseResumeId({
  masterResumeContextAsset,
  activeLlmProfile,
  systemPrompt,
  activeRunJob,
  sourceTabId,
  runId,
}) {
  const cancel = createCancelHelpers(runId);
  cancel.throwIfCanceled("base resume lookup");
  const resumeList = await listResumes(true, { signal: cancel.signal() });
  cancel.throwIfCanceled("base resume lookup");
  const masterResume = resumeList?.data?.find((resume) => resume?.is_master);
  if (!masterResume?.resume_id) {
    return bootstrapMasterResumeFromMarkdown({
      masterResumeContextAsset,
      activeLlmProfile,
      systemPrompt,
      activeRunJob,
      sourceTabId,
      runId,
    });
  }
  return {
    resumeId: masterResume.resume_id,
    prompt4Input: null,
    prompt4Raw: null,
    prompt4Result: null,
    prompt4Metadata: null,
  };
}

export async function generateResumeForLinkedInJob(
  tabId,
  prompt1CustomInstruction = "",
  jobInput = null,
) {
  logInfo("Orchestrator", "Generate flow started.", { tabId });
  const runStartedMs = Date.now();
  const customContext = prompt1CustomInstruction.trim();
  const customContextProvided = customContext.length > 0;
  const manualJobInputUsed = Boolean(jobInput?.rawText?.trim());
  let prompt4Input = null;
  let prompt4Raw = null;
  let prompt4Result = null;
  let prompt1Input = null;
  let prompt1DurationMs = null;
  let prompt2Input = null;
  let prompt2DurationMs = null;
  let prompt3Input = null;
  let prompt3DurationMs = null;
  let patchDurationMs = null;
  let promptMetadata = null;
  const promptMetadataByName = {};
  logInfo("Orchestrator", "Loading local assets.");
  const {
    masterResumeContextAsset,
    storyboardAsset,
    llmSettings,
    apifyFallbackSettings,
  } = await getUserAssets();
  const activeLlmProfile = getActiveLlmProfile(llmSettings);
  const systemPromptRendered = await loadSystemPromptGuardrailsWithMetadata();
  const systemPrompt = systemPromptRendered.text;
  const refreshPromptMetadata = async () => {
    promptMetadata = await buildPromptRunMetadata({
      profile: activeLlmProfile,
      prompts: promptMetadataByName,
      systemPrompt: systemPromptRendered.metadata,
    });
    return promptMetadata;
  };
  await refreshPromptMetadata();
  const currentExtensionState = await getExtensionState();
  const runId = currentExtensionState?.sessionId ?? null;
  const cancel = createCancelHelpers(runId);

  cancel.throwIfCanceled("job tab resolution");
  const activeTabId = manualJobInputUsed
    ? await getResolvableTabId(tabId)
    : await getActiveLinkedInTabId(tabId);
  logInfo("Orchestrator", "Using source tab.", {
    activeTabId,
    manualJobInputUsed,
  });
  cancel.throwIfCanceled("job extraction");
  const jobSnapshot = await resolveValidatedJobSnapshot({
    activeTabId,
    jobInput,
    activeLlmProfile,
    systemPrompt,
    apifyFallbackSettings,
  });
  cancel.throwIfCanceled("job extraction");
  logInfo("Orchestrator", "Job extraction completed.", {
    source: jobSnapshot.source,
    sourceUrl: jobSnapshot.sourceUrl,
    title: jobSnapshot.title,
    company: jobSnapshot.company,
    rawTextLength: jobSnapshot.rawText.length,
  });
  logInfo("LinkedInScrape", "LinkedIn scrape output.", {
    jobSnapshot,
  });
  await captureExtensionEvent("scrape_source_selected", {
    surface: "run_view",
    run_id: runId,
    source: jobSnapshot.source,
    source_url: jobSnapshot.sourceUrl,
    readiness: jobSnapshot.readiness ?? null,
    scrape_confidence: jobSnapshot?.quality?.confidence ?? null,
    jd_length: jobSnapshot.rawText?.length ?? 0,
  });

  logInfo("Orchestrator", "Resolving base resume.");
  const activeRunJob = {
    title: jobSnapshot.title,
    company: jobSnapshot.company,
    location: jobSnapshot.location ?? "",
    datePosted: jobSnapshot.datePosted ?? null,
    sourceUrl: jobSnapshot.sourceUrl,
  };
  const baseResumeResolution = await resolveBaseResumeId({
    masterResumeContextAsset,
    activeLlmProfile,
    systemPrompt,
    activeRunJob,
    sourceTabId: activeTabId,
    runId,
  });
  const baseResumeId = baseResumeResolution.resumeId;
  prompt4Input = baseResumeResolution.prompt4Input ?? null;
  prompt4Raw = baseResumeResolution.prompt4Raw ?? null;
  prompt4Result = baseResumeResolution.prompt4Result ?? null;
  if (baseResumeResolution.prompt4Metadata) {
    promptMetadataByName.prompt4 = baseResumeResolution.prompt4Metadata;
    await refreshPromptMetadata();
  }
  logInfo("Orchestrator", "Resolved base resume for cloning.", {
    baseResumeId,
  });
  logInfo(
    "Orchestrator",
    "Uploading scraped job description for downstream app features.",
    {
      baseResumeId,
    },
  );
  const uploadedJobDescription = buildStoredJobDescription(jobSnapshot);
  cancel.throwIfCanceled("job upload");
  const jobUploadResponse = await uploadJobDescription(
    uploadedJobDescription,
    baseResumeId,
    { signal: cancel.signal() },
  );
  cancel.throwIfCanceled("job upload");
  const jobId = jobUploadResponse?.job_id?.[0];
  if (!jobId) {
    throw new Error("Job upload response did not include a job id.");
  }
  await setExtensionState({
    sourceTabId: activeTabId,
    activeRunJob,
    status: SESSION_STATUS.scraped,
    llmProfileId: activeLlmProfile.id,
    llmProfileLabel: activeLlmProfile.label,
    jobSnapshot,
    jobId,
    originalResumeId: baseResumeId,
    tailoredResumeId: null,
    previewUrl: null,
    jobContextLinked: false,
    prompt4Input,
    prompt4Raw,
    prompt4Result,
    promptMetadata,
    prompt1Input: null,
    prompt1Raw: null,
    prompt1Result: null,
    prompt2Input: null,
    prompt2Raw: null,
    prompt2Result: null,
    prompt3Input: null,
    prompt3Raw: null,
    prompt3Parsed: null,
    prompt3Feedback: null,
    prompt3ValidationErrors: [],
    patchPayload: null,
    patchError: null,
    prompt1DurationMs: null,
    prompt2DurationMs: null,
    prompt3DurationMs: null,
    patchDurationMs: null,
    cancelReason: null,
    cancelPhase: null,
  });

  cancel.throwIfCanceled("resume clone");
  const cloneResponse = await cloneResume(baseResumeId, {
    signal: cancel.signal(),
  });
  cancel.throwIfCanceled("resume clone");
  const resumeId = cloneResponse?.data?.resume_id;
  if (!resumeId) {
    throw new Error("Clone response did not include a resume id.");
  }
  logInfo(
    "Orchestrator",
    "Cloned base resume and created job-specific resume.",
    { baseResumeId, resumeId },
  );
  await setExtensionState({
    selectedResumeId: resumeId,
    tailoredResumeId: resumeId,
  });
  cancel.throwIfCanceled("resume fetch");
  const fetchedResume = cloneResponse?.data
    ? cloneResponse
    : await fetchResumeById(resumeId, { signal: cancel.signal() });
  cancel.throwIfCanceled("resume fetch");
  let featureConfig;
  try {
    featureConfig = await fetchFeatureConfig({ signal: cancel.signal() });
  } catch (error) {
    if (isRunCanceledError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    logInfo(
      "Orchestrator",
      "Falling back to default fact-preservation setting after feature-config fetch failed.",
      {
        message,
        preserveGeneratedResumeFacts: true,
      },
    );
    featureConfig = { preserve_generated_resume_facts: true };
  }
  const preserveFactsEnabled =
    featureConfig?.preserve_generated_resume_facts !== false;
  const masterResumeData =
    fetchedResume?.data?.processed_resume ??
    cloneResponse?.data?.processed_resume ??
    null;
  const currentResume = resolveCurrentResumeSource(
    masterResumeContextAsset,
    fetchedResume,
  );
  const storyboard = ensureStoryboardContent(storyboardAsset);
  const promptContext = buildBasePromptContext({
    jobSnapshot,
    currentResume,
    storyboard,
    customInstruction: prompt1CustomInstruction,
    systemPrompt,
  });

  logInfo("Orchestrator", "Rendering Prompt 1.");
  const prompt1Rendered = await renderPrompt1WithMetadata(
    promptContext,
    activeLlmProfile,
  );
  const prompt1 = prompt1Rendered.text;
  prompt1Input = prompt1;
  promptMetadataByName.prompt1 = prompt1Rendered.metadata;
  await refreshPromptMetadata();
  await setExtensionState({
    prompt1Input,
    promptMetadata,
  });
  logPromptDebug("Prompt 1", "input", prompt1);

  logInfo("Orchestrator", "Running Prompt 1.");
  const prompt1StartedMs = Date.now();
  cancel.throwIfCanceled("Prompt 1");
  await captureExtensionEvent("prompt_stage_started", {
    surface: "run_view",
    run_id: runId,
    stage: 1,
    stage_label: "analyze_jd",
  });
  const prompt1Run = await runPrompt(prompt1, {
    profile: activeLlmProfile,
    promptLabel: "Prompt 1",
    systemPrompt,
    runId,
    signal: cancel.signal(),
    validateResponse: validatePrompt1RawOutput,
    buildRepairPrompt: buildPrompt1RepairPrompt,
    maxRepairAttempts: 1,
  });
  prompt1DurationMs = Date.now() - prompt1StartedMs;
  cancel.throwIfCanceled("Prompt 1");
  const prompt1Raw =
    prompt1Run.status === "success"
      ? prompt1Run.rawText
      : (prompt1Run.partialRawText ?? "");
  await setExtensionState({
    prompt1Raw,
    prompt1DurationMs,
  });
  if (prompt1Run.status === "canceled") {
    throwIfRunCanceled(runId, "Prompt 1");
  }
  if (prompt1Run.status !== "success") {
    logError("Orchestrator", "Prompt 1 failed.", prompt1Run);
    await captureExtensionEvent("prompt_stage_failed", {
      surface: "run_view",
      run_id: runId,
      stage: 1,
      stage_label: "analyze_jd",
      error_message: prompt1Run.message ?? "Prompt 1 failed.",
    });
    throw new Error(`Prompt 1 failed: ${prompt1Run.message}`);
  }
  if (prompt1Run.validationError) {
    logError("Orchestrator", "Prompt 1 failed validation after repair.", {
      validationError: prompt1Run.validationError,
      conversationUrl: prompt1Run.conversationUrl ?? null,
    });
    await captureExtensionEvent("prompt_stage_failed", {
      surface: "run_view",
      run_id: runId,
      stage: 1,
      stage_label: "analyze_jd",
      error_message: prompt1Run.validationError,
    });
    throw new Error(`Prompt 1 failed: ${prompt1Run.validationError}`);
  }
  logInfo("Orchestrator", "Parsing Prompt 1 output.");
  logPromptDebug("Prompt 1", "output", prompt1Raw);
  const prompt1Result = extractJsonFromText(prompt1Raw, {
    validate: (candidate) => validatePrompt1Data(candidate).length === 0,
  });
  promptContext.prompt1Json = prompt1Result;
  await setExtensionState({
    prompt1Raw,
    prompt1Result,
    prompt1DurationMs,
    promptMetadata,
    status: SESSION_STATUS.prompt1Done,
    resumeSource: currentResume,
  });
  await captureExtensionEvent("prompt_stage_succeeded", {
    surface: "run_view",
    run_id: runId,
    stage: 1,
    stage_label: "analyze_jd",
  });

  logInfo("Orchestrator", "Rendering Prompt 2.");
  const prompt2Rendered = await renderPrompt2WithMetadata(
    promptContext,
    activeLlmProfile,
  );
  const prompt2 = prompt2Rendered.text;
  prompt2Input = prompt2;
  promptMetadataByName.prompt2 = prompt2Rendered.metadata;
  await refreshPromptMetadata();
  await setExtensionState({
    prompt2Input,
    promptMetadata,
  });
  logPromptDebug("Prompt 2", "input", prompt2);
  logInfo("Orchestrator", "Running Prompt 2.");
  const prompt2StartedMs = Date.now();
  cancel.throwIfCanceled("Prompt 2");
  await captureExtensionEvent("prompt_stage_started", {
    surface: "run_view",
    run_id: runId,
    stage: 2,
    stage_label: "strategize_positioning",
  });
  const prompt2Run = await runPrompt(prompt2, {
    profile: activeLlmProfile,
    promptLabel: "Prompt 2",
    systemPrompt,
    runId,
    signal: cancel.signal(),
    validateResponse: validatePrompt2RawOutput,
    buildRepairPrompt: buildPrompt2RepairPrompt,
    maxRepairAttempts: 1,
  });
  prompt2DurationMs = Date.now() - prompt2StartedMs;
  cancel.throwIfCanceled("Prompt 2");
  const prompt2Raw =
    prompt2Run.status === "success"
      ? prompt2Run.rawText
      : (prompt2Run.partialRawText ?? "");
  await setExtensionState({
    prompt2Raw,
    prompt2DurationMs,
  });
  if (prompt2Run.status === "canceled") {
    throwIfRunCanceled(runId, "Prompt 2");
  }
  if (prompt2Run.status !== "success") {
    logError("Orchestrator", "Prompt 2 failed.", prompt2Run);
    await captureExtensionEvent("prompt_stage_failed", {
      surface: "run_view",
      run_id: runId,
      stage: 2,
      stage_label: "strategize_positioning",
      error_message: prompt2Run.message ?? "Prompt 2 failed.",
    });
    throw new Error(`Prompt 2 failed: ${prompt2Run.message}`);
  }
  if (prompt2Run.validationError) {
    logError("Orchestrator", "Prompt 2 failed validation after repair.", {
      validationError: prompt2Run.validationError,
      conversationUrl: prompt2Run.conversationUrl ?? null,
    });
    await captureExtensionEvent("prompt_stage_failed", {
      surface: "run_view",
      run_id: runId,
      stage: 2,
      stage_label: "strategize_positioning",
      error_message: prompt2Run.validationError,
    });
    throw new Error(`Prompt 2 failed: ${prompt2Run.validationError}`);
  }
  logInfo("Orchestrator", "Parsing Prompt 2 output.");
  logPromptDebug("Prompt 2", "output", prompt2Raw);
  const prompt2Result = extractJsonFromText(prompt2Raw, {
    validate: (candidate) => validatePrompt2Data(candidate).length === 0,
  });
  promptContext.prompt2Json = prompt2Result;
  await setExtensionState({
    prompt2Raw,
    prompt2Result,
    prompt2DurationMs,
    promptMetadata,
    status: SESSION_STATUS.prompt2Done,
  });
  await captureExtensionEvent("prompt_stage_succeeded", {
    surface: "run_view",
    run_id: runId,
    stage: 2,
    stage_label: "strategize_positioning",
  });

  logInfo("Orchestrator", "Rendering Prompt 3.");
  const prompt3Rendered = await renderPrompt3WithMetadata(
    promptContext,
    activeLlmProfile,
  );
  const prompt3 = prompt3Rendered.text;
  prompt3Input = prompt3;
  promptMetadataByName.prompt3 = prompt3Rendered.metadata;
  await refreshPromptMetadata();
  await setExtensionState({
    prompt3Input,
    promptMetadata,
  });
  logPromptDebug("Prompt 3", "input", prompt3);
  logInfo("Orchestrator", "Running Prompt 3.");
  const prompt3StartedMs = Date.now();
  cancel.throwIfCanceled("Prompt 3");
  await captureExtensionEvent("prompt_stage_started", {
    surface: "run_view",
    run_id: runId,
    stage: 3,
    stage_label: "write_tailored_resume",
  });
  const prompt3Run = await runPrompt(prompt3, {
    profile: activeLlmProfile,
    promptLabel: "Prompt 3",
    systemPrompt,
    runId,
    signal: cancel.signal(),
    validateResponse: validatePrompt3RawOutput,
    buildRepairPrompt: buildPrompt3RepairPrompt,
    maxRepairAttempts: 1,
  });
  const prompt3Raw =
    prompt3Run.status === "success"
      ? prompt3Run.rawText
      : (prompt3Run.partialRawText ?? "");
  prompt3DurationMs = Date.now() - prompt3StartedMs;
  await setExtensionState({
    prompt3Raw,
    prompt3DurationMs,
    status: SESSION_STATUS.prompt3Done,
  });
  cancel.throwIfCanceled("Prompt 3");
  if (prompt3Run.status === "canceled") {
    throwIfRunCanceled(runId, "Prompt 3");
  }
  if (prompt3Run.status !== "success") {
    logError("Orchestrator", "Prompt 3 failed.", prompt3Run);
    await captureExtensionEvent("prompt_stage_failed", {
      surface: "run_view",
      run_id: runId,
      stage: 3,
      stage_label: "write_tailored_resume",
      error_message: prompt3Run.message ?? "Prompt 3 failed.",
    });
    throw new Error(`Prompt 3 failed: ${prompt3Run.message}`);
  }
  if (prompt3Run.validationError) {
    logError("Orchestrator", "Prompt 3 failed validation after repair.", {
      validationError: prompt3Run.validationError,
      conversationUrl: prompt3Run.conversationUrl ?? null,
    });
    await captureExtensionEvent("prompt_stage_failed", {
      surface: "run_view",
      run_id: runId,
      stage: 3,
      stage_label: "write_tailored_resume",
      error_message: prompt3Run.validationError,
    });
    throw new Error(`Prompt 3 failed: ${prompt3Run.validationError}`);
  }

  logInfo("Orchestrator", "Parsing Prompt 3 output.");
  logPromptDebug("Prompt 3", "output", prompt3Raw);
  const prompt3Result = extractPrompt3PayloadFromText(prompt3Raw);
  const normalizedPrompt3Resume = stripPromptFlexNotesFromResumeData(
    normalizePrompt3ResumeData(prompt3Result.resumeData),
  );
  const prompt3WithPreservedFacts = preserveGeneratedResumeFacts(
    masterResumeData,
    normalizedPrompt3Resume,
    preserveFactsEnabled,
  );
  const prompt3Parsed = alignSectionMetaToSourceResume(
    masterResumeData,
    prompt3WithPreservedFacts,
  );
  const prompt3Feedback = prefixGenerationFeedbackSummary(
    normalizePrompt3Feedback(prompt3Result.generationFeedback),
    activeLlmProfile,
  );
  const serverPrompt2Artifact =
    stripPromptFlexNotesFromServerArtifact(prompt2Result);
  const patchPayload = {
    resume_data: prompt3Parsed,
    generation_feedback: prompt3Feedback,
    generation_artifacts: {
      prompt2: serverPrompt2Artifact,
    },
  };
  if (prompt3Result.usedLegacyShape) {
    logInfo(
      "Orchestrator",
      "Prompt 3 returned legacy ResumeData shape; continuing with wrapped patch payload.",
    );
  }
  logInfo("Orchestrator", "Validating Prompt 3 output.");
  const validationErrors = validateResumeData(prompt3Parsed);
  await setExtensionState({
    prompt3Parsed,
    prompt3Feedback,
    prompt3ValidationErrors: validationErrors,
    patchPayload,
    prompt3DurationMs,
    promptMetadata,
    status:
      validationErrors.length === 0
        ? SESSION_STATUS.validated
        : SESSION_STATUS.error,
  });

  if (validationErrors.length > 0) {
    logError("Orchestrator", "Prompt 3 validation failed.", {
      validationErrors,
    });
    await captureExtensionEvent("prompt_stage_failed", {
      surface: "run_view",
      run_id: runId,
      stage: 3,
      stage_label: "write_tailored_resume",
      error_message: validationErrors.join(" | "),
    });
    throw new Error(
      `Prompt 3 produced invalid ResumeData: ${validationErrors.join(" | ")}`,
    );
  }
  await captureExtensionEvent("prompt_stage_succeeded", {
    surface: "run_view",
    run_id: runId,
    stage: 3,
    stage_label: "write_tailored_resume",
  });

  function createHistoryEntry(status, previewUrl) {
    return {
      jobKey: jobSnapshot.sourceUrl,
      sourceUrl: jobSnapshot.sourceUrl,
      title: jobSnapshot.title,
      company: jobSnapshot.company,
      location: jobSnapshot.location ?? null,
      datePosted: jobSnapshot.datePosted ?? null,
      generatedAt: new Date().toISOString(),
      resumeId,
      previewUrl,
      status,
      runId,
      providerId: activeLlmProfile.id,
      providerLabel: activeLlmProfile.label,
      providerVendor: activeLlmProfile.vendor ?? null,
      providerMode: activeLlmProfile.mode ?? null,
      jobSource: jobSnapshot.source ?? null,
      jobReadiness: jobSnapshot.readiness ?? null,
      descriptionProvenance: jobSnapshot.provenance?.description ?? null,
      descriptionLength: jobSnapshot.quality?.descriptionLength ?? null,
      scrapeConfidence: jobSnapshot.quality?.confidence ?? null,
      manualJobInputUsed,
      customContextProvided,
      customContextLength: customContext.length,
      storyboardPresent: Boolean(storyboard),
      prompt1DurationMs,
      prompt2DurationMs,
      prompt3DurationMs,
      patchDurationMs,
      totalDurationMs: Date.now() - runStartedMs,
      prompt3ValidationErrorCount: validationErrors.length,
      promptMetadata,
      prompt4Input,
      prompt4Raw,
      prompt4Result,
      prompt1Input,
      prompt1Raw,
      prompt1Result,
      prompt2Input,
      prompt2Raw,
      prompt2Result,
      prompt3Input,
      prompt3Raw,
      prompt3Parsed,
      prompt3Feedback,
    };
  }

  try {
    logInfo("Orchestrator", "Patching generated resume.");
    cancel.throwIfCanceled("resume patch");
    const patchStartedMs = Date.now();
    await patchResume(
      resumeId,
      prompt3Parsed,
      prompt3Feedback,
      {
        prompt2: serverPrompt2Artifact,
      },
      { signal: cancel.signal() },
    );
    patchDurationMs = Date.now() - patchStartedMs;
    await setExtensionState({ patchDurationMs });
    cancel.throwIfCanceled("resume patch");
  } catch (error) {
    if (isRunCanceledError(error)) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Failed to patch resume.";
    logError("Orchestrator", "Resume patch failed.", { resumeId, message });
    await setExtensionState({
      patchError: message,
      status: SESSION_STATUS.error,
    });
    await upsertAndSyncHistoryEntry(
      createHistoryEntry(
        "patch_failed",
        await buildPreviewUrl(resumeId, {
          runId,
          source: "extension",
        }),
      ),
    );
    throw error;
  }

  try {
    logInfo("Orchestrator", "Linking generated resume to stored job context.", {
      baseResumeId,
      resumeId,
      jobId,
    });
    cancel.throwIfCanceled("job-context link");
    await linkResumeToJobContext(baseResumeId, resumeId, jobId, {
      signal: cancel.signal(),
    });
    cancel.throwIfCanceled("job-context link");
    await setExtensionState({ jobContextLinked: true });
  } catch (error) {
    if (isRunCanceledError(error)) {
      throw error;
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to link generated resume to job context.";
    logError(
      "Orchestrator",
      "Job-context link failed after successful patch.",
      {
        baseResumeId,
        resumeId,
        jobId,
        message,
      },
    );
    await setExtensionState({
      patchError: message,
      status: SESSION_STATUS.error,
      jobContextLinked: false,
    });
    await upsertAndSyncHistoryEntry(
      createHistoryEntry(
        "job_context_link_failed",
        await buildPreviewUrl(resumeId, {
          runId,
          source: "extension",
        }),
      ),
    );
    throw error;
  }

  try {
    logInfo(
      "Orchestrator",
      "Ensuring cover letter and outreach features are enabled.",
    );
    cancel.throwIfCanceled("feature enablement");
    await enableContentGenerationFeatures({ signal: cancel.signal() });
    cancel.throwIfCanceled("feature enablement");
  } catch (error) {
    if (isRunCanceledError(error)) {
      throw error;
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to enable content-generation features.";
    logError(
      "Orchestrator",
      "Feature enablement failed after successful job linkage.",
      {
        resumeId,
        jobId,
        message,
      },
    );
  }

  const generatedResumeTitle = buildResumeTitle(
    jobSnapshot.title,
    jobSnapshot.company,
  );
  if (generatedResumeTitle) {
    try {
      logInfo("Orchestrator", "Renaming generated resume.", {
        title: generatedResumeTitle,
      });
      cancel.throwIfCanceled("resume rename");
      await renameResume(resumeId, generatedResumeTitle, {
        signal: cancel.signal(),
      });
      cancel.throwIfCanceled("resume rename");
    } catch (error) {
      if (isRunCanceledError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Failed to rename resume.";
      logError("Orchestrator", "Resume rename failed after successful patch.", {
        resumeId,
        title: generatedResumeTitle,
        message,
      });
    }
  }

  cancel.throwIfCanceled("preview handoff");
  const previewUrl = await buildPreviewUrl(
    resumeId,
    {
      runId,
      source: "extension",
    },
    { signal: cancel.signal() },
  );
  await setExtensionState({
    status: SESSION_STATUS.patched,
    patchError: null,
    previewUrl,
    patchDurationMs,
    promptMetadata,
  });
  logInfo("Orchestrator", "Opening generated resume preview.", {
    resumeId,
    previewUrl,
  });
  markRunPreviewHandoffStarted(runId);
  await upsertAndSyncHistoryEntry(createHistoryEntry("generated", previewUrl));
  await captureExtensionEvent("tailor_completed", {
    surface: "run_view",
    run_id: runId,
    resume_id: resumeId,
    job_id: jobId,
    source_url: jobSnapshot.sourceUrl,
  });
  await openPreviewTab(previewUrl);

  return {
    resumeId,
    previewUrl,
    title: jobSnapshot.title,
    company: jobSnapshot.company,
  };
}
