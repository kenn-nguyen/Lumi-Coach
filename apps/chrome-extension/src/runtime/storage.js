import {
  DEFAULT_API_ORIGIN,
  DEFAULT_APP_ORIGIN,
  SESSION_STATUS,
  STORAGE_KEYS,
} from './constants.js';
import {
  getDefaultLlmSettings,
  mergeLlmSettings,
  updateLlmSettings,
} from './llm/profiles.js';

const PROMPT_PROFILE_IDS = ['profile1', 'profile2', 'profile3'];

function getDefaultPromptTemplateProfiles() {
  return {
    activeProfileId: 'profile1',
    profiles: Object.fromEntries(
      PROMPT_PROFILE_IDS.map((profileId) => [
        profileId,
        {
          prompt1TemplateAsset: null,
          prompt2TemplateAsset: null,
          prompt3TemplateAsset: null,
          systemPromptTemplateAsset: null,
        },
      ])
    ),
  };
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergePromptTemplateProfiles(storedProfiles, legacyAssets = {}) {
  const defaults = getDefaultPromptTemplateProfiles();
  const merged = cloneValue(defaults);

  if (storedProfiles && typeof storedProfiles === 'object') {
    const profiles = storedProfiles.profiles && typeof storedProfiles.profiles === 'object'
      ? storedProfiles.profiles
      : {};
    for (const profileId of PROMPT_PROFILE_IDS) {
      const storedProfile = profiles[profileId];
      if (storedProfile && typeof storedProfile === 'object') {
        merged.profiles[profileId] = {
          ...merged.profiles[profileId],
          ...cloneValue(storedProfile),
        };
      }
    }

    if (typeof storedProfiles.activeProfileId === 'string' && storedProfiles.activeProfileId in merged.profiles) {
      merged.activeProfileId = storedProfiles.activeProfileId;
    }
  }

  const activeProfile = merged.profiles[merged.activeProfileId];
  if (!activeProfile.prompt1TemplateAsset && legacyAssets.prompt1TemplateAsset) {
    activeProfile.prompt1TemplateAsset = legacyAssets.prompt1TemplateAsset;
  }
  if (!activeProfile.prompt2TemplateAsset && legacyAssets.prompt2TemplateAsset) {
    activeProfile.prompt2TemplateAsset = legacyAssets.prompt2TemplateAsset;
  }
  if (!activeProfile.prompt3TemplateAsset && legacyAssets.prompt3TemplateAsset) {
    activeProfile.prompt3TemplateAsset = legacyAssets.prompt3TemplateAsset;
  }
  if (!('systemPromptTemplateAsset' in activeProfile)) {
    activeProfile.systemPromptTemplateAsset = null;
  }

  return merged;
}

function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

function storageSet(values) {
  return chrome.storage.local.set(values);
}

export async function getUserAssets() {
  const data = await storageGet([
    STORAGE_KEYS.masterResumeContextAsset,
    STORAGE_KEYS.storyboardAsset,
    STORAGE_KEYS.promptTemplateProfiles,
    STORAGE_KEYS.prompt1TemplateAsset,
    STORAGE_KEYS.prompt2TemplateAsset,
    STORAGE_KEYS.prompt3TemplateAsset,
    STORAGE_KEYS.llmSettings,
    STORAGE_KEYS.chatGptTargetUrl,
    STORAGE_KEYS.appOrigin,
    STORAGE_KEYS.apiOrigin,
    STORAGE_KEYS.customFeatureEnabled,
    STORAGE_KEYS.extensionAuth,
  ]);
  const llmSettings = mergeLlmSettings(
    data[STORAGE_KEYS.llmSettings],
    data[STORAGE_KEYS.chatGptTargetUrl]
  );
  const promptTemplateProfiles = mergePromptTemplateProfiles(
    data[STORAGE_KEYS.promptTemplateProfiles],
    {
      prompt1TemplateAsset: data[STORAGE_KEYS.prompt1TemplateAsset] ?? null,
      prompt2TemplateAsset: data[STORAGE_KEYS.prompt2TemplateAsset] ?? null,
      prompt3TemplateAsset: data[STORAGE_KEYS.prompt3TemplateAsset] ?? null,
    }
  );
  const activePromptProfileId = promptTemplateProfiles.activeProfileId;
  const activePromptProfile = promptTemplateProfiles.profiles[activePromptProfileId] ?? getDefaultPromptTemplateProfiles().profiles.profile1;
  return {
    masterResumeContextAsset: data[STORAGE_KEYS.masterResumeContextAsset] ?? null,
    storyboardAsset: data[STORAGE_KEYS.storyboardAsset] ?? null,
    promptTemplateProfiles,
    activePromptProfileId,
    prompt1TemplateAsset: activePromptProfile.prompt1TemplateAsset ?? null,
    prompt2TemplateAsset: activePromptProfile.prompt2TemplateAsset ?? null,
    prompt3TemplateAsset: activePromptProfile.prompt3TemplateAsset ?? null,
    systemPromptTemplateAsset: activePromptProfile.systemPromptTemplateAsset ?? null,
    llmSettings,
    appOrigin: data[STORAGE_KEYS.appOrigin] ?? DEFAULT_APP_ORIGIN,
    apiOrigin: data[STORAGE_KEYS.apiOrigin] ?? DEFAULT_API_ORIGIN,
    customFeatureEnabled: data[STORAGE_KEYS.customFeatureEnabled] === true,
    extensionAuth: data[STORAGE_KEYS.extensionAuth] ?? null,
  };
}

export async function getExtensionAuth() {
  const data = await storageGet(STORAGE_KEYS.extensionAuth);
  return data[STORAGE_KEYS.extensionAuth] ?? null;
}

export async function setExtensionAuth(auth) {
  await storageSet({ [STORAGE_KEYS.extensionAuth]: auth });
  return auth;
}

export async function clearExtensionAuth() {
  await chrome.storage.local.remove(STORAGE_KEYS.extensionAuth);
}

export async function hasValidExtensionAuth() {
  const auth = await getExtensionAuth();
  if (!auth?.token || !auth?.expiresAt) return false;
  const now = Math.floor(Date.now() / 1000);
  return Number(auth.expiresAt) - 30 > now;
}

export async function getPendingExtensionAction() {
  const data = await storageGet(STORAGE_KEYS.extensionPendingAction);
  return data[STORAGE_KEYS.extensionPendingAction] ?? null;
}

export async function setPendingExtensionAction(action) {
  await storageSet({ [STORAGE_KEYS.extensionPendingAction]: action });
  return action;
}

export async function clearPendingExtensionAction() {
  await chrome.storage.local.remove(STORAGE_KEYS.extensionPendingAction);
}

function normalizeOrigin(value, fallback) {
  const normalized = (value || fallback).trim().replace(/\/+$/, '');
  return normalized || fallback;
}

export async function setStoryboardAsset(asset) {
  await storageSet({ [STORAGE_KEYS.storyboardAsset]: asset });
}

export async function setMasterResumeContextAsset(asset) {
  await storageSet({ [STORAGE_KEYS.masterResumeContextAsset]: asset });
}

export async function setPromptTemplateAsset(templateName, asset, promptProfileId = null) {
  const profileField = `${templateName}TemplateAsset`;
  if (!(profileField in getDefaultPromptTemplateProfiles().profiles.profile1)) {
    throw new Error(`Unknown prompt template name "${templateName}".`);
  }
  const currentAssets = await getUserAssets();
  const next = cloneValue(currentAssets.promptTemplateProfiles);
  const activeProfileId = promptProfileId && PROMPT_PROFILE_IDS.includes(promptProfileId)
    ? promptProfileId
    : next.activeProfileId;
  next.profiles[activeProfileId] = {
    ...next.profiles[activeProfileId],
    [profileField]: asset,
  };
  await storageSet({ [STORAGE_KEYS.promptTemplateProfiles]: next });
}

export async function savePromptTemplateProfileSelection(profileId) {
  if (!PROMPT_PROFILE_IDS.includes(profileId)) {
    throw new Error(`Unknown prompt profile id "${profileId}".`);
  }
  const currentAssets = await getUserAssets();
  const next = cloneValue(currentAssets.promptTemplateProfiles);
  next.activeProfileId = profileId;
  await storageSet({ [STORAGE_KEYS.promptTemplateProfiles]: next });
  return next;
}

export async function savePromptTemplateProfileBundle(profileId, uploads) {
  if (!PROMPT_PROFILE_IDS.includes(profileId)) {
    throw new Error(`Unknown prompt profile id "${profileId}".`);
  }
  const currentAssets = await getUserAssets();
  const next = cloneValue(currentAssets.promptTemplateProfiles);
  const currentProfile = next.profiles[profileId] ?? {};
  next.profiles[profileId] = {
    ...currentProfile,
    ...uploads,
  };
  next.activeProfileId = profileId;
  await storageSet({ [STORAGE_KEYS.promptTemplateProfiles]: next });
  return next;
}

async function getStoredLlmSettings() {
  const data = await storageGet([STORAGE_KEYS.llmSettings, STORAGE_KEYS.chatGptTargetUrl]);
  return mergeLlmSettings(data[STORAGE_KEYS.llmSettings], data[STORAGE_KEYS.chatGptTargetUrl]);
}

export async function saveLlmSettings(activeProfileId, profileUpdates) {
  const current = await getStoredLlmSettings();
  const next = updateLlmSettings(current, activeProfileId, profileUpdates);
  await storageSet({
    [STORAGE_KEYS.llmSettings]: next,
  });
  return next;
}

export async function setChatGptTargetUrl(url) {
  const normalizedUrl = (url || '').trim();
  const current = await getStoredLlmSettings();
  const next = updateLlmSettings(current, 'chatgpt:web_automation', {
    targetUrl: normalizedUrl || getDefaultLlmSettings().profiles['chatgpt:web_automation'].targetUrl,
  });
  await storageSet({
    [STORAGE_KEYS.llmSettings]: next,
    [STORAGE_KEYS.chatGptTargetUrl]: normalizedUrl,
  });
}

export async function setAppOrigin(url) {
  await storageSet({
    [STORAGE_KEYS.appOrigin]: normalizeOrigin(url, DEFAULT_APP_ORIGIN),
  });
}

export async function setApiOrigin(url) {
  await storageSet({
    [STORAGE_KEYS.apiOrigin]: normalizeOrigin(url, DEFAULT_API_ORIGIN),
  });
}

export async function setCustomFeatureEnabled(enabled) {
  await storageSet({
    [STORAGE_KEYS.customFeatureEnabled]: enabled === true,
  });
}

export async function getExtensionState() {
  const data = await storageGet([STORAGE_KEYS.extensionSession, STORAGE_KEYS.lastError]);
  return (
    data[STORAGE_KEYS.extensionSession] ?? {
      sessionId: null,
      selectedResumeId: null,
      status: SESSION_STATUS.idle,
      llmProfileId: null,
      llmProfileLabel: null,
      jobSnapshot: null,
      jobId: null,
      originalResumeId: null,
      tailoredResumeId: null,
      jobContextLinked: false,
      resumeSource: null,
      prompt1Result: null,
      prompt2Result: null,
      prompt3Raw: null,
      prompt3Parsed: null,
      prompt3Feedback: null,
      prompt3ValidationErrors: [],
      patchPayload: null,
      patchError: null,
      updatedAt: null,
    }
  );
}

export async function setExtensionState(nextState) {
  const merged = {
    ...(await getExtensionState()),
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
  await storageSet({ [STORAGE_KEYS.extensionSession]: merged });
  return merged;
}

export async function setLastError(message) {
  await storageSet({ [STORAGE_KEYS.lastError]: message });
  await setExtensionState({ status: SESSION_STATUS.error });
}

export async function getHistoryEntries() {
  const data = await storageGet(STORAGE_KEYS.historyEntries);
  return data[STORAGE_KEYS.historyEntries] ?? [];
}

export async function upsertHistoryEntry(entry) {
  const current = await getHistoryEntries();
  const next = [entry, ...current.filter((item) => item.jobKey !== entry.jobKey)];
  await storageSet({ [STORAGE_KEYS.historyEntries]: next });
  return next;
}

export async function clearExtensionLocalData() {
  await chrome.storage.local.remove([
    'masterResumeId',
    'resumeMatcherFloatingButtonTopOffset',
    STORAGE_KEYS.masterResumeContextAsset,
    STORAGE_KEYS.storyboardAsset,
    STORAGE_KEYS.promptTemplateProfiles,
    STORAGE_KEYS.prompt1TemplateAsset,
    STORAGE_KEYS.prompt2TemplateAsset,
    STORAGE_KEYS.prompt3TemplateAsset,
    STORAGE_KEYS.llmSettings,
    STORAGE_KEYS.chatGptTargetUrl,
    STORAGE_KEYS.appOrigin,
    STORAGE_KEYS.apiOrigin,
    STORAGE_KEYS.customFeatureEnabled,
    STORAGE_KEYS.extensionAuth,
    STORAGE_KEYS.extensionPendingAction,
    STORAGE_KEYS.extensionSession,
    STORAGE_KEYS.historyEntries,
    STORAGE_KEYS.lastError,
  ]);
}

export async function resetExtensionSettingsToDefault() {
  await chrome.storage.local.remove([
    'resumeMatcherFloatingButtonTopOffset',
    STORAGE_KEYS.promptTemplateProfiles,
    STORAGE_KEYS.llmSettings,
    STORAGE_KEYS.chatGptTargetUrl,
    STORAGE_KEYS.appOrigin,
    STORAGE_KEYS.apiOrigin,
    STORAGE_KEYS.customFeatureEnabled,
    STORAGE_KEYS.extensionAuth,
  ]);
}
