import { logInfo } from '../log.js';
import { runChatGptApiPrompt } from './providers/chatgpt-api.js';
import { runClaudeApiPrompt } from './providers/claude-api.js';
import { runClaudeWebPrompt } from './providers/claude-web.js';
import { runDeepSeekApiPrompt } from './providers/deepseek-api.js';
import { runGeminiApiPrompt } from './providers/gemini-api.js';
import { runGeminiWebPrompt } from './providers/gemini-web.js';
import { runChatGptWebPrompt } from './providers/chatgpt-web.js';

const RUNNERS = {
  'chatgpt:web_automation': runChatGptWebPrompt,
  'claude:web_automation': runClaudeWebPrompt,
  'claude:api': runClaudeApiPrompt,
  'chatgpt:api': runChatGptApiPrompt,
  'deepseek:api': runDeepSeekApiPrompt,
  'gemini:web_automation': runGeminiWebPrompt,
  'gemini:api': runGeminiApiPrompt,
};

export async function runPrompt(prompt, options = {}) {
  const profile = options.profile;
  if (!profile?.id) {
    throw new Error('An active LLM profile is required before running prompts.');
  }

  const runner = RUNNERS[profile.id];
  if (!runner) {
    throw new Error(`No LLM runner is registered for "${profile.id}".`);
  }

  logInfo('LlmRunner', 'Resolved prompt runner.', {
    promptLabel: options.promptLabel ?? 'Prompt',
    profileId: profile.id,
    vendor: profile.vendor,
    mode: profile.mode,
  });

  return runner(prompt, options);
}
