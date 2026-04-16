import { generateResumeForLinkedInJob, saveStoryboardAsset } from './runtime/orchestrator.js';
import { logError, logInfo, setLogRelayTabId } from './runtime/log.js';
import { clearPromptTemplateCache } from './runtime/prompt-loader.js';
import {
  clearExtensionLocalData,
  getExtensionState,
  getHistoryEntries,
  getUserAssets,
  resetExtensionSettingsToDefault,
  saveLlmSettings,
  setApiOrigin,
  setAppOrigin,
  setChatGptTargetUrl,
  setCustomFeatureEnabled,
  setLastError,
  setMasterResumeContextAsset,
  savePromptTemplateProfileSelection,
  setPromptTemplateAsset,
} from './runtime/storage.js';
import { openPreviewTab } from './runtime/api.js';

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
