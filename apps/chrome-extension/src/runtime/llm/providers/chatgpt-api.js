import { logError, logInfo } from '../../log.js';
import { requiresApiKeyForApiBaseUrl } from '../local-proxy.js';
import {
  buildApiHttpError,
  buildApiNetworkError,
  buildApiResponseError,
} from '../api-errors.js';

const PROVIDER_LABEL = 'ChatGPT';

function isAbortError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /abort|canceled/i.test(message);
}

function extractOpenAiText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const textParts = [];
  output.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      if (typeof part?.text === 'string' && part.text.trim()) {
        textParts.push(part.text.trim());
      }
    });
  });

  if (!textParts.length) {
    throw new Error('ChatGPT API returned no text content.');
  }

  return textParts.join('\n\n');
}

async function callChatGptApi(prompt, { apiKey, model, apiBaseUrl, promptLabel, systemPrompt = '', signal }) {
  logInfo('ChatGptApi', 'Sending prompt to ChatGPT API.', {
    promptLabel,
    model,
    apiBaseUrl,
    promptLength: prompt.length,
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
        ...(systemPrompt ? { instructions: systemPrompt } : {}),
        input: prompt,
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
    logError('ChatGptApi', 'ChatGPT API request failed before response.', {
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
    logError('ChatGptApi', 'ChatGPT API returned a non-OK status.', {
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
    const message = error instanceof Error ? error.message : 'ChatGPT API returned a non-JSON response body.';
    logError('ChatGptApi', 'ChatGPT API returned a non-JSON success body.', {
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
    const rawText = extractOpenAiText(payload);
    logInfo('ChatGptApi', 'ChatGPT API response parsed successfully.', {
      promptLabel,
      model,
      responseId: payload?.id ?? null,
      status: payload?.status ?? null,
    });
    return {
      status: 'success',
      rawText,
      responseId: payload?.id ?? null,
      usage: payload?.usage ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ChatGPT API returned an unreadable payload.';
    logError('ChatGptApi', 'ChatGPT API payload parsing failed.', {
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

export async function runChatGptApiPrompt(prompt, options = {}) {
  const profile = options.profile ?? {};
  const promptLabel = options.promptLabel ?? 'Prompt';
  const apiKey = typeof profile.apiKey === 'string' ? profile.apiKey.trim() : '';
  const model = typeof profile.model === 'string' && profile.model.trim()
    ? profile.model.trim()
    : 'gpt-5-mini';
  const apiBaseUrl = typeof profile.apiBaseUrl === 'string' && profile.apiBaseUrl.trim()
    ? profile.apiBaseUrl.trim()
    : 'https://api.openai.com/v1/responses';
  const systemPrompt = typeof options.systemPrompt === 'string' ? options.systemPrompt.trim() : '';
  const signal = options.signal;

  if (!apiKey && requiresApiKeyForApiBaseUrl(apiBaseUrl)) {
    return {
      status: 'error',
      message: 'ChatGPT API key is required for the active runner.',
    };
  }

  let result = await callChatGptApi(prompt, { apiKey, model, apiBaseUrl, promptLabel, systemPrompt, signal });
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

      logInfo('ChatGptApi', 'Attempting repair call for invalid API response.', {
        promptLabel,
        attempt,
        validationMessage: validation.message ?? 'The previous response was invalid.',
      });

      result = await callChatGptApi(repairPrompt, {
        apiKey,
        model,
        apiBaseUrl,
        promptLabel: `${promptLabel} Repair`,
        systemPrompt,
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
