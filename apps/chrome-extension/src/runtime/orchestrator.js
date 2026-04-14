import { SESSION_STATUS } from './constants.js';
import { extractJsonFromText, extractPrompt3PayloadFromText } from './json.js';
import { renderPrompt1, renderPrompt2, renderPrompt3 } from './prompt-loader.js';
import { scrapeLinkedInJob } from './linkedin.js';
import { validateResumeData } from './validation.js';
import {
  buildPreviewUrl,
  cloneResume,
  fetchResumeById,
  listResumes,
  openPreviewTab,
  patchResume,
  renameResume,
} from './api.js';
import { logError, logInfo } from './log.js';
import {
  getUserAssets,
  setExtensionState,
  setStoryboardAsset,
  upsertHistoryEntry,
} from './storage.js';
import { getActiveLlmProfile } from './llm/profiles.js';
import { runPrompt } from './llm/runners.js';

export async function saveStoryboardAsset(payload) {
  await setStoryboardAsset({
    filename: payload.filename,
    content: payload.content,
    uploadedAt: new Date().toISOString(),
  });
}

async function getActiveLinkedInTabId(tabId) {
  if (tabId) return tabId;
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeTab = tabs[0];
  if (!activeTab?.id || !activeTab.url?.startsWith('https://www.linkedin.com/jobs/')) {
    throw new Error('Open a LinkedIn job page in the active tab before generating a tailored resume.');
  }
  return activeTab.id;
}

function toResumeSource(resumePayload) {
  return resumePayload.data.processed_resume ?? resumePayload.data.raw_resume?.content ?? '';
}

function ensureStoryboardContent(storyboardAsset) {
  if (!storyboardAsset?.content?.trim()) {
    throw new Error('Upload a storyboard before generating a tailored resume.');
  }
  return storyboardAsset.content.trim();
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

function prefixGenerationFeedbackSummary(feedback, profile) {
  if (!feedback || typeof feedback !== 'object') {
    return feedback;
  }

  const providerLabel = typeof profile?.label === 'string' ? profile.label.trim().toUpperCase() : '';
  if (!providerLabel) {
    return feedback;
  }

  const summary = typeof feedback.summary === 'string' ? feedback.summary.trim() : '';
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
        message: validationErrors.join(' | '),
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : 'Unable to parse JSON from model output.',
    };
  }
}

function buildPrompt3RepairPrompt({ validationMessage, promptLabel, attempt }) {
  return [
    `Your previous ${promptLabel ?? 'Prompt 3'} response was invalid.`,
    `Validation issue: ${validationMessage}`,
    'Return corrected JSON only.',
    'Do not include markdown fences, commentary, or prose before or after the JSON.',
    'The top-level object must contain `resume_data`.',
    '`generation_feedback` is optional, but if present it must be valid JSON with `summary`, `pros`, `cons`, and `caveats`.',
    'Do not return the empty schema template. Reuse the same resume content you already generated, but fix the JSON format and schema issues.',
    `This is repair attempt ${attempt}.`,
  ].join('\n');
}

async function resolveBaseResumeId(storedResumeId) {
  const resumeList = await listResumes(true);
  const masterResume = resumeList?.data?.find((resume) => resume?.is_master);
  if (!masterResume?.resume_id) {
    throw new Error('No master resume was found in Resume Matcher. Upload one in the app first.');
  }
  return masterResume.resume_id;
}

