import { SESSION_STATUS } from './constants.js';
import { extractJsonFromText, extractPrompt3PayloadFromText } from './json.js';
import { renderPrompt1, renderPrompt2, renderPrompt3 } from './prompt-loader.js';
import { scrapeLinkedInJob } from './linkedin.js';
import { validateResumeData } from './validation.js';
import {
  buildPreviewUrl,
  cloneResume,
  fetchFeatureConfig,
  enableContentGenerationFeatures,
  fetchResumeById,
  linkResumeToJobContext,
  listResumes,
  openPreviewTab,
  patchResume,
  renameResume,
  uploadJobDescription,
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

function buildStoredJobDescription(jobSnapshot) {
  const parts = [
    jobSnapshot?.title ? `Title: ${jobSnapshot.title}` : null,
    jobSnapshot?.company ? `Company: ${jobSnapshot.company}` : null,
    jobSnapshot?.location ? `Location: ${jobSnapshot.location}` : null,
    jobSnapshot?.sourceUrl ? `Source URL: ${jobSnapshot.sourceUrl}` : null,
    null,
    jobSnapshot?.rawText?.trim() || '',
  ].filter((part) => part !== null);
  return parts.join('\n').trim();
}

function logPromptDebug(label, stage, payload) {
  logInfo('PromptDebug', `${label} ${stage}.`, {
    label,
    stage,
    payload,
  });
}

const PRESERVED_PERSONAL_INFO_FIELDS = [
  'name',
  'customTagline',
  'email',
  'phone',
  'location',
  'website',
  'linkedin',
  'github',
];

const PRESERVED_EXPERIENCE_FIELDS = ['title', 'company', 'years'];

function preserveExperienceFacts(masterExperience, generatedExperience) {
  if (!Array.isArray(masterExperience) || !Array.isArray(generatedExperience)) {
    return generatedExperience;
  }

  const masterById = new Map(
    masterExperience
      .filter((item) => item && typeof item === 'object' && Number.isInteger(item.id))
      .map((item) => [item.id, item])
  );

  return generatedExperience.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return item;
    }
    let masterItem = Number.isInteger(item.id) ? masterById.get(item.id) : null;
    if (!masterItem && index < masterExperience.length) {
      const fallback = masterExperience[index];
      if (fallback && typeof fallback === 'object') {
        masterItem = fallback;
      }
    }
    if (!masterItem || typeof masterItem !== 'object') {
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

function preserveGeneratedResumeFacts(masterResumeData, generatedResumeData, enabled) {
  if (!enabled || !masterResumeData || typeof masterResumeData !== 'object' || !generatedResumeData || typeof generatedResumeData !== 'object') {
    return generatedResumeData;
  }

  const nextResume = { ...generatedResumeData };
  const masterPersonalInfo = masterResumeData.personalInfo;
  const generatedPersonalInfo = nextResume.personalInfo;
  if (masterPersonalInfo && typeof masterPersonalInfo === 'object') {
    const nextPersonalInfo = generatedPersonalInfo && typeof generatedPersonalInfo === 'object'
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
    generatedResumeData.workExperience
  );

  return nextResume;
}

function replaceEmDashCharacters(value) {
  if (typeof value === 'string') {
    return value.replace(/—/g, '-');
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceEmDashCharacters(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, replaceEmDashCharacters(nested)])
    );
  }
  return value;
}

