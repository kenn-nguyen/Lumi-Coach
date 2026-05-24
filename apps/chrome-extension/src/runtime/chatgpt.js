import { DEFAULT_CHATGPT_TARGET_URL } from './constants.js';
import { extractJsonFromText } from './json.js';
import { logError, logInfo } from './log.js';
import { registerRunCleanup } from './run-control.js';

const chatGptRunSessions = new Map();

function getRuntimeError() {
  return chrome.runtime.lastError?.message;
}

function getReusableRunId(options = {}) {
  const reusePopupSession = options?.reusePopupSession === true;
  const runId =
    typeof options?.runId === 'string' && options.runId.trim()
      ? options.runId.trim()
      : '';
  return reusePopupSession && runId ? runId : '';
}

function buildRunTargetUrl(targetUrl) {
  try {
    const url = new URL(targetUrl);
    url.searchParams.set('rm_run', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    return url.toString();
  } catch {
    return targetUrl;
  }
}

function isPopupClosedError(error) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /no tab with id|no window with id|tab was closed|window was closed|target closed|cannot access a chrome-extension|frame with id \d+ was removed/i.test(
    message,
  );
}

async function openPopupWindow(targetUrl) {
  return new Promise((resolve, reject) => {
    chrome.windows.create(
      {
        url: targetUrl,
        type: 'popup',
        focused: false,
        width: 980,
        height: 900,
        top: 40,
        left: 40,
      },
      (createdWindow) => {
        const runtimeError = getRuntimeError();
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }
        if (!createdWindow?.id) {
          reject(new Error('Unable to open the ChatGPT window.'));
          return;
        }
        resolve(createdWindow.id);
      }
    );
  });
}

function getElapsedPhaseKey(elapsedMs) {
  if (elapsedMs < 4000) return 'popup_load';
  if (elapsedMs < 12000) return 'submit';
  if (elapsedMs < 30000) return 'first_response';
  if (elapsedMs < 90000) return 'streaming';
  return 'long_wait';
}

function formatElapsedSeconds(elapsedMs) {
  const seconds = Math.max(1, Math.ceil(elapsedMs / 1000));
  return `${seconds}s`;
}

function getElapsedPhaseLabel(elapsedMs, pollCount = 1) {
  const phaseKey = getElapsedPhaseKey(elapsedMs);
  const phrases = {
    popup_load: 'Waiting for ChatGPT to load…',
    submit: 'Submitting the prompt…',
    first_response: 'Waiting for the first response…',
    streaming: 'Waiting for ChatGPT to finish…',
    long_wait: 'Still waiting on ChatGPT…',
  };
  const phrase = phrases[phaseKey] ?? phrases.long_wait;
  if (elapsedMs < 15000) {
    return phrase;
  }
  return `${phrase} ${formatElapsedSeconds(elapsedMs)}.`;
}

async function listWindowTabs(windowId) {
  return chrome.tabs.query({ windowId });
}

async function waitForChatGptTab(windowId, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tabs = await listWindowTabs(windowId);
    if (!tabs.length && Date.now() - startedAt > 500) {
      throw new Error('ChatGPT popup was closed before the tab finished loading.');
    }
    const tab = tabs.find((candidate) => candidate.id && (candidate.url?.startsWith('https://chatgpt.com') || candidate.url?.startsWith('https://chat.openai.com')));
    if (tab?.id && tab.status === 'complete') {
      return tab.id;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the ChatGPT window.');
}

async function waitForChatGptTabById(tabId, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (
        tab?.id &&
        tab.status === 'complete' &&
        (tab.url?.startsWith('https://chatgpt.com') ||
          tab.url?.startsWith('https://chat.openai.com'))
      ) {
        return tab;
      }
    } catch {
      if (Date.now() - startedAt > 500) {
        throw new Error(
          'ChatGPT popup was closed before the tab finished loading.',
        );
      }
    }
    await wait(250);
  }
  throw new Error('Timed out waiting for the ChatGPT tab.');
}

async function closeWindow(windowId) {
  return chrome.windows.remove(windowId).catch(() => {});
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeResultForLogging(result) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  let normalized = result;
  if (typeof normalized.submitDebug === 'string') {
    try {
      normalized = {
        ...normalized,
        submitDebug: JSON.parse(normalized.submitDebug),
      };
    } catch {
      normalized = {
        ...normalized,
        submitDebugText: normalized.submitDebug,
      };
    }
  }

  if (normalized.submitDebug && typeof normalized.submitDebug === 'object') {
    normalized = {
      ...normalized,
      submitDebugText: JSON.stringify(normalized.submitDebug),
    };
  }

  return normalized;
}

function buildStartupReadinessLog(state) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  return {
    ready: state.ready === true,
    authRequired: state.authRequired === true,
    composerFound: state.composerFound === true,
    composerInteractive: state.composerInteractive === true,
    sendButtonFound: state.sendButtonFound === true,
    sendButtonDisabled:
      typeof state.sendButtonDisabled === 'boolean'
        ? state.sendButtonDisabled
        : null,
    sendButtonState:
      state.sendButtonState && typeof state.sendButtonState === 'object'
        ? state.sendButtonState
        : null,
    formFound: state.formFound === true,
    conversationUrl: state.conversationUrl ?? null,
  };
}

