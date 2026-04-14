import { logError, logInfo } from '../../log.js';

const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

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

async function callClaudeApi(prompt, { apiKey, model, apiBaseUrl, promptLabel, systemPrompt = '' }) {
  logInfo('ClaudeApi', 'Sending prompt to Claude API.', {
    promptLabel,
    model,
    apiBaseUrl,
    promptLength: prompt.length,
  });

  let response;
  try {
    response = await fetch(apiBaseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': DEFAULT_ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('ClaudeApi', 'Claude API request failed before response.', {
      promptLabel,
      model,
      apiBaseUrl,
      message,
    });
    return {
      status: 'error',
      message: `Claude API request failed before response: ${message}`,
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
      status: 'error',
      message: `Claude API request failed (status ${response.status}): ${body}`,
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
      status: 'error',
      message: `Claude API returned a non-JSON response body: ${message}`,
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
      status: 'error',
      message,
    };
  }
}

export async function runClaudeApiPrompt(prompt, options = {}) {
  const profile = options.profile ?? {};
  const promptLabel = options.promptLabel ?? 'Prompt';
  const apiKey = typeof profile.apiKey === 'string' ? profile.apiKey.trim() : '';
  const model = typeof profile.model === 'string' && profile.model.trim()
    ? profile.model.trim()
    : 'claude-sonnet-4-5';
  const apiBaseUrl = typeof profile.apiBaseUrl === 'string' && profile.apiBaseUrl.trim()
    ? profile.apiBaseUrl.trim()
    : 'https://api.anthropic.com/v1/messages';
  const systemPrompt = typeof options.systemPrompt === 'string' ? options.systemPrompt.trim() : '';

  if (!apiKey) {
    return {
      status: 'error',
      message: 'Claude API key is required for the active runner.',
    };
  }
  let result = await callClaudeApi(prompt, { apiKey, model, apiBaseUrl, promptLabel, systemPrompt });
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
