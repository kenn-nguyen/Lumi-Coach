import { SESSION_STATUS } from "./constants.js";
import { runApifyLinkedInFallback } from "./apify.js";
import {
  extractJsonFromText,
  extractPrompt3PayloadFromText,
  extractPrompt4ResumeDataFromText,
} from "./json.js";
import { evaluateJobDescriptionGuardrail } from "./job-guardrail.js";
import {
  renderPrompt1,
  renderPrompt2,
  renderPrompt3,
  renderPrompt4,
} from "./prompt-loader.js";
import { scrapeLinkedInJob } from "./linkedin.js";
import { validateResumeData } from "./validation.js";
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
  upsertHistoryEntry,
} from "./storage.js";
import { captureExtensionEvent } from "./analytics.js";
import { getActiveLlmProfile } from "./llm/profiles.js";
import { runPrompt } from "./llm/runners.js";

export async function saveStoryboardAsset(payload) {
  await setStoryboardAsset({
    filename: payload.filename,
    content: payload.content,
    uploadedAt: new Date().toISOString(),
  });
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
  const localContext = masterResumeContextAsset?.content?.trim();
  if (localContext) {
    return localContext;
  }
  return toResumeSource(fetchedResume);
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

const PRESERVED_EXPERIENCE_FIELDS = ["title", "company", "years"];

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

function preserveGeneratedResumeFacts(
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

function normalizePrompt3Feedback(feedback) {
  const normalized = replaceEmDashCharacters(feedback);
  if (!normalized || typeof normalized !== "object") {
    return normalized;
  }

  return normalized;
}

function isKennNguyenName(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.includes("kenn") && normalized.includes("nguyen");
}

function stripTrailingPeriodForCustomSuffix(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trimEnd();
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

function findExperienceIndexByCompany(workExperience, matcher) {
  if (!Array.isArray(workExperience)) {
    return -1;
  }

  return workExperience.findIndex((item) => {
    const company =
      typeof item?.company === "string" ? item.company.toLowerCase() : "";
    return matcher(company);
  });
}

function appendUniqueBullet(workExperienceItem, bulletText) {
  if (!workExperienceItem || typeof workExperienceItem !== "object") {
    return workExperienceItem;
  }

  const description = Array.isArray(workExperienceItem.description)
    ? [...workExperienceItem.description]
    : [];
  if (!description.includes(bulletText)) {
    description.push(bulletText);
  }

  return {
    ...workExperienceItem,
    description,
  };
}

function appendSuffixToFirstBullet(workExperienceItem, suffix) {
  if (!workExperienceItem || typeof workExperienceItem !== "object") {
    return workExperienceItem;
  }

  const description = Array.isArray(workExperienceItem.description)
    ? [...workExperienceItem.description]
    : [];
  if (!description.length || typeof description[0] !== "string") {
    return workExperienceItem;
  }

  if (description[0].includes(suffix)) {
    return workExperienceItem;
  }

  description[0] =
    `${stripTrailingPeriodForCustomSuffix(description[0])} ${suffix}`.trim();

  return {
    ...workExperienceItem,
    description,
  };
}

function applyKennNguyenCustomFeature(resumeData, enabled) {
  if (!enabled || !resumeData || typeof resumeData !== "object") {
    return resumeData;
  }

  if (!isKennNguyenName(resumeData.personalInfo?.name)) {
    return resumeData;
  }

  if (
    !Array.isArray(resumeData.workExperience) ||
    resumeData.workExperience.length === 0
  ) {
    return resumeData;
  }

  const nextResume = {
    ...resumeData,
    workExperience: [...resumeData.workExperience],
  };

  const trustingSocialIndex = findExperienceIndexByCompany(
    nextResume.workExperience,
    (company) => company.includes("trusting social"),
  );
  if (trustingSocialIndex >= 0) {
    nextResume.workExperience[trustingSocialIndex] = appendUniqueBullet(
      nextResume.workExperience[trustingSocialIndex],
      "(Trusting Social is a Sequoia-backed, Series D startup, $400M+ valuation)",
    );
  }

  const paypalIndex = findExperienceIndexByCompany(
    nextResume.workExperience,
    (company) => company.includes("paypal"),
  );
  if (paypalIndex >= 0) {
    nextResume.workExperience[paypalIndex] = appendSuffixToFirstBullet(
      nextResume.workExperience[paypalIndex],
      "- (Consulting project)",
    );
  }

  const infineonIndex = findExperienceIndexByCompany(
    nextResume.workExperience,
    (company) => company.includes("infineon"),
  );
  if (infineonIndex >= 0) {
    nextResume.workExperience[infineonIndex] = appendSuffixToFirstBullet(
      nextResume.workExperience[infineonIndex],
      "- (Internship, Infineon is a top global semiconductor & IoT company with >50,000 employees)",
    );
  }

  return nextResume;
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

function validatePrompt3RawOutput(rawText) {
  try {
    const prompt3Result = extractPrompt3PayloadFromText(rawText);
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

function buildPrompt3RepairPrompt({ validationMessage, promptLabel, attempt }) {
  return [
    `Your previous ${promptLabel ?? "Prompt 3"} response was invalid.`,
    `Validation issue: ${validationMessage}`,
    "Return corrected JSON only.",
    "Do not include markdown fences, commentary, or prose before or after the JSON.",
    "The top-level object must contain `resume_data`.",
    "`generation_feedback` is optional, but if present it must be valid JSON with `summary`, `pros`, `cons`, and `caveats`.",
    "Do not use the em dash character `—`; use a normal hyphen `-` instead.",
    "Do not end resume bullet strings with a period `.`.",
    "Do not return the empty schema template. Reuse the same resume content you already generated, but fix the JSON format and schema issues.",
    `This is repair attempt ${attempt}.`,
  ].join("\n");
}

function validatePrompt4RawOutput(rawText) {
  try {
    const resumeData = extractPrompt4ResumeDataFromText(rawText);
    const validationErrors = validateResumeData(
      normalizePrompt3ResumeData(resumeData),
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

function buildPrompt4RepairPrompt({ validationMessage, promptLabel, attempt }) {
  return [
    `Your previous ${promptLabel ?? "Prompt 4"} response was invalid.`,
    `Validation issue: ${validationMessage}`,
    "Return corrected JSON only.",
    "Do not include markdown fences, commentary, or prose before or after the JSON.",
    "Return only the ResumeData object itself. Do not wrap it in `resume_data`.",
    "Do not include `generation_feedback`, explanations, notes, or any other top-level keys.",
    "Do not use the em dash character `—`; use a normal hyphen `-` instead.",
    "Do not return the empty schema template. Reuse the same resume facts you already extracted, but fix the JSON format and schema issues.",
    `This is repair attempt ${attempt}.`,
  ].join("\n");
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
}) {
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
  });

  try {
    const prompt4 = await renderPrompt4(
      {
        currentResume: localResumeMarkdown,
        systemPrompt,
      },
      activeLlmProfile,
    );
    logPromptDebug("Prompt 4", "input", prompt4);
    logInfo("Orchestrator", "Running Prompt 4.");

    const prompt4Run = await runPrompt(prompt4, {
      profile: activeLlmProfile,
      promptLabel: "Prompt 4",
      systemPrompt,
      validateResponse: validatePrompt4RawOutput,
      buildRepairPrompt: buildPrompt4RepairPrompt,
      maxRepairAttempts: 1,
    });

    const prompt4Raw =
      prompt4Run.status === "success"
        ? prompt4Run.rawText
        : (prompt4Run.partialRawText ?? "");

    if (prompt4Run.status !== "success") {
      logError("Orchestrator", "Prompt 4 failed.", prompt4Run);
      throw new Error(`Prompt 4 failed: ${prompt4Run.message}`);
    }

    if (prompt4Run.validationError) {
      logError("Orchestrator", "Prompt 4 failed validation after repair.", {
        validationError: prompt4Run.validationError,
        conversationUrl: prompt4Run.conversationUrl ?? null,
      });
      throw new Error(`Prompt 4 failed: ${prompt4Run.validationError}`);
    }

    logInfo("Orchestrator", "Parsing Prompt 4 output.");
    logPromptDebug("Prompt 4", "output", prompt4Raw);
    const parsedResumeData = normalizePrompt3ResumeData(
      extractPrompt4ResumeDataFromText(prompt4Raw),
    );
    const validationErrors = validateResumeData(parsedResumeData);
    if (validationErrors.length > 0) {
      throw new Error(
        `Prompt 4 produced invalid ResumeData: ${validationErrors.join(" | ")}`,
      );
    }

    const uploadResponse = await uploadStructuredResume(
      buildBootstrappedMasterFilename(masterResumeContextAsset),
      parsedResumeData,
    );
    if (!uploadResponse?.resume_id) {
      throw new Error(
        "Prompt 4 finished, but Lumi Coach did not return a master resume id.",
      );
    }

    logInfo("Orchestrator", "Created backend master resume from Prompt 4.", {
      resumeId: uploadResponse.resume_id,
      processingStatus: uploadResponse.processing_status ?? null,
    });
    return uploadResponse.resume_id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setExtensionState({
      patchError: message,
      status: SESSION_STATUS.error,
    });
    throw error instanceof Error ? error : new Error(message);
  }
}

async function resolveBaseResumeId({
  masterResumeContextAsset,
  activeLlmProfile,
  systemPrompt,
  activeRunJob,
  sourceTabId,
}) {
  const resumeList = await listResumes(true);
  const masterResume = resumeList?.data?.find((resume) => resume?.is_master);
  if (!masterResume?.resume_id) {
    return bootstrapMasterResumeFromMarkdown({
      masterResumeContextAsset,
      activeLlmProfile,
      systemPrompt,
      activeRunJob,
      sourceTabId,
    });
  }
  return masterResume.resume_id;
}

export async function generateResumeForLinkedInJob(
  tabId,
  prompt1CustomInstruction = "",
  jobInput = null,
) {
  logInfo("Orchestrator", "Generate flow started.", { tabId });
  logInfo("Orchestrator", "Loading local assets.");
  const {
    masterResumeContextAsset,
    storyboardAsset,
    systemPromptTemplateAsset,
    llmSettings,
    customFeatureEnabled,
    apifyFallbackSettings,
  } = await getUserAssets();
  const activeLlmProfile = getActiveLlmProfile(llmSettings);
  const systemPrompt = systemPromptTemplateAsset?.content?.trim() || "";
  const currentExtensionState = await getExtensionState();
  const runId = currentExtensionState?.sessionId ?? null;

  const activeTabId = await getActiveLinkedInTabId(tabId);
  logInfo("Orchestrator", "Using active LinkedIn tab.", { activeTabId });
  const jobSnapshot = await resolveValidatedJobSnapshot({
    activeTabId,
    jobInput,
    activeLlmProfile,
    systemPrompt,
    apifyFallbackSettings,
  });
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
  const baseResumeId = await resolveBaseResumeId({
    masterResumeContextAsset,
    activeLlmProfile,
    systemPrompt,
    activeRunJob,
    sourceTabId: activeTabId,
  });
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
  const jobUploadResponse = await uploadJobDescription(
    uploadedJobDescription,
    baseResumeId,
  );
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
    prompt1Result: null,
    prompt2Result: null,
    prompt3Raw: null,
    prompt3Parsed: null,
    prompt3Feedback: null,
    prompt3ValidationErrors: [],
    patchPayload: null,
    patchError: null,
  });

  const cloneResponse = await cloneResume(baseResumeId);
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
  const fetchedResume = cloneResponse?.data
    ? cloneResponse
    : await fetchResumeById(resumeId);
  let featureConfig;
  try {
    featureConfig = await fetchFeatureConfig();
  } catch (error) {
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
  const prompt1 = await renderPrompt1(promptContext, activeLlmProfile);
  logPromptDebug("Prompt 1", "input", prompt1);

  logInfo("Orchestrator", "Running Prompt 1.");
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
  });
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
  logInfo("Orchestrator", "Parsing Prompt 1 output.");
  logPromptDebug("Prompt 1", "output", prompt1Run.rawText);
  const prompt1Result = extractJsonFromText(prompt1Run.rawText);
  promptContext.prompt1Json = prompt1Result;
  await setExtensionState({
    prompt1Result,
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
  const prompt2 = await renderPrompt2(promptContext, activeLlmProfile);
  logPromptDebug("Prompt 2", "input", prompt2);
  logInfo("Orchestrator", "Running Prompt 2.");
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
  });
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
  logInfo("Orchestrator", "Parsing Prompt 2 output.");
  logPromptDebug("Prompt 2", "output", prompt2Run.rawText);
  const prompt2Result = extractJsonFromText(prompt2Run.rawText);
  promptContext.prompt2Json = prompt2Result;
  await setExtensionState({
    prompt2Result,
    status: SESSION_STATUS.prompt2Done,
  });
  await captureExtensionEvent("prompt_stage_succeeded", {
    surface: "run_view",
    run_id: runId,
    stage: 2,
    stage_label: "strategize_positioning",
  });

  logInfo("Orchestrator", "Rendering Prompt 3.");
  const prompt3 = await renderPrompt3(promptContext, activeLlmProfile);
  logPromptDebug("Prompt 3", "input", prompt3);
  logInfo("Orchestrator", "Running Prompt 3.");
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
    validateResponse: validatePrompt3RawOutput,
    buildRepairPrompt: buildPrompt3RepairPrompt,
    maxRepairAttempts: 1,
  });
  const prompt3Raw =
    prompt3Run.status === "success"
      ? prompt3Run.rawText
      : (prompt3Run.partialRawText ?? "");
  await setExtensionState({ prompt3Raw, status: SESSION_STATUS.prompt3Done });
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
  const normalizedPrompt3Resume = normalizePrompt3ResumeData(
    prompt3Result.resumeData,
  );
  const prompt3Parsed = applyKennNguyenCustomFeature(
    preserveGeneratedResumeFacts(
      masterResumeData,
      normalizedPrompt3Resume,
      preserveFactsEnabled,
    ),
    customFeatureEnabled,
  );
  if (
    customFeatureEnabled &&
    isKennNguyenName(prompt3Parsed?.personalInfo?.name)
  ) {
    logInfo(
      "Orchestrator",
      "Applied custom feature adjustments for Kenn Nguyen.",
      {
        resumeId,
      },
    );
  }
  const prompt3Feedback = prefixGenerationFeedbackSummary(
    normalizePrompt3Feedback(prompt3Result.generationFeedback),
    activeLlmProfile,
  );
  const patchPayload = {
    resume_data: prompt3Parsed,
    generation_feedback: prompt3Feedback,
    generation_artifacts: {
      prompt2: prompt2Result,
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

  try {
    logInfo("Orchestrator", "Patching generated resume.");
    await patchResume(resumeId, prompt3Parsed, prompt3Feedback, {
      prompt2: prompt2Result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to patch resume.";
    logError("Orchestrator", "Resume patch failed.", { resumeId, message });
    await setExtensionState({
      patchError: message,
      status: SESSION_STATUS.error,
    });
    await upsertHistoryEntry({
      jobKey: jobSnapshot.sourceUrl,
      sourceUrl: jobSnapshot.sourceUrl,
      title: jobSnapshot.title,
      company: jobSnapshot.company,
      datePosted: jobSnapshot.datePosted ?? null,
      generatedAt: new Date().toISOString(),
      resumeId,
      previewUrl: await buildPreviewUrl(resumeId, {
        runId,
        source: "extension",
      }),
      status: "patch_failed",
    });
    throw error;
  }

  try {
    logInfo("Orchestrator", "Linking generated resume to stored job context.", {
      baseResumeId,
      resumeId,
      jobId,
    });
    await linkResumeToJobContext(baseResumeId, resumeId, jobId);
    await setExtensionState({ jobContextLinked: true });
  } catch (error) {
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
    await upsertHistoryEntry({
      jobKey: jobSnapshot.sourceUrl,
      sourceUrl: jobSnapshot.sourceUrl,
      title: jobSnapshot.title,
      company: jobSnapshot.company,
      datePosted: jobSnapshot.datePosted ?? null,
      generatedAt: new Date().toISOString(),
      resumeId,
      previewUrl: await buildPreviewUrl(resumeId, {
        runId,
        source: "extension",
      }),
      status: "job_context_link_failed",
    });
    throw error;
  }

  try {
    logInfo(
      "Orchestrator",
      "Ensuring cover letter and outreach features are enabled.",
    );
    await enableContentGenerationFeatures();
  } catch (error) {
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
      await renameResume(resumeId, generatedResumeTitle);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rename resume.";
      logError("Orchestrator", "Resume rename failed after successful patch.", {
        resumeId,
        title: generatedResumeTitle,
        message,
      });
    }
  }

  const previewUrl = await buildPreviewUrl(resumeId, {
    runId,
    source: "extension",
  });
  await setExtensionState({
    status: SESSION_STATUS.patched,
    patchError: null,
    previewUrl,
  });
  logInfo("Orchestrator", "Opening generated resume preview.", {
    resumeId,
    previewUrl,
  });
  await upsertHistoryEntry({
    jobKey: jobSnapshot.sourceUrl,
    sourceUrl: jobSnapshot.sourceUrl,
    title: jobSnapshot.title,
    company: jobSnapshot.company,
    datePosted: jobSnapshot.datePosted ?? null,
    generatedAt: new Date().toISOString(),
    resumeId,
    previewUrl,
    status: "generated",
  });
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
