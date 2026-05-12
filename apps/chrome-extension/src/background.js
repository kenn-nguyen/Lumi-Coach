import {
  generateResumeForLinkedInJob,
  importMasterResumeFromTextAsset,
  saveStoryboardAsset,
} from "./runtime/orchestrator.js";
import { captureExtensionEvent } from "./runtime/analytics.js";
import { logError, logInfo, logWarn, setLogRelayTabId } from "./runtime/log.js";
import { clearPromptTemplateCache } from "./runtime/prompt-loader.js";
import {
  fetchResumeById,
  fetchExtensionAccessToken,
  listResumes,
  openPreviewTab,
  openWebsiteSignInTab,
  openWebsiteSignOutTab,
  syncExtensionPromptDefaults,
  verifyWebsiteSession,
} from "./runtime/api.js";
import { SESSION_STATUS } from "./runtime/constants.js";
import {
  areSameAccountUsers,
  deriveAccountKeyFromUser,
} from "./runtime/account.js";
import {
  classifyLinkedInJobsRoute,
  isLinkedInJobsShellUrl,
  LINKEDIN_ROUTE_MODE,
} from "./shared/linkedin-route.js";
import { getExtensionSetupState } from "./runtime/setup-state.js";
import { syncExtensionRun } from "./runtime/extension-runs.js";
import {
  getActiveLlmProfile,
  updateLlmSettings,
} from "./runtime/llm/profiles.js";
import { validateApiProfile } from "./runtime/llm/api-check.js";
import {
  activateAccountWorkspace,
  clearAccountDisconnectState,
  clearExtensionAuth,
  clearAllExtensionLocalData,
  clearPendingExtensionAction,
  clearExtensionLocalData,
  completeOnboarding,
  getActiveAccountKey,
  getExtensionAuth,
  getExtensionState,
  getOnboardingProgress,
  getUserAssets,
  getPendingExtensionAction,
  getServerPromptDefaults,
  hasValidExtensionAuth,
  resetExtensionSettingsToDefault,
  applyServerPromptDefaultsSyncResult,
  saveApifyFallbackSettings,
  saveLlmSettings,
  setApiOrigin,
  setAppOrigin,
  setChatGptTargetUrl,
  setExtensionAuth,
  setExtensionState,
  setLastError,
  setMasterResumeContextAsset,
  setOnboardingProgress,
  setPendingExtensionAction,
  savePromptTemplateProfileSelection,
  setStoryboardAsset,
  setPromptTemplateAsset,
} from "./runtime/storage.js";
import {
  getPackagedPromptArtifactText,
  getPromptArtifactDefinition,
  getPromptArtifactKeysForTemplate,
  getPromptDownloadConfig,
} from "./runtime/prompt-defaults.js";
import {
  clearActiveRun,
  ensureActiveRun,
  getActiveRunConflict,
  getActiveRun,
  isRunCanceledError,
  markRunTerminal,
  requestActiveRunCancel,
  updateActiveRun,
} from "./runtime/run-control.js";

let suppressSourceFocusUntil = 0;
let backendMasterResumeCache = {
  accountKey: null,
  hasValue: false,
  value: null,
  promise: null,
  fetchedAt: 0,
};
let backendMasterResumeDataCache = {
  accountKey: null,
  resumeId: null,
  hasValue: false,
  value: null,
  promise: null,
  fetchedAt: 0,
};
const ACTIVE_SESSION_STATUSES = new Set([
  SESSION_STATUS.starting,
  SESSION_STATUS.bootstrapMaster,
  SESSION_STATUS.scraped,
  SESSION_STATUS.prompt1Done,
  SESSION_STATUS.prompt2Done,
  SESSION_STATUS.prompt3Done,
  SESSION_STATUS.validated,
  SESSION_STATUS.canceling,
]);

function getStaleRunCancelPhase(extensionState) {
  const status = extensionState?.status;
  if (status === SESSION_STATUS.bootstrapMaster) {
    return "base resume setup";
  }
  if (status === SESSION_STATUS.scraped) {
    return "job extraction";
  }
  if (status === SESSION_STATUS.prompt1Done) {
    return "Prompt 1";
  }
  if (status === SESSION_STATUS.prompt2Done) {
    return "Prompt 2";
  }
  if (status === SESSION_STATUS.prompt3Done) {
    return "Prompt 3";
  }
  if (status === SESSION_STATUS.validated) {
    return "resume patch";
  }
  if (status === SESSION_STATUS.canceling) {
    return extensionState?.cancelPhase || "running";
  }
  return "running";
}

async function normalizeOrphanedRunSession(extensionState) {
  const session = extensionState ?? (await getExtensionState().catch(() => null));
  const runId =
    typeof session?.sessionId === "string" && session.sessionId
      ? session.sessionId
      : null;
  if (!runId || !ACTIVE_SESSION_STATUSES.has(session?.status)) {
    return session;
  }
  if (getActiveRun(runId)) {
    return session;
  }

  const healed = await setExtensionState({
    sessionId: runId,
    status: SESSION_STATUS.canceled,
    cancelReason: session?.cancelReason || "browser_closed",
    cancelPhase: getStaleRunCancelPhase(session),
    previewUrl: null,
    patchError: null,
  });
  return healed;
}

function getSignedOutWorkspaceMessage() {
  return "Sign in to continue tailoring this job. Each account keeps its own local extension workspace.";
}

function getAccountSwitchMessage() {
  return "You’re signed in with a different account. This account uses its own local extension workspace.";
}

function hasAccountMismatch(extensionAuth, websiteSession) {
  if (!extensionAuth?.user || !websiteSession?.user) {
    return false;
  }

  return !areSameAccountUsers(extensionAuth.user, websiteSession.user);
}

async function applyExtensionAuthPayload(payload) {
  const previousAuth = await getExtensionAuth();
  const previousAccountKey =
    deriveAccountKeyFromUser(previousAuth?.user) ??
    (await getActiveAccountKey());
  const nextAccountKey = deriveAccountKeyFromUser(payload?.user);
  const accountChanged =
    Boolean(previousAccountKey) &&
    Boolean(nextAccountKey) &&
    previousAccountKey !== nextAccountKey;

  logInfo("Background", "Applying extension auth payload.", {
    previousAccountKey,
    nextAccountKey,
    previousUser: previousAuth?.user
      ? {
          id: previousAuth.user.id ?? null,
          email: previousAuth.user.email ?? null,
        }
      : null,
    nextUser: payload?.user
      ? {
          id: payload.user.id ?? null,
          email: payload.user.email ?? null,
        }
      : null,
    accountChanged,
  });

  if (accountChanged && previousAccountKey) {
    await cancelActiveRun({
      reason: "account_switched",
      phase: "account_switch",
    });
    await clearAccountDisconnectState(previousAccountKey);
  }

  await setExtensionAuth({
    token: payload.token,
    expiresAt: payload.expiresAt,
    user: payload.user ?? null,
    connectedAt: new Date().toISOString(),
  });
  const activation = await activateAccountWorkspace(payload.user ?? null);
  const activeAccountKey = await getActiveAccountKey();

  logInfo("Background", "Extension auth payload applied.", {
    previousAccountKey,
    nextAccountKey,
    activeAccountKey,
    activation,
  });

  return {
    accountChanged:
      accountChanged || activation.switched === true,
    previousAccountKey,
    accountKey: nextAccountKey,
  };
}

