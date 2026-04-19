import {
  generateResumeForLinkedInJob,
  saveStoryboardAsset,
} from "./runtime/orchestrator.js";
import { captureExtensionEvent } from "./runtime/analytics.js";
import { logError, logInfo, logWarn, setLogRelayTabId } from "./runtime/log.js";
import { clearPromptTemplateCache } from "./runtime/prompt-loader.js";
import {
  fetchExtensionAccessToken,
  openPreviewTab,
  openWebsiteSignInTab,
  openWebsiteSignOutTab,
  verifyWebsiteSession,
} from "./runtime/api.js";
import { SESSION_STATUS } from "./runtime/constants.js";
import { getExtensionSetupState } from "./runtime/setup-state.js";
import {
  clearExtensionAuth,
  clearPendingExtensionAction,
  clearExtensionLocalData,
  completeOnboarding,
  getExtensionState,
  getHistoryEntries,
  getOnboardingProgress,
  getUserAssets,
  getPendingExtensionAction,
  hasValidExtensionAuth,
  resetExtensionSettingsToDefault,
  saveApifyFallbackSettings,
  saveLlmSettings,
  setApiOrigin,
  setAppOrigin,
  setChatGptTargetUrl,
  setCustomFeatureEnabled,
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

let suppressSourceFocusUntil = 0;

async function getConnectionSnapshot({ trySync = true } = {}) {
  let extensionConnected = false;
  let websiteAuthenticated = false;

  try {
    extensionConnected = await hasValidExtensionAuth();
    const websiteSession = await verifyWebsiteSession();
    websiteAuthenticated = websiteSession?.authenticated === true;
    if (trySync && !extensionConnected && websiteAuthenticated) {
      const synced = await syncExtensionAuthFromWebsite();
      extensionConnected = Boolean(synced?.token);
    }
  } catch {
    extensionConnected = false;
    websiteAuthenticated = false;
  }

  const connected = extensionConnected && websiteAuthenticated;
  return {
    connected,
    extensionConnected,
    websiteAuthenticated,
    connectionState: connected ? "connected" : "signed_out",
  };
}

async function getRuntimeSnapshot({ trySync = true } = {}) {
  const [extensionState, assets, history, connection, onboardingProgress] =
    await Promise.all([
      getExtensionState(),
      getUserAssets(),
      getHistoryEntries(),
      getConnectionSnapshot({ trySync }),
      getOnboardingProgress(),
    ]);

  return {
    ok: true,
    state: extensionState,
    assets,
    history,
    ...connection,
    setupState: getExtensionSetupState({
      assets,
      extensionConnected: connection.extensionConnected,
      websiteAuthenticated: connection.websiteAuthenticated,
      onboardingProgress,
    }),
  };
}

async function syncExtensionAuthFromWebsite() {
  const payload = await fetchExtensionAccessToken();
  if (!payload?.token || !payload?.expiresAt) {
    return null;
  }

  await setExtensionAuth({
    token: payload.token,
    expiresAt: payload.expiresAt,
    user: payload.user ?? null,
    connectedAt: new Date().toISOString(),
  });

  return payload;
}

async function broadcastLinkedInMessage(message) {
  const tabs = await chrome.tabs
    .query({ url: ["https://www.linkedin.com/jobs/*"] })
    .catch(() => []);
  await Promise.all(
    tabs
      .filter((tab) => typeof tab.id === "number")
      .map((tab) => chrome.tabs.sendMessage(tab.id, message).catch(() => {})),
  );
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
    return;
  }

  await broadcastLinkedInMessage(message);
}

async function ensureExtensionAuthForAction(pendingAction, options = {}) {
  const hasAuth = await hasValidExtensionAuth();
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
      message: "Sign in with Google to continue.",
    };
  }

  if (options.skipWebsiteSessionCheck) {
    return { connected: true };
  }

  const websiteSession = await verifyWebsiteSession();
  if (websiteSession?.authenticated) {
    return { connected: true, connectionState: "connected" };
  }

  await setPendingExtensionAction(pendingAction);
  return {
    connected: false,
    connectionState: "signed_out",
    message: "You are signed out of Lumi Coach. Sign in to continue.",
  };
}

function getStoryboardRecommendationMessage() {
  return "A story bank helps produce better results. Continue without it?";
}

async function hasStoryboardAsset() {
  const { storyboardAsset } = await getUserAssets();
  return Boolean(storyboardAsset?.content?.trim());
}