function injectedChatGptReadinessProbe() {
  const INPUT_SELECTORS = [
    'div#prompt-textarea.ProseMirror[contenteditable="true"][role="textbox"]',
    '[data-composer-surface="true"] div#prompt-textarea[contenteditable="true"]',
    '.wcDTda_prosemirror-parent div#prompt-textarea[contenteditable="true"]',
    'textarea#prompt-textarea',
    'textarea[name="prompt-textarea"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Ask"]',
    'textarea[data-testid="prompt-textarea"]',
    'form textarea',
    'div#prompt-textarea[contenteditable="true"]',
    'div[contenteditable="true"][data-testid="composer"]',
    'div[data-testid*="composer"] [contenteditable="true"]',
    'div[contenteditable="true"].ProseMirror',
    'form [contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
  ];
  const SEND_BUTTON_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[data-testid*="send"]',
    'button[aria-label*="Send prompt"]',
    'button[aria-label*="Send message"]',
    'button[aria-label="Send"]',
    'button[type="submit"]',
    'form button[type="submit"]',
  ];
  const LOGIN_SELECTORS = [
    'a[href*="/auth/login"]',
    'button[data-testid="login-button"]',
    'button[aria-label*="Log in"]',
    'button[aria-label*="Sign in"]',
  ];

  function currentConversationUrl() {
    return window.location.href.startsWith('https://chatgpt.com/') ||
      window.location.href.startsWith('https://chat.openai.com/')
      ? window.location.href
      : undefined;
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function findVisibleElement(selectors) {
    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        if (isVisible(node)) return node;
      }
    }
    return null;
  }

  function findComposer() {
    for (const selector of INPUT_SELECTORS) {
      const candidate = findVisibleElement([selector]);
      if (!candidate) continue;
      if (candidate instanceof HTMLTextAreaElement) return candidate;
      if (
        candidate instanceof HTMLElement &&
        (candidate.isContentEditable ||
          candidate.getAttribute('contenteditable') === 'true')
      ) {
        return candidate;
      }
    }
    return null;
  }

  function isComposerInteractive(composer) {
    if (!composer) return false;
    if (composer instanceof HTMLTextAreaElement) {
      return !composer.disabled && !composer.readOnly;
    }
    return (
      composer.getAttribute('aria-disabled') !== 'true' &&
      composer.getAttribute('contenteditable') !== 'false'
    );
  }

  function hasLoginPrompt() {
    return Boolean(findVisibleElement(LOGIN_SELECTORS));
  }

  function findFormSubmitButton(form) {
    if (!(form instanceof HTMLFormElement)) return null;
    const buttons = Array.from(form.querySelectorAll('button')).filter(
      (node) => node instanceof HTMLButtonElement,
    );
    const prioritized = buttons.find((button) => {
      const aria = (button.getAttribute('aria-label') ?? '').toLowerCase();
      const testId = (button.getAttribute('data-testid') ?? '').toLowerCase();
      const text = (button.textContent ?? '').toLowerCase();
      const looksLoading =
        aria.includes('loading') ||
        text.includes('loading') ||
        aria.includes('stop') ||
        text.includes('stop');
      const looksLikeComposerUtility =
        testId.includes('composer-plus') ||
        testId.includes('plus-btn') ||
        aria.includes('attach') ||
        aria.includes('upload') ||
        aria.includes('voice') ||
        aria.includes('microphone') ||
        text.includes('attach') ||
        text.includes('upload') ||
        text.includes('voice');
      return (
        !looksLoading &&
        !looksLikeComposerUtility &&
        (button.type === 'submit' ||
          aria.includes('send') ||
          testId.includes('send'))
      );
    });
    if (prioritized) return prioritized;
    return (
      buttons.find((button) => {
        const aria = (button.getAttribute('aria-label') ?? '').toLowerCase();
        const testId = (button.getAttribute('data-testid') ?? '').toLowerCase();
        const text = (button.textContent ?? '').toLowerCase();
        const looksLoading =
          aria.includes('loading') ||
          text.includes('loading') ||
          aria.includes('stop') ||
          text.includes('stop');
        const looksLikeComposerUtility =
          testId.includes('composer-plus') ||
          testId.includes('plus-btn') ||
          aria.includes('attach') ||
          aria.includes('upload') ||
          aria.includes('voice') ||
          aria.includes('microphone') ||
          text.includes('attach') ||
          text.includes('upload') ||
          text.includes('voice');
        return (
          !looksLoading &&
          !looksLikeComposerUtility &&
          (button.type === 'submit' ||
            aria.includes('send') ||
            testId.includes('send'))
        );
      }) ?? null
    );
  }

  function findSendButton(form) {
    for (const selector of SEND_BUTTON_SELECTORS) {
      const node = document.querySelector(selector);
      if (node instanceof HTMLButtonElement) {
        const aria = (node.getAttribute('aria-label') ?? '').toLowerCase();
        const testId = (node.getAttribute('data-testid') ?? '').toLowerCase();
        const text = (node.textContent ?? '').toLowerCase();
        const looksLikeComposerUtility =
          testId.includes('composer-plus') ||
          testId.includes('plus-btn') ||
          aria.includes('attach') ||
          aria.includes('upload') ||
          aria.includes('voice') ||
          aria.includes('microphone') ||
          text.includes('attach') ||
          text.includes('upload') ||
          text.includes('voice');
        if (
          aria.includes('loading') ||
          text.includes('loading') ||
          aria.includes('stop') ||
          text.includes('stop') ||
          looksLikeComposerUtility
        ) {
          continue;
        }
        return node;
      }
    }
    return findFormSubmitButton(form);
  }

  function getButtonState(button) {
    if (!(button instanceof HTMLButtonElement)) return null;
    return {
      text: button.textContent?.trim().slice(0, 30) ?? '',
      ariaLabel: button.getAttribute('aria-label'),
      dataTestId: button.getAttribute('data-testid'),
      disabled: button.disabled,
    };
  }

  const composer = findComposer();
  const form =
    composer instanceof HTMLTextAreaElement
      ? composer.form
      : composer?.closest?.('form');
  const sendButton = findSendButton(form);

  return {
    ready: Boolean(composer && isComposerInteractive(composer)),
    authRequired: !composer && hasLoginPrompt(),
    composerFound: Boolean(composer),
    composerInteractive: Boolean(composer && isComposerInteractive(composer)),
    sendButtonFound: Boolean(sendButton),
    sendButtonDisabled:
      sendButton instanceof HTMLButtonElement ? sendButton.disabled : null,
    sendButtonState: getButtonState(sendButton),
    formFound: form instanceof HTMLFormElement,
    conversationUrl: currentConversationUrl(),
  };
}

async function probeChatGptStartupReady(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: injectedChatGptReadinessProbe,
  });
  return results?.[0]?.result ?? null;
}

async function waitForChatGptStartupReady(
  tabId,
  timeoutMs,
  options = {},
) {
  if (!(Number.isFinite(timeoutMs) && timeoutMs > 0)) {
    return { ready: false, skipped: true, state: null, elapsedMs: 0 };
  }

  const pollIntervalMs = Math.max(
    50,
    Math.min(options.pollIntervalMs ?? 150, timeoutMs),
  );
  const startedAt = Date.now();
  let lastState = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastState = await probeChatGptStartupReady(tabId);
      if (lastState?.ready) {
        return {
          ready: true,
          timedOut: false,
          state: lastState,
          elapsedMs: Date.now() - startedAt,
        };
      }
    } catch (error) {
      if (isPopupClosedError(error)) {
        throw error;
      }
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      break;
    }
    await wait(Math.min(pollIntervalMs, remainingMs));
  }

  return {
    ready: false,
    timedOut: true,
    state: lastState,
    elapsedMs: Date.now() - startedAt,
  };
}

