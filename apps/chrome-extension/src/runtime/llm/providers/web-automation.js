import { extractJsonFromText } from '../../json.js';
import { logError, logInfo } from '../../log.js';
import { registerRunCleanup } from '../../run-control.js';

function getRuntimeError() {
  return chrome.runtime.lastError?.message;
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
  return /no tab with id|no window with id|tab was closed|window was closed|target closed|cannot access a chrome-extension/i.test(
    message,
  );
}

async function openPopupWindow(targetUrl, config) {
  const providerLabel = config.providerLabel;
  const popupWidth = Number.isFinite(config.popupWidth) ? config.popupWidth : 980;
  const popupHeight = Number.isFinite(config.popupHeight) ? config.popupHeight : 900;
  const popupTop = Number.isFinite(config.popupTop) ? config.popupTop : 40;
  const popupLeft = Number.isFinite(config.popupLeft) ? config.popupLeft : 40;
  return new Promise((resolve, reject) => {
    chrome.windows.create(
      {
        url: targetUrl,
        type: 'popup',
        focused: false,
        width: popupWidth,
        height: popupHeight,
        top: popupTop,
        left: popupLeft,
      },
      (createdWindow) => {
        const runtimeError = getRuntimeError();
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }
        if (!createdWindow?.id) {
          reject(new Error(`Unable to open the ${providerLabel} window.`));
          return;
        }
        resolve(createdWindow.id);
      }
    );
  });
}

async function listWindowTabs(windowId) {
  return chrome.tabs.query({ windowId });
}

