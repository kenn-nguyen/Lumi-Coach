import {
  DEFAULT_API_ORIGIN,
  DEFAULT_APP_ORIGIN,
  DEFAULT_CHATGPT_TARGET_URL,
  SESSION_STATUS,
  STORAGE_KEYS,
} from './constants.js';

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
    STORAGE_KEYS.prompt1TemplateAsset,
    STORAGE_KEYS.prompt2TemplateAsset,
    STORAGE_KEYS.prompt3TemplateAsset,
    STORAGE_KEYS.chatGptTargetUrl,
    STORAGE_KEYS.appOrigin,
    STORAGE_KEYS.apiOrigin,
  ]);
  return {
    masterResumeContextAsset: data[STORAGE_KEYS.masterResumeContextAsset] ?? null,
    storyboardAsset: data[STORAGE_KEYS.storyboardAsset] ?? null,
    prompt1TemplateAsset: data[STORAGE_KEYS.prompt1TemplateAsset] ?? null,
    prompt2TemplateAsset: data[STORAGE_KEYS.prompt2TemplateAsset] ?? null,
    prompt3TemplateAsset: data[STORAGE_KEYS.prompt3TemplateAsset] ?? null,
    chatGptTargetUrl: data[STORAGE_KEYS.chatGptTargetUrl] ?? DEFAULT_CHATGPT_TARGET_URL,
    appOrigin: data[STORAGE_KEYS.appOrigin] ?? DEFAULT_APP_ORIGIN,
    apiOrigin: data[STORAGE_KEYS.apiOrigin] ?? DEFAULT_API_ORIGIN,
  };
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

export async function setPromptTemplateAsset(templateName, asset) {
  const key = STORAGE_KEYS[`${templateName}TemplateAsset`];
  if (!key) {
    throw new Error(`Unknown prompt template name "${templateName}".`);
  }
  await storageSet({ [key]: asset });
}

export async function setChatGptTargetUrl(url) {
  await storageSet({
    [STORAGE_KEYS.chatGptTargetUrl]: (url || DEFAULT_CHATGPT_TARGET_URL).trim() || DEFAULT_CHATGPT_TARGET_URL,
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

export async function getExtensionState() {
  const data = await storageGet([STORAGE_KEYS.extensionSession, STORAGE_KEYS.lastError]);
  return (
    data[STORAGE_KEYS.extensionSession] ?? {
      sessionId: null,
      selectedResumeId: null,
      status: SESSION_STATUS.idle,
      jobSnapshot: null,
      resumeSource: null,
      prompt1Result: null,
      prompt2Result: null,
      prompt3Raw: null,
      prompt3Parsed: null,
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
    STORAGE_KEYS.prompt1TemplateAsset,
    STORAGE_KEYS.prompt2TemplateAsset,
    STORAGE_KEYS.prompt3TemplateAsset,
    STORAGE_KEYS.chatGptTargetUrl,
    STORAGE_KEYS.appOrigin,
    STORAGE_KEYS.apiOrigin,
    STORAGE_KEYS.extensionSession,
    STORAGE_KEYS.historyEntries,
    STORAGE_KEYS.lastError,
  ]);
}

export async function resetExtensionSettingsToDefault() {
  await chrome.storage.local.remove([
    'resumeMatcherFloatingButtonTopOffset',
    STORAGE_KEYS.chatGptTargetUrl,
    STORAGE_KEYS.appOrigin,
    STORAGE_KEYS.apiOrigin,
  ]);
}
