import { generateResumeForLinkedInJob, saveStoryboardAsset } from './runtime/orchestrator.js';
import { logError, logInfo, setLogRelayTabId } from './runtime/log.js';
import { clearPromptTemplateCache } from './runtime/prompt-loader.js';
import { openExtensionConnectTab, openPreviewTab } from './runtime/api.js';
import {
  clearExtensionAuth,
  clearPendingExtensionAction,
  clearExtensionLocalData,
  getExtensionState,
  getHistoryEntries,
  getUserAssets,
  getPendingExtensionAction,
  hasValidExtensionAuth,
  resetExtensionSettingsToDefault,
  saveLlmSettings,
  setApiOrigin,
  setAppOrigin,
  setChatGptTargetUrl,
  setCustomFeatureEnabled,
  setExtensionAuth,
  setLastError,
  setMasterResumeContextAsset,
  setPendingExtensionAction,
  savePromptTemplateProfileSelection,
  setPromptTemplateAsset,
} from './runtime/storage.js';

async function ensureExtensionAuthForAction(pendingAction) {
  const hasAuth = await hasValidExtensionAuth();
  if (hasAuth) return { connected: true };

  await setPendingExtensionAction(pendingAction);
  await openExtensionConnectTab(chrome.runtime.id);
  return { connected: false };
}

async function resumePendingExtensionAction() {
  const pendingAction = await getPendingExtensionAction();
  if (!pendingAction) return;

  await clearPendingExtensionAction();

  if (pendingAction.type === 'generate_active_job') {
    const tabId = pendingAction.tabId ?? null;
    setLogRelayTabId(tabId);
    try {
      await generateResumeForLinkedInJob(
        tabId,
        pendingAction.prompt1CustomInstruction ?? ''
      );
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'EXTENSION_RESUMED_GENERATION_RESULT',
          payload: { ok: true },
        }).catch(() => {});
      }
    } catch (error) {
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'EXTENSION_RESUMED_GENERATION_RESULT',
          payload: {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to generate tailored resume.',
          },
        }).catch(() => {});
      }
      throw error;
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  logInfo('Background', 'Extension installed.');
});

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const run = async () => {
    logInfo('Background', 'Received message.', {
      type: message?.type,
      senderTabId: sender?.tab?.id ?? null,
    });

    switch (message?.type) {
      case 'PING':
        return { ok: true, source: 'background' };

      case 'REGISTER_LOG_VIEWER':
        setLogRelayTabId(sender?.tab?.id ?? null);
        return { ok: true };

      case 'GET_STATE':
        return {
          ok: true,
          state: await getExtensionState(),
          assets: await getUserAssets(),
          history: await getHistoryEntries(),
        };

      case 'CLEAR_EXTENSION_AUTH':
        await clearExtensionAuth();
        await clearPendingExtensionAction();
        return { ok: true };

      case 'SAVE_STORYBOARD':
        await saveStoryboardAsset(message.payload);
        return { ok: true };

      case 'SAVE_MASTER_RESUME_CONTEXT':
        await setMasterResumeContextAsset({
          filename: message.payload?.filename,
          content: message.payload?.content,
          uploadedAt: new Date().toISOString(),
        });
        return { ok: true };

      case 'SAVE_PROMPT_TEMPLATE':
        await setPromptTemplateAsset(message.payload?.templateName, {
          filename: message.payload?.filename,
          content: message.payload?.content,
          uploadedAt: new Date().toISOString(),
        }, message.payload?.promptProfileId);
        clearPromptTemplateCache();
        return { ok: true };

      case 'SAVE_PROMPT_PROFILE_SELECTION':
        clearPromptTemplateCache();
        return {
          ok: true,
          promptTemplateProfiles: await savePromptTemplateProfileSelection(message.payload?.profileId),
        };

      case 'DELETE_PROMPT_TEMPLATE':
        clearPromptTemplateCache();
        await setPromptTemplateAsset(message.payload?.templateName, null, message.payload?.promptProfileId);
        return { ok: true };

      case 'SAVE_CHATGPT_URL':
        await setChatGptTargetUrl(message.payload?.url);
        return { ok: true };

      case 'SAVE_LLM_SETTINGS':
        return {
          ok: true,
          llmSettings: await saveLlmSettings(message.payload?.activeProfileId, message.payload?.profileUpdates),
        };

      case 'SAVE_RUNTIME_URLS':
        await setAppOrigin(message.payload?.appUrl);
        await setApiOrigin(message.payload?.apiUrl);
        return { ok: true };

      case 'SAVE_CUSTOM_FEATURE_ENABLED':
        await setCustomFeatureEnabled(message.payload?.enabled === true);
        return { ok: true };

      case 'RESET_LOCAL_DATA':
        await clearExtensionLocalData();
        clearPromptTemplateCache();
        return { ok: true };

      case 'RESET_DEFAULT_SETTINGS':
        await resetExtensionSettingsToDefault();
        return { ok: true };

      case 'GENERATE_FOR_ACTIVE_JOB': {
        setLogRelayTabId(message.payload?.tabId ?? sender?.tab?.id ?? null);
        const authGate = await ensureExtensionAuthForAction({
          type: 'generate_active_job',
          tabId: message.payload?.tabId ?? sender?.tab?.id ?? null,
          prompt1CustomInstruction: message.payload?.prompt1CustomInstruction ?? '',
        });
        if (!authGate.connected) {
          return {
            ok: true,
            awaitingAuth: true,
            message: 'Finish signing in to SOM Career Coach in the opened tab.',
          };
        }
        const result = await generateResumeForLinkedInJob(
          message.payload?.tabId ?? sender?.tab?.id,
          message.payload?.prompt1CustomInstruction ?? ''
        );
        return { ok: true, result };
      }

      case 'OPEN_PREVIEW': {
        await openPreviewTab(message.payload?.previewUrl);
        return { ok: true };
      }

      default:
        return { ok: false, error: 'Unknown message type.' };
    }
  };

  run()
    .then((result) => sendResponse(result))
    .catch(async (error) => {
      const messageText = error instanceof Error ? error.message : 'Unknown extension error.';
      logError('Background', 'Message handling failed.', { type: message?.type, error: messageText });
      await setLastError(messageText);
      sendResponse({ ok: false, error: messageText });
    });

  return true;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const run = async () => {
    const { appOrigin } = await getUserAssets();
    const senderUrl = sender?.url ?? '';
    if (!senderUrl.startsWith(appOrigin)) {
      throw new Error('Rejected external message from unknown origin.');
    }

    switch (message?.type) {
      case 'SOM_EXTENSION_CONNECT_COMPLETE':
        await setExtensionAuth({
          token: message.payload?.token,
          expiresAt: message.payload?.expiresAt,
          user: message.payload?.user ?? null,
          connectedAt: new Date().toISOString(),
        });
        sendResponse({ ok: true });
        if (sender?.tab?.id) {
          chrome.tabs.remove(sender.tab.id).catch(() => {});
        }
        await resumePendingExtensionAction();
        return;

      default:
        sendResponse({ ok: false, error: 'Unknown external message type.' });
        return;
    }
  };

  run().catch(async (error) => {
    const messageText = error instanceof Error ? error.message : 'Unknown external auth error.';
    logError('Background', 'External message handling failed.', {
      type: message?.type,
      error: messageText,
    });
    sendResponse({ ok: false, error: messageText });
  });

  return true;
});