function injectedChatGptPromptEntry(prompt, options = {}) {
  const responseIdleTimeoutMs = options.responseIdleTimeoutMs ?? 300000;
  const responseFirstTokenTimeoutMs = options.responseFirstTokenTimeoutMs ?? 300000;
  const composerWaitTimeoutMs = 45000;
  const responseTimeoutMs = options.responseTimeoutMs ?? 600000;
  const composeReadyTimeoutMs = options.composeReadyTimeoutMs ?? 15000;
  const sendReadyTimeoutMs = options.sendReadyTimeoutMs ?? 12000;
  const INPUT_SELECTORS = [
    'div#prompt-textarea.ProseMirror[contenteditable="true"][role="textbox"]',
    '[data-composer-surface="true"] div#prompt-textarea[contenteditable="true"]',
    '.wcDTda_prosemirror-parent div#prompt-textarea[contenteditable="true"]',
    'textarea#prompt-textarea',
    'textarea[name="prompt-textarea"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Ask"]',
    'textarea[data-testid="prompt-textarea"]',
    'form textarea',
    'div#prompt-textarea[contenteditable="true"]',
    'div[contenteditable="true"][data-testid="composer"]',
    'div[data-testid*="composer"] [contenteditable="true"]',
    'div[contenteditable="true"].ProseMirror',
    'form [contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
  ];
  const SEND_BUTTON_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[data-testid*="send"]',
    'button[aria-label*="Send prompt"]',
    'button[aria-label*="Send message"]',
    'button[aria-label="Send"]',
    'button[type="submit"]',
    'form button[type="submit"]',
  ];
  const STOP_BUTTON_SELECTORS = [
    'button[data-testid="stop-button"]',
    'button[data-testid*="stop"]',
    'button[aria-label*="Stop generating"]',
    'button[aria-label*="Stop streaming"]',
    'button[aria-label="Stop"]',
    'button[aria-label*="Stop loading"]',
  ];
  const ASSISTANT_TEXT_SELECTORS = [
    '[data-message-author-role="assistant"] .markdown',
    '[data-message-author-role="assistant"] [class*="markdown"]',
    '[data-message-author-role="assistant"] .prose',
    'article[data-testid^="conversation-turn-"] .markdown',
    'article[data-testid^="conversation-turn-"] [class*="markdown"]',
    'article[data-testid^="conversation-turn-"] .prose',
  ];
  const LOGIN_SELECTORS = [
    'a[href*="/auth/login"]',
    'button[data-testid="login-button"]',
    'button[aria-label*="Log in"]',
    'button[aria-label*="Sign in"]',
  ];

  function currentConversationUrl() {
    return window.location.href.startsWith('https://chatgpt.com/') || window.location.href.startsWith('https://chat.openai.com/')
      ? window.location.href
      : undefined;
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function findVisibleElement(selectors) {
    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        if (isVisible(node)) return node;
      }
    }
    return null;
  }

  function findComposer() {
    for (const selector of INPUT_SELECTORS) {
      const candidate = findVisibleElement([selector]);
      if (!candidate) continue;
      if (candidate instanceof HTMLTextAreaElement) return candidate;
      if (candidate instanceof HTMLElement && (candidate.isContentEditable || candidate.getAttribute('contenteditable') === 'true')) {
        return candidate;
      }
    }
    return null;
  }

  function isComposerInteractive(composer) {
    if (!composer) return false;
    if (composer instanceof HTMLTextAreaElement) {
      return !composer.disabled && !composer.readOnly;
    }
    return composer.getAttribute('aria-disabled') !== 'true' && composer.getAttribute('contenteditable') !== 'false';
  }

  function hasLoginPrompt() {
    return Boolean(findVisibleElement(LOGIN_SELECTORS));
  }

  function findFormSubmitButton(form) {
    if (!(form instanceof HTMLFormElement)) return null;
    const buttons = Array.from(form.querySelectorAll('button')).filter((node) => node instanceof HTMLButtonElement);
    const prioritized = buttons.find((button) => {
      const aria = (button.getAttribute('aria-label') ?? '').toLowerCase();
      const testId = (button.getAttribute('data-testid') ?? '').toLowerCase();
      const text = (button.textContent ?? '').toLowerCase();
      const looksLoading = aria.includes('loading') || text.includes('loading') || aria.includes('stop') || text.includes('stop');
      const looksLikeComposerUtility =
        testId.includes('composer-plus') ||
        testId.includes('plus-btn') ||
        aria.includes('attach') ||
        aria.includes('upload') ||
        aria.includes('voice') ||
        aria.includes('microphone') ||
        text.includes('attach') ||
        text.includes('upload') ||
        text.includes('voice');
      return !looksLoading && !looksLikeComposerUtility && (button.type === 'submit' || aria.includes('send') || testId.includes('send'));
    });
    if (prioritized) return prioritized;
    return buttons.find((button) => {
      const aria = (button.getAttribute('aria-label') ?? '').toLowerCase();
      const testId = (button.getAttribute('data-testid') ?? '').toLowerCase();
      const text = (button.textContent ?? '').toLowerCase();
      const looksLoading = aria.includes('loading') || text.includes('loading') || aria.includes('stop') || text.includes('stop');
      const looksLikeComposerUtility =
        testId.includes('composer-plus') ||
        testId.includes('plus-btn') ||
        aria.includes('attach') ||
        aria.includes('upload') ||
        aria.includes('voice') ||
        aria.includes('microphone') ||
        text.includes('attach') ||
        text.includes('upload') ||
        text.includes('voice');
      return !looksLoading && !looksLikeComposerUtility && (button.type === 'submit' || aria.includes('send') || testId.includes('send'));
    }) ?? null;
  }

  function getFormDebug(form) {
    if (!(form instanceof HTMLFormElement)) {
      return { formFound: false, buttonCount: 0, buttons: [] };
    }
    const buttons = Array.from(form.querySelectorAll('button')).filter((node) => node instanceof HTMLButtonElement);
    return {
      formFound: true,
      buttonCount: buttons.length,
      buttons: buttons.slice(0, 5).map((button) => ({
        type: button.type || null,
        text: button.textContent?.trim().slice(0, 30) ?? '',
        ariaLabel: button.getAttribute('aria-label'),
        dataTestId: button.getAttribute('data-testid'),
        disabled: button.disabled,
      })),
    };
  }

  function findSendButton(form) {
    for (const selector of SEND_BUTTON_SELECTORS) {
      const node = document.querySelector(selector);
      if (node instanceof HTMLButtonElement) {
        const aria = (node.getAttribute('aria-label') ?? '').toLowerCase();
        const testId = (node.getAttribute('data-testid') ?? '').toLowerCase();
        const text = (node.textContent ?? '').toLowerCase();
        const looksLikeComposerUtility =
          testId.includes('composer-plus') ||
          testId.includes('plus-btn') ||
          aria.includes('attach') ||
          aria.includes('upload') ||
          aria.includes('voice') ||
          aria.includes('microphone') ||
          text.includes('attach') ||
          text.includes('upload') ||
          text.includes('voice');
        if (aria.includes('loading') || text.includes('loading') || aria.includes('stop') || text.includes('stop') || looksLikeComposerUtility) {
          continue;
        }
        return node;
      }
    }
    return findFormSubmitButton(form);
  }

  function getButtonState(button) {
    if (!(button instanceof HTMLButtonElement)) return null;
    return {
      text: button.textContent?.trim().slice(0, 30) ?? '',
      ariaLabel: button.getAttribute('aria-label'),
      dataTestId: button.getAttribute('data-testid'),
      disabled: button.disabled,
    };
  }

  function getConversationKey() {
    const url = currentConversationUrl();
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return url;
    }
  }

  function getSubmissionSnapshot(composer, form) {
    const assistantSnapshot = getAssistantSnapshot();
    const buttons = getFormDebug(form);
    const composerTextLength =
      composer instanceof HTMLTextAreaElement
        ? composer.value.trim().length
        : composer.textContent?.trim().length ?? 0;

    return {
      composerTextLength,
      hasStopButton: hasStopButton(),
      assistantCount: assistantSnapshot.count,
      assistantLatestKey: assistantSnapshot.latestKey,
      assistantLatestTextLength: assistantSnapshot.latestText.length,
      conversationKey: getConversationKey(),
      ...buttons,
      sendButtonState: getButtonState(findSendButton(form)),
    };
  }

  function didSubmissionStart(baseline, next) {
    return (
      next.hasStopButton ||
      next.composerTextLength === 0 ||
      next.assistantCount > baseline.assistantCount ||
      (baseline.assistantLatestKey && next.assistantLatestKey && next.assistantLatestKey !== baseline.assistantLatestKey) ||
      (baseline.conversationKey && next.conversationKey && next.conversationKey !== baseline.conversationKey)
    );
  }

  function hasStopButton() {
    if (STOP_BUTTON_SELECTORS.some((selector) => document.querySelector(selector))) {
      return true;
    }

    const buttons = Array.from(document.querySelectorAll('button')).filter((node) => node instanceof HTMLButtonElement);
    return buttons.some((button) => {
      const aria = (button.getAttribute('aria-label') ?? '').toLowerCase();
      const text = (button.textContent ?? '').toLowerCase();
      const testId = (button.getAttribute('data-testid') ?? '').toLowerCase();
      return (
        aria.includes('stop') ||
        aria.includes('loading') ||
        text.includes('stop') ||
        text.includes('loading') ||
        testId.includes('stop')
      );
    });
  }

  function getAssistantSnapshot() {
    const seen = new Set();
    const candidates = ASSISTANT_TEXT_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter((node) => {
        if (seen.has(node)) return false;
        seen.add(node);
        return true;
      })
      .map((node, index) => {
        const article = node.closest('article[data-testid^="conversation-turn-"]');
        const key = article?.getAttribute('data-testid') ?? `assistant-node-${index}`;
        const text = node.textContent?.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim() ?? '';
        return { key, text };
      })
      .filter((item) => item.text);
    const latest = candidates.at(-1);
    return {
      count: candidates.length,
      latestKey: latest?.key ?? null,
      latestText: latest?.text ?? '',
    };
  }

  function hasNewAssistantTurn(previous, next) {
    if (!next.latestText) return false;
    if (next.count > previous.count) return true;
    if (next.latestKey && previous.latestKey && next.latestKey !== previous.latestKey) return true;
    if (previous.latestText && next.latestText !== previous.latestText) return true;
    return false;
  }

  async function waitForComposer(timeoutMs) {
    const existing = findComposer();
    if (existing) return existing;
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error(hasLoginPrompt() ? 'auth_required' : 'dom_changed:Unable to locate the ChatGPT composer.'));
      }, timeoutMs);

      const observer = new MutationObserver(() => {
        const candidate = findComposer();
        if (!candidate) return;
        observer.disconnect();
        window.clearTimeout(timeoutId);
        resolve(candidate);
      });

      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    });
  }

  async function waitForAssistantBaseline() {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    return getAssistantSnapshot();
  }

  async function waitForComposerReady(composer, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
      const sendButton = findSendButton(form);
      if (isComposerInteractive(composer) && (!sendButton || !sendButton.disabled || sendButton.getAttribute('aria-disabled') !== 'true')) {
        return {
          ready: true,
          sendButtonFound: Boolean(sendButton),
          sendButtonDisabled: sendButton?.disabled ?? null,
          sendButtonState: getButtonState(sendButton),
          ...getFormDebug(form),
        };
      }
      await new Promise((resolve) => window.setTimeout(resolve, 200));
    }
    const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
    const sendButton = findSendButton(form);
    return {
      ready: false,
      sendButtonFound: Boolean(sendButton),
      sendButtonDisabled: sendButton?.disabled ?? null,
      sendButtonState: getButtonState(sendButton),
      ...getFormDebug(form),
      composerDisabled:
        composer instanceof HTMLTextAreaElement
          ? composer.disabled || composer.readOnly
          : composer.getAttribute('aria-disabled') === 'true' || composer.getAttribute('contenteditable') === 'false',
    };
  }

  async function fillComposer(composer, nextPrompt) {
    composer.focus();
    if (composer instanceof HTMLTextAreaElement) {
      const prototype = Object.getPrototypeOf(composer);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor?.set) {
        descriptor.set.call(composer, nextPrompt);
      } else {
        composer.value = nextPrompt;
      }
      composer.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: nextPrompt, inputType: 'insertText' }));
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, data: nextPrompt, inputType: 'insertText' }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    composer.innerHTML = '';
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const inserted = document.execCommand('insertText', false, nextPrompt);
    if (!inserted) {
      composer.textContent = nextPrompt;
    }
    composer.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: nextPrompt, inputType: 'insertText' }));
    composer.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function waitForSendReady(composer, timeoutMs = sendReadyTimeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
      const sendButton = findSendButton(form);
      const composerText = composer instanceof HTMLTextAreaElement ? composer.value.trim() : composer.textContent?.trim() ?? '';
      if (sendButton && !sendButton.disabled) {
        return {
          ready: true,
          mode: 'button',
          composerTextLength: composerText.length,
          sendButtonState: getButtonState(sendButton),
          ...getFormDebug(form),
        };
      }
      if (!sendButton && composerText.length > 0) {
        return {
          ready: true,
          mode: form instanceof HTMLFormElement ? 'keyboard_in_form' : 'keyboard',
          composerTextLength: composerText.length,
          sendButtonState: null,
          ...getFormDebug(form),
        };
      }
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
    const sendButton = findSendButton(form);
    const composerText = composer instanceof HTMLTextAreaElement ? composer.value.trim() : composer.textContent?.trim() ?? '';
    return {
      ready: false,
      mode: sendButton ? 'button' : form ? 'pending_button' : 'keyboard',
      composerTextLength: composerText.length,
      sendButtonDisabled: sendButton?.disabled ?? null,
      sendButtonState: getButtonState(sendButton),
      ...getFormDebug(form),
    };
  }

  async function waitForSubmissionStart(composer, form, baselineSnapshot, timeoutMs = Math.max(10000, sendReadyTimeoutMs)) {
    const samples = [];
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = getSubmissionSnapshot(composer, form);
      if (samples.length < 8 || Date.now() - startedAt + 250 >= timeoutMs) {
        samples.push(snapshot);
      }
      if (didSubmissionStart(baselineSnapshot, snapshot)) {
        return { started: true, snapshot, samples };
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    return {
      started: false,
      snapshot: getSubmissionSnapshot(composer, form),
      samples,
    };
  }

  async function submitPrompt(composer) {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    const readiness = await waitForSendReady(composer);
    const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
    const sendButton = findSendButton(form);
    const baselineSnapshot = getSubmissionSnapshot(composer, form);
    if (!readiness.ready) {
      throw new Error(
        `dom_changed:Prompt submission control never became ready after filling the ChatGPT composer.|submit_debug=${JSON.stringify({
          ...readiness,
          baselineSnapshot,
        })}`
      );
    }

    const attemptLog = [];

    const trySubmitAttempt = async (label, runner) => {
      runner();
      const submission = await waitForSubmissionStart(composer, form, baselineSnapshot);
      const started = submission.started;
      attemptLog.push({
        label,
        started,
        state: submission.snapshot,
        samples: submission.samples,
      });
      return started;
    };

    if (sendButton && !sendButton.disabled) {
      const buttonStarted = await trySubmitAttempt('button.click', () => {
        sendButton.click();
      });
      if (!buttonStarted) {
        const pointerStarted = await trySubmitAttempt('button.pointerSequence', () => {
          sendButton.focus();
          for (const eventName of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
            sendButton.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }));
          }
        });
        if (pointerStarted) return;
      } else {
        return;
      }
    }

    const enterEventInit = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', which: 13, keyCode: 13 };
    const keyboardStarted = await trySubmitAttempt('composer.enter', () => {
      composer.dispatchEvent(new KeyboardEvent('keydown', enterEventInit));
      composer.dispatchEvent(new KeyboardEvent('keypress', enterEventInit));
      composer.dispatchEvent(new KeyboardEvent('keyup', enterEventInit));
    });
    if (keyboardStarted) return;

    throw new Error(
      `dom_changed:Prompt submission did not start after filling the ChatGPT composer.|submit_debug=${JSON.stringify({
        composerType: composer instanceof HTMLTextAreaElement ? 'textarea' : 'contenteditable',
        submitMode: readiness.mode,
        baselineSnapshot,
        attempts: attemptLog,
      })}`
    );
  }

  async function waitForAssistantResponse(previousAssistant, timeoutMs) {
    const existingSnapshot = getAssistantSnapshot();
    if (hasNewAssistantTurn(previousAssistant, existingSnapshot) && !hasStopButton()) {
      return existingSnapshot.latestText;
    }

    return new Promise((resolve, reject) => {
      let stableTimer = null;
      let sawNewTurn = hasNewAssistantTurn(previousAssistant, existingSnapshot);
      let lastProgressAt = Date.now();
      let lastSnapshot = existingSnapshot;

      const cleanup = () => {
        observer.disconnect();
        window.clearTimeout(hardTimeoutId);
        window.clearInterval(idlePollId);
        if (stableTimer !== null) window.clearTimeout(stableTimer);
      };

      const failForTimeout = () => {
        const latestSnapshot = getAssistantSnapshot();
        cleanup();
        reject(new Error(latestSnapshot.latestText.trim() ? `dom_changed:Timed out waiting for the ChatGPT response.|partial=${latestSnapshot.latestText.trim()}` : 'dom_changed:Timed out waiting for the ChatGPT response.'));
      };

      const maybeResolve = () => {
        const latestSnapshot = getAssistantSnapshot();
        const isNewTurn = hasNewAssistantTurn(previousAssistant, latestSnapshot);
        const changed =
          latestSnapshot.count !== lastSnapshot.count ||
          latestSnapshot.latestKey !== lastSnapshot.latestKey ||
          latestSnapshot.latestText !== lastSnapshot.latestText;

        if (changed && isNewTurn) {
          sawNewTurn = true;
          lastProgressAt = Date.now();
        }

        lastSnapshot = latestSnapshot;

        if (!isNewTurn || hasStopButton()) {
          if (stableTimer !== null) {
            window.clearTimeout(stableTimer);
            stableTimer = null;
          }
          return;
        }

        if (stableTimer !== null) {
          window.clearTimeout(stableTimer);
        }

        stableTimer = window.setTimeout(() => {
          cleanup();
          resolve(latestSnapshot.latestText);
        }, 900);
      };

      const hardTimeoutId = window.setTimeout(() => failForTimeout(), timeoutMs);
      const idlePollId = window.setInterval(() => {
        maybeResolve();
        const timeoutWindow = sawNewTurn ? responseIdleTimeoutMs : Math.min(responseFirstTokenTimeoutMs, timeoutMs);
        if (Date.now() - lastProgressAt >= timeoutWindow) {
          failForTimeout();
        }
      }, 1000);

      const observer = new MutationObserver(() => maybeResolve());
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    });
  }

  return waitForComposer(composerWaitTimeoutMs)
    .then(async (composer) => {
      const composerReady = await waitForComposerReady(composer, composeReadyTimeoutMs);
      if (!composerReady.ready) {
        throw new Error(`dom_changed:ChatGPT composer never became interactive.|submit_debug=${JSON.stringify(composerReady)}`);
      }
      const baseline = await waitForAssistantBaseline();
      await fillComposer(composer, prompt);
      await submitPrompt(composer);
      const rawText = (await waitForAssistantResponse(baseline, responseTimeoutMs)).trim();
      if (!rawText) {
        return {
          status: 'dom_changed',
          message: 'ChatGPT returned an empty assistant response after prompt submission.',
          conversationUrl: currentConversationUrl(),
        };
      }
      return {
        status: 'success',
        rawText,
        conversationUrl: currentConversationUrl(),
      };
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'dom_changed:Unknown ChatGPT automation error.';
      if (message === 'auth_required') {
        return {
          status: 'auth_required',
          message: 'Please log into ChatGPT in a normal browser tab first.',
          conversationUrl: currentConversationUrl(),
        };
      }

      const partialMarker = '|partial=';
      const debugMarker = '|submit_debug=';
      const partialIndex = message.indexOf(partialMarker);
      const debugIndex = message.indexOf(debugMarker);
      const partialRawText = partialIndex >= 0 ? message.slice(partialIndex + partialMarker.length) : undefined;
      const cleanBeforePartial = partialIndex >= 0 ? message.slice(0, partialIndex) : message;
      const cleanMessage = debugIndex >= 0 ? cleanBeforePartial.slice(0, debugIndex) : cleanBeforePartial;
      const submitDebug = debugIndex >= 0 ? message.slice(debugIndex + debugMarker.length, partialIndex >= 0 ? partialIndex : undefined) : undefined;
      return {
        status: 'dom_changed',
        message: cleanMessage.startsWith('dom_changed:') ? cleanMessage.replace('dom_changed:', '').trim() : cleanMessage,
        partialRawText,
        submitDebug,
        conversationUrl: currentConversationUrl(),
      };
    });
}

