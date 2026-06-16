import { logError, logInfo } from '../../log.js';
import {
  decorateSystemPromptForJsonOutput,
  getDeepSeekJsonModeConfig,
  shouldUseJsonOutput,
} from '../json-output.js';
import { requiresApiKeyForApiBaseUrl } from '../local-proxy.js';
import { resolveLlmStageSettings } from '../profiles.js';
import {
  buildApiHttpError,
  buildApiNetworkError,
  buildApiResponseError,
} from '../api-errors.js';

const PROVIDER_LABEL = 'DeepSeek';

function isAbortError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /abort|canceled/i.test(message);
}

function extractDeepSeekText(payload) {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  const textParts = choices
    .map((choice) => choice?.message?.content)
    .filter((text) => typeof text === 'string' && text.trim())
    .map((text) => text.trim());

  if (!textParts.length) {
    throw new Error('DeepSeek API returned no text content.');
  }

  return textParts.join('\n\n');
}

function isPromptCacheEnabled(profile) {
  return profile?.promptCache?.enabled !== false;
}

function buildAutomaticCachePrompt(prompt, apiPromptBlocks, promptCacheEnabled) {
  if (!promptCacheEnabled || !Array.isArray(apiPromptBlocks) || !apiPromptBlocks.length) {
    return prompt;
  }

  const stableBlocks = apiPromptBlocks
    .filter((block) => block?.cacheable === true && typeof block.text === 'string' && block.text.trim())
    .map((block) => block.text.trim());
  const dynamicBlocks = apiPromptBlocks
    .filter((block) => block?.cacheable !== true && typeof block.text === 'string' && block.text.trim())
    .map((block) => block.text.trim());

  if (!stableBlocks.length || !dynamicBlocks.length) {
    return prompt;
  }

  return [...stableBlocks, ...dynamicBlocks].join('\n\n');
}

function normalizeThinkingPayload(thinking) {
  if (!thinking || typeof thinking !== 'object') return null;
  const type = typeof thinking.type === 'string' ? thinking.type.trim() : '';
  return type ? { type } : null;
}

function normalizeReasoningEffort(stageSettings) {
  const direct =
    typeof stageSettings.reasoning_effort === 'string'
      ? stageSettings.reasoning_effort.trim()
      : '';
  if (direct) return direct;
  const nested =
    typeof stageSettings.reasoning?.effort === 'string'
      ? stageSettings.reasoning.effort.trim()
      : '';
  return nested;
}

