import {
  DEFAULT_API_ORIGIN,
  DEFAULT_APP_ORIGIN,
  SESSION_STATUS,
  STORAGE_KEYS,
} from "./constants.js";
import { deriveAccountKeyFromUser } from "./account.js";
import {
  getDefaultLlmSettings,
  mergeLlmSettings,
  updateLlmSettings,
} from "./llm/profiles.js";
import { isUserEditablePromptTemplateName } from "./prompt-defaults.js";

const PROMPT_PROFILE_IDS = ["profile1", "profile2", "profile3"];
const ONBOARDING_STEPS = ["intro", "sign_in", "assets", "provider", "done"];
const ACCOUNT_STORAGE_VERSION = 1;
const MAX_HISTORY_ENTRIES = 1000;
const LEGACY_ACCOUNT_SCOPED_KEYS = [
  STORAGE_KEYS.masterResumeContextAsset,
  STORAGE_KEYS.storyboardAsset,
  STORAGE_KEYS.promptTemplateProfiles,
  STORAGE_KEYS.prompt1TemplateAsset,
  STORAGE_KEYS.prompt2TemplateAsset,
  STORAGE_KEYS.prompt3TemplateAsset,
  STORAGE_KEYS.serverPromptArtifacts,
  STORAGE_KEYS.serverPromptManifest,
  STORAGE_KEYS.serverPromptLastSyncedAt,
  STORAGE_KEYS.llmSettings,
  STORAGE_KEYS.chatGptTargetUrl,
  STORAGE_KEYS.onboardingProgress,
  STORAGE_KEYS.apifyFallbackSettings,
  STORAGE_KEYS.extensionPendingAction,
  STORAGE_KEYS.extensionSession,
  STORAGE_KEYS.historyEntries,
  STORAGE_KEYS.lastError,
];
const ACCOUNT_SETTINGS_SCOPED_KEYS = [
  STORAGE_KEYS.promptTemplateProfiles,
  STORAGE_KEYS.serverPromptArtifacts,
  STORAGE_KEYS.serverPromptManifest,
  STORAGE_KEYS.serverPromptLastSyncedAt,
  STORAGE_KEYS.llmSettings,
  STORAGE_KEYS.chatGptTargetUrl,
  STORAGE_KEYS.onboardingProgress,
  STORAGE_KEYS.apifyFallbackSettings,
];

function getDefaultOnboardingProgress() {
  return {
    hasCompletedOnboarding: false,
    onboardingStep: "sign_in",
  };
}

export function getDefaultApifyFallbackSettings() {
  return {
    enabled: true,
    apiToken: "",
  };
}

function getDefaultPromptTemplateProfiles() {
  return {
    activeProfileId: "profile1",
    profiles: Object.fromEntries(
      PROMPT_PROFILE_IDS.map((profileId) => [
        profileId,
        {
          prompt1TemplateAsset: null,
          prompt2TemplateAsset: null,
          prompt3TemplateAsset: null,
          systemPromptTemplateAsset: null,
        },
      ]),
    ),
  };
}

function normalizePromptArtifactMap(storedArtifacts) {
  if (!storedArtifacts || typeof storedArtifacts !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(storedArtifacts).filter(
      ([key, value]) =>
        typeof key === "string" &&
        key.trim().length > 0 &&
        typeof value === "string",
    ),
  );
}

