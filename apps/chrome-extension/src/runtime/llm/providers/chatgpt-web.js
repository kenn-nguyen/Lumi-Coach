import { runChatGptPrompt } from '../../chatgpt.js';

export async function runChatGptWebPrompt(prompt, options = {}) {
  const targetUrl = options.profile?.targetUrl || options.targetUrl;
  return runChatGptPrompt(prompt, {
    ...options,
    targetUrl,
  });
}