async function openChatGptSession(options = {}) {
  const requestedTargetUrl = options.targetUrl ?? DEFAULT_CHATGPT_TARGET_URL;
  const promptLabel = options.promptLabel ?? 'Prompt';
  const targetUrl = buildRunTargetUrl(requestedTargetUrl);
  const promptLength = options.promptLength ?? 0;
  const composeReadyTimeoutMs = options.composeReadyTimeoutMs ?? null;
  const sendReadyTimeoutMs = options.sendReadyTimeoutMs ?? null;
  const warmupDelayMs = options.warmupDelayMs ?? 1500;
  const runId = options.runId ?? null;
  logInfo('ChatGptAutomation', 'Opening ChatGPT popup.', {
    promptLabel,
    targetUrl,
    promptLength,
    composeReadyTimeoutMs,
    sendReadyTimeoutMs,
    warmupDelayMs,
  });
  const popupWindowId = await openPopupWindow(targetUrl);
  logInfo('ChatGptAutomation', 'ChatGPT popup created.', { promptLabel, popupWindowId });
  const unregisterCleanup = runId
    ? registerRunCleanup(runId, async () => {
        await closeWindow(popupWindowId);
      })
    : () => {};
  try {
    logInfo('ChatGptAutomation', 'Waiting for ChatGPT tab to finish loading.', { promptLabel, popupWindowId });
    const tabId = await waitForChatGptTab(popupWindowId);
    logInfo('ChatGptAutomation', 'ChatGPT tab ready.', { promptLabel, popupWindowId, tabId });
    if (warmupDelayMs > 0) {
      logInfo('ChatGptAutomation', 'Waiting for ChatGPT startup readiness.', {
        promptLabel,
        tabId,
        warmupDelayMs,
      });
      const readiness = await waitForChatGptStartupReady(tabId, warmupDelayMs);
      if (readiness.ready) {
        logInfo('ChatGptAutomation', 'ChatGPT startup ready.', {
          promptLabel,
          tabId,
          elapsedMs: readiness.elapsedMs,
          readiness: buildStartupReadinessLog(readiness.state),
        });
      } else {
        logInfo(
          'ChatGptAutomation',
          'ChatGPT startup readiness wait expired; continuing to prompt runner.',
          {
            promptLabel,
            tabId,
            elapsedMs: readiness.elapsedMs,
            readiness: buildStartupReadinessLog(readiness.state),
          },
        );
      }
    }
    return { popupWindowId, tabId, targetUrl, promptLabel, unregisterCleanup };
  } catch (error) {
    unregisterCleanup();
    await closeWindow(popupWindowId);
    throw error;
  }
}

