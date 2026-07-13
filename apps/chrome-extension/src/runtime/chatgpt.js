import { DEFAULT_CHATGPT_TARGET_URL } from './constants.js';
import { extractJsonFromText } from './json.js';
import { logError, logInfo, logWarn } from './log.js';
import { recordRawEmission } from './log-buffer.js';
import {
  getActiveRun,
  registerRunCleanup,
  throwIfRunCanceled,
} from './run-control.js';
import { acquireWebFireSlot } from './fire-gate.js';

const chatGptRunSessions = new Map();

// ---------------------------------------------------------------------------
// Orphaned-window recovery helpers
// When the MV3 service worker is killed mid-run the chatGptRunSessions Map is
// wiped, but any open popup window survives.  We persist window IDs to
// storage so the next worker startup can close any leftover windows.
// ---------------------------------------------------------------------------
const ORPHAN_WINDOW_STORAGE_KEY = 'chatgpt_popup_window_ids';

async function persistPopupWindowId(windowId) {
  try {
    const stored = await chrome.storage.local.get(ORPHAN_WINDOW_STORAGE_KEY);
    const ids = new Set(stored[ORPHAN_WINDOW_STORAGE_KEY] ?? []);
    ids.add(windowId);
    await chrome.storage.local.set({ [ORPHAN_WINDOW_STORAGE_KEY]: [...ids] });
  } catch {
    // Non-critical — best effort
  }
}

async function removePersistedPopupWindowId(windowId) {
  try {
    const stored = await chrome.storage.local.get(ORPHAN_WINDOW_STORAGE_KEY);
    const ids = new Set(stored[ORPHAN_WINDOW_STORAGE_KEY] ?? []);
    ids.delete(windowId);
    if (ids.size > 0) {
      await chrome.storage.local.set({ [ORPHAN_WINDOW_STORAGE_KEY]: [...ids] });
    } else {
      await chrome.storage.local.remove(ORPHAN_WINDOW_STORAGE_KEY);
    }
  } catch {
    // Non-critical — best effort
  }
}

/**
 * Close any ChatGPT popup windows left open by a previous service-worker
 * incarnation.  Call once during service-worker startup.
 */
export async function closeOrphanedChatGptWindows() {
  try {
    const stored = await chrome.storage.local.get(ORPHAN_WINDOW_STORAGE_KEY);
    const ids = stored[ORPHAN_WINDOW_STORAGE_KEY] ?? [];
    if (ids.length === 0) return;
    logInfo('ChatGptAutomation', 'Closing orphaned ChatGPT popup windows.', { ids });
    await Promise.all(ids.map((id) => chrome.windows.remove(id).catch(() => {})));
    await chrome.storage.local.remove(ORPHAN_WINDOW_STORAGE_KEY);
  } catch {
    // Non-critical
  }
}

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

function isChatGptUrl(url) {
  return (
    typeof url === 'string' &&
    (url.startsWith('https://chatgpt.com') ||
      url.startsWith('https://chat.openai.com'))
  );
}

function isPopupClosedError(error) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /no tab with id|no window with id|tab was closed|window was closed|target closed|cannot access a chrome-extension|frame with id \d+ was removed/i.test(
    message,
  );
}

// Auth cookies that MUST be preserved — removing any of these logs the user
// out of ChatGPT. Covers next-auth's session token (which can be chunked into
// `…session-token.0`, `.1`, …), callback URL, and CSRF token.
function isChatGptAuthCookie(name) {
  return (
    name.startsWith('__Secure-next-auth') ||
    name.startsWith('__Host-next-auth') ||
    name.includes('session-token')
  );
}

/**
 * Remove cookies that accumulate and bloat the Cookie request header for
 * chatgpt.com, causing HTTP 431 (Request Header Fields Too Large) — reproducible
 * by simply opening chatgpt.com after the header has grown too large; a manual
 * refresh (after some cookies clear) fixes it. We clear the non-essential
 * offenders so the header stays under the limit.
 *
 * Purged (never affects login):
 *   - Rotating Cloudflare cookies (__cf_bm, _cfuvid) — regenerate every ~30 min
 *     and stack up across sessions
 *   - Common analytics/tracking cookies (Google, Datadog, Bing, Meta, Segment)
 *   - Any cookie whose expiration date has already passed
 *
 * Deliberately NOT purged:
 *   - cf_clearance — Cloudflare's "this browser passed the bot check" token.
 *     Removing it forces a fresh challenge on the next navigation, which renders
 *     as an error page and broke prompt-to-prompt resets. Keep it.
 *   - the next-auth session/CSRF cookies (see isChatGptAuthCookie) — login.
 * Safe to call even if the `cookies` permission is absent (fails silently).
 */
async function pruneChatGptCookies({ aggressive = false } = {}) {
  const domains = ['chatgpt.com', '.chatgpt.com', 'chat.openai.com', '.chat.openai.com'];
  // Rotating Cloudflare + analytics cookies that are safe to clear before a
  // fresh session. (cf_clearance is intentionally excluded — see above.)
  const purgePrefixes = [
    '__cf_bm',
    '_cfuvid',
    '_ga',
    '_gid',
    '_gat', // Google Analytics
    '_dd_s', // Datadog
    '_uetsid',
    '_uetvid', // Bing
    '_fbp', // Meta pixel
    'ajs_', // Segment
  ];
  const nowSec = Date.now() / 1000;

  try {
    for (const domain of domains) {
      let cookies;
      try {
        cookies = await chrome.cookies.getAll({ domain });
      } catch {
        continue; // permission not granted or domain not accessible
      }
      for (const cookie of cookies) {
        if (isChatGptAuthCookie(cookie.name)) continue; // never touch login
        const isPurgeable =
          // 431 recovery: the Cookie header is too large, so clear EVERY
          // non-login cookie (incl. cf_clearance) to shrink it below the limit.
          // A one-time Cloudflare re-check may follow, but it beats a hard 431.
          aggressive ||
          purgePrefixes.some((p) => cookie.name.startsWith(p)) ||
          (cookie.expirationDate != null && cookie.expirationDate < nowSec);
        if (!isPurgeable) continue;
        const cookieUrl = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
        await chrome.cookies.remove({ url: cookieUrl, name: cookie.name }).catch(() => {});
      }
    }
  } catch {
    // Best-effort — never block the popup from opening
  }
}

// Diagnostic: summarize the chatgpt.com cookie jar (names + approximate byte
// size) so an HTTP 431 ("Request Header Fields Too Large") log pinpoints exactly
// which cookie bloats the Cookie header — enabling a precise, non-aggressive
// preventive prune instead of always clearing everything (which forces a
// Cloudflare re-check).
async function summarizeChatGptCookies() {
  const domains = ['chatgpt.com', '.chatgpt.com'];
  const seen = new Map(); // name -> approx bytes (dedupe by name across domains)
  let totalBytes = 0;
  try {
    for (const domain of domains) {
      let cookies;
      try {
        cookies = await chrome.cookies.getAll({ domain });
      } catch {
        continue;
      }
      for (const cookie of cookies) {
        if (seen.has(cookie.name)) continue;
        // "name=value; " — the shape that counts toward the request Cookie header.
        const bytes = (cookie.name?.length ?? 0) + (cookie.value?.length ?? 0) + 3;
        seen.set(cookie.name, bytes);
        totalBytes += bytes;
      }
    }
  } catch {
    // Best-effort diagnostic — never throw.
  }
  const top = [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, bytes]) => ({ name, bytes }));
  return { cookieCount: seen.size, approxHeaderBytes: totalBytes, topCookies: top };
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
      throw new Error('ChatGPT popup was closed before the tab became reachable.');
    }
    const tab = tabs.find(
      (candidate) => candidate.id && isChatGptUrl(candidate.url),
    );
    if (tab?.id) {
      return tab.id;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the ChatGPT tab.');
}

async function waitForChatGptTabById(tabId, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab?.id && isChatGptUrl(tab.url)) {
        return tab;
      }
    } catch {
      if (Date.now() - startedAt > 500) {
        throw new Error(
          'ChatGPT popup was closed before the tab became reachable.',
        );
      }
    }
    await wait(250);
  }
  throw new Error('Timed out waiting for the ChatGPT tab to become reachable.');
}