function stripBulletTerminalPeriod(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trimEnd();
  if (!trimmed.endsWith('.')) {
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
  if (!normalized || typeof normalized !== 'object') {
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

  if (nextResume.customSections && typeof nextResume.customSections === 'object') {
    nextResume.customSections = Object.fromEntries(
      Object.entries(nextResume.customSections).map(([key, section]) => {
        if (
          section &&
          typeof section === 'object' &&
          section.sectionType === 'itemList' &&
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
      })
    );
  }

  return nextResume;
}

function normalizePrompt3Feedback(feedback) {
  const normalized = replaceEmDashCharacters(feedback);
  if (!normalized || typeof normalized !== 'object') {
    return normalized;
  }

  return normalized;
}

function isKennNguyenName(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized.includes('kenn') && normalized.includes('nguyen');
}

function stripTrailingPeriodForCustomSuffix(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trimEnd();
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
}

function findExperienceIndexByCompany(workExperience, matcher) {
  if (!Array.isArray(workExperience)) {
    return -1;
  }

  return workExperience.findIndex((item) => {
    const company = typeof item?.company === 'string' ? item.company.toLowerCase() : '';
    return matcher(company);
  });
}

function appendUniqueBullet(workExperienceItem, bulletText) {
  if (!workExperienceItem || typeof workExperienceItem !== 'object') {
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
  if (!workExperienceItem || typeof workExperienceItem !== 'object') {
    return workExperienceItem;
  }

  const description = Array.isArray(workExperienceItem.description)
    ? [...workExperienceItem.description]
    : [];
  if (!description.length || typeof description[0] !== 'string') {
    return workExperienceItem;
  }

  if (description[0].includes(suffix)) {
    return workExperienceItem;
  }

  description[0] = `${stripTrailingPeriodForCustomSuffix(description[0])} ${suffix}`.trim();

  return {
    ...workExperienceItem,
    description,
  };
}

function applyKennNguyenCustomFeature(resumeData, enabled) {
  if (!enabled || !resumeData || typeof resumeData !== 'object') {
    return resumeData;
  }

  if (!isKennNguyenName(resumeData.personalInfo?.name)) {
    return resumeData;
  }

  if (!Array.isArray(resumeData.workExperience) || resumeData.workExperience.length === 0) {
    return resumeData;
  }

  const nextResume = {
    ...resumeData,
    workExperience: [...resumeData.workExperience],
  };

  const trustingSocialIndex = findExperienceIndexByCompany(
    nextResume.workExperience,
    (company) => company.includes('trusting social')
  );
  if (trustingSocialIndex >= 0) {
    nextResume.workExperience[trustingSocialIndex] = appendUniqueBullet(
      nextResume.workExperience[trustingSocialIndex],
      '(Trusting Social is a Sequoia-backed, Series D startup, $400M+ valuation)'
    );
  }

  const paypalIndex = findExperienceIndexByCompany(
    nextResume.workExperience,
    (company) => company.includes('paypal')
  );
  if (paypalIndex >= 0) {
    nextResume.workExperience[paypalIndex] = appendSuffixToFirstBullet(
      nextResume.workExperience[paypalIndex],
      '- (Consulting project)'
    );
  }

  const infineonIndex = findExperienceIndexByCompany(
    nextResume.workExperience,
    (company) => company.includes('infineon')
  );
  if (infineonIndex >= 0) {
    nextResume.workExperience[infineonIndex] = appendSuffixToFirstBullet(
      nextResume.workExperience[infineonIndex],
      '- (Internship, Infineon is a top global semiconductor & IoT company with >50,000 employees)'
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
    jobTitle: jobSnapshot?.title ?? '',
    company: jobSnapshot?.company ?? '',
    location: jobSnapshot?.location ?? '',
    sourceUrl: jobSnapshot?.sourceUrl ?? '',
    extractedAt: jobSnapshot?.extractedAt ?? '',
    jobDescriptionRawText: jobSnapshot?.rawText ?? '',
    currentResume,
    storyboard,
    customInstruction,
    systemPrompt,
    prompt1Json: null,
    prompt2Json: null,
  };
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
    'Do not use the em dash character `—`; use a normal hyphen `-` instead.',
    'Do not end resume bullet strings with a period `.`.',
    'Do not return the empty schema template. Reuse the same resume content you already generated, but fix the JSON format and schema issues.',
    `This is repair attempt ${attempt}.`,
  ].join('\n');
}

async function resolveBaseResumeId(storedResumeId) {
  const resumeList = await listResumes(true);
  const masterResume = resumeList?.data?.find((resume) => resume?.is_master);
  if (!masterResume?.resume_id) {
    throw new Error('No master resume was found in SOM Career Coach. Upload one in the app first.');
  }
  return masterResume.resume_id;
}

export async function generateResumeForLinkedInJob(tabId, prompt1CustomInstruction = '') {
  logInfo('Orchestrator', 'Generate flow started.', { tabId });
  logInfo('Orchestrator', 'Loading local assets.');
  const {
    masterResumeContextAsset,
    storyboardAsset,
    systemPromptTemplateAsset,
    llmSettings,
    customFeatureEnabled,
  } = await getUserAssets();
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
  logInfo('LinkedInScrape', 'LinkedIn scrape output.', {
    jobSnapshot,
  });

  logInfo('Orchestrator', 'Resolving base resume.');
  const baseResumeId = await resolveBaseResumeId();
  logInfo('Orchestrator', 'Resolved base resume for cloning.', { baseResumeId });
  logInfo('Orchestrator', 'Uploading scraped job description for downstream app features.', {
    baseResumeId,
  });
  const uploadedJobDescription = buildStoredJobDescription(jobSnapshot);
  const jobUploadResponse = await uploadJobDescription(uploadedJobDescription, baseResumeId);
  const jobId = jobUploadResponse?.job_id?.[0];
  if (!jobId) {
    throw new Error('Job upload response did not include a job id.');
  }
  await setExtensionState({
    sessionId: crypto.randomUUID(),
    status: SESSION_STATUS.scraped,
    llmProfileId: activeLlmProfile.id,
    llmProfileLabel: activeLlmProfile.label,
    jobSnapshot,
    jobId,
    originalResumeId: baseResumeId,
    tailoredResumeId: null,
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
    throw new Error('Clone response did not include a resume id.');
  }
  logInfo('Orchestrator', 'Cloned base resume and created job-specific resume.', { baseResumeId, resumeId });
  await setExtensionState({ selectedResumeId: resumeId, tailoredResumeId: resumeId });
  const fetchedResume = cloneResponse?.data ? cloneResponse : await fetchResumeById(resumeId);
  let featureConfig;
  try {
    featureConfig = await fetchFeatureConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logInfo('Orchestrator', 'Falling back to default fact-preservation setting after feature-config fetch failed.', {
      message,
      preserveGeneratedResumeFacts: true,
    });
    featureConfig = { preserve_generated_resume_facts: true };
  }
  const preserveFactsEnabled = featureConfig?.preserve_generated_resume_facts !== false;
  const masterResumeData =
    fetchedResume?.data?.processed_resume ??
    (cloneResponse?.data?.processed_resume ?? null);
  const currentResume = resolveCurrentResumeSource(masterResumeContextAsset, fetchedResume);
  const storyboard = ensureStoryboardContent(storyboardAsset);
  const promptContext = buildBasePromptContext({
    jobSnapshot,
    currentResume,
    storyboard,
    customInstruction: prompt1CustomInstruction,
    systemPrompt,
  });

  logInfo('Orchestrator', 'Rendering Prompt 1.');
  const prompt1 = await renderPrompt1(promptContext, activeLlmProfile);
  logPromptDebug('Prompt 1', 'input', prompt1);

  logInfo('Orchestrator', 'Running Prompt 1.');
  const prompt1Run = await runPrompt(prompt1, { profile: activeLlmProfile, promptLabel: 'Prompt 1', systemPrompt });
  if (prompt1Run.status !== 'success') {
    logError('Orchestrator', 'Prompt 1 failed.', prompt1Run);
    throw new Error(`Prompt 1 failed: ${prompt1Run.message}`);
  }
  logInfo('Orchestrator', 'Parsing Prompt 1 output.');
  logPromptDebug('Prompt 1', 'output', prompt1Run.rawText);
  const prompt1Result = extractJsonFromText(prompt1Run.rawText);
  promptContext.prompt1Json = prompt1Result;
  await setExtensionState({ prompt1Result, status: SESSION_STATUS.prompt1Done, resumeSource: currentResume });

  logInfo('Orchestrator', 'Rendering Prompt 2.');
  const prompt2 = await renderPrompt2(promptContext, activeLlmProfile);
  logPromptDebug('Prompt 2', 'input', prompt2);
  logInfo('Orchestrator', 'Running Prompt 2.');
  const prompt2Run = await runPrompt(prompt2, { profile: activeLlmProfile, promptLabel: 'Prompt 2', systemPrompt });
  if (prompt2Run.status !== 'success') {
    logError('Orchestrator', 'Prompt 2 failed.', prompt2Run);
    throw new Error(`Prompt 2 failed: ${prompt2Run.message}`);
  }
  logInfo('Orchestrator', 'Parsing Prompt 2 output.');
  logPromptDebug('Prompt 2', 'output', prompt2Run.rawText);
  const prompt2Result = extractJsonFromText(prompt2Run.rawText);
  promptContext.prompt2Json = prompt2Result;
  await setExtensionState({ prompt2Result, status: SESSION_STATUS.prompt2Done });

  logInfo('Orchestrator', 'Rendering Prompt 3.');
  const prompt3 = await renderPrompt3(promptContext, activeLlmProfile);
  logPromptDebug('Prompt 3', 'input', prompt3);
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
  logPromptDebug('Prompt 3', 'output', prompt3Raw);
  const prompt3Result = extractPrompt3PayloadFromText(prompt3Raw);
  const normalizedPrompt3Resume = normalizePrompt3ResumeData(prompt3Result.resumeData);
  const prompt3Parsed = applyKennNguyenCustomFeature(
    preserveGeneratedResumeFacts(
      masterResumeData,
      normalizedPrompt3Resume,
      preserveFactsEnabled
    ),
    customFeatureEnabled
  );
  if (customFeatureEnabled && isKennNguyenName(prompt3Parsed?.personalInfo?.name)) {
    logInfo('Orchestrator', 'Applied custom feature adjustments for Kenn Nguyen.', {
      resumeId,
    });
  }
  const prompt3Feedback = prefixGenerationFeedbackSummary(
    normalizePrompt3Feedback(prompt3Result.generationFeedback),
    activeLlmProfile
  );
  const patchPayload = {
    resume_data: prompt3Parsed,
    generation_feedback: prompt3Feedback,
    generation_artifacts: {
      prompt2: prompt2Result,
    },
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
    await patchResume(resumeId, prompt3Parsed, prompt3Feedback, {
      prompt2: prompt2Result,
    });
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

  try {
    logInfo('Orchestrator', 'Linking generated resume to stored job context.', {
      baseResumeId,
      resumeId,
      jobId,
    });
    await linkResumeToJobContext(baseResumeId, resumeId, jobId);
    await setExtensionState({ jobContextLinked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to link generated resume to job context.';
    logError('Orchestrator', 'Job-context link failed after successful patch.', {
      baseResumeId,
      resumeId,
      jobId,
      message,
    });
    await setExtensionState({ patchError: message, status: SESSION_STATUS.error, jobContextLinked: false });
    await upsertHistoryEntry({
      jobKey: jobSnapshot.sourceUrl,
      title: jobSnapshot.title,
      company: jobSnapshot.company,
      datePosted: jobSnapshot.datePosted ?? null,
      generatedAt: new Date().toISOString(),
      resumeId,
      previewUrl: await buildPreviewUrl(resumeId),
      status: 'job_context_link_failed',
    });
    throw error;
  }

  try {
    logInfo('Orchestrator', 'Ensuring cover letter and outreach features are enabled.');
    await enableContentGenerationFeatures();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enable content-generation features.';
    logError('Orchestrator', 'Feature enablement failed after successful job linkage.', {
      resumeId,
      jobId,
      message,
    });
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