async function getConnectionSnapshot({ trySync = true } = {}) {
  let extensionConnected = false;
  let websiteAuthenticated = false;
  let extensionAuth = null;
  let websiteSession = null;

  try {
    extensionAuth = await getExtensionAuth();
    extensionConnected = await hasValidExtensionAuth();
  } catch {
    extensionConnected = false;
    extensionAuth = null;
  }

  try {
    websiteSession = await verifyWebsiteSession();
    websiteAuthenticated = websiteSession?.authenticated === true;
  } catch {
    websiteAuthenticated = false;
  }

  const accountMismatch =
    websiteAuthenticated && hasAccountMismatch(extensionAuth, websiteSession);
  if (trySync && websiteAuthenticated && (!extensionConnected || accountMismatch)) {
    try {
      const synced = await syncExtensionAuthFromWebsite();
      extensionConnected = Boolean(synced?.token);
      if (extensionConnected) {
        void syncDefaultPromptArtifacts().catch((error) => {
          logWarn("Background", "Prompt defaults sync after auth sync failed.", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch {
      if (!extensionConnected || accountMismatch) {
        extensionConnected = false;
      }
    }
  } else if (accountMismatch) {
    extensionConnected = false;
  }

  const connected = extensionConnected;
  return {
    connected,
    extensionConnected,
    websiteAuthenticated,
    connectionState: connected ? "connected" : "signed_out",
  };
}

async function getRuntimeSnapshot({
  trySync = true,
  currentUrl = "",
  refreshBackendMaster = false,
  backendMasterMaxAgeMs = 0,
} = {}) {
  const [rawExtensionState, assets, connection, onboardingProgress] =
    await Promise.all([
      getExtensionState(),
      getUserAssets(),
      getConnectionSnapshot({ trySync }),
      getOnboardingProgress(),
    ]);
  const extensionState = await normalizeOrphanedRunSession(rawExtensionState);
  const backendMasterResume = await resolveBackendMasterResumeForAccount({
    accountKey: assets.activeAccountKey,
    connected: connection.connected,
    forceRefresh: refreshBackendMaster,
    maxAgeMs: backendMasterMaxAgeMs,
  });
  if (backendMasterResume?.resumeId) {
    void prefetchBackendMasterResumeDataForAccount({
      accountKey: assets.activeAccountKey,
      backendMasterResume,
      forceRefresh: refreshBackendMaster,
    });
  }
  const assetsWithBackendMaster = {
    ...assets,
    backendMasterResume,
  };

  return {
    ok: true,
    state: extensionState,
    assets: assetsWithBackendMaster,
    route: classifyLinkedInJobsRoute(currentUrl),
    ...connection,
    setupState: getExtensionSetupState({
      assets: assetsWithBackendMaster,
      extensionConnected: connection.extensionConnected,
      websiteAuthenticated: connection.websiteAuthenticated,
      onboardingProgress,
    }),
  };
}

async function getBackendMasterResumeSummary() {
  const resumeList = await listResumes(true);
  const masterResume = resumeList?.data?.find((resume) => resume?.is_master);
  if (!masterResume?.resume_id) {
    return null;
  }
  return {
    resumeId: masterResume.resume_id,
    filename: masterResume.filename ?? null,
    title: masterResume.title ?? null,
    updatedAt: masterResume.updated_at ?? null,
    processingStatus: masterResume.processing_status ?? null,
  };
}

function getCachedBackendMasterResume(accountKey) {
  if (
    !accountKey ||
    backendMasterResumeCache.accountKey !== accountKey ||
    !backendMasterResumeCache.hasValue
  ) {
    return null;
  }
  return backendMasterResumeCache.value;
}

function setCachedBackendMasterResume(accountKey, value) {
  backendMasterResumeCache = {
    accountKey: accountKey || null,
    hasValue: Boolean(accountKey),
    value: value ?? null,
    promise: null,
    fetchedAt: Date.now(),
  };
  if (
    !value?.resumeId ||
    backendMasterResumeDataCache.accountKey !== accountKey ||
    backendMasterResumeDataCache.resumeId !== value.resumeId
  ) {
    backendMasterResumeDataCache = {
      accountKey: null,
      resumeId: null,
      hasValue: false,
      value: null,
      promise: null,
      fetchedAt: 0,
    };
  }
}

function clearBackendMasterResumeCache() {
  backendMasterResumeCache = {
    accountKey: null,
    hasValue: false,
    value: null,
    promise: null,
    fetchedAt: 0,
  };
  backendMasterResumeDataCache = {
    accountKey: null,
    resumeId: null,
    hasValue: false,
    value: null,
    promise: null,
    fetchedAt: 0,
  };
}

function setCachedBackendMasterResumeData(accountKey, resumeId, value) {
  backendMasterResumeDataCache = {
    accountKey: accountKey || null,
    resumeId: resumeId || null,
    hasValue: Boolean(accountKey && resumeId),
    value: value ?? null,
    promise: null,
    fetchedAt: Date.now(),
  };
}

function prefetchBackendMasterResumeDataForAccount({
  accountKey,
  backendMasterResume,
  forceRefresh = false,
} = {}) {
  const resumeId = backendMasterResume?.resumeId ?? null;
  if (!accountKey || !resumeId) {
    return Promise.resolve(null);
  }

  if (
    !forceRefresh &&
    backendMasterResumeDataCache.accountKey === accountKey &&
    backendMasterResumeDataCache.resumeId === resumeId &&
    backendMasterResumeDataCache.hasValue
  ) {
    return Promise.resolve(backendMasterResumeDataCache.value);
  }

  if (
    backendMasterResumeDataCache.accountKey === accountKey &&
    backendMasterResumeDataCache.resumeId === resumeId &&
    backendMasterResumeDataCache.promise
  ) {
    return backendMasterResumeDataCache.promise;
  }

  const promise = fetchResumeById(resumeId)
    .then((resumePayload) => {
      setCachedBackendMasterResumeData(accountKey, resumeId, resumePayload);
      logInfo("Background", "Backend Master Resume prefetched.", {
        resumeId,
      });
      return resumePayload;
    })
    .catch((error) => {
      backendMasterResumeDataCache = {
        ...backendMasterResumeDataCache,
        promise: null,
      };
      logWarn("Background", "Failed to prefetch backend Master Resume.", {
        resumeId,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

  backendMasterResumeDataCache = {
    ...backendMasterResumeDataCache,
    accountKey,
    resumeId,
    promise,
  };
  return promise;
}

async function resolveBackendMasterResumeForAccount({
  accountKey,
  connected = true,
  forceRefresh = false,
  maxAgeMs = 0,
} = {}) {
  if (!connected || !accountKey) {
    return null;
  }

  if (
    !forceRefresh &&
    backendMasterResumeCache.accountKey === accountKey &&
    backendMasterResumeCache.hasValue
  ) {
    return backendMasterResumeCache.value;
  }

  if (
    maxAgeMs > 0 &&
    backendMasterResumeCache.accountKey === accountKey &&
    backendMasterResumeCache.hasValue &&
    Date.now() - backendMasterResumeCache.fetchedAt < maxAgeMs
  ) {
    return backendMasterResumeCache.value;
  }

  if (
    backendMasterResumeCache.accountKey === accountKey &&
    backendMasterResumeCache.promise
  ) {
    return backendMasterResumeCache.promise;
  }

  const promise = getBackendMasterResumeSummary()
    .then((backendMasterResume) => {
      setCachedBackendMasterResume(accountKey, backendMasterResume);
      return backendMasterResume;
    })
    .catch((error) => {
      backendMasterResumeCache = {
        ...backendMasterResumeCache,
        promise: null,
      };
      logWarn("Background", "Failed to load backend Master Resume summary.", {
        message: error instanceof Error ? error.message : String(error),
      });
      return getCachedBackendMasterResume(accountKey);
    });

  backendMasterResumeCache = {
    ...backendMasterResumeCache,
    accountKey,
    promise,
  };
  return promise;
}

async function getUserAssetsWithBackendMaster({ forceRefresh = true } = {}) {
  const assets = await getUserAssets();
  const backendMasterResume = await resolveBackendMasterResumeForAccount({
    accountKey: assets.activeAccountKey,
    connected: true,
    forceRefresh,
    maxAgeMs: 0,
  });
  return {
    ...assets,
    backendMasterResume,
  };
}

async function syncExtensionAuthFromWebsite() {
  logInfo("Background", "Starting website-to-extension auth sync.");
  const payload = await fetchExtensionAccessToken();
  if (!payload?.token || !payload?.expiresAt) {
    logWarn("Background", "Website auth sync returned no usable token.", {
      hasToken: Boolean(payload?.token),
      hasExpiry: Boolean(payload?.expiresAt),
      user: payload?.user
        ? {
            id: payload.user.id ?? null,
            email: payload.user.email ?? null,
          }
        : null,
    });
    return null;
  }

  const transition = await applyExtensionAuthPayload(payload);
  logInfo("Background", "Website-to-extension auth sync completed.", {
    accountChanged: transition.accountChanged === true,
    previousAccountKey: transition.previousAccountKey ?? null,
    accountKey: transition.accountKey ?? null,
  });
  return {
    ...payload,
    ...transition,
  };
}

async function syncDefaultPromptArtifacts() {
  const hasAuth = await hasValidExtensionAuth().catch(() => false);
  if (!hasAuth) {
    return {
      ok: false,
      skipped: true,
    };
  }
  const cache = await getServerPromptDefaults();
  try {
    const syncResult = await syncExtensionPromptDefaults(cache.manifest);
    const applied = await applyServerPromptDefaultsSyncResult(syncResult);
    if (applied.changedKeys.length > 0) {
      clearPromptTemplateCache();
    }
    return {
      ok: true,
      changedKeys: applied.changedKeys,
      lastSyncedAt: applied.lastSyncedAt,
      degraded: false,
    };
  } catch (error) {
    logWarn("Background", "Prompt defaults sync failed; keeping cached/default prompts.", {
      error: error instanceof Error ? error.message : String(error),
      cachedArtifactCount: Object.keys(cache.artifacts ?? {}).length,
      hasCachedManifest: Object.keys(cache.manifest ?? {}).length > 0,
    });
    return {
      ok: true,
      changedKeys: [],
      lastSyncedAt: cache.lastSyncedAt ?? null,
      degraded: true,
      usedCachedDefaults: Object.keys(cache.artifacts ?? {}).length > 0,
    };
  }
}

async function buildDefaultPromptDownload(templateName, promptProfileId = null) {
  const config = getPromptDownloadConfig(templateName);
  if (!config) {
    throw new Error(`Unknown prompt template "${templateName}".`);
  }

  let cache = await getServerPromptDefaults();
  const artifactKeys = getPromptArtifactKeysForTemplate(
    templateName,
    promptProfileId,
  );
  const missingArtifact = artifactKeys.some(
    (artifactKey) => typeof cache.artifacts?.[artifactKey] !== "string",
  );

  if (missingArtifact) {
    try {
      await syncDefaultPromptArtifacts();
      cache = await getServerPromptDefaults();
    } catch (error) {
      logWarn("Background", "Prompt defaults sync failed before download fallback.", {
        templateName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const entries = [];
  for (const artifactKey of artifactKeys) {
    const definition = getPromptArtifactDefinition(artifactKey);
    if (!definition?.fileName) {
      continue;
    }

    let content = cache.artifacts?.[artifactKey];
    if (typeof content !== "string") {
      content = await getPackagedPromptArtifactText(artifactKey).catch(() => "");
    }
    if (typeof content !== "string" || content.length === 0) {
      continue;
    }
    entries.push({
      name: definition.fileName,
      content,
    });
  }

  if (entries.length === 0) {
    throw new Error(`Failed to load default prompt files for ${templateName}.`);
  }

  return {
    ok: true,
    downloadName: config.downloadName,
    entries,
  };
}

function isSupportedContentScriptUrl(url = "") {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function broadcastContentScriptMessage(message) {
  const tabs = await chrome.tabs.query({}).catch(() => []);
  await Promise.all(
    tabs
      .filter((tab) =>
        isSupportedContentScriptUrl(tab.url || tab.pendingUrl || ""),
      )
      .filter((tab) => typeof tab.id === "number")
      .map((tab) => chrome.tabs.sendMessage(tab.id, message).catch(() => {})),
  );
}

function getCurrentRunSourceUrl(extensionState) {
  return (
    extensionState?.jobSnapshot?.sourceUrl ||
    extensionState?.activeRunJob?.sourceUrl ||
    ""
  );
}

function getCurrentRunLocation(extensionState) {
  return (
    extensionState?.jobSnapshot?.location ||
    extensionState?.activeRunJob?.location ||
    null
  );
}

async function finalizeCanceledRun(run, options = {}) {
  if (!run?.runId) return;

  const extensionState = await getExtensionState().catch(() => null);
  const currentRunId = extensionState?.sessionId ?? null;
  const shouldPersistSession = currentRunId === run.runId || !currentRunId;
  const cancelReason = options.reason ?? run.cancelReason ?? "user";
  const cancelPhase = options.phase ?? run.cancelPhase ?? run.phase ?? "running";

  if (shouldPersistSession) {
    const nextState = {
      sessionId: run.runId,
      sourceTabId: run.sourceTabId ?? extensionState?.sourceTabId ?? null,
      activeRunJob: run.activeRunJob ?? extensionState?.activeRunJob ?? null,
      previewUrl: null,
      patchError: null,
      status: SESSION_STATUS.canceled,
      cancelReason,
      cancelPhase,
    };
    await setExtensionState(nextState);
  }

  const sourceUrl = getCurrentRunSourceUrl(extensionState);
  await clearPendingExtensionAction();
  markRunTerminal(run.runId, "canceled");
  const cancelMessage = {
    type: "EXTENSION_RUN_CANCELED",
    payload: {
      runId: run.runId,
      reason: cancelReason,
      phase: cancelPhase,
    },
  };
  if (run.sourceTabId) {
    await chrome.tabs.sendMessage(run.sourceTabId, cancelMessage).catch(() => {});
  } else {
    await broadcastContentScriptMessage(cancelMessage);
  }
  clearActiveRun(run.runId);

  if (sourceUrl) {
    const historyEntry = {
      jobKey: sourceUrl,
      sourceUrl,
      title:
        extensionState?.jobSnapshot?.title ||
        extensionState?.activeRunJob?.title ||
        "Untitled role",
      company:
        extensionState?.jobSnapshot?.company ||
        extensionState?.activeRunJob?.company ||
        "Unknown company",
      location: getCurrentRunLocation(extensionState),
      datePosted: extensionState?.jobSnapshot?.datePosted ?? null,
      generatedAt: new Date().toISOString(),
      resumeId: extensionState?.tailoredResumeId ?? null,
      previewUrl: null,
      status: "canceled",
      runId: run.runId,
      providerId: extensionState?.llmProfileId ?? null,
      providerLabel: extensionState?.llmProfileLabel ?? null,
      providerVendor: null,
      providerMode: null,
      jobSource: extensionState?.jobSnapshot?.source ?? null,
      jobReadiness: extensionState?.jobSnapshot?.readiness ?? null,
      descriptionProvenance:
        extensionState?.jobSnapshot?.provenance?.description ?? null,
      descriptionLength:
        extensionState?.jobSnapshot?.quality?.descriptionLength ?? null,
      scrapeConfidence:
        extensionState?.jobSnapshot?.quality?.confidence ?? null,
      manualJobInputUsed:
        extensionState?.jobSnapshot?.source === "manual_text" ||
        extensionState?.jobSnapshot?.diagnostics?.manualOverride === true,
      customContextProvided: false,
      customContextLength: 0,
      storyboardPresent: false,
      prompt1DurationMs: extensionState?.prompt1DurationMs ?? null,
      prompt2DurationMs: extensionState?.prompt2DurationMs ?? null,
      prompt3DurationMs: extensionState?.prompt3DurationMs ?? null,
      patchDurationMs: extensionState?.patchDurationMs ?? null,
      totalDurationMs:
        typeof run.cancelRequestedAt === "number"
          ? Math.max(
              0,
              run.cancelRequestedAt - (run.startedAt ?? run.cancelRequestedAt),
            )
          : null,
      prompt3ValidationErrorCount:
        Array.isArray(extensionState?.prompt3ValidationErrors)
          ? extensionState.prompt3ValidationErrors.length
          : 0,
      prompt4Input: extensionState?.prompt4Input ?? null,
      prompt4Raw: extensionState?.prompt4Raw ?? null,
      prompt4Result: extensionState?.prompt4Result ?? null,
      prompt1Input: extensionState?.prompt1Input ?? null,
      prompt1Raw: extensionState?.prompt1Raw ?? null,
      prompt1Result: extensionState?.prompt1Result ?? null,
      prompt2Input: extensionState?.prompt2Input ?? null,
      prompt2Raw: extensionState?.prompt2Raw ?? null,
      prompt2Result: extensionState?.prompt2Result ?? null,
      prompt3Input: extensionState?.prompt3Input ?? null,
      prompt3Raw: extensionState?.prompt3Raw ?? null,
      prompt3Parsed: extensionState?.prompt3Parsed ?? null,
      prompt3Feedback: extensionState?.prompt3Feedback ?? null,
      cancelReason,
      cancelPhase,
    };
    void syncExtensionRun(historyEntry).catch((error) => {
      logWarn("Background", "Failed to sync canceled run.", {
        runId: run.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  void captureExtensionEvent("tailor_canceled", {
    surface: "run_view",
    run_id: run.runId,
    source_tab_id: run.sourceTabId ?? null,
    cancel_reason: cancelReason,
    cancel_phase: cancelPhase,
  }).catch(() => {});
}

async function cancelActiveRun(options = {}) {
  const run = getActiveRun();
  if (!run) {
    const extensionState = await normalizeOrphanedRunSession();
    if (
      extensionState?.status === SESSION_STATUS.canceled &&
      extensionState?.sessionId
    ) {
      return {
        ok: true,
        canceled: true,
        immediate: true,
        runId: extensionState.sessionId,
        reason: "stale_session",
        phase: extensionState.cancelPhase || "running",
      };
    }
    return { ok: true, canceled: false, reason: "no_active_run" };
  }

  const cancelResult = await requestActiveRunCancel(options);
  if (cancelResult.canceled && cancelResult.immediate) {
    await finalizeCanceledRun(run, options);
  } else if (cancelResult.canceled) {
    await setExtensionState({
      status: SESSION_STATUS.canceling,
      cancelReason: options.reason ?? run.cancelReason ?? "user",
      cancelPhase: options.phase ?? run.cancelPhase ?? run.phase ?? "running",
    }).catch(() => {});
  }
  return cancelResult;
}

function isInjectableContentScriptUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId, url) {
  if (typeof tabId !== "number" || !isInjectableContentScriptUrl(url)) {
    return false;
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "EXTENSION_PING",
    });
    if (response?.ok) {
      return true;
    }
  } catch {
    // Fall through to programmatic injection.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/linkedin-job.js"],
    });
    return true;
  } catch (error) {
    logWarn("Background", "Failed to ensure content script.", {
      tabId,
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function ensureLinkedInContentScript(tabId, url) {
  if (typeof tabId !== "number" || !isLinkedInJobsShellUrl(url)) {
    return false;
  }

  return ensureContentScript(tabId, url);
}

async function showLauncherInTab(tabId, url) {
  if (!(await ensureContentScript(tabId, url))) {
    return false;
  }
  await chrome.tabs.sendMessage(tabId, { type: "EXTENSION_SHOW_LAUNCHER" });
  return true;
}

async function sendLinkedInRouteChange(tabId, url) {
  if (typeof tabId !== "number" || !isLinkedInJobsShellUrl(url)) {
    return;
  }

  const ready = await ensureLinkedInContentScript(tabId, url);
  if (!ready) {
    return;
  }

  await chrome.tabs
    .sendMessage(tabId, {
      type: "EXTENSION_ROUTE_CHANGED",
      payload: {
        route: classifyLinkedInJobsRoute(url),
      },
    })
    .catch(() => {});
}

async function consumePatchedSuccess(extensionState = null) {
  const currentState =
    extensionState ?? (await getExtensionState().catch(() => null));
  if (!currentState || currentState.status !== SESSION_STATUS.patched) {
    return;
  }

  const sourceTabId = currentState.sourceTabId ?? null;
  await setExtensionState({
    status: SESSION_STATUS.idle,
    sourceTabId: null,
    activeRunJob: null,
    previewUrl: null,
    patchError: null,
  });

  const message = {
    type: "EXTENSION_PREVIEW_OPENED",
    payload: {
      sourceTabId,
    },
  };

  if (sourceTabId) {
    await chrome.tabs.sendMessage(sourceTabId, message).catch(() => {});
  }

  await broadcastContentScriptMessage(message);
}

async function ensureExtensionAuthForAction(pendingAction, options = {}) {
  const [hasAuth, extensionAuth] = await Promise.all([
    hasValidExtensionAuth(),
    getExtensionAuth(),
  ]);
  if (!hasAuth) {
    let websiteAuthenticated = false;
    try {
      const websiteSession = await verifyWebsiteSession();
      websiteAuthenticated = websiteSession?.authenticated === true;
    } catch {
      websiteAuthenticated = false;
    }
    await setPendingExtensionAction(pendingAction);
    if (websiteAuthenticated) {
      try {
        const synced = await syncExtensionAuthFromWebsite();
        if (synced) {
          return { connected: true, connectionState: "connected" };
        }
      } catch (error) {
        logError(
          "Background",
          "Automatic extension auth sync failed before action.",
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }
    return {
      connected: false,
      connectionState: "signed_out",
      message: getSignedOutWorkspaceMessage(),
    };
  }

  if (options.skipWebsiteSessionCheck) {
    return { connected: true };
  }

  let websiteSession = null;
  try {
    websiteSession = await verifyWebsiteSession();
  } catch (error) {
    logWarn(
      "Background",
      "Website session check failed after extension auth; continuing with extension token.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return { connected: true, connectionState: "connected" };
  }

  if (!websiteSession?.authenticated) {
    return { connected: true, connectionState: "connected" };
  }

  if (!hasAccountMismatch(extensionAuth, websiteSession)) {
    return { connected: true, connectionState: "connected" };
  }

  await setPendingExtensionAction(pendingAction);
  try {
    const synced = await syncExtensionAuthFromWebsite();
    if (synced?.token) {
      return {
        connected: true,
        connectionState: "connected",
        accountChanged: synced.accountChanged === true,
      };
    }
  } catch (error) {
    logError(
      "Background",
      "Automatic extension auth sync failed after account mismatch.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

  return {
    connected: false,
    connectionState: "signed_out",
    message: getSignedOutWorkspaceMessage(),
  };
}

async function maybeResumePendingExtensionAction(options = {}) {
  const pendingAction = await getPendingExtensionAction();
  if (!pendingAction) return;
  await resumePendingExtensionAction(options);
}

function getMissingMasterResumeContextMessage() {
  return "Add your Master Resume to Lumi Coach before tailoring. Upload it in the extension to extract and save it.";
}

function isReconnectRequiredError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /connect the som career coach extension before continuing/i.test(message) ||
    /extension session expired\. reconnect som career coach and try again\./i.test(
      message,
    ) ||
    /missing bearer token/i.test(message) ||
    /expired bearer token/i.test(message)
  );
}

async function focusSourceTab(tabId) {
  if (!tabId) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (typeof tab.windowId === "number") {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });
  } catch {
    // Ignore missing or stale tabs.
  }
}

function suppressSourceFocusFor(ms) {
  suppressSourceFocusUntil = Date.now() + ms;
}

function isSourceFocusSuppressed() {
  return Date.now() < suppressSourceFocusUntil;
}

async function resumePendingExtensionAction(options = {}) {
  const pendingAction = await getPendingExtensionAction();
  if (!pendingAction) return;

  if (pendingAction.type === "generate_active_job") {
    const runId = pendingAction.runId ?? crypto.randomUUID();
    const tabId = pendingAction.tabId ?? null;
    ensureActiveRun({
      runId,
      sourceTabId: tabId,
      activeRunJob: pendingAction.activeRunJob ?? null,
      phase: "preflight",
      inFlight: false,
      cancelable: true,
    });
    const authGate = await ensureExtensionAuthForAction(pendingAction, {
      skipWebsiteSessionCheck: options.skipWebsiteSessionCheck === true,
    });
    if (!authGate.connected) {
      updateActiveRun(runId, { phase: "awaiting_auth", inFlight: false });
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, {
            type: "EXTENSION_AUTH_REQUIRED",
            payload: {
              runId,
              connectionState: authGate.connectionState || "signed_out",
              message: authGate.message || "Sign in to Lumi Coach to continue.",
            },
          })
          .catch(() => {});
      }
      return;
    }
    const assets = await getUserAssetsWithBackendMaster();
    const setupState = getExtensionSetupState({
      assets,
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: await getOnboardingProgress(),
    });
    if (setupState?.state === "missing_resume") {
      updateActiveRun(runId, { phase: "setup_required", inFlight: false });
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, {
            type: "EXTENSION_SETUP_REQUIRED",
            payload: {
              setupState,
              message: getMissingMasterResumeContextMessage(),
            },
          })
          .catch(() => {});
      }
      return;
    }
    if (setupState?.state === "missing_provider_config") {
      updateActiveRun(runId, { phase: "setup_required", inFlight: false });
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, {
            type: "EXTENSION_SETUP_REQUIRED",
            payload: {
              setupState,
              message:
                setupState.detail ||
                "Finish provider setup in the extension to continue.",
            },
          })
          .catch(() => {});
      }
      return;
    }
    await clearPendingExtensionAction();
    setLogRelayTabId(tabId);
    try {
      updateActiveRun(runId, { phase: "running", inFlight: true });
      await setExtensionState({
        sessionId: runId,
        sourceTabId: tabId,
        activeRunJob: pendingAction.activeRunJob ?? null,
        status: SESSION_STATUS.starting,
        previewUrl: null,
        patchError: null,
        prompt1DurationMs: null,
        prompt2DurationMs: null,
        prompt3DurationMs: null,
        promptMetadata: null,
        patchDurationMs: null,
        cancelReason: null,
        cancelPhase: null,
      });
      const runtimeState = await getExtensionState();
      await captureExtensionEvent("tailor_started", {
        surface: "run_view",
        run_id: runtimeState?.sessionId ?? null,
        source_tab_id: tabId ?? null,
        resumed: true,
      });
      await generateResumeForLinkedInJob(
        tabId,
        pendingAction.prompt1CustomInstruction ?? "",
        pendingAction.jobInput ?? null,
      );
      markRunTerminal(runId, "completed");
      clearActiveRun(runId);
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, {
            type: "EXTENSION_RESUMED_GENERATION_RESULT",
            payload: { ok: true, runId },
          })
          .catch(() => {});
      }
    } catch (error) {
      if (isRunCanceledError(error)) {
        await finalizeCanceledRun(getActiveRun(runId) || { runId }, {
          reason: "user",
        });
        if (tabId) {
          chrome.tabs
            .sendMessage(tabId, {
              type: "EXTENSION_RESUMED_GENERATION_RESULT",
              payload: { ok: true, canceled: true, runId },
            })
            .catch(() => {});
        }
        return;
      }
      const runtimeState = await getExtensionState();
      await captureExtensionEvent("tailor_failed", {
        surface: "run_view",
        run_id: runtimeState?.sessionId ?? null,
        resumed: true,
        error_message:
          error instanceof Error
            ? error.message
            : "Failed to generate tailored resume.",
      });
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, {
            type: "EXTENSION_RESUMED_GENERATION_RESULT",
            payload: {
              ok: false,
              runId,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to generate tailored resume.",
            },
          })
          .catch(() => {});
      }
      clearActiveRun(runId);
      throw error;
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  logInfo("Background", "Extension installed.");
});

chrome.action.onClicked.addListener(async (tab) => {
  const currentUrl = tab?.url || tab?.pendingUrl || "";
  if (tab?.id && isInjectableContentScriptUrl(currentUrl)) {
    try {
      await showLauncherInTab(tab.id, currentUrl);
      return;
    } catch (error) {
      logError(
        "Background",
        "Failed to show floating launcher in current tab.",
        {
          tabId: tab.id,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  const extensionState = await normalizeOrphanedRunSession();
  const activeStatus = extensionState?.status;
  const sourceTabId = extensionState?.sourceTabId ?? null;

  if (
    [
      SESSION_STATUS.starting,
      SESSION_STATUS.scraped,
      SESSION_STATUS.prompt1Done,
      SESSION_STATUS.prompt2Done,
      SESSION_STATUS.prompt3Done,
      SESSION_STATUS.validated,
    ].includes(activeStatus)
  ) {
    if (sourceTabId) {
      await focusSourceTab(sourceTabId);
      try {
        const sourceTab = await chrome.tabs.get(sourceTabId).catch(() => null);
        await showLauncherInTab(
          sourceTabId,
          sourceTab?.url || sourceTab?.pendingUrl || "",
        );
      } catch {
        // Ignore missing content script or stale LinkedIn tab.
      }
      return;
    }
  }

  if (activeStatus === SESSION_STATUS.patched && extensionState?.previewUrl) {
    await openPreviewTab(extensionState.previewUrl);
    await consumePatchedSuccess(extensionState);
    return;
  }

  // Nothing else to show on non-injectable browser pages.
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const run = async () => {
    logInfo("Background", "Received message.", {
      type: message?.type,
      senderTabId: sender?.tab?.id ?? null,
    });

    switch (message?.type) {
      case "PING":
        return { ok: true, source: "background" };

      case "REGISTER_LOG_VIEWER":
        setLogRelayTabId(sender?.tab?.id ?? null);
        return { ok: true };

      case "GET_STATE":
        return getRuntimeSnapshot({
          currentUrl: sender?.tab?.url || sender?.tab?.pendingUrl || "",
          refreshBackendMaster:
            message.payload?.refreshBackendMaster === true,
          backendMasterMaxAgeMs:
            Number.isFinite(message.payload?.backendMasterMaxAgeMs)
              ? message.payload.backendMasterMaxAgeMs
              : 0,
        });

      case "CHECK_CONNECTION_STATUS":
        return getRuntimeSnapshot({
          currentUrl: sender?.tab?.url || sender?.tab?.pendingUrl || "",
          refreshBackendMaster:
            message.payload?.refreshBackendMaster === true,
          backendMasterMaxAgeMs:
            Number.isFinite(message.payload?.backendMasterMaxAgeMs)
              ? message.payload.backendMasterMaxAgeMs
              : 0,
        });

      case "SYNC_DEFAULT_PROMPTS":
        return syncDefaultPromptArtifacts();

      case "GET_DEFAULT_PROMPT_DOWNLOAD":
        return buildDefaultPromptDownload(
          message.payload?.templateName,
          message.payload?.promptProfileId,
        );

      case "CLEAR_EXTENSION_AUTH":
        await clearExtensionAuth();
        await clearPendingExtensionAction();
        clearBackendMasterResumeCache();
        return { ok: true };

      case "SAVE_STORYBOARD":
        await saveStoryboardAsset(message.payload);
        await maybeResumePendingExtensionAction();
        return { ok: true };

      case "SAVE_MASTER_RESUME_CONTEXT":
        await setMasterResumeContextAsset({
          filename: message.payload?.filename,
          content: message.payload?.content,
          uploadedAt: new Date().toISOString(),
        });
        await maybeResumePendingExtensionAction();
        return { ok: true };

      case "IMPORT_MASTER_RESUME_CONTEXT": {
        const masterResume = await importMasterResumeFromTextAsset({
          filename: message.payload?.filename,
          content: message.payload?.content,
          replaceExisting: message.payload?.replaceExisting !== false,
        });
        const assets = await getUserAssets();
        setCachedBackendMasterResume(assets.activeAccountKey, masterResume);
        await setMasterResumeContextAsset(null);
        await maybeResumePendingExtensionAction();
        return {
          ok: true,
          masterResume,
        };
      }

      case "CLEAR_MASTER_RESUME_CONTEXT":
        await setMasterResumeContextAsset(null);
        return { ok: true };

      case "CLEAR_STORYBOARD":
        await setStoryboardAsset(null);
        return { ok: true };

      case "SAVE_PROMPT_TEMPLATE":
        try {
          await setPromptTemplateAsset(
            message.payload?.templateName,
            {
              filename: message.payload?.filename,
              content: message.payload?.content,
              uploadedAt: new Date().toISOString(),
            },
            message.payload?.promptProfileId,
          );
          clearPromptTemplateCache();
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to save prompt template.",
          };
        }

      case "SAVE_PROMPT_PROFILE_SELECTION":
        clearPromptTemplateCache();
        return {
          ok: true,
          promptTemplateProfiles: await savePromptTemplateProfileSelection(
            message.payload?.profileId,
          ),
        };

      case "DELETE_PROMPT_TEMPLATE":
        try {
          clearPromptTemplateCache();
          await setPromptTemplateAsset(
            message.payload?.templateName,
            null,
            message.payload?.promptProfileId,
          );
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to delete prompt template.",
          };
        }

      case "SAVE_CHATGPT_URL":
        await setChatGptTargetUrl(message.payload?.url);
        return { ok: true };

      case "SAVE_LLM_SETTINGS":
        {
          const currentAssets = await getUserAssets();
          const candidateSettings = updateLlmSettings(
            currentAssets.llmSettings,
            message.payload?.activeProfileId,
            message.payload?.profileUpdates,
          );
          const candidateProfile = getActiveLlmProfile(candidateSettings);
          const validation = await validateApiProfile(candidateProfile);
          if (!validation.ok) {
            return {
              ok: false,
              error:
                validation.error ||
                "AI API error. Check your API provider setup and try again.",
            };
          }
        }
        const llmSettings = await saveLlmSettings(
          message.payload?.activeProfileId,
          message.payload?.profileUpdates,
        );
        await maybeResumePendingExtensionAction();
        return {
          ok: true,
          llmSettings,
        };

      case "SAVE_APIFY_FALLBACK_SETTINGS": {
        const apifyFallbackSettings = await saveApifyFallbackSettings(
          message.payload,
        );
        return {
          ok: true,
          apifyFallbackSettings,
        };
      }

      case "SET_ONBOARDING_STEP": {
        const onboardingProgress = await setOnboardingProgress({
          onboardingStep: message.payload?.step,
        });
        return { ok: true, onboardingProgress };
      }

      case "COMPLETE_ONBOARDING": {
        const onboardingProgress = await completeOnboarding();
        return { ok: true, onboardingProgress };
      }

      case "SAVE_RUNTIME_URLS":
        await setAppOrigin(message.payload?.appUrl);
        await setApiOrigin(message.payload?.apiUrl);
        return { ok: true };

      case "RESET_LOCAL_DATA":
        await clearExtensionLocalData();
        clearBackendMasterResumeCache();
        clearPromptTemplateCache();
        return { ok: true };

      case "RESET_BROWSER_DATA":
        await clearAllExtensionLocalData();
        clearBackendMasterResumeCache();
        clearPromptTemplateCache();
        return { ok: true };

      case "RESET_DEFAULT_SETTINGS":
        await resetExtensionSettingsToDefault();
        return { ok: true };

      case "CANCEL_ACTIVE_RUN": {
        const cancelResult = await cancelActiveRun({
          runId: message.payload?.runId ?? null,
          reason: "user",
          phase: message.payload?.phase ?? "running",
        });
        return { ok: true, ...cancelResult };
      }

      case "TRACK_ANALYTICS_EVENT":
        await captureExtensionEvent(
          message.payload?.event,
          message.payload?.properties || {},
        );
        return { ok: true };

      case "GENERATE_FOR_ACTIVE_JOB": {
        const runId =
          message.payload?.runId ||
          crypto.randomUUID();
        const activeRunConflict = getActiveRunConflict(runId);
        if (activeRunConflict) {
          return {
            ok: false,
            blockedByActiveRun: true,
            runId: activeRunConflict.runId,
            error:
              "A tailoring run is already in progress. Cancel it before starting another.",
          };
        }
        const pendingAction = {
          runId,
          type: "generate_active_job",
          tabId: message.payload?.tabId ?? sender?.tab?.id ?? null,
          prompt1CustomInstruction:
            message.payload?.prompt1CustomInstruction ?? "",
          jobInput: message.payload?.jobInput ?? null,
          activeRunJob: message.payload?.activeRunJob ?? null,
        };
        ensureActiveRun({
          runId,
          sourceTabId: pendingAction.tabId,
          activeRunJob: pendingAction.activeRunJob ?? null,
          phase: "preflight",
          inFlight: false,
          cancelable: true,
          startedAt: Date.now(),
        });
        setLogRelayTabId(message.payload?.tabId ?? sender?.tab?.id ?? null);
        const authGate = await ensureExtensionAuthForAction(pendingAction);
        if (!authGate.connected) {
          updateActiveRun(runId, { phase: "awaiting_auth", inFlight: false });
          await setExtensionState({
            sessionId: runId,
            sourceTabId: pendingAction.tabId,
            activeRunJob: pendingAction.activeRunJob ?? null,
            status: SESSION_STATUS.idle,
            previewUrl: null,
            patchError: null,
            promptMetadata: null,
            cancelReason: null,
            cancelPhase: null,
          });
          return {
            ok: true,
            awaitingAuth: true,
            runId,
            connectionState: authGate.connectionState || "signed_out",
            message: authGate.message || getSignedOutWorkspaceMessage(),
          };
        }
        const assets = await getUserAssetsWithBackendMaster();
        const setupState = getExtensionSetupState({
          assets,
          extensionConnected: true,
          websiteAuthenticated: true,
          onboardingProgress: await getOnboardingProgress(),
        });
        if (setupState?.state === "missing_resume") {
          await setPendingExtensionAction(pendingAction);
          updateActiveRun(runId, { phase: "setup_required", inFlight: false });
          return {
            ok: true,
            runId,
            setupState,
            message:
              setupState.detail || getMissingMasterResumeContextMessage(),
          };
        }
        if (setupState?.state === "missing_provider_config") {
          await setPendingExtensionAction(pendingAction);
          updateActiveRun(runId, { phase: "setup_required", inFlight: false });
          return {
            ok: true,
            runId,
            setupState,
            message:
              setupState.detail ||
              "Finish provider setup in the extension to continue.",
          };
        }
        try {
          updateActiveRun(runId, { phase: "running", inFlight: true });
          await setExtensionState({
            sessionId: runId,
            sourceTabId: pendingAction.tabId,
            activeRunJob: pendingAction.activeRunJob ?? null,
            status: SESSION_STATUS.starting,
            previewUrl: null,
            patchError: null,
            prompt1DurationMs: null,
            prompt2DurationMs: null,
            prompt3DurationMs: null,
            promptMetadata: null,
            patchDurationMs: null,
            cancelReason: null,
            cancelPhase: null,
          });
          const runtimeState = await getExtensionState();
          await captureExtensionEvent("tailor_started", {
            surface: "run_view",
            run_id: runtimeState?.sessionId ?? null,
            source_tab_id: pendingAction.tabId ?? null,
          });
          const result = await generateResumeForLinkedInJob(
            message.payload?.tabId ?? sender?.tab?.id,
            message.payload?.prompt1CustomInstruction ?? "",
            message.payload?.jobInput ?? null,
          );
          markRunTerminal(runId, "completed");
          clearActiveRun(runId);
          return { ok: true, result, runId };
        } catch (error) {
          if (isRunCanceledError(error)) {
            await finalizeCanceledRun(getActiveRun(runId) || { runId }, {
              reason: "user",
            });
            return { ok: true, canceled: true, runId };
          }
          const runtimeState = await getExtensionState();
          await captureExtensionEvent("tailor_failed", {
            surface: "run_view",
            run_id: runtimeState?.sessionId ?? null,
            error_message:
              error instanceof Error ? error.message : String(error),
          });
          if (isReconnectRequiredError(error)) {
            await setPendingExtensionAction(pendingAction);
            const websiteSession = await verifyWebsiteSession().catch(
              () => null,
            );
            if (websiteSession?.authenticated) {
              try {
                const synced = await syncExtensionAuthFromWebsite();
                if (synced) {
                  updateActiveRun(runId, { phase: "running", inFlight: true });
                  const result = await generateResumeForLinkedInJob(
                    message.payload?.tabId ?? sender?.tab?.id,
                    message.payload?.prompt1CustomInstruction ?? "",
                    message.payload?.jobInput ?? null,
                  );
                  await clearPendingExtensionAction();
                  markRunTerminal(runId, "completed");
                  clearActiveRun(runId);
                  return { ok: true, result, runId };
                }
              } catch (syncError) {
                if (isRunCanceledError(syncError)) {
                  await finalizeCanceledRun(getActiveRun(runId) || { runId }, {
                    reason: "user",
                  });
                  return { ok: true, canceled: true, runId };
                }
                logError(
                  "Background",
                  "Automatic auth repair failed after reconnect-required error.",
                  {
                    error:
                      syncError instanceof Error
                        ? syncError.message
                        : String(syncError),
                  },
                );
              }
            }
            return {
              ok: true,
              awaitingAuth: true,
              runId,
              connectionState: "signed_out",
              message: getSignedOutWorkspaceMessage(),
            };
          }
          clearActiveRun(runId);
          throw error;
        }
      }

      case "CONTINUE_PENDING_GENERATION_WITHOUT_STORYBOARD":
        await resumePendingExtensionAction({ allowWithoutStoryboard: true });
        return { ok: true };

      case "CLEAR_PENDING_EXTENSION_ACTION":
        await clearPendingExtensionAction();
        return { ok: true };

      case "OPEN_SIGN_IN": {
        const sourceTabId = message.payload?.tabId ?? sender?.tab?.id ?? null;
        await openWebsiteSignInTab(chrome.runtime.id, sourceTabId);
        return { ok: true };
      }

      case "OPEN_SIGN_OUT":
        suppressSourceFocusFor(15000);
        await openWebsiteSignOutTab();
        return { ok: true };

      case "OPEN_PREVIEW": {
        await openPreviewTab(message.payload?.previewUrl);
        await consumePatchedSuccess();
        return { ok: true };
      }

      case "FOCUS_LINKEDIN_JOB_TAB": {
        const tabs = await chrome.tabs.query({
          url: ["https://www.linkedin.com/*"],
        });
        const jobTabs = tabs.filter((tab) =>
          isLinkedInJobsShellUrl(tab.url || tab.pendingUrl || ""),
        );
        const targetTab =
          jobTabs.find((tab) => tab.active && tab.lastFocusedWindow) ||
          jobTabs.find((tab) => tab.active) ||
          jobTabs[0];
        if (!targetTab?.id) {
          return { ok: false, error: "Open a LinkedIn job page first." };
        }
        await focusSourceTab(targetTab.id);
        return { ok: true };
      }

      default:
        return { ok: false, error: "Unknown message type." };
    }
  };

  run()
    .then((result) => sendResponse(result))
    .catch(async (error) => {
      if (
        (message?.type === "GENERATE_FOR_ACTIVE_JOB" ||
          message?.type === "CONTINUE_PENDING_GENERATION_WITHOUT_STORYBOARD") &&
        isRunCanceledError(error)
      ) {
        sendResponse({ ok: true, canceled: true });
        return;
      }
      const messageText =
        error instanceof Error ? error.message : "Unknown extension error.";
      const shouldDowngradeGenerateFailure =
        message?.type === "GENERATE_FOR_ACTIVE_JOB" ||
        message?.type === "CONTINUE_PENDING_GENERATION_WITHOUT_STORYBOARD";
      if (shouldDowngradeGenerateFailure) {
        logWarn("Background", "Message handling failed.", {
          type: message?.type,
          error: messageText,
        });
      } else {
        logError("Background", "Message handling failed.", {
          type: message?.type,
          error: messageText,
        });
      }
      await setLastError(messageText);
      sendResponse({ ok: false, error: messageText });
    });

  return true;
});

chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    const run = async () => {
      const { appOrigin } = await getUserAssets();
      const senderUrl = sender?.url ?? "";
      if (!senderUrl.startsWith(appOrigin)) {
        throw new Error("Rejected external message from unknown origin.");
      }

      switch (message?.type) {
        case "SOM_EXTENSION_AUTH_SYNC":
        case "SOM_EXTENSION_CONNECT_COMPLETE": {
          logInfo("Background", "Received external auth sync message.", {
            type: message?.type,
            senderUrl,
            sourceTabId: message.payload?.sourceTabId ?? null,
            user: message.payload?.user
              ? {
                  id: message.payload.user.id ?? null,
                  email: message.payload.user.email ?? null,
                }
              : null,
          });
          const transition = await applyExtensionAuthPayload({
            token: message.payload?.token,
            expiresAt: message.payload?.expiresAt,
            user: message.payload?.user ?? null,
          });
          sendResponse({ ok: true });
          await broadcastContentScriptMessage({
            type: "EXTENSION_CONNECTION_STATE_CHANGED",
            payload: {
              connectionState: "connected",
              accountChanged: transition.accountChanged === true,
              message:
                transition.accountChanged === true
                  ? getAccountSwitchMessage()
                  : "",
            },
          });
          await resumePendingExtensionAction({ skipWebsiteSessionCheck: true });
          return;
        }

        case "SOM_EXTENSION_SIGNED_OUT":
          logInfo("Background", "Received external sign-out sync message.", {
            type: message?.type,
            senderUrl,
            activeAccountKeyBeforeClear: await getActiveAccountKey(),
          });
          suppressSourceFocusUntil = 0;
          await cancelActiveRun({
            reason: "signed_out",
            phase: "sign_out",
          });
          await clearExtensionAuth();
          await clearPendingExtensionAction();
          logInfo("Background", "Extension sign-out sync completed.", {
            activeAccountKeyAfterClear: await getActiveAccountKey(),
          });
          sendResponse({ ok: true });
          await broadcastContentScriptMessage({
            type: "EXTENSION_CONNECTION_STATE_CHANGED",
            payload: {
              connectionState: "signed_out",
              message: getSignedOutWorkspaceMessage(),
            },
          });
          return;

        case "SOM_EXTENSION_LOGIN_REQUIRED":
          if (!isSourceFocusSuppressed() && sender?.tab?.id) {
            await focusSourceTab(sender.tab.id);
          }
          sendResponse({ ok: true });
          return;

        default:
          sendResponse({ ok: false, error: "Unknown external message type." });
          return;
      }
    };

    run().catch(async (error) => {
      const messageText =
        error instanceof Error ? error.message : "Unknown external auth error.";
      logError("Background", "External message handling failed.", {
        type: message?.type,
        error: messageText,
      });
      sendResponse({ ok: false, error: messageText });
    });

    return true;
  },
);

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab?.url || tab?.pendingUrl || "";
    const route = classifyLinkedInJobsRoute(url);
    if (!route.isJobsShell) return;
    await sendLinkedInRouteChange(tabId, url);
    if (route.mode !== LINKEDIN_ROUTE_MODE.active) return;
    await chrome.tabs
      .sendMessage(tabId, { type: "EXTENSION_RECHECK_CONNECTION" })
      .catch(() => {});
  } catch {
    // Ignore activation races for closed or inaccessible tabs.
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab?.url || tab?.pendingUrl || "";
  if (!isLinkedInJobsShellUrl(url)) {
    return;
  }

  if (typeof changeInfo.url === "string" || changeInfo.status === "complete") {
    await sendLinkedInRouteChange(tabId, url);
  }
});

if (chrome.webNavigation?.onHistoryStateUpdated) {
  chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (details.frameId !== 0) return;
    await sendLinkedInRouteChange(details.tabId, details.url);
  });
}