export async function getOrOpenChatGptRunSession(runId, options = {}) {
  const normalizedRunId =
    typeof runId === 'string' && runId.trim() ? runId.trim() : '';
  if (!normalizedRunId) {
    throw new Error('A run id is required to reuse a ChatGPT popup session.');
  }

  const existing = chatGptRunSessions.get(normalizedRunId);
  if (existing) {
    return existing;
  }

  const session = await openChatGptSession({
    ...options,
    runId: normalizedRunId,
  });

  session.unregisterCleanup?.();
  session.unregisterCleanup = registerRunCleanup(
    normalizedRunId,
    async () => {
      chatGptRunSessions.delete(normalizedRunId);
      await closeWindow(session.popupWindowId);
    },
  );
  session.needsReset = false;
  chatGptRunSessions.set(normalizedRunId, session);
  return session;
}

export async function resetChatGptRunSession(runId, options = {}) {
  const normalizedRunId =
    typeof runId === 'string' && runId.trim() ? runId.trim() : '';
  if (!normalizedRunId) {
    throw new Error('A run id is required to reset a ChatGPT popup session.');
  }

  const session = await getOrOpenChatGptRunSession(normalizedRunId, options);
  const requestedTargetUrl = options.targetUrl ?? DEFAULT_CHATGPT_TARGET_URL;
  const targetUrl = buildRunTargetUrl(requestedTargetUrl);
  const warmupDelayMs = options.warmupDelayMs ?? 1500;

  logInfo('ChatGptAutomation', 'Resetting reusable ChatGPT popup.', {
    promptLabel: options.promptLabel ?? session.promptLabel ?? 'Prompt',
    runId: normalizedRunId,
    tabId: session.tabId,
    targetUrl,
    warmupDelayMs,
  });

  const updatedTab = await chrome.tabs.update(session.tabId, { url: targetUrl });
  const nextTabId = updatedTab?.id ?? session.tabId;
  await waitForChatGptTabById(nextTabId);
  if (warmupDelayMs > 0) {
    const readiness = await waitForChatGptStartupReady(nextTabId, warmupDelayMs);
    logInfo(
      'ChatGptAutomation',
      readiness.ready
        ? 'ChatGPT startup ready after reset.'
        : 'ChatGPT startup readiness wait expired after reset; continuing to prompt runner.',
      {
        promptLabel: options.promptLabel ?? session.promptLabel ?? 'Prompt',
        runId: normalizedRunId,
        tabId: nextTabId,
        elapsedMs: readiness.elapsedMs,
        readiness: buildStartupReadinessLog(readiness.state),
      },
    );
  }

  session.tabId = nextTabId;
  session.targetUrl = targetUrl;
  session.needsReset = false;
  return session;
}