// Resolve once the tab's TOP frame finishes (re)loading. `chrome.tabs.reload`
// returns immediately — it does NOT wait for the reload to commit — so without
// this the old page is still in the tab and a readiness probe / prompt inject
// races against the reload tearing the page down (observed: a refreshed prompt
// returning no result). Register the listener BEFORE triggering the reload so
// the event can't be missed; a timeout + optional status fallback guarantees we
// never hang if webNavigation is unavailable.
function waitForTopFrameLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      try {
        chrome.webNavigation?.onCompleted?.removeListener(onCompleted);
      } catch {
        /* ignore */
      }
      clearTimeout(timer);
      resolve(ok);
    };
    const onCompleted = (details) => {
      if (details?.tabId === tabId && details?.frameId === 0) finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      chrome.webNavigation?.onCompleted?.addListener(onCompleted);
    } catch {
      // webNavigation unavailable — the timeout fallback will resolve.
    }
  });
}

async function closeWindow(windowId) {
  await removePersistedPopupWindowId(windowId);
  return chrome.windows.remove(windowId).catch(() => {});
}

// True when the popup window no longer exists. Used to tell a user-closed window
// (window gone → don't reopen) apart from a Chrome-discarded tab (window still
// present → safe to reopen and continue the run).
async function isPopupWindowGone(windowId) {
  if (typeof windowId !== 'number') return true;
  try {
    await chrome.windows.get(windowId);
    return false;
  } catch {
    return true;
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// When the popup shows an error page we can't read WHY (Chrome error pages
// aren't script-injectable). Probe chatgpt.com directly from the background —
// with the same cookies — to capture the real HTTP status (403/429/431/…) so we
// can tell a Cloudflare block apart from cookie bloat or a network drop.
async function probeChatGptHttpStatus() {
  try {
    const res = await fetch('https://chatgpt.com/', {
      method: 'GET',
      credentials: 'include',
      redirect: 'manual',
      cache: 'no-store',
    });
    if (res.type === 'opaqueredirect') return 'redirect';
    return res.status ?? 'unknown';
  } catch (error) {
    return `network-error:${error instanceof Error ? error.message : String(error)}`;
  }
}

// Raise and un-minimize the active run's ChatGPT popup so a frozen/hidden popup
// resumes streaming. Called from the background when the user clicks the
// "Bring ChatGPT to front" hint in the LinkedIn tab.
export async function focusChatGptPopup(runId = null) {
  let windowId = null;
  // Target the requested run's popup (parallel: N popups exist). Fall back to
  // the first session when no runId is given (single-popup / legacy callers).
  if (runId) {
    const session = chatGptRunSessions.get(runId);
    if (typeof session?.popupWindowId === 'number') {
      windowId = session.popupWindowId;
    }
  }
  if (typeof windowId !== 'number') {
    for (const session of chatGptRunSessions.values()) {
      if (typeof session?.popupWindowId === 'number') {
        windowId = session.popupWindowId;
        break;
      }
    }
  }
  if (typeof windowId !== 'number') return false;
  try {
    await chrome.windows.update(windowId, {
      focused: true,
      state: 'normal',
      drawAttention: true,
    });
    return true;
  } catch {
    return false;
  }
}

function truncateForLog(value, max = 300) {
  if (typeof value !== 'string') return value;
  return value.length > max ? `${value.slice(0, max)}… (${value.length} chars)` : value;
}

function normalizeResultForLogging(result) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  // Trim the large fields before logging. The full model output (rawText /
  // partialRawText) and submitDebug sample arrays are multi-KB; logging them
  // verbatim retains them in the console and bloats every LOG_EVENT relay
  // message. Keep capped previews — enough to debug, cheap to carry.
  const normalized = { ...result };
  if (typeof normalized.rawText === 'string') {
    normalized.rawText = truncateForLog(normalized.rawText);
  }
  if (typeof normalized.partialRawText === 'string') {
    normalized.partialRawText = truncateForLog(normalized.partialRawText);
  }
  if (normalized.submitDebug != null) {
    const debugText =
      typeof normalized.submitDebug === 'string'
        ? normalized.submitDebug
        : JSON.stringify(normalized.submitDebug);
    normalized.submitDebug = truncateForLog(debugText, 600);
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

  const acceptAnyProbeResult = options.acceptAnyProbeResult === true;
  const pollIntervalMs = Math.max(
    100,
    Math.min(options.pollIntervalMs ?? 300, timeoutMs),
  );
  const startedAt = Date.now();
  let lastState = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastState = await probeChatGptStartupReady(tabId);
      if (lastState && (acceptAnyProbeResult || lastState.ready)) {
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
  const responseIdleTimeoutMs = options.responseIdleTimeoutMs ?? 600000;
  const responseFirstTokenTimeoutMs = options.responseFirstTokenTimeoutMs ?? 600000;
  const composerWaitTimeoutMs = 45000;
  const responseTimeoutMs = options.responseTimeoutMs ?? 1200000;
  const composeReadyTimeoutMs = options.composeReadyTimeoutMs ?? 15000;
  const sendReadyTimeoutMs = options.sendReadyTimeoutMs ?? 12000;
  const preSubmitDelayMinMs = options.preSubmitDelayMinMs ?? 400;
  const preSubmitDelayMaxMs = options.preSubmitDelayMaxMs ?? 800;
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
  // ChatGPT renders a Regenerate button when a message fails (e.g. "Conversation not found").
  const ERROR_STATE_SELECTORS = [
    'button[data-testid="regenerate-response-button"]',
    'button[data-testid*="regenerate"]',
    'button[aria-label*="Regenerate"]',
    'button[aria-label*="Retry"]',
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
  const timingMarks = {
    startedAt: Date.now(),
    composerFoundAt: null,
    composerInteractiveAt: null,
    fillStartedAt: null,
    fillCompletedAt: null,
    sendReadyAt: null,
    preSubmitDelayMs: null,
    submitStartedAt: null,
    firstAssistantTurnAt: null,
    responseCompletedAt: null,
  };

  function markTiming(name) {
    if (!(name in timingMarks) || timingMarks[name] !== null) return;
    timingMarks[name] = Date.now();
  }

  function buildTimingSummary() {
    const origin = timingMarks.startedAt;
    const offset = (value) =>
      typeof value === 'number' ? Math.max(0, value - origin) : null;
    return {
      composerFoundMs: offset(timingMarks.composerFoundAt),
      composerInteractiveMs: offset(timingMarks.composerInteractiveAt),
      fillStartedMs: offset(timingMarks.fillStartedAt),
      fillCompletedMs: offset(timingMarks.fillCompletedAt),
      sendReadyMs: offset(timingMarks.sendReadyAt),
      preSubmitDelayMs:
        typeof timingMarks.preSubmitDelayMs === 'number'
          ? timingMarks.preSubmitDelayMs
          : null,
      submitStartedMs: offset(timingMarks.submitStartedAt),
      firstAssistantTurnMs: offset(timingMarks.firstAssistantTurnAt),
      responseCompletedMs: offset(timingMarks.responseCompletedAt),
    };
  }

  // Visibility instrumentation — a hidden popup (minimized or fully occluded)
  // is throttled by Chrome: timers fire at most ~once/second and rendering
  // freezes, so the MutationObserver and idle poll below can miss streaming
  // updates and declare a false timeout. Tracking visibility lets us tell a
  // genuine ChatGPT stall apart from "the user hid the window."
  const visibilityMarks = {
    initialState:
      typeof document !== 'undefined' ? document.visibilityState : 'visible',
    hiddenCount: 0,
    accumulatedHiddenMs: 0,
    hiddenSinceTs: null,
    currentlyHidden: false,
    lastBecameHiddenMs: null,
    lastBecameVisibleMs: null,
  };
  if (visibilityMarks.initialState === 'hidden') {
    visibilityMarks.currentlyHidden = true;
    visibilityMarks.hiddenSinceTs = timingMarks.startedAt;
  }

  function handleVisibilityChange() {
    const now = Date.now();
    if (document.visibilityState === 'hidden') {
      visibilityMarks.hiddenCount += 1;
      visibilityMarks.currentlyHidden = true;
      visibilityMarks.hiddenSinceTs = now;
      visibilityMarks.lastBecameHiddenMs = Math.max(0, now - timingMarks.startedAt);
    } else {
      if (visibilityMarks.hiddenSinceTs != null) {
        visibilityMarks.accumulatedHiddenMs += now - visibilityMarks.hiddenSinceTs;
        visibilityMarks.hiddenSinceTs = null;
      }
      visibilityMarks.currentlyHidden = false;
      visibilityMarks.lastBecameVisibleMs = Math.max(0, now - timingMarks.startedAt);
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  function buildVisibilitySummary() {
    let totalHiddenMs = visibilityMarks.accumulatedHiddenMs;
    if (visibilityMarks.currentlyHidden && visibilityMarks.hiddenSinceTs != null) {
      totalHiddenMs += Date.now() - visibilityMarks.hiddenSinceTs;
    }
    const elapsedMs = Math.max(1, Date.now() - timingMarks.startedAt);
    return {
      initialState: visibilityMarks.initialState,
      everHidden:
        visibilityMarks.hiddenCount > 0 ||
        visibilityMarks.initialState === 'hidden',
      hiddenCount: visibilityMarks.hiddenCount,
      totalHiddenMs,
      hiddenFraction: Math.min(1, Math.round((totalHiddenMs / elapsedMs) * 100) / 100),
      hiddenAtEnd: visibilityMarks.currentlyHidden,
      lastBecameHiddenMs: visibilityMarks.lastBecameHiddenMs,
      lastBecameVisibleMs: visibilityMarks.lastBecameVisibleMs,
    };
  }

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

  function isElementVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    // checkVisibility (Chrome 105+) honours display:none, visibility:hidden,
    // content-visibility and opacity. Fall back to layout boxes if unavailable.
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    return el.getClientRects().length > 0;
  }

  function findStopButton() {
    for (const selector of STOP_BUTTON_SELECTORS) {
      const node = document.querySelector(selector);
      if (node instanceof HTMLElement && isElementVisible(node)) {
        return node;
      }
    }
    const buttons = Array.from(document.querySelectorAll('button')).filter((node) => node instanceof HTMLButtonElement);
    return (
      buttons.find((button) => {
        const aria = (button.getAttribute('aria-label') ?? '').toLowerCase();
        const testId = (button.getAttribute('data-testid') ?? '').toLowerCase();
        // Match on aria-label / data-testid only — the real stop control always
        // carries one (aria "Stop answering", testId "stop-button"). The
        // textContent scan was dropped: ChatGPT's reasoning models render a
        // "Stopped thinking" collapse toggle whose text contains "stop", which
        // was falsely read as "still generating". Exclude the past-tense
        // "stopped" so a reasoning toggle labelled via aria can't match either.
        const matchesStop =
          (aria.includes('stop') && !aria.includes('stopped')) || testId.includes('stop');
        // Require the control to be actually visible. ChatGPT leaves a hidden
        // stop button in the DOM after generation finishes; counting it kept the
        // watcher "still generating" forever and the run never settled.
        return matchesStop && isElementVisible(button);
      }) ?? null
    );
  }

  function hasStopButton() {
    return findStopButton() !== null;
  }

  function hasErrorState() {
    return ERROR_STATE_SELECTORS.some((selector) => document.querySelector(selector));
  }

  function scrapeAssistantTextLenient() {
    // Gate-free last resort: the single longest assistant-looking text block.
    // Used to resolve and to rescue on timeout so a finished answer is never
    // lost just because the structural selectors drifted.
    const seen = new Set();
    let best = '';
    for (const selector of ASSISTANT_TEXT_SELECTORS) {
      for (const node of document.querySelectorAll(selector)) {
        if (seen.has(node)) continue;
        seen.add(node);
        const text = node.textContent?.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim() ?? '';
        if (text.length > best.length) best = text;
      }
    }
    return best;
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
    // The gate-free lenient scrape is intentionally NOT called here — this runs
    // on every (throttled) mutation and must stay cheap. Stale-selector recovery
    // lives in the settle and timeout-rescue branches, which call
    // scrapeAssistantTextLenient only once.
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
    if (existing) {
      markTiming('composerFoundAt');
      return existing;
    }
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
        markTiming('composerFoundAt');
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
    return getAssistantSnapshot();
  }

  async function waitForComposerReady(composer, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
      const sendButton = findSendButton(form);
      if (isComposerInteractive(composer)) {
        markTiming('composerInteractiveAt');
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
    markTiming('fillStartedAt');
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
      markTiming('fillCompletedAt');
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
    markTiming('fillCompletedAt');
  }

  async function waitForSendReady(composer, timeoutMs = sendReadyTimeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
      const sendButton = findSendButton(form);
      const composerText = composer instanceof HTMLTextAreaElement ? composer.value.trim() : composer.textContent?.trim() ?? '';
      if (sendButton && !sendButton.disabled) {
        markTiming('sendReadyAt');
        return {
          ready: true,
          mode: 'button',
          composerTextLength: composerText.length,
          sendButtonState: getButtonState(sendButton),
          ...getFormDebug(form),
        };
      }
      if (!sendButton && composerText.length > 0) {
        markTiming('sendReadyAt');
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

  function getRandomPreSubmitDelayMs() {
    const minMs = Math.max(0, Number.isFinite(preSubmitDelayMinMs) ? preSubmitDelayMinMs : 400);
    const maxMs = Math.max(minMs, Number.isFinite(preSubmitDelayMaxMs) ? preSubmitDelayMaxMs : 800);
    return minMs + Math.round(Math.random() * (maxMs - minMs));
  }

  async function waitForPreSubmitDelay() {
    const delayMs = getRandomPreSubmitDelayMs();
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    timingMarks.preSubmitDelayMs = delayMs;
    return delayMs;
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
    // Yield one frame so the composer DOM settles before checking send
    // readiness. requestAnimationFrame is FROZEN while the popup is hidden or
    // occluded (Chrome pauses rendering on background tabs), which would hang
    // the entire run until the user manually focuses the window. Race it
    // against a timer that still fires in the background so the run proceeds
    // unattended: rAF wins (~16ms) when visible, the timer wins when hidden.
    await new Promise((resolve) => {
      let settled = false;
      const proceed = () => {
        if (settled) return;
        settled = true;
        resolve(undefined);
      };
      window.requestAnimationFrame(proceed);
      window.setTimeout(proceed, 100);
    });
    const readiness = await waitForSendReady(composer);
    if (!readiness.ready) {
      const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
      const baselineSnapshot = getSubmissionSnapshot(composer, form);
      throw new Error(
        `dom_changed:Prompt submission control never became ready after filling the ChatGPT composer.|submit_debug=${JSON.stringify({
          ...readiness,
          baselineSnapshot,
        })}`
      );
    }

    const preSubmitDelayMs = await waitForPreSubmitDelay();
    const submitReadiness = await waitForSendReady(composer, 1000);
    const form = composer instanceof HTMLTextAreaElement ? composer.form : composer.closest('form');
    const sendButton = findSendButton(form);
    const baselineSnapshot = getSubmissionSnapshot(composer, form);
    if (!submitReadiness.ready) {
      throw new Error(
        `dom_changed:Prompt submission control stopped being ready during the pre-submit wait.|submit_debug=${JSON.stringify({
          ...submitReadiness,
          preSubmitDelayMs,
          baselineSnapshot,
        })}`
      );
    }

    const attemptLog = [];

    const trySubmitAttempt = async (label, runner) => {
      markTiming('submitStartedAt');
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
        submitMode: submitReadiness.mode,
        preSubmitDelayMs,
        baselineSnapshot,
        attempts: attemptLog,
      })}`
    );
  }

  async function waitForAssistantResponse(previousAssistant, timeoutMs) {
    const existingSnapshot = getAssistantSnapshot();
    // Require non-empty text: a new assistant turn container can exist in the
    // DOM before its text has rendered, which would otherwise return empty.
    if (
      hasNewAssistantTurn(previousAssistant, existingSnapshot) &&
      !hasStopButton() &&
      existingSnapshot.latestText.trim()
    ) {
      return existingSnapshot.latestText;
    }

    return new Promise((resolve, reject) => {
      let stableTimer = null;
      let sawNewTurn = hasNewAssistantTurn(previousAssistant, existingSnapshot);
      let sawStopButton = hasStopButton();
      let lastProgressAt = Date.now();
      let lastSnapshot = existingSnapshot;
      // When generation reportedly finished (Stop button gone) but no text is on
      // the page, this marks when that empty-but-done state began, so we can
      // fail fast after a short grace window instead of the full timeout.
      let emptyFinishSince = null;

      let finished = false;

      // Expose live watcher state for the background progress poll.
      window.__rmWatcherState = {
        sawStopButton,
        sawNewTurn,
        hasStop: hasStopButton(),
        hasError: hasErrorState(),
        textLen: existingSnapshot.latestText.length,
        stableTimerActive: false,
        stopBtn: null,
      };
      // On-demand best-effort extraction for the background poll. When the popup
      // is hidden the browser suspends this watcher's timers, so the in-page
      // settle never fires; the SW poll then detects completion (Stop button
      // gone + stable text) and calls this to pull the finished answer without
      // waiting for the (starved) settle. Reuses the same scraping as the
      // in-page path so the text is identical.
      window.__rmScrapeAssistant = () => {
        const snapshot = getAssistantSnapshot().latestText.trim();
        return snapshot || scrapeAssistantTextLenient().trim();
      };
      let scheduleId = null;

      const cleanup = () => {
        finished = true;
        observer.disconnect();
        window.clearTimeout(hardTimeoutId);
        window.clearInterval(idlePollId);
        if (stableTimer !== null) window.clearTimeout(stableTimer);
        if (scheduleId !== null) window.clearTimeout(scheduleId);
      };

      // Coalesce mutation bursts: ChatGPT mutates the DOM per streamed token, so
      // running the O(response-size) snapshot synchronously on every mutation
      // freezes the popup. Run it at most once per ~200ms; the 1s idle poll is
      // the backstop.
      const scheduleResolve = () => {
        if (finished || scheduleId !== null) return;
        scheduleId = window.setTimeout(() => {
          scheduleId = null;
          if (!finished) maybeResolve();
        }, 200);
      };

      const failForTimeout = () => {
        // Rescue: hand back whatever text is on the page (gate-free) so a
        // finished answer can still be salvaged by canUsePartialJson.
        const snapshotText = getAssistantSnapshot().latestText.trim();
        const partialText = snapshotText || scrapeAssistantTextLenient().trim();
        cleanup();
        reject(new Error(partialText ? `dom_changed:Timed out waiting for the ChatGPT response.|partial=${partialText}` : 'dom_changed:Timed out waiting for the ChatGPT response.'));
      };

      const maybeResolve = () => {
        const latestSnapshot = getAssistantSnapshot();
        const isNewTurn = hasNewAssistantTurn(previousAssistant, latestSnapshot);
        const stopPresent = hasStopButton();
        if (window.__rmWatcherState) {
          const stopBtn = findStopButton();
          window.__rmWatcherState.sawStopButton = sawStopButton;
          window.__rmWatcherState.sawNewTurn = sawNewTurn;
          window.__rmWatcherState.hasStop = stopPresent;
          window.__rmWatcherState.hasError = hasErrorState();
          window.__rmWatcherState.textLen = latestSnapshot.latestText.length;
          window.__rmWatcherState.stableTimerActive = stableTimer !== null;
          window.__rmWatcherState.stopBtn = stopBtn
            ? {
                aria: stopBtn.getAttribute('aria-label'),
                testId: stopBtn.getAttribute('data-testid'),
                text: (stopBtn.textContent ?? '').trim().slice(0, 20),
              }
            : null;
        }
        if (stopPresent) {
          sawStopButton = true;
        }
        // Primary completion signal: the Send button became Stop while
        // generating and has now reverted (Stop gone) -> generation finished,
        // independent of the message-text DOM.
        const finishedByButton = sawStopButton && !stopPresent;

        const changed =
          latestSnapshot.count !== lastSnapshot.count ||
          latestSnapshot.latestKey !== lastSnapshot.latestKey ||
          latestSnapshot.latestText !== lastSnapshot.latestText;

        if (changed && isNewTurn) {
          sawNewTurn = true;
          lastProgressAt = Date.now();
          markTiming('firstAssistantTurnAt');
        }

        lastSnapshot = latestSnapshot;

        const hasResponseText = latestSnapshot.latestText.trim().length > 0;

        // Fast-fail empty completion: the model reportedly finished (Stop button
        // appeared then went away) but produced no text. Allow a short grace
        // window for late rendering, then fail fast (retriable) instead of
        // waiting out the full first-token/idle timeout. Confirm with a gate-free
        // scrape so we don't bail when only the structured selectors missed it.
        if (finishedByButton && !hasResponseText && !scrapeAssistantTextLenient().trim()) {
          if (emptyFinishSince === null) {
            emptyFinishSince = Date.now();
          } else if (Date.now() - emptyFinishSince >= 6000) {
            cleanup();
            reject(new Error('dom_changed:ChatGPT returned an empty assistant response after prompt submission.'));
            return;
          }
        } else {
          emptyFinishSince = null;
        }

        // Backstop: if response text is non-empty and hasn't grown for a quiet
        // period, treat generation as finished so a leftover DOM node can't hang
        // the watcher for the full timeout. Critically, require the Stop button
        // to be GONE: a real, visible Stop button means ChatGPT is still
        // generating — or, when the popup is hidden/occluded, its rendering is
        // FROZEN mid-stream (quiet text is the freeze, not completion). Settling
        // there captures truncated output and fires a premature repair that
        // pastes into a still-busy composer. Wait for the Stop button to clear.
        const quietForSettle =
          sawNewTurn &&
          hasResponseText &&
          !stopPresent &&
          Date.now() - lastProgressAt >= 12000;

        // Settle when the button transition says finished, or a new turn was seen
        // with the Stop button gone, or the text has gone quiet (backstop).
        const readyToSettle =
          finishedByButton || (isNewTurn && !stopPresent) || quietForSettle;
        if (!readyToSettle) {
          // Don't cancel a running settle timer if we already have response text.
          // ChatGPT's "Conversation not found" React-Query loop re-renders the
          // page repeatedly, briefly reflashing the Stop button even after
          // generation is done — which would otherwise cancel and restart the
          // settle timer for minutes. If latestText is non-empty the response is
          // captured; let the timer run through the transient flicker.
          if (stableTimer !== null && !hasResponseText) {
            window.clearTimeout(stableTimer);
            stableTimer = null;
          }
          return;
        }

        if (stableTimer !== null) {
          window.clearTimeout(stableTimer);
        }

        stableTimer = window.setTimeout(() => {
          // Re-read at fire time: 900ms may have rendered more (or the first)
          // text since the timer was scheduled.
          const freshSnapshot = getAssistantSnapshot();
          const resolvedText = freshSnapshot.latestText.trim()
            ? freshSnapshot.latestText
            : scrapeAssistantTextLenient();
          if (!resolvedText.trim()) {
            // The settle signal fired (e.g. the Stop button flashed and vanished
            // during page setup) but no assistant text is on the page yet. Don't
            // resolve empty — re-arm and keep waiting for real text or the
            // timeout (which is retriable) instead of failing the run.
            stableTimer = null;
            return;
          }
          cleanup();
          markTiming('responseCompletedAt');
          resolve(resolvedText);
        }, 900);
      };

      const waitStartedAt = Date.now();
      const hardTimeoutId = window.setTimeout(() => failForTimeout(), timeoutMs);
      const idlePollId = window.setInterval(() => {
        maybeResolve();
        // Fast-fail when ChatGPT shows an error state (Regenerate button) and
        // no response text has been captured yet. The "Conversation not found"
        // React-Query loop can start mid-generation, causing constant DOM
        // re-renders that flicker the Stop button — so we guard on sawNewTurn
        // (response text appeared) rather than sawStopButton (Stop was seen).
        if (!sawNewTurn && Date.now() - waitStartedAt >= 3000 && hasErrorState()) {
          cleanup();
          reject(new Error('dom_changed:ChatGPT failed to respond (error state detected — possibly "Conversation not found"). The run will retry.'));
          return;
        }
        // A visible Stop button means the model is actively working — including a
        // reasoning model that stays SILENT for minutes while "thinking" before
        // it streams any text. Count that as live progress so a thinking run is
        // never cut off and re-fired mid-thought. Only the hard overall cap
        // (responseTimeoutMs / hardTimeoutId) can end a run while it's still
        // generating. A genuine error is caught by the hasErrorState() fast-fail
        // above, so a flickering Stop button during an error loop can't wedge us.
        if (hasStopButton()) {
          lastProgressAt = Date.now();
        }
        const timeoutWindow = sawNewTurn ? responseIdleTimeoutMs : Math.min(responseFirstTokenTimeoutMs, timeoutMs);
        if (Date.now() - lastProgressAt >= timeoutWindow) {
          failForTimeout();
        }
      }, 1000);

      const observer = new MutationObserver(scheduleResolve);
      // Watch text/structure only. attributes:true fires on every cursor blink,
      // hover, and spinner change in ChatGPT's UI — pure overhead for response
      // detection — so it is intentionally omitted.
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
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
          timings: buildTimingSummary(),
          visibility: buildVisibilitySummary(),
        };
      }
      return {
        status: 'success',
        rawText,
        conversationUrl: currentConversationUrl(),
        timings: buildTimingSummary(),
        visibility: buildVisibilitySummary(),
      };
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'dom_changed:Unknown ChatGPT automation error.';
      if (message === 'auth_required') {
        return {
          status: 'auth_required',
          message: 'Please log into ChatGPT in a normal browser tab first.',
          conversationUrl: currentConversationUrl(),
          timings: buildTimingSummary(),
          visibility: buildVisibilitySummary(),
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
        timings: buildTimingSummary(),
        visibility: buildVisibilitySummary(),
      };
    })
    .finally(() => {
      try {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      } catch {
        // Best-effort — the listener dies with the page context anyway.
      }
    });
}

// Runs in the page's MAIN world: makes the popup always report itself as
// visible/focused so ChatGPT does not pause streaming/rendering when the window
// is backgrounded (another app focused, or covered by the main window). Without
// this the run stalls until the user clicks back to the popup.
function injectedVisibilityKeepAlive() {
  if (window.__rmVisibilityKeepAlive) return;
  window.__rmVisibilityKeepAlive = true;
  try {
    // Capture the REAL visibility getter before we spoof it, so the
    // requestAnimationFrame shim below only activates when the window is
    // genuinely hidden (and native rAF is otherwise untouched when visible).
    let readRealHidden = () => false;
    try {
      const desc =
        Object.getOwnPropertyDescriptor(Document.prototype, 'hidden') ||
        Object.getOwnPropertyDescriptor(document, 'hidden');
      if (desc && typeof desc.get === 'function') {
        readRealHidden = () => {
          try {
            return desc.get.call(document) === true;
          } catch {
            return false;
          }
        };
      }
    } catch {}

    const force = (obj, prop, value) => {
      try {
        Object.defineProperty(obj, prop, { configurable: true, get: () => value });
      } catch {}
    };
    force(document, 'hidden', false);
    force(document, 'visibilityState', 'visible');
    force(document, 'webkitHidden', false);
    force(document, 'webkitVisibilityState', 'visible');
    try {
      document.hasFocus = () => true;
    } catch {}
    // Swallow the page-level visibility events so the site's own pause handlers
    // never fire. Scoped to visibilitychange only — not blur/focus — to avoid
    // interfering with the composer's input handling.
    const swallow = (event) => event.stopImmediatePropagation();
    for (const name of ['visibilitychange', 'webkitvisibilitychange']) {
      document.addEventListener(name, swallow, true);
      window.addEventListener(name, swallow, true);
    }

    // Chrome suspends requestAnimationFrame for backgrounded/occluded windows,
    // which freezes ChatGPT's streamed-token rendering mid-response and leaves us
    // capturing truncated JSON. Spoofing document.hidden is NOT enough — rAF
    // suspension is engine-level. Drive rAF from a MessageChannel loop (the one
    // scheduler Chrome does not throttle in background tabs), paced to ~60fps,
    // but only while the window is genuinely hidden; when visible we defer to
    // native rAF so foreground timing and CPU are unchanged.
    try {
      const nativeRaf =
        typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame.bind(window)
          : null;
      const nativeCancel =
        typeof window.cancelAnimationFrame === 'function'
          ? window.cancelAnimationFrame.bind(window)
          : () => {};
      if (nativeRaf && typeof MessageChannel === 'function') {
        const channel = new MessageChannel();
        const pending = new Map();
        // Offset ids far above native rAF's small counter to avoid collisions.
        let nextId = 1000000000;
        let scheduled = false;
        let lastFrameAt = 0;
        const now = () =>
          typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now();
        const post = () => {
          if (scheduled) return;
          scheduled = true;
          channel.port2.postMessage(0);
        };
        channel.port1.onmessage = () => {
          scheduled = false;
          if (pending.size === 0) return;
          const ts = now();
          // Pace to ~60fps; if a frame isn't due yet, re-post instead of firing.
          if (ts - lastFrameAt < 16) {
            post();
            return;
          }
          lastFrameAt = ts;
          const due = Array.from(pending.values());
          pending.clear();
          for (const cb of due) {
            try {
              cb(ts);
            } catch {}
          }
        };
        window.requestAnimationFrame = (cb) => {
          if (!readRealHidden()) {
            return nativeRaf(cb);
          }
          const id = nextId++;
          pending.set(id, cb);
          post();
          return id;
        };
        window.cancelAnimationFrame = (id) => {
          if (pending.delete(id)) return;
          try {
            nativeCancel(id);
          } catch {}
        };
      }
    } catch {}
  } catch {}
}

async function installVisibilityKeepAlive(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: injectedVisibilityKeepAlive,
    });
  } catch {
    // Best-effort — never block the run if the keep-alive can't be installed.
  }
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
  // Clear stale Cloudflare and expired cookies before opening the popup.
  // This prevents HTTP 431 (Request Header Fields Too Large) caused by
  // accumulated cookies bloating the Cookie header on fresh popup requests.
  await pruneChatGptCookies();
  let popupWindowId;
  try {
    popupWindowId = await openPopupWindow(targetUrl);
  } catch (error) {
    // Explicit failure log so "clicked Tailor but no popup opened" is pinpointed
    // in a saved log instead of surfacing only as a generic downstream error.
    logError('ChatGptAutomation', 'Failed to open ChatGPT popup window.', {
      promptLabel,
      targetUrl,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  logInfo('ChatGptAutomation', 'ChatGPT popup created.', { promptLabel, popupWindowId });
  // Persist immediately so a service-worker crash doesn't leave this window orphaned.
  void persistPopupWindowId(popupWindowId);
  const unregisterCleanup = runId
    ? registerRunCleanup(runId, async () => {
        await closeWindow(popupWindowId);
      })
    : () => {};
  try {
    logInfo('ChatGptAutomation', 'Waiting for ChatGPT tab to become reachable.', { promptLabel, popupWindowId });
    const tabId = await waitForChatGptTab(popupWindowId);
    logInfo('ChatGptAutomation', 'ChatGPT tab reachable.', { promptLabel, popupWindowId, tabId });
    await installVisibilityKeepAlive(tabId);
    if (warmupDelayMs > 0) {
      logInfo('ChatGptAutomation', 'Probing ChatGPT startup readiness.', {
        promptLabel,
        tabId,
        warmupDelayMs,
      });
      const readiness = await waitForChatGptStartupReady(tabId, warmupDelayMs, {
        acceptAnyProbeResult: true,
        pollIntervalMs: 300,
      });
      if (readiness.state?.ready) {
        logInfo('ChatGptAutomation', 'ChatGPT startup ready.', {
          promptLabel,
          tabId,
          elapsedMs: readiness.elapsedMs,
          readiness: buildStartupReadinessLog(readiness.state),
        });
      } else if (readiness.state) {
        logInfo('ChatGptAutomation', 'ChatGPT page probe succeeded before full startup readiness.', {
          promptLabel,
          tabId,
          elapsedMs: readiness.elapsedMs,
          readiness: buildStartupReadinessLog(readiness.state),
        });
      } else {
        logInfo(
          'ChatGptAutomation',
          'ChatGPT startup probe expired; continuing to prompt runner.',
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
  session.pendingResetPromise = null;
  chatGptRunSessions.set(normalizedRunId, session);
  return session;
}

async function performChatGptRunSessionReset(normalizedRunId, session, options = {}) {
  const warmupDelayMs = options.warmupDelayMs ?? 1500;
  const promptLabel = options.promptLabel ?? session.promptLabel ?? 'Prompt';

  logInfo('ChatGptAutomation', 'Refreshing reusable ChatGPT popup for the next prompt.', {
    promptLabel,
    runId: normalizedRunId,
    tabId: session.tabId,
    warmupDelayMs,
  });

  // Prune rotating Cloudflare + expired cookies to keep the request header under
  // the 431 limit across a long run. (cf_clearance is preserved.)
  await pruneChatGptCookies();

  // Refresh the SAME popup — exactly like hitting the browser's refresh button —
  // instead of navigating to a brand-new URL. A ChatGPT temporary chat resets on
  // reload, so this yields a fresh empty chat for the next prompt, and a same-URL
  // refresh is markedly faster than a fresh cross-page navigation (warm
  // connection, cached assets, Cloudflare clearance intact). This restores the
  // faster pre-0.3.x prompt-to-prompt cadence.
  const reloadDone = waitForTopFrameLoad(session.tabId);
  await chrome.tabs.reload(session.tabId, { bypassCache: false });
  await reloadDone; // wait for the refresh to actually finish before injecting
  await waitForChatGptTabById(session.tabId);
  // The reload dropped the MAIN-world override; re-install it.
  await installVisibilityKeepAlive(session.tabId);
  if (warmupDelayMs > 0) {
    const readiness = await waitForChatGptStartupReady(session.tabId, warmupDelayMs, {
      acceptAnyProbeResult: true,
      pollIntervalMs: 300,
    });
    logInfo(
      'ChatGptAutomation',
      readiness.state?.ready
        ? 'ChatGPT startup ready after refresh.'
        : readiness.state
          ? 'ChatGPT page probe succeeded after refresh before full startup readiness.'
          : 'ChatGPT startup probe expired after refresh; continuing to prompt runner.',
      {
        promptLabel,
        runId: normalizedRunId,
        tabId: session.tabId,
        elapsedMs: readiness.elapsedMs,
        readiness: buildStartupReadinessLog(readiness.state),
      },
    );
  }

  session.needsReset = false;
  return session;
}

// Recover an unreachable popup the way a human does: wait a moment, then hit
// refresh on the SAME page (chrome.tabs.reload) — NOT re-navigate to a new URL.
// Used when the popup shows an error page (Cloudflare block / 4xx / network),
// regardless of the specific error. Returns true if the tab was reloaded and is
// reachable again, false if the tab is gone (caller falls back to reopening).
async function reloadChatGptRunSessionTab(session, options = {}) {
  const promptLabel = options.promptLabel ?? session.promptLabel ?? 'Prompt';
  // Random 1–2s pause before refreshing, so a transient block can clear and the
  // retry doesn't look like an instant bot re-hit.
  await wait(1000 + Math.floor(Math.random() * 1000));
  // A persistent HTTP 431 ("Request Header Fields Too Large") is a bloated
  // Cookie header — reloading re-sends the same oversized cookies, so the
  // browser's own refresh, hard-refresh, and URL changes all stay stuck on the
  // error page. The only cure is shrinking the header.
  //
  // IMPORTANT: this background-worker probe carries FAR fewer headers than the
  // real popup request (no sec-ch-*, referer, or full browser fingerprint), so
  // it routinely reports 200 while the POPUP itself is stuck on 431. We cannot
  // trust the probe to detect the 431, so on ANY error page recovery we clear
  // every non-login cookie to shrink the header. This path only runs when the
  // popup is genuinely showing an error page, so aggressive pruning is safe
  // (a one-time Cloudflare re-check may follow, but it beats a hard 431 loop).
  const httpStatus = await probeChatGptHttpStatus();
  // Diagnostic: capture what the Cookie header looks like BEFORE we clear it, so
  // a recurring 431 log shows exactly which cookie(s) bloated it.
  const cookieSummary = await summarizeChatGptCookies();
  logWarn(
    'ChatGptAutomation',
    'chatgpt.com cookie header before error-page recovery prune (pinpoints 431 bloat).',
    { promptLabel, tabId: session.tabId, ...cookieSummary },
  );
  await pruneChatGptCookies({ aggressive: true });
  try {
    // Plain reload of the current page — same as the browser's refresh button.
    const reloadDone = waitForTopFrameLoad(session.tabId);
    await chrome.tabs.reload(session.tabId, { bypassCache: false });
    await reloadDone; // wait for the refresh to finish before injecting
  } catch {
    return false; // tab/window gone — let the caller reopen instead
  }
  try {
    await waitForChatGptTabById(session.tabId);
  } catch {
    return false;
  }
  // The reload dropped the MAIN-world override; re-install it before running.
  await installVisibilityKeepAlive(session.tabId);
  // After an aggressive cookie prune, the reload may briefly show a Cloudflare
  // re-check before the real composer appears. Wait for ACTUAL readiness (not
  // just any probe result) with a generous timeout so we don't re-inject the
  // prompt into a mid-load / challenge page and misdetect it as an error page
  // again. Returns as soon as the composer is ready (fast for a healthy page).
  const readiness = await waitForChatGptStartupReady(session.tabId, 12000, {
    acceptAnyProbeResult: false,
    pollIntervalMs: 500,
  });
  logInfo('ChatGptAutomation', 'Reloaded (refreshed) the ChatGPT popup after an error page.', {
    promptLabel,
    tabId: session.tabId,
    httpStatus,
    cookiesPurged: 'aggressive',
    probedHttpStatus: httpStatus,
    elapsedMs: readiness.elapsedMs,
    readiness: buildStartupReadinessLog(readiness.state),
  });
  // Same URL, same session — just refreshed. No reset needed.
  session.needsReset = false;
  return true;
}

export async function resetChatGptRunSession(runId, options = {}) {
  const normalizedRunId =
    typeof runId === 'string' && runId.trim() ? runId.trim() : '';
  if (!normalizedRunId) {
    throw new Error('A run id is required to reset a ChatGPT popup session.');
  }

  const session = await getOrOpenChatGptRunSession(normalizedRunId, options);
  if (session.pendingResetPromise) {
    return session.pendingResetPromise;
  }

  const resetPromise = performChatGptRunSessionReset(
    normalizedRunId,
    session,
    options,
  ).finally(() => {
    if (session.pendingResetPromise === resetPromise) {
      session.pendingResetPromise = null;
    }
  });
  session.pendingResetPromise = resetPromise;
  resetPromise.catch(() => {});
  return resetPromise;
}

export async function prepareChatGptRunSessionForNextStage(runId, options = {}) {
  const normalizedRunId =
    typeof runId === 'string' && runId.trim() ? runId.trim() : '';
  if (!normalizedRunId) {
    throw new Error('A run id is required to prepare a ChatGPT popup session.');
  }

  const session = chatGptRunSessions.get(normalizedRunId);
  if (!session) {
    return null;
  }
  if (session.pendingResetPromise) {
    return session.pendingResetPromise;
  }
  if (!session.needsReset) {
    return session;
  }
  return resetChatGptRunSession(normalizedRunId, options);
}

async function executeChatGptPromptInSession(session, prompt, options = {}) {
  const promptLabel = options.promptLabel ?? session.promptLabel ?? 'Prompt';
  const promptLength = prompt.length;
  const composeReadyTimeoutMs = options.composeReadyTimeoutMs ?? Math.min(30000, Math.max(15000, Math.ceil(promptLength / 3)));
  const sendReadyTimeoutMs = options.sendReadyTimeoutMs ?? Math.min(30000, Math.max(12000, Math.ceil(promptLength / 3)));
  const responseTimeoutMs = options.responseTimeoutMs ?? 1200000;
  const responseIdleTimeoutMs = options.responseIdleTimeoutMs ?? 600000;
  const responseFirstTokenTimeoutMs = options.responseFirstTokenTimeoutMs ?? 600000;
  const pollIntervalMs = options.pollIntervalMs ?? 4000;

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
    // Stall detection: if the popup gets minimized or fully covered (e.g. a
    // maximized/fullscreen window on macOS), the browser freezes its rendering
    // and streaming halts. This poll runs in the background worker, so it keeps
    // observing even while the popup renderer is frozen — nudge the LinkedIn tab
    // so the user can bring the popup back.
    let lastTextLen = -1;
    let lastGrowthAt = Date.now();
    let stallHintSent = false;
    const notifyPopupStall = (stalled, extra = {}) => {
      const sourceTabId = getActiveRun()?.sourceTabId;
      if (typeof sourceTabId !== 'number') return;
      chrome.tabs
        .sendMessage(sourceTabId, {
          type: stalled ? 'CHATGPT_POPUP_STALLED' : 'CHATGPT_POPUP_RESUMED',
          payload: { promptLabel, ...extra },
        })
        .catch(() => {});
    };
    // Background-poll completion backstop: when the popup is hidden the in-page
    // watcher's settle timers are suspended by the browser, so a FINISHED
    // response can sit unread until a timeout (then get needlessly retried). This
    // SW poll isn't visibility-throttled, so when it sees generation finished
    // (Stop button was present, now gone) with stable non-empty text, it scrapes
    // the answer directly and resolves — racing (and usually pre-empting) the
    // starved in-page settle only when the popup is hidden.
    let sawGenerating = false;
    let completeStableCount = 0;
    let pollCompletionDone = false;
    let resolvePollCompletion;
    const pollCompletionPromise = new Promise((resolve) => {
      resolvePollCompletion = resolve;
    });
    // Fire-gate: space this fire from other concurrent web-automation jobs so
    // multiple popups never hit Cloudflare in the same instant. Zero added
    // latency when serial (min-interval throttle). Then re-check cancellation —
    // never fire into a run we're already canceling (hazard #5).
    const fireRunId = options.runId ?? null;
    await acquireWebFireSlot({
      runId: fireRunId,
      tabId: session.tabId,
      promptLabel,
      provider: 'chatgpt',
    });
    if (fireRunId) throwIfRunCanceled(fireRunId, promptLabel);
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
      // Cheap live read of popup visibility + watcher state for stall diagnosis.
      let visibilityState = null;
      let watcherState = null;
      try {
        const [{ result: probe } = {}] =
          (await chrome.scripting.executeScript({
            target: { tabId: session.tabId },
            func: () => ({
              visibilityState: document.visibilityState,
              watcher: window.__rmWatcherState ?? null,
            }),
          })) ?? [];
        visibilityState = probe?.visibilityState ?? null;
        watcherState = probe?.watcher ?? null;
      } catch {
        // ignore — popup may be mid-navigation or closing
      }
      // Freeze/hidden-popup detection.
      try {
        const textLen =
          typeof watcherState?.textLen === 'number' ? watcherState.textLen : null;
        if (textLen !== null && textLen !== lastTextLen) {
          lastTextLen = textLen;
          lastGrowthAt = Date.now();
          if (stallHintSent) {
            stallHintSent = false;
            notifyPopupStall(false);
          }
        }
        let minimized = false;
        try {
          const win = await chrome.windows.get(session.popupWindowId);
          minimized = win?.state === 'minimized';
        } catch {
          // window may be gone/closing — leave to the main flow
        }
        // Minimized is definitive. Otherwise only flag a MID-STREAM stall (text
        // already started, then stopped growing while still generating) — a
        // longer window than a normal reasoning pause, which happens before text
        // appears — to avoid false alarms.
        // The background poll keeps reading the popup's live DOM even while the
        // window is occluded/backgrounded (the service worker isn't frozen), so
        // if the popup is genuinely still generating, textLen keeps growing and
        // lastGrowthAt stays fresh — no stall. Only flag a MID-STREAM stall after
        // a long gap (text started, then stopped growing for 45s while the Stop
        // button is still shown), so switching apps or a normal reasoning pause
        // doesn't trip a false "bring to front" alert.
        const generating = watcherState?.hasStop === true;
        const midStreamStalled =
          generating &&
          textLen !== null &&
          textLen > 0 &&
          Date.now() - lastGrowthAt >= 45000;
        if (!stallHintSent && (minimized || midStreamStalled)) {
          stallHintSent = true;
          notifyPopupStall(true, { minimized });
        }
      } catch {
        // never let stall detection break the run
      }
      // Background-poll completion backstop (see above): detect a finished
      // response the starved in-page settle can't report, then scrape it.
      try {
        if (!pollCompletionDone && watcherState) {
          const wLen =
            typeof watcherState.textLen === 'number' ? watcherState.textLen : 0;
          if (watcherState.hasStop === true) sawGenerating = true;
          const looksDone =
            sawGenerating &&
            watcherState.hasStop === false &&
            watcherState.sawNewTurn === true &&
            watcherState.hasError !== true &&
            wLen > 0;
          // Require the finished state to hold for two consecutive polls (~8s) so
          // a transient Stop-button flicker (ChatGPT's "Conversation not found"
          // re-render loop) can't trigger a premature resolve.
          completeStableCount = looksDone ? completeStableCount + 1 : 0;
          if (
            completeStableCount >= 2 &&
            getActiveRun()?.cancelRequested !== true
          ) {
            let scraped = null;
            try {
              const [{ result: text } = {}] =
                (await chrome.scripting.executeScript({
                  target: { tabId: session.tabId },
                  func: () =>
                    typeof window.__rmScrapeAssistant === 'function'
                      ? window.__rmScrapeAssistant()
                      : null,
                })) ?? [];
              scraped = typeof text === 'string' ? text.trim() : null;
            } catch {
              // popup mid-navigation/closing — let the main flow handle it
            }
            if (scraped) {
              pollCompletionDone = true;
              logInfo(
                'ChatGptAutomation',
                'Recovered a completed response from the background poll (in-page settle was starved by a hidden popup).',
                {
                  promptLabel,
                  tabId: session.tabId,
                  pollCount,
                  textLength: scraped.length,
                  visibilityState,
                },
              );
              resolvePollCompletion({
                status: 'success',
                rawText: scraped,
                conversationUrl: tabSnapshot?.url ?? session.targetUrl ?? null,
                timings: { completedBy: 'background_poll' },
                recoveredByPoll: true,
              });
            }
          }
        }
      } catch {
        // never let completion detection break the run
      }
      logInfo('ChatGptAutomation', 'ChatGPT prompt runner in progress.', {
        promptLabel,
        tabId: session.tabId,
        elapsedMs,
        pollCount,
        phase: getElapsedPhaseKey(elapsedMs),
        phaseText: getElapsedPhaseLabel(elapsedMs, pollCount),
        tab: tabSnapshot,
        visibilityState,
        watcher: watcherState,
      });
    }, pollIntervalMs);
    try {
      // Race the in-page watcher against the background-poll backstop. When the
      // popup is visible the watcher settles in <1s and wins; when it's hidden
      // (watcher timers suspended) the poll wins and provides the scraped answer.
      const outcome = await Promise.race([
        executionPromise.then((results) => ({ via: 'watcher', results })),
        pollCompletionPromise.then((result) => ({
          via: 'poll',
          results: [{ result }],
        })),
      ]);
      executionResults = outcome.results;
      if (outcome.via === 'poll') {
        // The in-page watcher is still pending (its settle was starved). Ignore
        // its eventual result and swallow any late rejection.
        executionPromise.catch(() => {});
      }
    } finally {
      settled = true;
      clearInterval(progressPoll);
      if (stallHintSent) {
        stallHintSent = false;
        notifyPopupStall(false);
      }
    }
  } catch (error) {
    if (isPopupClosedError(error)) {
      // Distinguish a genuine popup close/discard from a user cancel instead of
      // silently collapsing both into "Run canceled." The caller decides whether
      // to reopen (discard) or treat as canceled (user).
      logWarn(
        'ChatGptAutomation',
        'ChatGPT popup was closed or discarded before the response completed.',
        {
          promptLabel,
          tabId: session.tabId,
          detail: error instanceof Error ? error.message : String(error),
        },
      );
      return {
        status: 'popup_closed',
        message:
          'ChatGPT popup was closed or discarded before the response completed.',
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    // ChatGPT popup loaded an error page (network failure, site down, etc.).
    // Treat as a retriable failure rather than a hard crash so the run
    // surfaces a clean "interrupted" state instead of an unhandled exception.
    if (/frame with id \d+ is showing error page/i.test(message)) {
      // The popup navigation loaded a browser error page (network blip,
      // Cloudflare challenge, HTTP 431, or a transient ChatGPT issue). Return a
      // distinct status so the caller can reopen a fresh popup and retry once,
      // rather than failing the whole run — a fresh open re-prunes cookies and
      // often recovers. A persistent error page (retry also fails) surfaces the
      // clean "could not be reached" message.
      const httpStatus = await probeChatGptHttpStatus();
      logError('ChatGptAutomation', 'ChatGPT popup loaded an error page — network or site issue.', {
        promptLabel,
        tabId: session.tabId,
        targetUrl: session.targetUrl,
        httpStatus,
      });
      return {
        status: 'error_page',
        message:
          'ChatGPT could not be reached. Please check your internet connection and try again.',
      };
    }
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
    timings: result?.timings ?? null,
    visibility: result?.visibility ?? null,
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
  if (session) {
    session.pendingResetPromise = null;
  }
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
    result.message.includes('ChatGPT composer never became interactive.') ||
    result.message.includes('ChatGPT failed to respond (error state detected') ||
    result.message.includes('returned an empty assistant response')
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
    responseTimeoutMs: Math.min(1200000, Math.max(options.responseTimeoutMs ?? 0, 900000)),
    responseIdleTimeoutMs: Math.min(600000, Math.max(options.responseIdleTimeoutMs ?? 0, 600000)),
    responseFirstTokenTimeoutMs: Math.min(600000, Math.max(options.responseFirstTokenTimeoutMs ?? 0, 600000)),
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

      // Capture the full failing output that triggered this self-heal attempt
      // so a saved log carries the exact text that failed to parse/validate.
      recordRawEmission({
        stage: options.promptLabel ?? 'Prompt',
        attempt,
        rawText: result.rawText,
        validationMessage: validation.message,
      });

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
          1200000,
          Math.max(options.responseTimeoutMs ?? 0, 900000),
        ),
        responseIdleTimeoutMs: Math.min(
          600000,
          Math.max(options.responseIdleTimeoutMs ?? 0, 600000),
        ),
        responseFirstTokenTimeoutMs: Math.min(
          600000,
          Math.max(options.responseFirstTokenTimeoutMs ?? 0, 600000),
        ),
      });
      if (result.status !== 'success') {
        return result;
      }
    }

    if (result.status === 'success') {
      const finalValidation = validateResponse(result.rawText);
      if (finalValidation && !finalValidation.valid) {
        recordRawEmission({
          stage: options.promptLabel ?? 'Prompt',
          attempt: 'final',
          rawText: result.rawText,
          validationMessage: finalValidation.message,
        });
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

async function runReusableChatGptPromptOnce(prompt, options, reusableRunId) {
  const session = await getOrOpenChatGptRunSession(reusableRunId, {
    ...options,
    promptLength: prompt.length,
  });
  if (session.pendingResetPromise) {
    logInfo('ChatGptAutomation', 'Awaiting in-flight ChatGPT reset before running the next prompt.', {
      promptLabel: options.promptLabel ?? session.promptLabel ?? 'Prompt',
      runId: reusableRunId,
      tabId: session.tabId,
    });
    await session.pendingResetPromise;
  } else if (session.needsReset) {
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

export async function runChatGptPrompt(prompt, options = {}) {
  const reusableRunId = getReusableRunId(options);
  if (reusableRunId) {
    const promptLabel = options.promptLabel ?? 'Prompt';
    const wasUserCanceled = () =>
      getActiveRun(reusableRunId)?.cancelRequested === true;

    // Recover a reusable-popup run by reopening a fresh popup and retrying the
    // prompt once. `reason` is 'popup_closed' or 'error_page'.
    const recoverOrReturn = async (reason) => {
      // Never fight a user who stopped the run: an explicit cancel closes the
      // popup via cleanup — treat as canceled, don't reopen.
      if (wasUserCanceled()) {
        return { status: 'canceled', message: 'Run canceled.' };
      }
      // For a CLOSED popup, distinguish "the user closed the window" from
      // "Chrome discarded the backgrounded tab": if the window is gone, the user
      // closed it — do NOT reopen and fight them. (An error PAGE means the window
      // still exists showing an error, so this only guards the closed case.)
      if (reason === 'popup_closed') {
        const session = chatGptRunSessions.get(reusableRunId);
        if (await isPopupWindowGone(session?.popupWindowId)) {
          logWarn(
            'ChatGptAutomation',
            'ChatGPT popup window is gone (likely closed by the user); not reopening.',
            { runId: reusableRunId, promptLabel },
          );
          return {
            status: 'canceled',
            message: 'The ChatGPT popup was closed, so the run stopped.',
          };
        }
      }
      // Can't reach the site (error page) — whatever the cause (Cloudflare
      // block, 4xx, network blip). Recover the way a human does: wait ~1–2s then
      // hit REFRESH on the same page (chrome.tabs.reload), NOT re-navigate to a
      // new URL. Then retry the prompt on the same refreshed page. One quick
      // retry; if it still error-pages, that status surfaces and the run ends
      // with a clear message so the user can retry manually.
      const existingSession = chatGptRunSessions.get(reusableRunId);
      if (reason === 'error_page' && existingSession) {
        logWarn(
          'ChatGptAutomation',
          'Refreshing the ChatGPT popup to recover from an error page (Cloudflare/4xx/network).',
          { runId: reusableRunId, promptLabel, tabId: existingSession.tabId },
        );
        const reloaded = await reloadChatGptRunSessionTab(existingSession, {
          promptLabel,
        });
        if (reloaded) {
          // Same URL, refreshed — run the prompt in place (no reset/re-navigate).
          existingSession.needsReset = false;
          return runReusableChatGptPromptOnce(prompt, options, reusableRunId);
        }
        // Tab was gone — fall through to reopen a fresh popup.
      }
      // Closed/discarded popup (or an error page whose tab could not be reloaded):
      // open a fresh popup — which also re-prunes cookies — and retry once. If
      // that also fails, its result surfaces the real error.
      logWarn(
        'ChatGptAutomation',
        'Reopening a fresh ChatGPT popup to recover the run.',
        { runId: reusableRunId, promptLabel, reason },
      );
      await closeChatGptRunSession(reusableRunId);
      return runReusableChatGptPromptOnce(prompt, options, reusableRunId);
    };

    try {
      const result = await runReusableChatGptPromptOnce(
        prompt,
        options,
        reusableRunId,
      );
      if (result.status === 'popup_closed' || result.status === 'error_page') {
        return recoverOrReturn(result.status);
      }
      return result;
    } catch (error) {
      if (isPopupClosedError(error)) {
        return recoverOrReturn('popup_closed');
      }
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