async function callDeepSeekApi(prompt, { apiKey, model, apiBaseUrl, promptLabel, systemPrompt = '', apiPromptBlocks = null, promptCacheEnabled = true, thinking = null, reasoningEffort = '', useJsonOutput = false, signal }) {
  const input = buildAutomaticCachePrompt(prompt, apiPromptBlocks, promptCacheEnabled);
  const thinkingPayload = normalizeThinkingPayload(thinking);
  const systemPromptText = useJsonOutput
    ? decorateSystemPromptForJsonOutput(systemPrompt)
    : systemPrompt;
  const messages = [
    ...(systemPromptText ? [{ role: 'system', content: systemPromptText }] : []),
    { role: 'user', content: input },
  ];

  logInfo('DeepSeekApi', 'Sending prompt to DeepSeek API.', {
    promptLabel,
    model,
    apiBaseUrl,
    promptLength: prompt.length,
    inputLength: input.length,
    promptCacheEnabled,
    reasoningEffort: reasoningEffort || null,
    thinkingType: thinkingPayload?.type ?? null,
    jsonOutput: useJsonOutput,
  });

  let response;
  const headers = {
    'content-type': 'application/json',
  };
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  try {
    response = await fetch(apiBaseUrl, {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify({
        model,
        messages,
        ...(useJsonOutput ? { response_format: getDeepSeekJsonModeConfig() } : {}),
        ...(thinkingPayload ? { thinking: thinkingPayload } : {}),
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        stream: false,
      }),
    });
  } catch (error) {
    if (isAbortError(error)) {
      return {
        status: 'canceled',
        message: 'Run canceled.',
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    logError('DeepSeekApi', 'DeepSeek API request failed before response.', {
      promptLabel,
      model,
      apiBaseUrl,
      message,
    });
    return {
      ...buildApiNetworkError(PROVIDER_LABEL, message),
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logError('DeepSeekApi', 'DeepSeek API returned a non-OK status.', {
      promptLabel,
      model,
      apiBaseUrl,
      status: response.status,
      body,
    });
    return {
      ...buildApiHttpError(PROVIDER_LABEL, response.status, body),
    };
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    const body = await response.text().catch(() => '');
    const message = error instanceof Error ? error.message : 'DeepSeek API returned a non-JSON response body.';
    logError('DeepSeekApi', 'DeepSeek API returned a non-JSON success body.', {
      promptLabel,
      model,
      apiBaseUrl,
      message,
      body,
    });
    return {
      ...buildApiResponseError(PROVIDER_LABEL, message),
    };
  }

  try {
    const rawText = extractDeepSeekText(payload);
    logInfo('DeepSeekApi', 'DeepSeek API response parsed successfully.', {
      promptLabel,
      model,
      responseId: payload?.id ?? null,
      cacheHitTokens: payload?.usage?.prompt_cache_hit_tokens ?? null,
      cacheMissTokens: payload?.usage?.prompt_cache_miss_tokens ?? null,
    });
    return {
      status: 'success',
      rawText,
      responseId: payload?.id ?? null,
      usage: payload?.usage ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DeepSeek API returned an unreadable payload.';
    logError('DeepSeekApi', 'DeepSeek API payload parsing failed.', {
      promptLabel,
      model,
      message,
      payload,
    });
    return {
      ...buildApiResponseError(PROVIDER_LABEL, message),
    };
  }
}

export async function runDeepSeekApiPrompt(prompt, options = {}) {
  const profile = options.profile ?? {};
  const stageSettings = resolveLlmStageSettings(profile, options.promptStage);
  const promptLabel = options.promptLabel ?? 'Prompt';
  const apiKey = typeof stageSettings.apiKey === 'string' ? stageSettings.apiKey.trim() : '';
  const model = typeof stageSettings.model === 'string' && stageSettings.model.trim()
    ? stageSettings.model.trim()
    : 'deepseek-v4-pro';
  const apiBaseUrl = typeof stageSettings.apiBaseUrl === 'string' && stageSettings.apiBaseUrl.trim()
    ? stageSettings.apiBaseUrl.trim()
    : 'https://api.deepseek.com/chat/completions';
  const thinking = stageSettings.thinking ?? null;
  const reasoningEffort = normalizeReasoningEffort(stageSettings);
  const promptCacheEnabled = isPromptCacheEnabled(stageSettings);
  const useJsonOutput = shouldUseJsonOutput(options.promptStage);
  const apiPromptBlocks = Array.isArray(options.apiPromptBlocks)
    ? options.apiPromptBlocks
    : null;
  const systemPrompt = typeof options.systemPrompt === 'string' ? options.systemPrompt.trim() : '';
  const signal = options.signal;

  if (!apiKey && requiresApiKeyForApiBaseUrl(apiBaseUrl)) {
    return {
      status: 'error',
      message: 'DeepSeek API key is required for the active runner.',
    };
  }

  let result = await callDeepSeekApi(prompt, { apiKey, model, apiBaseUrl, promptLabel, systemPrompt, apiPromptBlocks, promptCacheEnabled, thinking, reasoningEffort, useJsonOutput, signal });
  const validateResponse = typeof options.validateResponse === 'function' ? options.validateResponse : null;
  const buildRepairPrompt = typeof options.buildRepairPrompt === 'function' ? options.buildRepairPrompt : null;
  const maxRepairAttempts = Number.isInteger(options.maxRepairAttempts)
    ? Math.max(0, options.maxRepairAttempts)
    : 0;

  if (result.status === 'success' && validateResponse && buildRepairPrompt && maxRepairAttempts > 0) {
    for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
      const validation = validateResponse(result.rawText);
      if (!validation || validation.valid) {
        break;
      }

      const repairPrompt = buildRepairPrompt({
        attempt,
        promptLabel,
        validationMessage: validation.message ?? 'The previous response was invalid.',
        previousRawText: result.rawText,
      });
      if (!repairPrompt || !repairPrompt.trim()) {
        result = {
          ...result,
          validationError: validation.message ?? 'The previous response was invalid.',
        };
        break;
      }

      logInfo('DeepSeekApi', 'Attempting repair call for invalid API response.', {
        promptLabel,
        attempt,
        validationMessage: validation.message ?? 'The previous response was invalid.',
      });

      result = await callDeepSeekApi(repairPrompt, {
        apiKey,
        model,
        apiBaseUrl,
        promptLabel: `${promptLabel} Repair`,
        systemPrompt,
        promptCacheEnabled,
        thinking,
        reasoningEffort,
        useJsonOutput,
        signal,
      });
      if (result.status !== 'success') {
        return result;
      }
    }

    if (result.status === 'success') {
      const finalValidation = validateResponse(result.rawText);
      if (finalValidation && !finalValidation.valid) {
        result = {
          ...result,
          validationError: finalValidation.message ?? 'The previous response was invalid.',
        };
      }
    }
  }

  return result;
}