function normalizePromptManifest(storedManifest) {
  if (!storedManifest || typeof storedManifest !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(storedManifest).filter(
      ([key, value]) =>
        typeof key === "string" &&
        key.trim().length > 0 &&
        typeof value === "string" &&
        value.trim().length > 0,
    ),
  );
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultExtensionState() {
  return {
    sessionId: null,
    sourceTabId: null,
    selectedResumeId: null,
    status: SESSION_STATUS.idle,
    llmProfileId: null,
    llmProfileLabel: null,
    activeRunJob: null,
    jobSnapshot: null,
    jobId: null,
    originalResumeId: null,
    tailoredResumeId: null,
    previewUrl: null,
    jobContextLinked: false,
    resumeSource: null,
    prompt4Input: null,
    prompt4Raw: null,
    prompt4Result: null,
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
    updatedAt: null,
  };
}

function mergePromptTemplateProfiles(storedProfiles, legacyAssets = {}) {
  const defaults = getDefaultPromptTemplateProfiles();
  const merged = cloneValue(defaults);

  if (storedProfiles && typeof storedProfiles === "object") {
    const profiles =
      storedProfiles.profiles && typeof storedProfiles.profiles === "object"
        ? storedProfiles.profiles
        : {};
    for (const profileId of PROMPT_PROFILE_IDS) {
      const storedProfile = profiles[profileId];
      if (storedProfile && typeof storedProfile === "object") {
        merged.profiles[profileId] = {
          ...merged.profiles[profileId],
          ...cloneValue(storedProfile),
        };
      }
    }

    if (
      typeof storedProfiles.activeProfileId === "string" &&
      storedProfiles.activeProfileId in merged.profiles
    ) {
      merged.activeProfileId = storedProfiles.activeProfileId;
    }
  }

  const activeProfile = merged.profiles[merged.activeProfileId];
  if (
    !activeProfile.prompt1TemplateAsset &&
    legacyAssets.prompt1TemplateAsset
  ) {
    activeProfile.prompt1TemplateAsset = legacyAssets.prompt1TemplateAsset;
  }
  if (
    !activeProfile.prompt2TemplateAsset &&
    legacyAssets.prompt2TemplateAsset
  ) {
    activeProfile.prompt2TemplateAsset = legacyAssets.prompt2TemplateAsset;
  }
  if (
    !activeProfile.prompt3TemplateAsset &&
    legacyAssets.prompt3TemplateAsset
  ) {
    activeProfile.prompt3TemplateAsset = legacyAssets.prompt3TemplateAsset;
  }
  if (!("systemPromptTemplateAsset" in activeProfile)) {
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

function buildScopedStorageKey(accountKey, storageKey) {
  return `account::${accountKey}::${storageKey}`;
}

function normalizeStoredAccountKey(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function buildScopedStorageEntries(accountKey, values) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .map(([storageKey, value]) => [
        buildScopedStorageKey(accountKey, storageKey),
        value,
      ]),
  );
}

function hasLegacyScopedValue(storageKey, value) {
  if (value === undefined) return false;
  if (storageKey === STORAGE_KEYS.lastError) {
    return typeof value === "string" && value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null;
}

function pickLegacyScopedData(data) {
  const next = {};
  let hasAny = false;

  for (const storageKey of LEGACY_ACCOUNT_SCOPED_KEYS) {
    if (!(storageKey in data)) continue;
    const value = data[storageKey];
    if (value === undefined) continue;
    next[storageKey] = value;
    if (hasLegacyScopedValue(storageKey, value)) {
      hasAny = true;
    }
  }

  return {
    hasAny,
    data: next,
  };
}

async function getExtensionAuthRaw() {
  const data = await storageGet(STORAGE_KEYS.extensionAuth);
  return data[STORAGE_KEYS.extensionAuth] ?? null;
}

async function ensureAccountStorageMigrated(preferredAccountKey = null) {
  const normalizedPreferredAccountKey =
    normalizeStoredAccountKey(preferredAccountKey);
  const data = await storageGet([
    STORAGE_KEYS.accountStorageVersion,
    STORAGE_KEYS.activeAccountKey,
    STORAGE_KEYS.extensionAuth,
    ...LEGACY_ACCOUNT_SCOPED_KEYS,
  ]);

  if (data[STORAGE_KEYS.accountStorageVersion] === ACCOUNT_STORAGE_VERSION) {
    return;
  }

  const authAccountKey =
    normalizedPreferredAccountKey ||
    deriveAccountKeyFromUser(data[STORAGE_KEYS.extensionAuth]?.user);
  const legacy = pickLegacyScopedData(data);
  const updates = {
    [STORAGE_KEYS.accountStorageVersion]: ACCOUNT_STORAGE_VERSION,
  };

  if (!legacy.hasAny) {
    if (authAccountKey) {
      updates[STORAGE_KEYS.activeAccountKey] = authAccountKey;
    }
    await storageSet(updates);
    return;
  }

  if (authAccountKey) {
    Object.assign(
      updates,
      buildScopedStorageEntries(authAccountKey, legacy.data),
      {
        [STORAGE_KEYS.activeAccountKey]: authAccountKey,
      },
    );
  } else {
    updates[STORAGE_KEYS.legacyScopedData] = legacy.data;
  }

  await storageSet(updates);
  await chrome.storage.local.remove(LEGACY_ACCOUNT_SCOPED_KEYS);
}

async function getCurrentAccountKey() {
  const rawAuth = await getExtensionAuthRaw();
  const preferredAccountKey = deriveAccountKeyFromUser(rawAuth?.user);
  await ensureAccountStorageMigrated(preferredAccountKey);
  const data = await storageGet(STORAGE_KEYS.activeAccountKey);
  const storedAccountKey = normalizeStoredAccountKey(
    data[STORAGE_KEYS.activeAccountKey],
  );
  if (storedAccountKey || !preferredAccountKey) {
    return storedAccountKey;
  }

  await storageSet({ [STORAGE_KEYS.activeAccountKey]: preferredAccountKey });
  return preferredAccountKey;
}

async function getScopedStorageValues(storageKeys, accountKey = null) {
  const resolvedAccountKey =
    normalizeStoredAccountKey(accountKey) || (await getCurrentAccountKey());
  if (!resolvedAccountKey) {
    return {};
  }

  const data = await storageGet(
    storageKeys.map((storageKey) =>
      buildScopedStorageKey(resolvedAccountKey, storageKey),
    ),
  );

  return Object.fromEntries(
    storageKeys.map((storageKey) => [
      storageKey,
      data[buildScopedStorageKey(resolvedAccountKey, storageKey)],
    ]),
  );
}

async function setScopedStorageValues(values, accountKey = null) {
  const resolvedAccountKey =
    normalizeStoredAccountKey(accountKey) || (await getCurrentAccountKey());
  if (!resolvedAccountKey) {
    return null;
  }

  const entries = buildScopedStorageEntries(resolvedAccountKey, values);
  if (Object.keys(entries).length) {
    await storageSet(entries);
  }

  return resolvedAccountKey;
}

async function removeScopedStorageKeys(storageKeys, accountKey = null) {
  const resolvedAccountKey =
    normalizeStoredAccountKey(accountKey) || (await getCurrentAccountKey());
  if (!resolvedAccountKey) {
    return;
  }

  await chrome.storage.local.remove(
    storageKeys.map((storageKey) =>
      buildScopedStorageKey(resolvedAccountKey, storageKey),
    ),
  );
}

async function getExtensionStateForAccount(accountKey) {
  const data = await getScopedStorageValues(
    [STORAGE_KEYS.extensionSession, STORAGE_KEYS.lastError],
    accountKey,
  );
  return data[STORAGE_KEYS.extensionSession] ?? getDefaultExtensionState();
}

async function clearDisconnectStateForAccount(accountKey) {
  const resolvedAccountKey = normalizeStoredAccountKey(accountKey);
  if (!resolvedAccountKey) return;

  await removeScopedStorageKeys(
    [STORAGE_KEYS.extensionPendingAction],
    resolvedAccountKey,
  );

  const currentState = await getExtensionStateForAccount(resolvedAccountKey);
  if (!ACTIVE_SESSION_STATUSES.has(currentState.status)) {
    return;
  }

  await setScopedStorageValues(
    {
      [STORAGE_KEYS.extensionSession]: {
        ...currentState,
        status: SESSION_STATUS.idle,
        sourceTabId: null,
        activeRunJob: null,
        previewUrl: null,
        patchError: null,
        updatedAt: new Date().toISOString(),
      },
    },
    resolvedAccountKey,
  );
}

const ACTIVE_SESSION_STATUSES = new Set([
  SESSION_STATUS.starting,
  SESSION_STATUS.bootstrapMaster,
  SESSION_STATUS.scraped,
  SESSION_STATUS.prompt1Done,
  SESSION_STATUS.prompt2Done,
  SESSION_STATUS.prompt3Done,
  SESSION_STATUS.validated,
]);

function buildRunLabel(extensionState) {
  const title =
    extensionState?.jobSnapshot?.title ||
    extensionState?.activeRunJob?.title ||
    "";
  const company =
    extensionState?.jobSnapshot?.company ||
    extensionState?.activeRunJob?.company ||
    "";
  if (title && company) return `${title} at ${company}`;
  return title || company || "current job";
}

async function syncBrowserActionState(extensionState) {
  if (!chrome?.action?.setBadgeText) return;

  const status = extensionState?.status || SESSION_STATUS.idle;
  const label = buildRunLabel(extensionState);

  if (ACTIVE_SESSION_STATUSES.has(status)) {
    await chrome.action
      .setBadgeBackgroundColor({ color: "#8C1F3F" })
      .catch(() => {});
    await chrome.action.setBadgeText({ text: "..." }).catch(() => {});
    await chrome.action
      .setTitle({ title: `Lumi Coach: running for ${label}` })
      .catch(() => {});
    return;
  }

  if (status === SESSION_STATUS.patched) {
    await chrome.action
      .setBadgeBackgroundColor({ color: "#1A5A38" })
      .catch(() => {});
    await chrome.action.setBadgeText({ text: "✓" }).catch(() => {});
    await chrome.action
      .setTitle({ title: `Lumi Coach: tailored resume ready for ${label}` })
      .catch(() => {});
    return;
  }

  if (status === SESSION_STATUS.error) {
    await chrome.action
      .setBadgeBackgroundColor({ color: "#A01F1F" })
      .catch(() => {});
    await chrome.action.setBadgeText({ text: "!" }).catch(() => {});
    await chrome.action
      .setTitle({
        title: `Lumi Coach: run failed${label ? ` for ${label}` : ""}`,
      })
      .catch(() => {});
    return;
  }

  await chrome.action.setBadgeText({ text: "" }).catch(() => {});
  await chrome.action.setTitle({ title: "Lumi Coach" }).catch(() => {});
}

export async function getUserAssets() {
  const accountKey = await getCurrentAccountKey();
  const [globalData, scopedData] = await Promise.all([
    storageGet([
      STORAGE_KEYS.appOrigin,
      STORAGE_KEYS.apiOrigin,
      STORAGE_KEYS.extensionAuth,
    ]),
    getScopedStorageValues(
      [
        STORAGE_KEYS.masterResumeContextAsset,
        STORAGE_KEYS.storyboardAsset,
        STORAGE_KEYS.promptTemplateProfiles,
        STORAGE_KEYS.prompt1TemplateAsset,
        STORAGE_KEYS.prompt2TemplateAsset,
        STORAGE_KEYS.prompt3TemplateAsset,
        STORAGE_KEYS.llmSettings,
        STORAGE_KEYS.chatGptTargetUrl,
        STORAGE_KEYS.onboardingProgress,
        STORAGE_KEYS.apifyFallbackSettings,
      ],
      accountKey,
    ),
  ]);
  const llmSettings = mergeLlmSettings(
    scopedData[STORAGE_KEYS.llmSettings],
    scopedData[STORAGE_KEYS.chatGptTargetUrl],
  );
  const promptTemplateProfiles = mergePromptTemplateProfiles(
    scopedData[STORAGE_KEYS.promptTemplateProfiles],
    {
      prompt1TemplateAsset:
        scopedData[STORAGE_KEYS.prompt1TemplateAsset] ?? null,
      prompt2TemplateAsset:
        scopedData[STORAGE_KEYS.prompt2TemplateAsset] ?? null,
      prompt3TemplateAsset:
        scopedData[STORAGE_KEYS.prompt3TemplateAsset] ?? null,
    },
  );
  const activePromptProfileId = promptTemplateProfiles.activeProfileId;
  const activePromptProfile =
    promptTemplateProfiles.profiles[activePromptProfileId] ??
    getDefaultPromptTemplateProfiles().profiles.profile1;
  return {
    activeAccountKey: accountKey,
    masterResumeContextAsset:
      scopedData[STORAGE_KEYS.masterResumeContextAsset] ?? null,
    storyboardAsset: scopedData[STORAGE_KEYS.storyboardAsset] ?? null,
    promptTemplateProfiles,
    activePromptProfileId,
    prompt1TemplateAsset: activePromptProfile.prompt1TemplateAsset ?? null,
    prompt2TemplateAsset: activePromptProfile.prompt2TemplateAsset ?? null,
    prompt3TemplateAsset: activePromptProfile.prompt3TemplateAsset ?? null,
    systemPromptTemplateAsset:
      activePromptProfile.systemPromptTemplateAsset ?? null,
    llmSettings,
    appOrigin: globalData[STORAGE_KEYS.appOrigin] ?? DEFAULT_APP_ORIGIN,
    apiOrigin: globalData[STORAGE_KEYS.apiOrigin] ?? DEFAULT_API_ORIGIN,
    extensionAuth: globalData[STORAGE_KEYS.extensionAuth] ?? null,
    onboardingProgress: normalizeOnboardingProgress(
      scopedData[STORAGE_KEYS.onboardingProgress],
    ),
    apifyFallbackSettings: normalizeApifyFallbackSettings(
      scopedData[STORAGE_KEYS.apifyFallbackSettings],
    ),
  };
}

export function normalizeApifyFallbackSettings(storedSettings) {
  const defaults = getDefaultApifyFallbackSettings();
  if (!storedSettings || typeof storedSettings !== "object") {
    return defaults;
  }

  return {
    enabled: storedSettings.enabled === true,
    apiToken:
      typeof storedSettings.apiToken === "string"
        ? storedSettings.apiToken.trim()
        : "",
  };
}

export function normalizeOnboardingProgress(storedProgress) {
  const defaults = getDefaultOnboardingProgress();
  if (!storedProgress || typeof storedProgress !== "object") {
    return defaults;
  }

  const nextStep =
    typeof storedProgress.onboardingStep === "string" &&
    ONBOARDING_STEPS.includes(storedProgress.onboardingStep)
      ? storedProgress.onboardingStep === "intro"
        ? "sign_in"
        : storedProgress.onboardingStep
      : defaults.onboardingStep;

  return {
    hasCompletedOnboarding: storedProgress.hasCompletedOnboarding === true,
    onboardingStep: nextStep,
  };
}

export async function getOnboardingProgress() {
  const data = await getScopedStorageValues([STORAGE_KEYS.onboardingProgress]);
  return normalizeOnboardingProgress(data[STORAGE_KEYS.onboardingProgress]);
}

export async function setOnboardingProgress(progress) {
  const current = await getOnboardingProgress();
  const next = normalizeOnboardingProgress({
    ...current,
    ...progress,
  });
  await setScopedStorageValues({
    [STORAGE_KEYS.onboardingProgress]: next,
  });
  return next;
}

export async function completeOnboarding() {
  return setOnboardingProgress({
    hasCompletedOnboarding: true,
    onboardingStep: "done",
  });
}

export async function getExtensionAuth() {
  await ensureAccountStorageMigrated();
  return getExtensionAuthRaw();
}

export async function setExtensionAuth(auth) {
  await ensureAccountStorageMigrated(deriveAccountKeyFromUser(auth?.user));
  await storageSet({ [STORAGE_KEYS.extensionAuth]: auth });
  return auth;
}

export async function clearExtensionAuth() {
  const activeAccountKey = await getCurrentAccountKey();
  await clearDisconnectStateForAccount(activeAccountKey);
  await chrome.storage.local.remove([
    STORAGE_KEYS.extensionAuth,
    STORAGE_KEYS.activeAccountKey,
  ]);
  await syncBrowserActionState({ status: SESSION_STATUS.idle });
}

export async function hasValidExtensionAuth() {
  const auth = await getExtensionAuth();
  if (!auth?.token || !auth?.expiresAt) return false;
  const now = Math.floor(Date.now() / 1000);
  return Number(auth.expiresAt) - 30 > now;
}

export async function getPendingExtensionAction() {
  const accountData = await getScopedStorageValues([
    STORAGE_KEYS.extensionPendingAction,
  ]);
  if (accountData[STORAGE_KEYS.extensionPendingAction]) {
    return accountData[STORAGE_KEYS.extensionPendingAction];
  }

  const data = await storageGet(STORAGE_KEYS.extensionPendingAction);
  return data[STORAGE_KEYS.extensionPendingAction] ?? null;
}

export async function setPendingExtensionAction(action) {
  const accountKey = await getCurrentAccountKey();
  if (accountKey) {
    await setScopedStorageValues({
      [STORAGE_KEYS.extensionPendingAction]: action,
    }, accountKey);
    await chrome.storage.local.remove(STORAGE_KEYS.extensionPendingAction);
    return action;
  }

  await storageSet({
    [STORAGE_KEYS.extensionPendingAction]: action,
  });
  return action;
}

export async function clearPendingExtensionAction() {
  await removeScopedStorageKeys([STORAGE_KEYS.extensionPendingAction]);
  await chrome.storage.local.remove(STORAGE_KEYS.extensionPendingAction);
}

function normalizeOrigin(value, fallback) {
  const normalized = (value || fallback).trim().replace(/\/+$/, "");
  return normalized || fallback;
}

export async function setStoryboardAsset(asset) {
  await setScopedStorageValues({ [STORAGE_KEYS.storyboardAsset]: asset });
}

export async function setMasterResumeContextAsset(asset) {
  await setScopedStorageValues({
    [STORAGE_KEYS.masterResumeContextAsset]: asset,
  });
}

export async function setPromptTemplateAsset(
  templateName,
  asset,
  promptProfileId = null,
) {
  if (!isUserEditablePromptTemplateName(templateName)) {
    throw new Error(`Prompt template "${templateName}" is system-managed and cannot be edited.`);
  }
  const profileField = `${templateName}TemplateAsset`;
  if (!(profileField in getDefaultPromptTemplateProfiles().profiles.profile1)) {
    throw new Error(`Unknown prompt template name "${templateName}".`);
  }
  const currentAssets = await getUserAssets();
  const next = cloneValue(currentAssets.promptTemplateProfiles);
  const activeProfileId =
    promptProfileId && PROMPT_PROFILE_IDS.includes(promptProfileId)
      ? promptProfileId
      : next.activeProfileId;
  next.profiles[activeProfileId] = {
    ...next.profiles[activeProfileId],
    [profileField]: asset,
  };
  await setScopedStorageValues({
    [STORAGE_KEYS.promptTemplateProfiles]: next,
  });
}

export async function savePromptTemplateProfileSelection(profileId) {
  if (!PROMPT_PROFILE_IDS.includes(profileId)) {
    throw new Error(`Unknown prompt profile id "${profileId}".`);
  }
  const currentAssets = await getUserAssets();
  const next = cloneValue(currentAssets.promptTemplateProfiles);
  next.activeProfileId = profileId;
  await setScopedStorageValues({
    [STORAGE_KEYS.promptTemplateProfiles]: next,
  });
  return next;
}

export async function savePromptTemplateProfileBundle(profileId, uploads) {
  if (!PROMPT_PROFILE_IDS.includes(profileId)) {
    throw new Error(`Unknown prompt profile id "${profileId}".`);
  }
  const currentAssets = await getUserAssets();
  const next = cloneValue(currentAssets.promptTemplateProfiles);
  const currentProfile = next.profiles[profileId] ?? {};
  const allowedUploads = Object.fromEntries(
    Object.entries(uploads || {}).filter(([field]) =>
      ["prompt1TemplateAsset", "prompt2TemplateAsset", "prompt3TemplateAsset"].includes(field),
    ),
  );
  next.profiles[profileId] = {
    ...currentProfile,
    ...allowedUploads,
  };
  next.activeProfileId = profileId;
  await setScopedStorageValues({
    [STORAGE_KEYS.promptTemplateProfiles]: next,
  });
  return next;
}

export async function getServerPromptDefaults() {
  const data = await getScopedStorageValues([
    STORAGE_KEYS.serverPromptArtifacts,
    STORAGE_KEYS.serverPromptManifest,
    STORAGE_KEYS.serverPromptLastSyncedAt,
  ]);

  return {
    artifacts: normalizePromptArtifactMap(
      data[STORAGE_KEYS.serverPromptArtifacts],
    ),
    manifest: normalizePromptManifest(data[STORAGE_KEYS.serverPromptManifest]),
    lastSyncedAt:
      typeof data[STORAGE_KEYS.serverPromptLastSyncedAt] === "string"
        ? data[STORAGE_KEYS.serverPromptLastSyncedAt]
        : null,
  };
}

export async function applyServerPromptDefaultsSyncResult(syncResult) {
  const current = await getServerPromptDefaults();
  const changed = normalizePromptArtifactMap(syncResult?.changed);
  const removed = Array.isArray(syncResult?.removed)
    ? syncResult.removed.filter(
        (value) => typeof value === "string" && value.trim().length > 0,
      )
    : [];
  const nextArtifacts = {
    ...current.artifacts,
    ...changed,
  };

  for (const artifactKey of removed) {
    delete nextArtifacts[artifactKey];
  }

  const nextManifest = normalizePromptManifest(syncResult?.manifest);
  const nextSyncedAt = new Date().toISOString();

  await setScopedStorageValues({
    [STORAGE_KEYS.serverPromptArtifacts]: nextArtifacts,
    [STORAGE_KEYS.serverPromptManifest]: nextManifest,
    [STORAGE_KEYS.serverPromptLastSyncedAt]: nextSyncedAt,
  });

  return {
    artifacts: nextArtifacts,
    manifest: nextManifest,
    lastSyncedAt: nextSyncedAt,
    changedKeys: [...Object.keys(changed), ...removed],
  };
}

async function getStoredLlmSettings() {
  const data = await getScopedStorageValues([
    STORAGE_KEYS.llmSettings,
    STORAGE_KEYS.chatGptTargetUrl,
  ]);
  return mergeLlmSettings(
    data[STORAGE_KEYS.llmSettings],
    data[STORAGE_KEYS.chatGptTargetUrl],
  );
}

export async function saveLlmSettings(activeProfileId, profileUpdates) {
  const current = await getStoredLlmSettings();
  const next = updateLlmSettings(current, activeProfileId, profileUpdates);
  await setScopedStorageValues({
    [STORAGE_KEYS.llmSettings]: next,
  });
  return next;
}

export async function saveApifyFallbackSettings(nextSettings) {
  const current = await getUserAssets();
  const merged = normalizeApifyFallbackSettings({
    ...current.apifyFallbackSettings,
    ...nextSettings,
  });
  await setScopedStorageValues({
    [STORAGE_KEYS.apifyFallbackSettings]: merged,
  });
  return merged;
}

export async function setChatGptTargetUrl(url) {
  const normalizedUrl = (url || "").trim();
  const current = await getStoredLlmSettings();
  const next = updateLlmSettings(current, "chatgpt:web_automation", {
    targetUrl:
      normalizedUrl ||
      getDefaultLlmSettings().profiles["chatgpt:web_automation"].targetUrl,
  });
  await setScopedStorageValues({
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

export async function getExtensionState() {
  const data = await getScopedStorageValues([
    STORAGE_KEYS.extensionSession,
    STORAGE_KEYS.lastError,
  ]);
  return data[STORAGE_KEYS.extensionSession] ?? getDefaultExtensionState();
}

export async function setExtensionState(nextState) {
  const merged = {
    ...(await getExtensionState()),
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
  await setScopedStorageValues({ [STORAGE_KEYS.extensionSession]: merged });
  await syncBrowserActionState(merged);
  return merged;
}

export async function setLastError(message) {
  await setScopedStorageValues({ [STORAGE_KEYS.lastError]: message });
  await setExtensionState({ status: SESSION_STATUS.error });
}

export async function getHistoryEntries() {
  const data = await getScopedStorageValues([STORAGE_KEYS.historyEntries]);
  return data[STORAGE_KEYS.historyEntries] ?? [];
}

export async function upsertHistoryEntry(entry) {
  const current = await getHistoryEntries();
  const next = [
    entry,
    ...current.filter((item) => item.jobKey !== entry.jobKey),
  ].slice(0, MAX_HISTORY_ENTRIES);
  await setScopedStorageValues({ [STORAGE_KEYS.historyEntries]: next });
  return next;
}

export async function removeHistoryEntryByRunId(runId) {
  const normalizedRunId = String(runId || "").trim();
  if (!normalizedRunId) {
    throw new Error("Missing run id for history deletion.");
  }

  const current = await getHistoryEntries();
  const next = current.filter((entry) => entry?.runId !== normalizedRunId);
  await setScopedStorageValues({ [STORAGE_KEYS.historyEntries]: next });
  return {
    removed: next.length !== current.length,
    history: next,
  };
}

export async function getActiveAccountKey() {
  return getCurrentAccountKey();
}

export async function activateAccountWorkspace(user) {
  const nextAccountKey = deriveAccountKeyFromUser(user);
  await ensureAccountStorageMigrated(nextAccountKey);
  const previousData = await storageGet(STORAGE_KEYS.activeAccountKey);
  const previousAccountKey = normalizeStoredAccountKey(
    previousData[STORAGE_KEYS.activeAccountKey],
  );

  if (nextAccountKey) {
    await storageSet({ [STORAGE_KEYS.activeAccountKey]: nextAccountKey });
  } else {
    await chrome.storage.local.remove(STORAGE_KEYS.activeAccountKey);
  }

  return {
    previousAccountKey,
    accountKey: nextAccountKey,
    switched:
      Boolean(previousAccountKey) &&
      Boolean(nextAccountKey) &&
      previousAccountKey !== nextAccountKey,
  };
}

export async function clearAccountDisconnectState(accountKey) {
  await clearDisconnectStateForAccount(accountKey);
}

export async function clearExtensionLocalData() {
  await removeScopedStorageKeys(LEGACY_ACCOUNT_SCOPED_KEYS);
  await chrome.storage.local.remove(STORAGE_KEYS.extensionPendingAction);
  await syncBrowserActionState({ status: SESSION_STATUS.idle });
}

export async function clearAllExtensionLocalData() {
  const allStored = await storageGet(null);
  const scopedKeys = Object.keys(allStored).filter((storageKey) =>
    storageKey.startsWith("account::"),
  );

  await chrome.storage.local.remove([
    "masterResumeId",
    "resumeMatcherFloatingButtonTopOffset",
    STORAGE_KEYS.accountStorageVersion,
    STORAGE_KEYS.activeAccountKey,
    STORAGE_KEYS.legacyScopedData,
    STORAGE_KEYS.appOrigin,
    STORAGE_KEYS.apiOrigin,
    STORAGE_KEYS.extensionAuth,
    STORAGE_KEYS.analyticsState,
    STORAGE_KEYS.extensionPendingAction,
    ...LEGACY_ACCOUNT_SCOPED_KEYS,
    ...scopedKeys,
  ]);
  await syncBrowserActionState({ status: SESSION_STATUS.idle });
}

export async function resetExtensionSettingsToDefault() {
  await removeScopedStorageKeys(ACCOUNT_SETTINGS_SCOPED_KEYS);
  await chrome.storage.local.remove([
    "resumeMatcherFloatingButtonTopOffset",
    STORAGE_KEYS.appOrigin,
    STORAGE_KEYS.apiOrigin,
  ]);
  await syncBrowserActionState(await getExtensionState());
}