export async function generateResumeForLinkedInJob(tabId, prompt1CustomInstruction = '') {
  logInfo('Orchestrator', 'Generate flow started.', { tabId });
  logInfo('Orchestrator', 'Loading local assets.');
  const { masterResumeContextAsset, storyboardAsset, systemPromptTemplateAsset, llmSettings } = await getUserAssets();
  const activeLlmProfile = getActiveLlmProfile(llmSettings);
  const systemPrompt = systemPromptTemplateAsset?.content?.trim() || '';

  const activeTabId = await getActiveLinkedInTabId(tabId);
  logInfo('Orchestrator', 'Using active LinkedIn tab.', { activeTabId });
  const jobSnapshot = await scrapeLinkedInJob(activeTabId);
  logInfo('Orchestrator', 'LinkedIn scrape completed.', {
    sourceUrl: jobSnapshot.sourceUrl,
    title: jobSnapshot.title,
    company: jobSnapshot.company,
    rawTextLength: jobSnapshot.rawText.length,
  });
  await setExtensionState({
    sessionId: crypto.randomUUID(),
    status: SESSION_STATUS.scraped,
    llmProfileId: activeLlmProfile.id,
    llmProfileLabel: activeLlmProfile.label,
    jobSnapshot,
    prompt1Result: null,
    prompt2Result: null,
    prompt3Raw: null,
    prompt3Parsed: null,
    prompt3Feedback: null,
    prompt3ValidationErrors: [],
    patchPayload: null,
    patchError: null,
  });

  logInfo('Orchestrator', 'Resolving base resume.');
  const baseResumeId = await resolveBaseResumeId();
  logInfo('Orchestrator', 'Resolved base resume for cloning.', { baseResumeId });
  const cloneResponse = await cloneResume(baseResumeId);
  const resumeId = cloneResponse?.data?.resume_id;
  if (!resumeId) {
    throw new Error('Clone response did not include a resume id.');
  }
  logInfo('Orchestrator', 'Cloned base resume and created job-specific resume.', { baseResumeId, resumeId });
  const fetchedResume = cloneResponse?.data ? cloneResponse : await fetchResumeById(resumeId);
  const currentResume = resolveCurrentResumeSource(masterResumeContextAsset, fetchedResume);
  const storyboard = ensureStoryboardContent(storyboardAsset);

  logInfo('Orchestrator', 'Rendering Prompt 1.');
  const prompt1 = await renderPrompt1({
    jobTitle: jobSnapshot.title,
    company: jobSnapshot.company,
    location: jobSnapshot.location,
    sourceUrl: jobSnapshot.sourceUrl,
    extractedAt: jobSnapshot.extractedAt,
    jobDescriptionRawText: jobSnapshot.rawText,
    customInstruction: prompt1CustomInstruction,
  }, activeLlmProfile);

  logInfo('Orchestrator', 'Running Prompt 1.');
  const prompt1Run = await runPrompt(prompt1, { profile: activeLlmProfile, promptLabel: 'Prompt 1', systemPrompt });
  if (prompt1Run.status !== 'success') {
    logError('Orchestrator', 'Prompt 1 failed.', prompt1Run);
    throw new Error(`Prompt 1 failed: ${prompt1Run.message}`);
  }
  logInfo('Orchestrator', 'Parsing Prompt 1 output.');
  const prompt1Result = extractJsonFromText(prompt1Run.rawText);
  await setExtensionState({ selectedResumeId: resumeId, prompt1Result, status: SESSION_STATUS.prompt1Done, resumeSource: currentResume });

  logInfo('Orchestrator', 'Rendering Prompt 2.');
  const prompt2 = await renderPrompt2({ prompt1Json: prompt1Result }, activeLlmProfile);
  logInfo('Orchestrator', 'Running Prompt 2.');
  const prompt2Run = await runPrompt(prompt2, { profile: activeLlmProfile, promptLabel: 'Prompt 2', systemPrompt });
  if (prompt2Run.status !== 'success') {
    logError('Orchestrator', 'Prompt 2 failed.', prompt2Run);
    throw new Error(`Prompt 2 failed: ${prompt2Run.message}`);
  }
  logInfo('Orchestrator', 'Parsing Prompt 2 output.');
  const prompt2Result = extractJsonFromText(prompt2Run.rawText);
  await setExtensionState({ prompt2Result, status: SESSION_STATUS.prompt2Done });

  logInfo('Orchestrator', 'Rendering Prompt 3.');
  const prompt3 = await renderPrompt3({
    prompt2Json: prompt2Result,
    currentResume,
    storyboard,
  }, activeLlmProfile);
  logInfo('Orchestrator', 'Running Prompt 3.');
  const prompt3Run = await runPrompt(prompt3, {
    profile: activeLlmProfile,
    promptLabel: 'Prompt 3',
    systemPrompt,
    validateResponse: validatePrompt3RawOutput,
    buildRepairPrompt: buildPrompt3RepairPrompt,
    maxRepairAttempts: 1,
  });
  const prompt3Raw = prompt3Run.status === 'success' ? prompt3Run.rawText : prompt3Run.partialRawText ?? '';
  await setExtensionState({ prompt3Raw, status: SESSION_STATUS.prompt3Done });
  if (prompt3Run.status !== 'success') {
    logError('Orchestrator', 'Prompt 3 failed.', prompt3Run);
    throw new Error(`Prompt 3 failed: ${prompt3Run.message}`);
  }
  if (prompt3Run.validationError) {
    logError('Orchestrator', 'Prompt 3 failed validation after repair.', {
      validationError: prompt3Run.validationError,
      conversationUrl: prompt3Run.conversationUrl ?? null,
    });
    throw new Error(`Prompt 3 failed: ${prompt3Run.validationError}`);
  }

  logInfo('Orchestrator', 'Parsing Prompt 3 output.');
  const prompt3Result = extractPrompt3PayloadFromText(prompt3Raw);
  const prompt3Parsed = prompt3Result.resumeData;
  const prompt3Feedback = prefixGenerationFeedbackSummary(
    prompt3Result.generationFeedback,
    activeLlmProfile
  );
  const patchPayload = {
    resume_data: prompt3Parsed,
    generation_feedback: prompt3Feedback,
  };
  if (prompt3Result.usedLegacyShape) {
    logInfo('Orchestrator', 'Prompt 3 returned legacy ResumeData shape; continuing with wrapped patch payload.');
  }
  logInfo('Orchestrator', 'Validating Prompt 3 output.');
  const validationErrors = validateResumeData(prompt3Parsed);
  await setExtensionState({
    prompt3Parsed,
    prompt3Feedback,
    prompt3ValidationErrors: validationErrors,
    patchPayload,
    status: validationErrors.length === 0 ? SESSION_STATUS.validated : SESSION_STATUS.error,
  });

  if (validationErrors.length > 0) {
    logError('Orchestrator', 'Prompt 3 validation failed.', { validationErrors });
    throw new Error(`Prompt 3 produced invalid ResumeData: ${validationErrors.join(' | ')}`);
  }

  try {
    logInfo('Orchestrator', 'Patching generated resume.');
    await patchResume(resumeId, prompt3Parsed, prompt3Feedback);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to patch resume.';
    logError('Orchestrator', 'Resume patch failed.', { resumeId, message });
    await setExtensionState({ patchError: message, status: SESSION_STATUS.error });
    await upsertHistoryEntry({
      jobKey: jobSnapshot.sourceUrl,
      title: jobSnapshot.title,
      company: jobSnapshot.company,
      datePosted: jobSnapshot.datePosted ?? null,
      generatedAt: new Date().toISOString(),
      resumeId,
      previewUrl: await buildPreviewUrl(resumeId),
      status: 'patch_failed',
    });
    throw error;
  }

  const generatedResumeTitle = buildResumeTitle(jobSnapshot.title, jobSnapshot.company);
  if (generatedResumeTitle) {
    try {
      logInfo('Orchestrator', 'Renaming generated resume.', { title: generatedResumeTitle });
      await renameResume(resumeId, generatedResumeTitle);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename resume.';
      logError('Orchestrator', 'Resume rename failed after successful patch.', {
        resumeId,
        title: generatedResumeTitle,
        message,
      });
    }
  }

  const previewUrl = await buildPreviewUrl(resumeId);
  await setExtensionState({ status: SESSION_STATUS.patched, patchError: null });
  logInfo('Orchestrator', 'Opening generated resume preview.', { resumeId, previewUrl });
  await upsertHistoryEntry({
    jobKey: jobSnapshot.sourceUrl,
    title: jobSnapshot.title,
    company: jobSnapshot.company,
    datePosted: jobSnapshot.datePosted ?? null,
    generatedAt: new Date().toISOString(),
    resumeId,
    previewUrl,
    status: 'generated',
  });
  await openPreviewTab(previewUrl);

  return {
    resumeId,
    previewUrl,
    title: jobSnapshot.title,
    company: jobSnapshot.company,
  };
}
