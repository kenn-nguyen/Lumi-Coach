import { runWebAutomationPrompt } from './web-automation.js';

const GEMINI_WEB_CONFIG = {
  providerLabel: 'Gemini',
  scope: 'GeminiWebAutomation',
  defaultTargetUrl: 'https://gemini.google.com/app',
  popupWidth: 980,
  popupHeight: 900,
  popupTop: 40,
  popupLeft: 40,
  responseTimeoutMs: 600000,
  responseIdleTimeoutMs: 600000,
  responseFirstTokenTimeoutMs: 600000,
  urlMatchers: ['https://gemini.google.com/', 'https://bard.google.com/'],
  inputSelectors: [
    'rich-textarea div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[aria-label*="Enter a prompt"]',
    'textarea[placeholder*="Enter a prompt"]',
    'textarea[placeholder*="Ask Gemini"]',
    'textarea[placeholder*="Message Gemini"]',
    'form [contenteditable="true"]',
    'form textarea',
  ],
  sendButtonSelectors: [
    'button[aria-label*="Send"]',
    'button[aria-label*="Submit"]',
    'button[mattooltip*="Send"]',
    'button[data-test-id*="send"]',
    'form button[type="submit"]',
    'button[type="submit"]',
  ],
  stopButtonSelectors: [
    'button[aria-label*="Stop"]',
    'button[mattooltip*="Stop"]',
  ],
  assistantTextSelectors: [
    'model-response .markdown',
    'model-response .response-content',
    'message-content .markdown',
    'message-content .model-response-text',
    'main .markdown',
    'main message-content',
  ],
  loginSelectors: [
    'a[href*="accounts.google.com"]',
    'input[type="email"]',
    'button[aria-label*="Sign in"]',
    'button[aria-label*="Log in"]',
  ],
  authRequiredMessage: 'Please log into Gemini in a normal browser tab first.',
  openPopupMessage: 'Opening Gemini popup.',
  popupCreatedMessage: 'Gemini popup created.',
  waitForTabMessage: 'Waiting for Gemini tab to finish loading.',
  tabReadyMessage: 'Gemini tab ready.',
  waitForHydrationMessage: 'Waiting for Gemini page hydration.',
  injectRunnerMessage: 'Injecting Gemini prompt runner.',
  progressMessage: 'Gemini prompt runner in progress.',
  retryMessage: 'Retrying prompt after submit-start failure.',
  partialSuccessMessage: 'Using parseable partial Gemini response after timeout.',
  partialRetrySuccessMessage: 'Using parseable partial Gemini response after retry timeout.',
};

export async function runGeminiWebPrompt(prompt, options = {}) {
  const targetUrl = options.profile?.targetUrl || options.targetUrl || GEMINI_WEB_CONFIG.defaultTargetUrl;
  return runWebAutomationPrompt(prompt, GEMINI_WEB_CONFIG, {
    ...options,
    targetUrl,
  });
}