async function waitForProviderTab(windowId, config, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tabs = await listWindowTabs(windowId);
    if (!tabs.length && Date.now() - startedAt > 500) {
      throw new Error(`${config.providerLabel} popup was closed before the tab finished loading.`);
    }
    const tab = tabs.find((candidate) => candidate.id && config.urlMatchers.some((matcher) => candidate.url?.startsWith(matcher)));
    if (tab?.id && tab.status === 'complete') {
      return tab.id;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for the ${config.providerLabel} window.`);
}

async function closeWindow(windowId) {
  return chrome.windows.remove(windowId).catch(() => {});
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

function getElapsedPhaseLabel(elapsedMs, pollCount, config) {
  const providerName = config.providerLabel;
  const phaseKey = getElapsedPhaseKey(elapsedMs);
  const phrases = {
    popup_load: `${providerName} loading…`,
    submit: 'Submitting the prompt…',
    first_response: `${providerName} is thinking…`,
    streaming: 'Waiting for the response to finish…',
    long_wait: `${providerName} is still running…`,
  };
  const phrase = phrases[phaseKey] ?? phrases.long_wait;
  if (elapsedMs < 15000) {
    return phrase;
  }
  return `${phrase} ${formatElapsedSeconds(elapsedMs)}.`;
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

function buildWatchdogStateLog(state) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  return {
    phase: state.phase ?? null,
    resultStatus: state.resultStatus ?? null,
    busy: state.busy === true,
    rawTextLength:
      typeof state.rawText === 'string' ? state.rawText.length : 0,
    latestTextLength:
      typeof state.latestTextLength === 'number' ? state.latestTextLength : null,
    updatedAt: typeof state.updatedAt === 'number' ? state.updatedAt : null,
    conversationUrl: state.conversationUrl ?? null,
  };
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

function injectedProviderReadinessProbe(config) {
  const INPUT_SELECTORS = config.inputSelectors ?? [];
  const SEND_BUTTON_SELECTORS = config.sendButtonSelectors ?? [];
  const LOGIN_SELECTORS = config.loginSelectors ?? [];

  function currentConversationUrl() {
    if (config.urlMatchers.some((matcher) => window.location.href.startsWith(matcher))) {
      return window.location.href;
    }
    return undefined;
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
    if (!(form instanceof HTMLFormElement)) {
      return null;
    }

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

async function probeWebAutomationStartupReady(tabId, config) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: injectedProviderReadinessProbe,
    args: [config],
  });
  return results?.[0]?.result ?? null;
}

async function waitForWebAutomationStartupReady(
  tabId,
  config,
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
      lastState = await probeWebAutomationStartupReady(tabId, config);
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

export function injectedProviderPromptEntry(prompt, config, options = {}) {
  const WATCHDOG_STATE_KEY = '__resumeMatcherWebAutomationState';
  const responseIdleTimeoutMs = options.responseIdleTimeoutMs ?? config.responseIdleTimeoutMs ?? 25000;
  const responseFirstTokenTimeoutMs = options.responseFirstTokenTimeoutMs ?? config.responseFirstTokenTimeoutMs ?? 60000;
  const responseSettleDelayMs = options.responseSettleDelayMs ?? config.responseSettleDelayMs ?? 900;
  const composerWaitTimeoutMs = 45000;
  const responseTimeoutMs = options.responseTimeoutMs ?? 120000;
  const composeReadyTimeoutMs = options.composeReadyTimeoutMs ?? 15000;
  const sendReadyTimeoutMs = options.sendReadyTimeoutMs ?? 12000;
  const INPUT_SELECTORS = config.inputSelectors ?? [];
  const SEND_BUTTON_SELECTORS = config.sendButtonSelectors ?? [];
  const STOP_BUTTON_SELECTORS = config.stopButtonSelectors ?? [];
  const RESPONSE_BUSY_SELECTORS = config.responseBusySelectors ?? [];
  const PRIMARY_ASSISTANT_TEXT_SELECTORS = config.primaryAssistantTextSelectors ?? [];
  const ASSISTANT_TEXT_SELECTORS = config.assistantTextSelectors ?? [];
  const ASSISTANT_TURN_CONTAINER_SELECTORS =
    config.assistantTurnContainerSelectors ?? [];
  const ASSISTANT_TURN_ROLE_HEADING_SELECTORS =
    config.assistantTurnRoleHeadingSelectors ?? [];
  const ASSISTANT_CONTENT_SELECTORS = config.assistantContentSelectors ?? [];
  const ASSISTANT_TURN_ROLE_HEADING_PATTERN =
    typeof config.assistantTurnRoleHeadingPattern === 'string' &&
    config.assistantTurnRoleHeadingPattern.trim().length > 0
      ? new RegExp(config.assistantTurnRoleHeadingPattern, 'i')
      : null;
  const LOGIN_SELECTORS = config.loginSelectors ?? [];
  const providerLabel = config.providerLabel ?? 'LLM';
  const authRequiredMessage = config.authRequiredMessage ?? `Please log into ${providerLabel} in a normal browser tab first.`;

  function publishWatchdogState(partial) {
    const previous =
      window[WATCHDOG_STATE_KEY] &&
      typeof window[WATCHDOG_STATE_KEY] === 'object'
        ? window[WATCHDOG_STATE_KEY]
        : {};
    const next = {
      ...previous,
      providerLabel,
      updatedAt: Date.now(),
      ...partial,
    };
    window[WATCHDOG_STATE_KEY] = next;
    return next;
  }

  function currentConversationUrl() {
    if (config.urlMatchers.some((matcher) => window.location.href.startsWith(matcher))) {
      return window.location.href;
    }
    return undefined;
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
    if (!(form instanceof HTMLFormElement)) {
      return null;
    }

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

  function hasResponseBusyIndicator() {
    for (const selector of RESPONSE_BUSY_SELECTORS) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        if (!isVisible(node)) continue;
        if (!(node instanceof Element)) return true;

        const streamingAttr = node.getAttribute('data-is-streaming');
        if (streamingAttr != null) {
          const normalized = streamingAttr.trim().toLowerCase();
          if (normalized === 'false' || normalized === '0' || normalized === 'done') {
            continue;
          }
          return true;
        }

        const busyAttr = node.getAttribute('aria-busy');
        if (busyAttr != null) {
          if (busyAttr.trim().toLowerCase() === 'false') {
            continue;
          }
          return true;
        }

        return true;
      }
    }
    return false;
  }

  function collectAssistantCandidates(selectors) {
    const seen = new Set();
    return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter((node) => {
        if (seen.has(node)) return false;
        seen.add(node);
        return true;
      })
      .map((node, index) => {
        const article = findAssistantTurnContainer(node);
        const key =
          article?.getAttribute('data-testid') ||
          article?.getAttribute('data-message-id') ||
          article?.getAttribute('data-test-render-count') ||
          `assistant-node-${index}`;
        const text = extractAssistantCandidateText(node, article);
        return { key, text, article };
      })
      .filter(
        (item) =>
          item.text &&
          (!ASSISTANT_TURN_ROLE_HEADING_PATTERN || item.article instanceof Element)
      );
  }

  function extractAssistantCandidateText(node, article) {
    const scopedText = extractScopedAssistantContent(article);
    if (scopedText) {
      return scopedText;
    }
    const nodeText = normalizeAssistantText(readNodeText(node));
    const isCodeLikeNode = node instanceof Element && Boolean(node.closest('pre, code'));
    if (isCodeLikeNode || !(article instanceof Element)) {
      return nodeText;
    }

    const articleText = normalizeAssistantText(readNodeText(article));
    return articleText.length > nodeText.length ? articleText : nodeText;
  }

  function readNodeText(node) {
    if (node instanceof HTMLElement) {
      return node.innerText ?? node.textContent ?? '';
    }
    return node?.textContent ?? '';
  }

  function normalizeAssistantText(text) {
    return text.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
  }

  function getUniqueElements(elements) {
    const seen = new Set();
    return elements.filter((element) => {
      if (!(element instanceof Element)) return false;
      if (seen.has(element)) return false;
      seen.add(element);
      return true;
    });
  }

  function getAssistantTurnContainers(node) {
    return getUniqueElements([
      ...ASSISTANT_TURN_CONTAINER_SELECTORS.map((selector) =>
        node.closest(selector)
      ),
      node.closest('article[data-testid^="conversation-turn-"]'),
      node.closest('[data-test-render-count]'),
      node.closest('[data-message-id]'),
      node.closest('[data-testid*="message"]'),
    ]);
  }

  function containerHasAssistantRoleMarker(container) {
    if (!(container instanceof Element)) return false;
    if (!ASSISTANT_TURN_ROLE_HEADING_PATTERN) return true;

    const headingNodes = ASSISTANT_TURN_ROLE_HEADING_SELECTORS.length
      ? ASSISTANT_TURN_ROLE_HEADING_SELECTORS.flatMap((selector) =>
          Array.from(container.querySelectorAll(selector))
        )
      : [container];

    return headingNodes.some((node) => {
      const text = normalizeAssistantText(readNodeText(node));
      return text && ASSISTANT_TURN_ROLE_HEADING_PATTERN.test(text);
    });
  }

  function findAssistantTurnContainer(node) {
    const containers = getAssistantTurnContainers(node);
    if (!containers.length) {
      return null;
    }
    if (!ASSISTANT_TURN_ROLE_HEADING_PATTERN) {
      return containers[0];
    }
    return (
      containers.find((container) => containerHasAssistantRoleMarker(container)) ??
      null
    );
  }

  function extractScopedAssistantContent(container) {
    if (!(container instanceof Element) || !ASSISTANT_CONTENT_SELECTORS.length) {
      return '';
    }

    const matches = getUniqueElements(
      ASSISTANT_CONTENT_SELECTORS.flatMap((selector) =>
        Array.from(container.querySelectorAll(selector))
      )
    );
    let bestText = '';
    matches.forEach((node) => {
      const text = normalizeAssistantText(readNodeText(node));
      if (text.length > bestText.length) {
        bestText = text;
      }
    });
    return bestText;
  }

  function mergeAssistantCandidates(candidates) {
    const merged = [];
    const indexByKey = new Map();

    candidates.forEach((candidate) => {
      const existingIndex = indexByKey.get(candidate.key);
      if (existingIndex == null) {
        indexByKey.set(candidate.key, merged.length);
        merged.push(candidate);
        return;
      }

      if (candidate.text.length > merged[existingIndex].text.length) {
        merged[existingIndex] = candidate;
      }
    });

    return merged;
  }

  function getAssistantSnapshot() {
    const primaryCandidates = mergeAssistantCandidates(
      collectAssistantCandidates(PRIMARY_ASSISTANT_TEXT_SELECTORS)
    );
    const fallbackCandidates = mergeAssistantCandidates(
      collectAssistantCandidates(ASSISTANT_TEXT_SELECTORS)
    );
    const candidates = primaryCandidates.length ? primaryCandidates : fallbackCandidates;
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
        reject(new Error(hasLoginPrompt() ? 'auth_required' : `dom_changed:Unable to locate the ${providerLabel} composer.`));
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
    publishWatchdogState({
      phase: 'submitting',
      resultStatus: null,
      busy: true,
      rawText: '',
      latestTextLength: 0,
      conversationUrl: currentConversationUrl(),
    });
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    const readiness = await waitForSendReady(composer);
    const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
    const sendButton = findSendButton(form);
    const baselineSnapshot = getSubmissionSnapshot(composer, form);
    if (!readiness.ready) {
      throw new Error(
        `dom_changed:Prompt submission control never became ready after filling the ${providerLabel} composer.|submit_debug=${JSON.stringify({
          ...readiness,
          baselineSnapshot,
        })}`
      );
    }

    const attemptLog = [];

    const trySubmitAttempt = async (label, runner) => {
      runner();
      const submission = await waitForSubmissionStart(composer, form, baselineSnapshot);
      attemptLog.push({
        label,
        started: submission.started,
        state: submission.snapshot,
        samples: submission.samples,
      });
      return submission.started;
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
      `dom_changed:Prompt submission did not start after filling the ${providerLabel} composer.|submit_debug=${JSON.stringify({
        composerType: composer instanceof HTMLTextAreaElement ? 'textarea' : 'contenteditable',
        submitMode: readiness.mode,
        baselineSnapshot,
        attempts: attemptLog,
      })}`
    );
  }

  async function waitForAssistantResponse(previousAssistant, timeoutMs) {
    const existingSnapshot = getAssistantSnapshot();
    if (hasNewAssistantTurn(previousAssistant, existingSnapshot) && !hasStopButton() && !hasResponseBusyIndicator()) {
      publishWatchdogState({
        phase: 'completed',
        resultStatus: 'success',
        busy: false,
        rawText: existingSnapshot.latestText,
        latestTextLength: existingSnapshot.latestText.length,
        conversationUrl: currentConversationUrl(),
      });
      return existingSnapshot.latestText;
    }

    return new Promise((resolve, reject) => {
      let stableTimer = null;
      let sawNewTurn = hasNewAssistantTurn(previousAssistant, existingSnapshot);
      let lastProgressAt = Date.now();
      let lastSnapshot = existingSnapshot;
      let lastBusyState = hasStopButton() || hasResponseBusyIndicator();

      const cleanup = () => {
        observer.disconnect();
        window.clearTimeout(hardTimeoutId);
        window.clearInterval(idlePollId);
        if (stableTimer !== null) window.clearTimeout(stableTimer);
      };

      const failForTimeout = () => {
        const latestSnapshot = getAssistantSnapshot();
        const partialText = latestSnapshot.latestText.trim();
        publishWatchdogState({
          phase: 'timed_out',
          resultStatus: 'timeout',
          busy: false,
          rawText: partialText,
          latestTextLength: latestSnapshot.latestText.length,
          conversationUrl: currentConversationUrl(),
        });
        cleanup();
        reject(
          new Error(
            partialText
              ? `dom_changed:Timed out waiting for the ${providerLabel} response.|partial=${partialText}`
              : `dom_changed:Timed out waiting for the ${providerLabel} response.`
          )
        );
      };

      const maybeResolve = () => {
        const latestSnapshot = getAssistantSnapshot();
        const isNewTurn = hasNewAssistantTurn(previousAssistant, latestSnapshot);
        const busyState = hasStopButton() || hasResponseBusyIndicator();
        const changed =
          latestSnapshot.count !== lastSnapshot.count ||
          latestSnapshot.latestKey !== lastSnapshot.latestKey ||
          latestSnapshot.latestText !== lastSnapshot.latestText;
        const busyChanged = busyState !== lastBusyState;

        if (changed && isNewTurn) {
          sawNewTurn = true;
          lastProgressAt = Date.now();
        }

        if (busyChanged) {
          lastProgressAt = Date.now();
        }

        lastSnapshot = latestSnapshot;
        lastBusyState = busyState;
        publishWatchdogState({
          phase: 'waiting_for_response',
          resultStatus: null,
          busy: busyState,
          rawText: '',
          latestTextLength: latestSnapshot.latestText.length,
          conversationUrl: currentConversationUrl(),
        });

        if (!isNewTurn || busyState) {
          if (stableTimer !== null) {
            window.clearTimeout(stableTimer);
            stableTimer = null;
          }
          return;
        }

        if (changed || busyChanged) {
          if (stableTimer !== null) {
            window.clearTimeout(stableTimer);
            stableTimer = null;
          }
        }

        if (stableTimer === null) {
          stableTimer = window.setTimeout(() => {
            publishWatchdogState({
              phase: 'completed',
              resultStatus: 'success',
              busy: false,
              rawText: latestSnapshot.latestText,
              latestTextLength: latestSnapshot.latestText.length,
              conversationUrl: currentConversationUrl(),
            });
            cleanup();
            resolve(latestSnapshot.latestText);
          }, responseSettleDelayMs);
        }
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

  publishWatchdogState({
    phase: 'initializing',
    resultStatus: null,
    busy: false,
    rawText: '',
    latestTextLength: 0,
    conversationUrl: currentConversationUrl(),
  });

  return waitForComposer(composerWaitTimeoutMs)
    .then(async (composer) => {
      const composerReady = await waitForComposerReady(composer, composeReadyTimeoutMs);
      if (!composerReady.ready) {
        throw new Error(`dom_changed:${providerLabel} composer never became interactive.|submit_debug=${JSON.stringify(composerReady)}`);
      }
      const baseline = await waitForAssistantBaseline();
      await fillComposer(composer, prompt);
      await submitPrompt(composer);
      const rawText = (await waitForAssistantResponse(baseline, responseTimeoutMs)).trim();
      if (!rawText) {
        publishWatchdogState({
          phase: 'empty_response',
          resultStatus: 'dom_changed',
          busy: false,
          rawText: '',
          latestTextLength: 0,
          conversationUrl: currentConversationUrl(),
        });
        return {
          status: 'dom_changed',
          message: `${providerLabel} returned an empty assistant response after prompt submission.`,
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
      const message = error instanceof Error ? error.message : `dom_changed:Unknown ${providerLabel} automation error.`;
      if (message === 'auth_required') {
        publishWatchdogState({
          phase: 'auth_required',
          resultStatus: 'auth_required',
          busy: false,
          rawText: '',
          latestTextLength: 0,
          conversationUrl: currentConversationUrl(),
        });
        return {
          status: 'auth_required',
          message: authRequiredMessage,
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
      publishWatchdogState({
        phase: 'failed',
        resultStatus: 'dom_changed',
        busy: false,
        rawText: partialRawText ?? '',
        latestTextLength: typeof partialRawText === 'string' ? partialRawText.length : 0,
        conversationUrl: currentConversationUrl(),
      });
      return {
        status: 'dom_changed',
        message: cleanMessage.startsWith('dom_changed:') ? cleanMessage.replace('dom_changed:', '').trim() : cleanMessage,
        partialRawText,
        submitDebug,
        conversationUrl: currentConversationUrl(),
      };
    });
}

async function readInjectedProviderExecutionState(tabId) {
  try {
    const [{ result }] =
      (await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const state = window.__resumeMatcherWebAutomationState;
          if (!state || typeof state !== 'object') {
            return null;
          }
          return {
            phase: typeof state.phase === 'string' ? state.phase : null,
            resultStatus:
              typeof state.resultStatus === 'string'
                ? state.resultStatus
                : null,
            busy: state.busy === true,
            rawText: typeof state.rawText === 'string' ? state.rawText : '',
            latestTextLength:
              typeof state.latestTextLength === 'number'
                ? state.latestTextLength
                : null,
            updatedAt:
              typeof state.updatedAt === 'number' ? state.updatedAt : null,
            conversationUrl:
              typeof state.conversationUrl === 'string'
                ? state.conversationUrl
                : undefined,
          };
        },
      })) ?? [];
    return result ?? null;
  } catch {
    return null;
  }
}

function startWebAutomationCompletionWatchdog(session, config, options = {}) {
  const promptLabel = options.promptLabel ?? session.promptLabel ?? 'Prompt';
  const pollIntervalMs = options.watchdogPollIntervalMs ?? 3000;
  let stopped = false;
  let timerId = null;
  let lastCompletedState = null;

  const stop = () => {
    stopped = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const promise = new Promise((resolve) => {
    const schedule = () => {
      if (stopped) return;
      timerId = setTimeout(runTick, pollIntervalMs);
    };

    const runTick = async () => {
      if (stopped) return;
      const state = await readInjectedProviderExecutionState(session.tabId);
      if (!state) {
        schedule();
        return;
      }

      if (
        state.resultStatus === 'success' &&
        typeof state.rawText === 'string' &&
        state.rawText.trim()
      ) {
        const normalizedText = state.rawText.trim();
        const isSameCompletedState =
          lastCompletedState &&
          lastCompletedState.updatedAt === state.updatedAt &&
          lastCompletedState.rawText === normalizedText;

        if (isSameCompletedState) {
          stop();
          logInfo(config.scope, 'Completion watchdog recovered a stale popup result.', {
            promptLabel,
            tabId: session.tabId,
            watchdogState: buildWatchdogStateLog(state),
          });
          resolve({
            status: 'success',
            rawText: normalizedText,
            conversationUrl: state.conversationUrl,
            recoveredByWatchdog: true,
          });
          return;
        }

        lastCompletedState = {
          updatedAt: state.updatedAt ?? null,
          rawText: normalizedText,
        };
      } else {
        lastCompletedState = null;
      }

      schedule();
    };

    schedule();
  });

  return { promise, stop };
}

function shouldRetryPromptRun(result, config) {
  if (result?.status !== 'dom_changed' || typeof result?.message !== 'string') {
    return false;
  }

  const composerLabel = config.providerLabel;
  return (
    result.message.includes(`Prompt submission did not start after filling the ${composerLabel} composer.`) ||
    result.message.includes(`Prompt submission control never became ready after filling the ${composerLabel} composer.`) ||
    result.message.includes(`Timed out waiting for the ${composerLabel} response.`) ||
    result.message.includes(`Unable to locate the ${composerLabel} composer.`) ||
    result.message.includes(`${composerLabel} composer never became interactive.`)
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

async function openWebAutomationSession(config, options = {}) {
  const requestedTargetUrl = options.targetUrl ?? config.defaultTargetUrl;
  const promptLabel = options.promptLabel ?? 'Prompt';
  const targetUrl = buildRunTargetUrl(requestedTargetUrl);
  const promptLength = options.promptLength ?? 0;
  const composeReadyTimeoutMs = options.composeReadyTimeoutMs ?? null;
  const sendReadyTimeoutMs = options.sendReadyTimeoutMs ?? null;
  const responseTimeoutMs = options.responseTimeoutMs ?? config.responseTimeoutMs ?? null;
  const responseIdleTimeoutMs = options.responseIdleTimeoutMs ?? config.responseIdleTimeoutMs ?? null;
  const responseFirstTokenTimeoutMs = options.responseFirstTokenTimeoutMs ?? config.responseFirstTokenTimeoutMs ?? null;
  const warmupDelayMs = options.warmupDelayMs ?? 1500;
  const runId = options.runId ?? null;

  logInfo(config.scope, config.openPopupMessage, {
    promptLabel,
    targetUrl,
    promptLength,
    composeReadyTimeoutMs,
    sendReadyTimeoutMs,
    responseTimeoutMs,
    responseIdleTimeoutMs,
    responseFirstTokenTimeoutMs,
    warmupDelayMs,
    popupWidth: config.popupWidth ?? 980,
    popupHeight: config.popupHeight ?? 900,
  });
  const popupWindowId = await openPopupWindow(targetUrl, config);
  logInfo(config.scope, config.popupCreatedMessage, { promptLabel, popupWindowId });
  const unregisterCleanup = runId
    ? registerRunCleanup(runId, async () => {
        await closeWindow(popupWindowId);
      })
    : () => {};

  try {
    logInfo(config.scope, config.waitForTabMessage, { promptLabel, popupWindowId });
    const tabId = await waitForProviderTab(popupWindowId, config);
    logInfo(config.scope, config.tabReadyMessage, { promptLabel, popupWindowId, tabId });
    if (warmupDelayMs > 0) {
      logInfo(config.scope, config.waitForHydrationMessage, { promptLabel, tabId, warmupDelayMs });
      const readiness = await waitForWebAutomationStartupReady(
        tabId,
        config,
        warmupDelayMs,
      );
      if (readiness.ready) {
        logInfo(config.scope, `${config.providerLabel} startup ready.`, {
          promptLabel,
          tabId,
          elapsedMs: readiness.elapsedMs,
          readiness: buildStartupReadinessLog(readiness.state),
        });
      } else {
        logInfo(
          config.scope,
          `${config.providerLabel} startup readiness wait expired; continuing to prompt runner.`,
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

async function executeWebAutomationPromptInSession(session, prompt, config, options = {}) {
  const promptLabel = options.promptLabel ?? session.promptLabel ?? 'Prompt';
  const promptLength = prompt.length;
  const composeReadyTimeoutMs = options.composeReadyTimeoutMs ?? Math.min(30000, Math.max(15000, Math.ceil(promptLength / 3)));
  const sendReadyTimeoutMs = options.sendReadyTimeoutMs ?? Math.min(30000, Math.max(12000, Math.ceil(promptLength / 3)));
  const responseTimeoutMs = options.responseTimeoutMs ?? config.responseTimeoutMs ?? 120000;
  const responseIdleTimeoutMs = options.responseIdleTimeoutMs ?? config.responseIdleTimeoutMs ?? 25000;
  const responseFirstTokenTimeoutMs = options.responseFirstTokenTimeoutMs ?? config.responseFirstTokenTimeoutMs ?? 60000;

  let executionResults;
  try {
    logInfo(config.scope, config.injectRunnerMessage, {
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
      func: injectedProviderPromptEntry,
      args: [
        prompt,
        config,
        {
          responseTimeoutMs,
          responseIdleTimeoutMs,
          responseFirstTokenTimeoutMs,
          responseSettleDelayMs: options.responseSettleDelayMs ?? config.responseSettleDelayMs,
          composeReadyTimeoutMs,
          sendReadyTimeoutMs,
        },
      ],
    });
    const completionWatchdog = startWebAutomationCompletionWatchdog(
      session,
      config,
      options,
    );

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
      logInfo(config.scope, config.progressMessage, {
        promptLabel,
        tabId: session.tabId,
        elapsedMs,
        pollCount,
        phase: getElapsedPhaseKey(elapsedMs),
        phaseText: getElapsedPhaseLabel(elapsedMs, pollCount, config),
        tab: tabSnapshot,
      });
    }, 4000);

    try {
      const racedResult = await Promise.race([
        executionPromise.then((results) => ({
          kind: 'execution',
          results,
        })),
        completionWatchdog.promise.then((result) => ({
          kind: 'watchdog',
          result,
        })),
      ]);
      if (racedResult.kind === 'watchdog') {
        return racedResult.result;
      }
      executionResults = racedResult.results;
    } finally {
      settled = true;
      completionWatchdog.stop();
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
    logError(config.scope, 'Script injection failed.', {
      promptLabel,
      tabId: session.tabId,
      targetUrl: session.targetUrl,
      message,
    });
    throw new Error(`Failed to inject ${config.providerLabel} prompt runner into ${session.targetUrl}: ${message}`);
  }

  const [{ result }] = executionResults ?? [];
  const [tab] = await chrome.tabs.query({ windowId: session.popupWindowId });
  logInfo(config.scope, 'Script execution completed.', {
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
    logError(config.scope, 'Prompt run returned a non-success result.', normalizeResultForLogging(result));
  }
  return result;
}

async function closeWebAutomationSession(session) {
  session?.unregisterCleanup?.();
  if (session?.popupWindowId) {
    await closeWindow(session.popupWindowId);
  }
}

async function runWebAutomationPromptWithRetryInSession(prompt, session, config, options = {}) {
  const firstResult = await executeWebAutomationPromptInSession(session, prompt, config, options);
  if (canUsePartialJson(firstResult)) {
    logInfo(config.scope, config.partialSuccessMessage, {
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

  if (!shouldRetryPromptRun(firstResult, config) || options.disableRetry) {
    return firstResult;
  }

  logInfo(config.scope, config.retryMessage, {
    promptLabel: options.promptLabel ?? 'Prompt',
    promptLength: prompt.length,
    firstAttempt: normalizeResultForLogging(firstResult),
  });

  const retryResult = await executeWebAutomationPromptInSession(session, prompt, config, {
    ...options,
    disableRetry: true,
    composeReadyTimeoutMs: Math.min(45000, Math.max(options.composeReadyTimeoutMs ?? 0, Math.ceil(prompt.length / 2), 20000)),
    sendReadyTimeoutMs: Math.min(45000, Math.max(options.sendReadyTimeoutMs ?? 0, Math.ceil(prompt.length / 2), 18000)),
    responseTimeoutMs: Math.max(options.responseTimeoutMs ?? 0, config.responseTimeoutMs ?? 0, 180000),
    responseIdleTimeoutMs: Math.max(options.responseIdleTimeoutMs ?? 0, config.responseIdleTimeoutMs ?? 0, 90000),
    responseFirstTokenTimeoutMs: Math.max(options.responseFirstTokenTimeoutMs ?? 0, config.responseFirstTokenTimeoutMs ?? 0, 90000),
  });
  if (canUsePartialJson(retryResult)) {
    logInfo(config.scope, config.partialRetrySuccessMessage, {
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

export async function runWebAutomationPrompt(prompt, config, options = {}) {
  const session = await openWebAutomationSession(config, {
    ...options,
    promptLength: prompt.length,
  });

  try {
    let result = await runWebAutomationPromptWithRetryInSession(prompt, session, config, options);
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
          promptLabel: options.promptLabel ?? 'Prompt',
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

        logInfo(config.scope, 'Attempting in-thread repair for invalid response.', {
          promptLabel: options.promptLabel ?? 'Prompt',
          attempt,
          validationMessage: validation.message ?? 'The previous response was invalid.',
          conversationUrl: result.conversationUrl ?? null,
        });

        result = await runWebAutomationPromptWithRetryInSession(repairPrompt, session, config, {
          ...options,
          disableRetry: false,
          composeReadyTimeoutMs: Math.min(30000, Math.max(options.composeReadyTimeoutMs ?? 0, 12000)),
          sendReadyTimeoutMs: Math.min(30000, Math.max(options.sendReadyTimeoutMs ?? 0, 12000)),
          responseTimeoutMs: Math.max(options.responseTimeoutMs ?? 0, config.responseTimeoutMs ?? 0, 120000),
          responseIdleTimeoutMs: Math.max(options.responseIdleTimeoutMs ?? 0, config.responseIdleTimeoutMs ?? 0, 45000),
          responseFirstTokenTimeoutMs: Math.max(options.responseFirstTokenTimeoutMs ?? 0, config.responseFirstTokenTimeoutMs ?? 0, 45000),
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
  } finally {
    await closeWebAutomationSession(session);
  }
}
