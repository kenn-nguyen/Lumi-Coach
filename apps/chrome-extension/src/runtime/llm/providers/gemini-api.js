import { logError, logInfo } from '../../log.js';
import {
  decorateSystemPromptForJsonOutput,
  getGeminiJsonModeConfig,
  shouldUseJsonOutput,
} from '../json-output.js';
import {
  buildApiHttpError,
  buildApiNetworkError,
  buildApiResponseError,
} from '../api-errors.js';

const PROVIDER_LABEL = 'Gemini';

function isAbortError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /abort|canceled/i.test(message);
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const firstCandidate = candidates.find((candidate) => Array.isArray(candidate?.content?.parts));
  const parts = Array.isArray(firstCandidate?.content?.parts) ? firstCandidate.content.parts : [];
  const textParts = parts
    .filter((part) => typeof part?.text === 'string')
    .map((part) => part.text.trim())
    .filter(Boolean);

  if (!textParts.length) {
    throw new Error('Gemini API returned no text content.');
  }

  return textParts.join('\n\n');
}

async function callGeminiApi(prompt, { apiKey, model, endpoint, promptLabel, systemPrompt = '', useJsonOutput = false, thinkingConfig = null, signal }) {
  const systemPromptText = useJsonOutput
    ? decorateSystemPromptForJsonOutput(systemPrompt)
    : systemPrompt;
  logInfo('GeminiApi', 'Sending prompt to Gemini API.', {
    promptLabel,
    model,
    endpoint,
    promptLength: prompt.length,
    jsonOutput: useJsonOutput,
  });

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        ...(systemPromptText
          ? {
              systemInstruction: {
                parts: [{ text: systemPromptText }],
              },
            }
          : {}),
        ...(() => {
          const generationConfig = {
            ...(useJsonOutput ? getGeminiJsonModeConfig() : {}),
            ...(thinkingConfig && typeof thinkingConfig === 'object' ? { thinkingConfig } : {}),
          };
          return Object.keys(generationConfig).length ? { generationConfig } : {};
        })(),
        contents: [
          {
            parts: [
              { text: prompt },
            ],
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
    logError('GeminiApi', 'Gemini API request failed before response.', {
      promptLabel,
      model,
      endpoint,
      message,
    });
    return {
      ...buildApiNetworkError(PROVIDER_LABEL, message),
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logError('GeminiApi', 'Gemini API returned a non-OK status.', {
      promptLabel,
      model,
      endpoint,
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
    const message = error instanceof Error ? error.message : 'Gemini API returned a non-JSON response body.';
    logError('GeminiApi', 'Gemini API returned a non-JSON success body.', {
      promptLabel,
      model,
      endpoint,
      message,
      body,
    });
    return {
      ...buildApiResponseError(PROVIDER_LABEL, message),
    };
  }

  try {
    const rawText = extractGeminiText(payload);
    logInfo('GeminiApi', 'Gemini API response parsed successfully.', {
      promptLabel,
      model,
      candidateCount: Array.isArray(payload?.candidates) ? payload.candidates.length : 0,
    });
    return {
      status: 'success',
      rawText,
      usage: payload?.usageMetadata ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini API returned an unreadable payload.';
    logError('GeminiApi', 'Gemini API payload parsing failed.', {
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

export async function runGeminiApiPrompt(prompt, options = {}) {
  const profile = options.profile ?? {};
  const promptLabel = options.promptLabel ?? 'Prompt';
  const apiKey = typeof profile.apiKey === 'string' ? profile.apiKey.trim() : '';
  const model = typeof profile.model === 'string' && profile.model.trim()
    ? profile.model.trim()
    : 'gemini-2.5-flash';
  const apiBaseUrl = typeof profile.apiBaseUrl === 'string' && profile.apiBaseUrl.trim()
    ? profile.apiBaseUrl.trim().replace(/\/+$/, '')
    : 'https://generativelanguage.googleapis.com/v1beta/models';
  const systemPrompt = typeof options.systemPrompt === 'string' ? options.systemPrompt.trim() : '';
  const useJsonOutput = shouldUseJsonOutput(options.promptStage);
  const thinkingConfig =
    profile.thinkingConfig && typeof profile.thinkingConfig === 'object'
      ? profile.thinkingConfig
      : null;
  const signal = options.signal;

  if (!apiKey) {
    return {
      status: 'error',
      message: 'Gemini API key is required for the active runner.',
    };
  }

  const endpoint = `${apiBaseUrl}/${encodeURIComponent(model)}:generateContent`;
  let result = await callGeminiApi(prompt, { apiKey, model, endpoint, promptLabel, systemPrompt, useJsonOutput, thinkingConfig, signal });
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

      logInfo('GeminiApi', 'Attempting repair call for invalid API response.', {
        promptLabel,
        attempt,
        validationMessage: validation.message ?? 'The previous response was invalid.',
      });

      result = await callGeminiApi(repairPrompt, {
        apiKey,
        model,
        endpoint,
        promptLabel: `${promptLabel} Repair`,
        systemPrompt,
        useJsonOutput,
        thinkingConfig,
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