async function maybeResumePendingExtensionAction(options = {}) {
  const pendingAction = await getPendingExtensionAction();
  if (!pendingAction) return;
  await resumePendingExtensionAction(options);
}

function getMissingMasterResumeContextMessage() {
  return "Upload your resume to the extension first as a .txt, .md, or .json file. PDF and DOCX are not supported here.";
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
    const tabId = pendingAction.tabId ?? null;
    const authGate = await ensureExtensionAuthForAction(pendingAction, {
      skipWebsiteSessionCheck: options.skipWebsiteSessionCheck === true,
    });
    if (!authGate.connected) {
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, {
            type: "EXTENSION_AUTH_REQUIRED",
            payload: {
              connectionState: authGate.connectionState || "signed_out",
              message: authGate.message || "Sign in to Lumi Coach to continue.",
            },
          })
          .catch(() => {});
      }
      return;
    }
    const assets = await getUserAssets();
    const setupState = getExtensionSetupState({
      assets,
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: await getOnboardingProgress(),
    });
    if (setupState?.state === "missing_resume") {
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
    if (!options.allowWithoutStoryboard && !(await hasStoryboardAsset())) {
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, {
            type: "EXTENSION_STORYBOARD_RECOMMENDATION",
            payload: { message: getStoryboardRecommendationMessage() },
          })
          .catch(() => {});
      }
      return;
    }

    await clearPendingExtensionAction();
    setLogRelayTabId(tabId);
    try {
      await setExtensionState({
        sessionId: crypto.randomUUID(),
        sourceTabId: tabId,
        activeRunJob: pendingAction.activeRunJob ?? null,
        status: SESSION_STATUS.starting,
        previewUrl: null,
        patchError: null,
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
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, {
            type: "EXTENSION_RESUMED_GENERATION_RESULT",
            payload: { ok: true },
          })
          .catch(() => {});
      }
    } catch (error) {
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
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to generate tailored resume.",
            },
          })
          .catch(() => {});
      }
      throw error;
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  logInfo("Background", "Extension installed.");
});

