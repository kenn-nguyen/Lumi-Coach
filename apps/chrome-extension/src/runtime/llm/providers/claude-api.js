import { logError, logInfo } from '../../log.js';
import {
  decorateSystemPromptForJsonOutput,
  getClaudeJsonModeConfig,
  shouldUseJsonOutput,
} from '../json-output.js';
import { resolveLlmStageSettings } from '../profiles.js';
import {
  buildApiHttpError,
  buildApiNetworkError,
  buildApiResponseError,
} from '../api-errors.js';

const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';
const PROVIDER_LABEL = 'Claude';
const MAX_CACHE_BREAKPOINTS = 4;

function isAbortError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /abort|canceled/i.test(message);
}

function extractClaudeText(payload) {
  const blocks = Array.isArray(payload?.content) ? payload.content : [];
  const textBlocks = blocks
    .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
    .map((block) => block.text.trim())
    .filter(Boolean);

  if (!textBlocks.length) {
    throw new Error('Claude API returned no text content.');
  }

  return textBlocks.join('\n\n');
}

function isPromptCacheEnabled(profile) {
  return profile?.promptCache?.enabled !== false;
}

function buildClaudeTextBlock(text, cacheable = false, cacheState) {
  const block = {
    type: 'text',
    text,
  };
  if (cacheable && cacheState.count < MAX_CACHE_BREAKPOINTS) {
    block.cache_control = { type: 'ephemeral' };
    cacheState.count += 1;
  }
  return block;
}

function buildClaudeSystem(systemPrompt, cacheEnabled, cacheState) {
  if (!systemPrompt) return null;
  if (!cacheEnabled) return systemPrompt;
  return [buildClaudeTextBlock(systemPrompt, true, cacheState)];
}

function buildClaudeUserContent(prompt, apiPromptBlocks, cacheEnabled, cacheState) {
  if (!cacheEnabled || !Array.isArray(apiPromptBlocks) || !apiPromptBlocks.length) {
    return prompt;
  }
  return apiPromptBlocks
    .filter((block) => typeof block?.text === 'string' && block.text.trim())
    .map((block) =>
      buildClaudeTextBlock(block.text.trim(), block.cacheable === true, cacheState),
    );
}

function normalizeThinkingPayload(thinking) {
  if (!thinking || typeof thinking !== 'object') return null;
  const type = typeof thinking.type === 'string' ? thinking.type.trim() : '';
  if (type !== 'enabled') return null;
  const budgetTokens = Number.isFinite(Number(thinking.budget_tokens))
    ? Math.max(1024, Math.floor(Number(thinking.budget_tokens)))
    : 8192;
  return {
    type: 'enabled',
    budget_tokens: budgetTokens,
  };
}

async function callClaudeApi(prompt, { apiKey, model, apiBaseUrl, promptLabel, systemPrompt = '', apiPromptBlocks = null, promptCacheEnabled = true, maxTokens = 4096, thinking = null, useJsonOutput = false, signal }) {
  const cacheState = { count: 0 };
  const cacheEnabled = promptCacheEnabled === true;
  const systemPromptText = useJsonOutput
    ? decorateSystemPromptForJsonOutput(systemPrompt)
    : systemPrompt;
  const system = buildClaudeSystem(systemPromptText, cacheEnabled, cacheState);
  const userContent = buildClaudeUserContent(prompt, apiPromptBlocks, cacheEnabled, cacheState);
  const thinkingPayload = normalizeThinkingPayload(thinking);
  const resolvedMaxTokens = Math.max(
    Number.isFinite(Number(maxTokens)) ? Math.floor(Number(maxTokens)) : 4096,
    thinkingPayload ? thinkingPayload.budget_tokens + 1024 : 4096,
  );
  logInfo('ClaudeApi', 'Sending prompt to Claude API.', {
    promptLabel,
    model,
    apiBaseUrl,
    promptLength: prompt.length,
    promptCacheEnabled: cacheEnabled,
    cacheBreakpoints: cacheState.count,
    thinkingBudgetTokens: thinkingPayload?.budget_tokens ?? null,
    jsonOutput: useJsonOutput,
  });

  let response;
  try {
    response = await fetch(apiBaseUrl, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': DEFAULT_ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: resolvedMaxTokens,
        ...(useJsonOutput ? { output_config: getClaudeJsonModeConfig() } : {}),
        ...(thinkingPayload ? { thinking: thinkingPayload } : {}),
        ...(system ? { system } : {}),
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
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
    logError('ClaudeApi', 'Claude API request failed before response.', {
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
    logError('ClaudeApi', 'Claude API returned a non-OK status.', {
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
    const message = error instanceof Error ? error.message : 'Claude API returned a non-JSON response body.';
    logError('ClaudeApi', 'Claude API returned a non-JSON success body.', {
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
    const rawText = extractClaudeText(payload);
    logInfo('ClaudeApi', 'Claude API response parsed successfully.', {
      promptLabel,
      model,
      messageId: payload?.id ?? null,
      stopReason: payload?.stop_reason ?? null,
    });
    return {
      status: 'success',
      rawText,
      messageId: payload?.id ?? null,
      stopReason: payload?.stop_reason ?? null,
      usage: payload?.usage ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Claude API returned an unreadable payload.';
    logError('ClaudeApi', 'Claude API payload parsing failed.', {
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

export async function runClaudeApiPrompt(prompt, options = {}) {
  const profile = options.profile ?? {};
  const stageSettings = resolveLlmStageSettings(profile, options.promptStage);
  const promptLabel = options.promptLabel ?? 'Prompt';
  const apiKey = typeof stageSettings.apiKey === 'string' ? stageSettings.apiKey.trim() : '';
  const model = typeof stageSettings.model === 'string' && stageSettings.model.trim()
    ? stageSettings.model.trim()
    : 'claude-sonnet-4-5';
  const apiBaseUrl = typeof stageSettings.apiBaseUrl === 'string' && stageSettings.apiBaseUrl.trim()
    ? stageSettings.apiBaseUrl.trim()
    : 'https://api.anthropic.com/v1/messages';
  const maxTokens = stageSettings.maxTokens ?? 4096;
  const thinking = stageSettings.thinking ?? null;
  const promptCacheEnabled = isPromptCacheEnabled(stageSettings);
  const useJsonOutput = shouldUseJsonOutput(options.promptStage);
  const apiPromptBlocks = Array.isArray(options.apiPromptBlocks)
    ? options.apiPromptBlocks
    : null;
  const systemPrompt = typeof options.systemPrompt === 'string' ? options.systemPrompt.trim() : '';
  const signal = options.signal;

  if (!apiKey) {
    return {
      status: 'error',
      message: 'Claude API key is required for the active runner.',
    };
  }
  let result = await callClaudeApi(prompt, { apiKey, model, apiBaseUrl, promptLabel, systemPrompt, apiPromptBlocks, promptCacheEnabled, maxTokens, thinking, useJsonOutput, signal });
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

      logInfo('ClaudeApi', 'Attempting repair call for invalid API response.', {
        promptLabel,
        attempt,
        validationMessage: validation.message ?? 'The previous response was invalid.',
      });

      result = await callClaudeApi(repairPrompt, {
        apiKey,
        model,
        apiBaseUrl,
        promptLabel: `${promptLabel} Repair`,
        systemPrompt,
        promptCacheEnabled,
        maxTokens,
        thinking,
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