async function executeChatGptPromptInSession(session, prompt, options = {}) {
  const promptLabel = options.promptLabel ?? session.promptLabel ?? 'Prompt';
  const promptLength = prompt.length;
  const composeReadyTimeoutMs = options.composeReadyTimeoutMs ?? Math.min(30000, Math.max(15000, Math.ceil(promptLength / 3)));
  const sendReadyTimeoutMs = options.sendReadyTimeoutMs ?? Math.min(30000, Math.max(12000, Math.ceil(promptLength / 3)));
  const responseTimeoutMs = options.responseTimeoutMs ?? 600000;
  const responseIdleTimeoutMs = options.responseIdleTimeoutMs ?? 300000;
  const responseFirstTokenTimeoutMs = options.responseFirstTokenTimeoutMs ?? 300000;

  let executionResults;
  try {
    logInfo('ChatGptAutomation', 'Injecting ChatGPT prompt runner.', {
      promptLabel,
      tabId: session.tabId,
      responseTimeoutMs,
      responseIdleTimeoutMs,
      responseFirstTokenTimeoutMs,
    });

    let settled = false;
    const pollStartAt = Date.now();
    let pollCount = 0;
    const executionPromise = chrome.scripting.executeScript({
      target: { tabId: session.tabId },
      func: injectedChatGptPromptEntry,
      args: [prompt, { responseTimeoutMs, responseIdleTimeoutMs, responseFirstTokenTimeoutMs, composeReadyTimeoutMs, sendReadyTimeoutMs }],
    });
    const progressPoll = setInterval(async () => {
      if (settled) return;
      const elapsedMs = Date.now() - pollStartAt;
      pollCount += 1;
      let tabSnapshot = null;
      try {
        const tab = await chrome.tabs.get(session.tabId);
        tabSnapshot = {
          status: tab?.status ?? null,
          title: tab?.title ?? null,
          url: tab?.url ?? null,
        };
      } catch {
        // ignore transient tab lookup errors while popup is active
      }
      logInfo('ChatGptAutomation', 'ChatGPT prompt runner in progress.', {
        promptLabel,
        tabId: session.tabId,
        elapsedMs,
        pollCount,
        phase: getElapsedPhaseKey(elapsedMs),
        phaseText: getElapsedPhaseLabel(elapsedMs, pollCount),
        tab: tabSnapshot,
      });
    }, 4000);
    try {
      executionResults = await executionPromise;
    } finally {
      settled = true;
      clearInterval(progressPoll);
    }
  } catch (error) {
    if (isPopupClosedError(error)) {
      return {
        status: 'canceled',
        message: 'Run canceled.',
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    logError('ChatGptAutomation', 'Script injection failed.', {
      promptLabel,
      tabId: session.tabId,
      targetUrl: session.targetUrl,
      message,
    });
    throw new Error(`Failed to inject ChatGPT prompt runner into ${session.targetUrl}: ${message}`);
  }

  const [{ result }] = executionResults ?? [];
  const [tab] = await chrome.tabs.query({ windowId: session.popupWindowId });
  logInfo('ChatGptAutomation', 'Script execution completed.', {
    promptLabel,
    tabId: session.tabId,
    tabUrl: tab?.url ?? null,
    hasResult: Boolean(result),
    status: result?.status ?? null,
  });

  if (!result) {
    if (!tab) {
      return {
        status: 'canceled',
        message: 'Run canceled.',
      };
    }
    throw new Error(`Prompt automation did not return a result. Tab URL: ${tab?.url ?? 'unknown'}`);
  }
  if (result.status !== 'success') {
    logError('ChatGptAutomation', 'Prompt run returned a non-success result.', normalizeResultForLogging(result));
  }
  return result;
}

async function closeChatGptSession(session) {
  session?.unregisterCleanup?.();
  if (session?.popupWindowId) {
    await closeWindow(session.popupWindowId);
  }
}

export async function closeChatGptRunSession(runId) {
  const normalizedRunId =
    typeof runId === 'string' && runId.trim() ? runId.trim() : '';
  if (!normalizedRunId) return;

  const session = chatGptRunSessions.get(normalizedRunId);
  if (!session) return;

  chatGptRunSessions.delete(normalizedRunId);
  await closeChatGptSession(session);
}

function shouldRetryPromptRun(result) {
  if (result?.status !== 'dom_changed' || typeof result?.message !== 'string') {
    return false;
  }

  return (
    result.message.includes('Prompt submission did not start after filling the ChatGPT composer.') ||
    result.message.includes('Prompt submission control never became ready after filling the ChatGPT composer.') ||
    result.message.includes('Timed out waiting for the ChatGPT response.') ||
    result.message.includes('Unable to locate the ChatGPT composer.') ||
    result.message.includes('ChatGPT composer never became interactive.')
  );
}

function canUsePartialJson(result) {
  if (result?.status !== 'dom_changed' || typeof result?.partialRawText !== 'string') {
    return false;
  }

  try {
    extractJsonFromText(result.partialRawText);
    return true;
  } catch {
    return false;
  }
}

async function runChatGptPromptWithRetryInSession(prompt, session, options = {}) {
  const firstResult = await executeChatGptPromptInSession(session, prompt, options);
  if (canUsePartialJson(firstResult)) {
    logInfo('ChatGptAutomation', 'Using parseable partial ChatGPT response after timeout.', {
      promptLabel: options.promptLabel ?? 'Prompt',
      promptLength: prompt.length,
      conversationUrl: firstResult.conversationUrl ?? null,
    });
    return {
      status: 'success',
      rawText: firstResult.partialRawText.trim(),
      conversationUrl: firstResult.conversationUrl,
    };
  }
  if (!shouldRetryPromptRun(firstResult) || options.disableRetry) {
    return firstResult;
  }

  logInfo('ChatGptAutomation', 'Retrying prompt after submit-start failure.', {
    promptLabel: options.promptLabel ?? 'Prompt',
    promptLength: prompt.length,
    firstAttempt: normalizeResultForLogging(firstResult),
  });

  const retryResult = await executeChatGptPromptInSession(session, prompt, {
    ...options,
    disableRetry: true,
    composeReadyTimeoutMs: Math.min(45000, Math.max(options.composeReadyTimeoutMs ?? 0, Math.ceil(prompt.length / 2), 20000)),
    sendReadyTimeoutMs: Math.min(45000, Math.max(options.sendReadyTimeoutMs ?? 0, Math.ceil(prompt.length / 2), 18000)),
    responseTimeoutMs: Math.min(900000, Math.max(options.responseTimeoutMs ?? 0, 720000)),
    responseIdleTimeoutMs: Math.min(600000, Math.max(options.responseIdleTimeoutMs ?? 0, 300000)),
    responseFirstTokenTimeoutMs: Math.min(600000, Math.max(options.responseFirstTokenTimeoutMs ?? 0, 300000)),
  });
  if (canUsePartialJson(retryResult)) {
    logInfo('ChatGptAutomation', 'Using parseable partial ChatGPT response after retry timeout.', {
      promptLabel: options.promptLabel ?? 'Prompt',
      promptLength: prompt.length,
      conversationUrl: retryResult.conversationUrl ?? null,
    });
    return {
      status: 'success',
      rawText: retryResult.partialRawText.trim(),
      conversationUrl: retryResult.conversationUrl,
    };
  }
  return retryResult;
}

async function runChatGptPromptInExistingSession(prompt, session, options = {}) {
  let result = await runChatGptPromptWithRetryInSession(prompt, session, options);
  const validateResponse =
    typeof options.validateResponse === 'function'
      ? options.validateResponse
      : null;
  const buildRepairPrompt =
    typeof options.buildRepairPrompt === 'function'
      ? options.buildRepairPrompt
      : null;
  const maxRepairAttempts = Number.isInteger(options.maxRepairAttempts)
    ? Math.max(0, options.maxRepairAttempts)
    : 0;

  if (
    result.status === 'success' &&
    validateResponse &&
    buildRepairPrompt &&
    maxRepairAttempts > 0
  ) {
    for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
      const validation = validateResponse(result.rawText);
      if (!validation || validation.valid) {
        break;
      }

      const repairPrompt = buildRepairPrompt({
        attempt,
        promptLabel: options.promptLabel ?? 'Prompt',
        validationMessage:
          validation.message ?? 'The previous response was invalid.',
        previousRawText: result.rawText,
      });
      if (!repairPrompt || !repairPrompt.trim()) {
        result = {
          ...result,
          validationError:
            validation.message ?? 'The previous response was invalid.',
        };
        break;
      }

      logInfo(
        'ChatGptAutomation',
        'Attempting in-thread repair for invalid response.',
        {
          promptLabel: options.promptLabel ?? 'Prompt',
          attempt,
          validationMessage:
            validation.message ?? 'The previous response was invalid.',
          conversationUrl: result.conversationUrl ?? null,
        },
      );

      result = await runChatGptPromptWithRetryInSession(repairPrompt, session, {
        ...options,
        disableRetry: false,
        composeReadyTimeoutMs: Math.min(
          30000,
          Math.max(options.composeReadyTimeoutMs ?? 0, 12000),
        ),
        sendReadyTimeoutMs: Math.min(
          30000,
          Math.max(options.sendReadyTimeoutMs ?? 0, 12000),
        ),
        responseTimeoutMs: Math.min(
          600000,
          Math.max(options.responseTimeoutMs ?? 0, 300000),
        ),
        responseIdleTimeoutMs: Math.min(
          420000,
          Math.max(options.responseIdleTimeoutMs ?? 0, 180000),
        ),
        responseFirstTokenTimeoutMs: Math.min(
          420000,
          Math.max(options.responseFirstTokenTimeoutMs ?? 0, 180000),
        ),
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
          validationError:
            finalValidation.message ?? 'The previous response was invalid.',
        };
      }
    }
  }

  return result;
}

export async function runChatGptPrompt(prompt, options = {}) {
  const reusableRunId = getReusableRunId(options);
  if (reusableRunId) {
    const session = await getOrOpenChatGptRunSession(reusableRunId, {
      ...options,
      promptLength: prompt.length,
    });
    if (session.needsReset) {
      await resetChatGptRunSession(reusableRunId, {
        ...options,
        promptLength: prompt.length,
      });
    }

    try {
      const result = await runChatGptPromptInExistingSession(
        prompt,
        session,
        options,
      );
      session.needsReset =
        result.status === 'success' && !result.validationError;
      return result;
    } catch (error) {
      session.needsReset = false;
      throw error;
    }
  }

  const session = await openChatGptSession({
    ...options,
    promptLength: prompt.length,
  });

  try {
    return await runChatGptPromptInExistingSession(prompt, session, options);
  } finally {
    await closeChatGptSession(session);
  }
}

export function clearChatGptRunSessionsForTests() {
  chatGptRunSessions.clear();
}