chrome.action.onClicked.addListener(async (tab) => {
  const extensionState = await getExtensionState().catch(() => null);
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
        await chrome.tabs.sendMessage(sourceTabId, {
          type: "EXTENSION_SHOW_LAUNCHER",
        });
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

  if (!tab?.id || !tab.url?.startsWith("https://www.linkedin.com/jobs/")) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "EXTENSION_SHOW_LAUNCHER" });
  } catch (error) {
    logError(
      "Background",
      "Failed to restore floating launcher from action click.",
      {
        tabId: tab.id,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
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
        return getRuntimeSnapshot();

      case "CHECK_CONNECTION_STATUS":
        return getRuntimeSnapshot();

      case "CLEAR_EXTENSION_AUTH":
        await clearExtensionAuth();
        await clearPendingExtensionAction();
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

      case "CLEAR_MASTER_RESUME_CONTEXT":
        await setMasterResumeContextAsset(null);
        return { ok: true };

      case "CLEAR_STORYBOARD":
        await setStoryboardAsset(null);
        return { ok: true };

      case "SAVE_PROMPT_TEMPLATE":
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

      case "SAVE_PROMPT_PROFILE_SELECTION":
        clearPromptTemplateCache();
        return {
          ok: true,
          promptTemplateProfiles: await savePromptTemplateProfileSelection(
            message.payload?.profileId,
          ),
        };

      case "DELETE_PROMPT_TEMPLATE":
        clearPromptTemplateCache();
        await setPromptTemplateAsset(
          message.payload?.templateName,
          null,
          message.payload?.promptProfileId,
        );
        return { ok: true };

      case "SAVE_CHATGPT_URL":
        await setChatGptTargetUrl(message.payload?.url);
        return { ok: true };

      case "SAVE_LLM_SETTINGS":
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

      case "SAVE_CUSTOM_FEATURE_ENABLED":
        await setCustomFeatureEnabled(message.payload?.enabled === true);
        return { ok: true };

      case "RESET_LOCAL_DATA":
        await clearExtensionLocalData();
        clearPromptTemplateCache();
        return { ok: true };

      case "RESET_DEFAULT_SETTINGS":
        await resetExtensionSettingsToDefault();
        return { ok: true };

      case "TRACK_ANALYTICS_EVENT":
        await captureExtensionEvent(
          message.payload?.event,
          message.payload?.properties || {},
        );
        return { ok: true };

      case "GENERATE_FOR_ACTIVE_JOB": {
        const pendingAction = {
          type: "generate_active_job",
          tabId: message.payload?.tabId ?? sender?.tab?.id ?? null,
          prompt1CustomInstruction:
            message.payload?.prompt1CustomInstruction ?? "",
          jobInput: message.payload?.jobInput ?? null,
          activeRunJob: message.payload?.activeRunJob ?? null,
        };
        setLogRelayTabId(message.payload?.tabId ?? sender?.tab?.id ?? null);
        const authGate = await ensureExtensionAuthForAction(pendingAction);
        if (!authGate.connected) {
          return {
            ok: true,
            awaitingAuth: true,
            connectionState: authGate.connectionState || "signed_out",
            message: authGate.message || "Sign in with Google to continue.",
          };
        }
        const assets = await getUserAssets();
        const setupState = getExtensionSetupState({
          assets,
          extensionConnected: true,
          websiteAuthenticated: true,
          onboardingProgress: await getOnboardingProgress(),
        });
        if (setupState?.state === "missing_resume") {
          await setPendingExtensionAction(pendingAction);
          return {
            ok: true,
            setupState,
            message:
              setupState.detail || getMissingMasterResumeContextMessage(),
          };
        }
        if (setupState?.state === "missing_provider_config") {
          await setPendingExtensionAction(pendingAction);
          return {
            ok: true,
            setupState,
            message:
              setupState.detail ||
              "Finish provider setup in the extension to continue.",
          };
        }
        if (
          !message.payload?.allowWithoutStoryboard &&
          !(await hasStoryboardAsset())
        ) {
          await setPendingExtensionAction(pendingAction);
          return {
            ok: true,
            awaitingStoryboard: true,
            message: getStoryboardRecommendationMessage(),
          };
        }
        try {
          await setExtensionState({
            sessionId: crypto.randomUUID(),
            sourceTabId: pendingAction.tabId,
            activeRunJob: pendingAction.activeRunJob ?? null,
            status: SESSION_STATUS.starting,
            previewUrl: null,
            patchError: null,
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
          return { ok: true, result };
        } catch (error) {
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
                  const result = await generateResumeForLinkedInJob(
                    message.payload?.tabId ?? sender?.tab?.id,
                    message.payload?.prompt1CustomInstruction ?? "",
                    message.payload?.jobInput ?? null,
                  );
                  await clearPendingExtensionAction();
                  return { ok: true, result };
                }
              } catch (syncError) {
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
              connectionState: "signed_out",
              message: "Sign in with Google to continue.",
            };
          }
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
          url: ["https://www.linkedin.com/jobs/*"],
        });
        const targetTab =
          tabs.find((tab) => tab.active && tab.lastFocusedWindow) ||
          tabs.find((tab) => tab.active) ||
          tabs[0];
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
        case "SOM_EXTENSION_CONNECT_COMPLETE":
          const pendingAction = await getPendingExtensionAction();
          await setExtensionAuth({
            token: message.payload?.token,
            expiresAt: message.payload?.expiresAt,
            user: message.payload?.user ?? null,
            connectedAt: new Date().toISOString(),
          });
          sendResponse({ ok: true });
          await broadcastLinkedInMessage({
            type: "EXTENSION_CONNECTION_STATE_CHANGED",
            payload: { connectionState: "connected" },
          });
          await resumePendingExtensionAction({ skipWebsiteSessionCheck: true });
          return;

        case "SOM_EXTENSION_SIGNED_OUT":
          suppressSourceFocusUntil = 0;
          await clearExtensionAuth();
          await clearPendingExtensionAction();
          sendResponse({ ok: true });
          await broadcastLinkedInMessage({
            type: "EXTENSION_CONNECTION_STATE_CHANGED",
            payload: {
              connectionState: "signed_out",
              message:
                "Sign in to continue tailoring this job. Your setup is still here.",
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
    if (!tab?.url?.startsWith("https://www.linkedin.com/jobs/")) return;
    await chrome.tabs
      .sendMessage(tabId, { type: "EXTENSION_RECHECK_CONNECTION" })
      .catch(() => {});
  } catch {
    // Ignore activation races for closed or inaccessible tabs.
  }
});
