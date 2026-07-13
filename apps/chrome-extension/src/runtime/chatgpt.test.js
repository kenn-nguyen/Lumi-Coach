import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The fire-gate throttles real prompt fires with 400–1000ms timers; stub it so
// the ChatGPT tests fire instantly. Its own timing is covered by fire-gate.test.js.
vi.mock('./fire-gate.js', () => ({
  acquireWebFireSlot: () => Promise.resolve(),
  resetWebFireGate: () => {},
}));

import {
  clearChatGptRunSessionsForTests,
  closeChatGptRunSession,
  getOrOpenChatGptRunSession,
  prepareChatGptRunSessionForNextStage,
  resetChatGptRunSession,
  runChatGptPrompt,
} from './chatgpt.js';
import {
  clearActiveRun,
  ensureActiveRun,
  requestActiveRunCancel,
} from './run-control.js';

function createChromeMock() {
  let nextWindowId = 1;
  let nextTabId = 101;
  let defaultTabStatus = 'complete';
  let pendingTabUpdate = null;
  let pendingTabReload = null;
  const windowsById = new Map();
  const tabsById = new Map();
  const webNavCompletedListeners = new Set();
  // Background-poll simulation: sequence of watcher states the poll's state-read
  // returns, the text its scrape returns, and whether the in-page watcher is
  // held pending (to simulate a hidden popup starving the in-page settle).
  const watcherStateReads = [];
  let lastWatcherStateRead = null;
  let scrapeResult = '';
  let holdWatcher = false;
  const scriptingResults = [];
  const readinessResults = [];

  function createTab(url, windowId) {
    const tab = {
      id: nextTabId++,
      windowId,
      url,
      status: defaultTabStatus,
      title: 'ChatGPT',
    };
    tabsById.set(tab.id, tab);
    windowsById.set(windowId, [tab.id]);
    return tab;
  }

  const chrome = {
    runtime: {
      lastError: undefined,
    },
    windows: {
      create: vi.fn((options, callback) => {
        const windowId = nextWindowId++;
        createTab(options.url, windowId);
        callback({ id: windowId });
      }),
      remove: vi.fn(async (windowId) => {
        const tabIds = windowsById.get(windowId) ?? [];
        for (const tabId of tabIds) {
          tabsById.delete(tabId);
        }
        windowsById.delete(windowId);
      }),
    },
    tabs: {
      query: vi.fn(async (queryInfo = {}) => {
        if (typeof queryInfo.windowId === 'number') {
          const tabIds = windowsById.get(queryInfo.windowId) ?? [];
          return tabIds
            .map((tabId) => tabsById.get(tabId))
            .filter(Boolean)
            .map((tab) => ({ ...tab }));
        }
        return Array.from(tabsById.values()).map((tab) => ({ ...tab }));
      }),
      get: vi.fn(async (tabId) => {
        const tab = tabsById.get(tabId);
        if (!tab) {
          throw new Error(`No tab with id ${tabId}`);
        }
        return { ...tab };
      }),
      update: vi.fn(async (tabId, updateProperties) => {
        const tab = tabsById.get(tabId);
        if (!tab) {
          throw new Error(`No tab with id ${tabId}`);
        }
        if (pendingTabUpdate) {
          const gate = pendingTabUpdate;
          pendingTabUpdate = null;
          await gate;
        }
        if (typeof updateProperties?.url === 'string') {
          tab.url = updateProperties.url;
        }
        tab.status = 'complete';
        return { ...tab };
      }),
      reload: vi.fn(async (tabId) => {
        const tab = tabsById.get(tabId);
        if (!tab) {
          throw new Error(`No tab with id ${tabId}`);
        }
        if (pendingTabReload) {
          const gate = pendingTabReload;
          pendingTabReload = null;
          await gate;
        }
        tab.status = 'complete';
        // Simulate the top-frame load finishing so waitForTopFrameLoad resolves.
        for (const fn of Array.from(webNavCompletedListeners)) {
          fn({ tabId, frameId: 0 });
        }
        return undefined;
      }),
    },
    webNavigation: {
      onCompleted: {
        addListener: vi.fn((fn) => webNavCompletedListeners.add(fn)),
        removeListener: vi.fn((fn) => webNavCompletedListeners.delete(fn)),
      },
    },
    scripting: {
      executeScript: vi.fn(async (request) => {
        if (request?.func?.name === 'injectedChatGptReadinessProbe') {
          const nextReadiness =
            readinessResults.shift() ?? {
              ready: true,
              composerFound: true,
              composerInteractive: true,
              authRequired: false,
            };
          return [{ result: nextReadiness, request }];
        }
        const name = request?.func?.name;
        const src =
          typeof request?.func === 'function' ? request.func.toString() : '';
        // The poll's reads are inline arrows (property name 'func'); gate on that
        // so the NAMED watcher (which also references __rmWatcherState because it
        // sets it) doesn't match these branches.
        if (name === 'func' && src.includes('__rmScrapeAssistant')) {
          return [{ result: scrapeResult, request }];
        }
        if (name === 'func' && src.includes('__rmWatcherState')) {
          const watcher =
            watcherStateReads.length > 0
              ? watcherStateReads.shift()
              : lastWatcherStateRead;
          lastWatcherStateRead = watcher ?? lastWatcherStateRead;
          return [
            { result: { visibilityState: 'hidden', watcher: watcher ?? null }, request },
          ];
        }
        // The in-page watcher (injectedChatGptPromptEntry). Optionally hold it
        // pending forever to simulate a hidden popup starving its settle timers.
        if (name === 'injectedChatGptPromptEntry' && holdWatcher) {
          return new Promise(() => {});
        }
        const nextResult =
          scriptingResults.shift() ?? {
            status: 'success',
            rawText: '{"ok":true}',
            conversationUrl: 'https://chatgpt.com/c/default',
          };
        return [{ result: nextResult, request }];
      }),
    },
  };

  return {
    chrome,
    scriptingResults,
    readinessResults,
    watcherStateReads,
    setScrapeResult(text) {
      scrapeResult = text;
    },
    holdWatcher() {
      holdWatcher = true;
    },
    setDefaultTabStatus(status) {
      defaultTabStatus = status;
    },
    holdNextTabUpdate() {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      pendingTabUpdate = gate;
      return {
        release() {
          release?.();
        },
      };
    },
    holdNextTabReload() {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      pendingTabReload = gate;
      return {
        release() {
          release?.();
        },
      };
    },
  };
}

describe('chatgpt run-scoped popup reuse', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock.chrome);
  });

  afterEach(() => {
    clearChatGptRunSessionsForTests();
    clearActiveRun();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reuses the same popup session for the same run id', async () => {
    ensureActiveRun({ runId: 'run-1', phase: 'running', inFlight: true });

    const firstSession = await getOrOpenChatGptRunSession('run-1', {
      promptLabel: 'Prompt 1',
      warmupDelayMs: 0,
    });
    const secondSession = await getOrOpenChatGptRunSession('run-1', {
      promptLabel: 'Prompt 2',
      warmupDelayMs: 0,
    });

    expect(firstSession.tabId).toBe(secondSession.tabId);
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(1);
  });

  it('creates separate popup sessions for different run ids', async () => {
    const firstSession = await getOrOpenChatGptRunSession('run-a', {
      warmupDelayMs: 0,
    });

    const secondSession = await getOrOpenChatGptRunSession('run-b', {
      warmupDelayMs: 0,
    });

    expect(firstSession.tabId).not.toBe(secondSession.tabId);
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(2);
  });

  it('removes a cached session when explicitly closed', async () => {
    ensureActiveRun({ runId: 'run-close', phase: 'running', inFlight: true });

    await getOrOpenChatGptRunSession('run-close', { warmupDelayMs: 0 });
    await closeChatGptRunSession('run-close');
    await getOrOpenChatGptRunSession('run-close', { warmupDelayMs: 0 });

    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(2);
    expect(chromeMock.chrome.windows.remove).toHaveBeenCalledTimes(1);
  });

  it('resets the same tab to a fresh temporary chat url', async () => {
    ensureActiveRun({ runId: 'run-reset', phase: 'running', inFlight: true });

    const session = await getOrOpenChatGptRunSession('run-reset', {
      warmupDelayMs: 0,
    });
    const originalTabId = session.tabId;

    const resetSession = await resetChatGptRunSession('run-reset', {
      warmupDelayMs: 0,
    });

    // Reset refreshes the SAME popup (browser-refresh style) rather than
    // navigating to a new URL — faster, and a temporary chat resets on reload.
    expect(resetSession.tabId).toBe(originalTabId);
    expect(chromeMock.chrome.tabs.reload).toHaveBeenCalledTimes(1);
    expect(chromeMock.chrome.tabs.reload).toHaveBeenCalledWith(originalTabId, {
      bypassCache: false,
    });
    expect(chromeMock.chrome.tabs.update).not.toHaveBeenCalled();
  });

  it('skips the fixed warmup delay when ChatGPT reports startup readiness immediately', async () => {
    vi.useFakeTimers();
    ensureActiveRun({ runId: 'run-ready', phase: 'running', inFlight: true });
    chromeMock.readinessResults.push({
      ready: true,
      composerFound: true,
      composerInteractive: true,
      authRequired: false,
    });

    let session = null;
    let settled = false;
    const sessionPromise = getOrOpenChatGptRunSession('run-ready', {
      promptLabel: 'Prompt',
      warmupDelayMs: 1500,
    }).then((value) => {
      session = value;
      settled = true;
      return value;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(session?.tabId).toBeTruthy();
    expect(
      chromeMock.chrome.scripting.executeScript.mock.calls.some(
        ([request]) => request?.func?.name === 'injectedChatGptReadinessProbe',
      ),
    ).toBe(true);

    await sessionPromise;
  });

  it('opens a reusable session without waiting for tab completion when the page is already reachable', async () => {
    ensureActiveRun({ runId: 'run-loading-tab', phase: 'running', inFlight: true });
    chromeMock.setDefaultTabStatus('loading');

    const session = await getOrOpenChatGptRunSession('run-loading-tab', {
      warmupDelayMs: 0,
    });

    expect(session.tabId).toBeTruthy();
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(1);
  });

  it('keeps repair attempts in the same popup session without resetting', async () => {
    ensureActiveRun({ runId: 'run-repair', phase: 'running', inFlight: true });
    chromeMock.scriptingResults.push(
      {
        status: 'success',
        rawText: '{"ok":false}',
        conversationUrl: 'https://chatgpt.com/c/repair',
      },
      {
        status: 'success',
        rawText: '{"ok":true}',
        conversationUrl: 'https://chatgpt.com/c/repair',
      },
    );

    const result = await runChatGptPrompt('Return JSON', {
      runId: 'run-repair',
      reusePopupSession: true,
      warmupDelayMs: 0,
      validateResponse: (rawText) =>
        rawText.includes('"ok":true')
          ? { valid: true }
          : { valid: false, message: 'Need ok true' },
      buildRepairPrompt: ({ attempt }) => `repair-${attempt}`,
      maxRepairAttempts: 1,
    });

    expect(result).toMatchObject({
      status: 'success',
      rawText: '{"ok":true}',
    });
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(1);
    expect(chromeMock.chrome.tabs.update).not.toHaveBeenCalled();
    expect(chromeMock.chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(chromeMock.chrome.windows.remove).not.toHaveBeenCalled();
  });

  it('reuses the popup and resets between sequential prompt stages', async () => {
    ensureActiveRun({ runId: 'run-seq', phase: 'running', inFlight: true });
    chromeMock.scriptingResults.push(
      {
        status: 'success',
        rawText: '{"stage":1}',
        conversationUrl: 'https://chatgpt.com/c/1',
      },
      {
        status: 'success',
        rawText: '{"stage":2}',
        conversationUrl: 'https://chatgpt.com/c/2',
      },
    );

    const firstResult = await runChatGptPrompt('Prompt 1', {
      runId: 'run-seq',
      reusePopupSession: true,
      warmupDelayMs: 0,
    });
    const secondResult = await runChatGptPrompt('Prompt 2', {
      runId: 'run-seq',
      reusePopupSession: true,
      warmupDelayMs: 0,
    });

    expect(firstResult.status).toBe('success');
    expect(secondResult.status).toBe('success');
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(1);
    expect(chromeMock.chrome.tabs.reload).toHaveBeenCalledTimes(1);
    const firstTabId =
      chromeMock.chrome.scripting.executeScript.mock.calls[0][0].target.tabId;
    const secondTabId =
      chromeMock.chrome.scripting.executeScript.mock.calls[1][0].target.tabId;
    expect(firstTabId).toBe(secondTabId);
  });

  it('deduplicates an in-flight background reset for the next stage', async () => {
    ensureActiveRun({ runId: 'run-prepare', phase: 'running', inFlight: true });
    const session = await getOrOpenChatGptRunSession('run-prepare', {
      warmupDelayMs: 0,
    });
    session.needsReset = true;
    const heldReload = chromeMock.holdNextTabReload();

    const firstReset = prepareChatGptRunSessionForNextStage('run-prepare', {
      warmupDelayMs: 0,
    });
    const secondReset = prepareChatGptRunSessionForNextStage('run-prepare', {
      warmupDelayMs: 0,
    });

    // Drain microtasks (the reset prunes cookies before refreshing, adding async
    // steps) so the held tabs.reload call is reached before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chromeMock.chrome.tabs.reload).toHaveBeenCalledTimes(1);

    heldReload.release();
    const [firstSession, secondSession] = await Promise.all([
      firstReset,
      secondReset,
    ]);

    expect(firstSession.tabId).toBe(session.tabId);
    expect(secondSession.tabId).toBe(session.tabId);
    expect(session.needsReset).toBe(false);
    expect(session.pendingResetPromise).toBe(null);
  });

  it('recovers a completed response from the background poll when the hidden popup starves the in-page settle', async () => {
    ensureActiveRun({ runId: 'run-poll', phase: 'running', inFlight: true });
    // Simulate a hidden popup: the in-page watcher never resolves (its settle
    // timers are suspended), and the SW poll observes generation finish.
    chromeMock.holdWatcher();
    chromeMock.setScrapeResult('{"resume":"final answer"}');
    chromeMock.watcherStateReads.push(
      { hasStop: true, sawNewTurn: true, textLen: 100, hasError: false },
      { hasStop: false, sawNewTurn: true, textLen: 500, hasError: false },
      { hasStop: false, sawNewTurn: true, textLen: 500, hasError: false },
      { hasStop: false, sawNewTurn: true, textLen: 500, hasError: false },
    );

    const result = await runChatGptPrompt('Prompt', {
      runId: 'run-poll',
      reusePopupSession: true,
      warmupDelayMs: 0,
      pollIntervalMs: 5,
    });

    expect(result.status).toBe('success');
    expect(result.rawText).toContain('final answer');
  });

  it('preserves the legacy open-close behavior when popup reuse is disabled', async () => {
    chromeMock.scriptingResults.push({
      status: 'success',
      rawText: '{"legacy":true}',
      conversationUrl: 'https://chatgpt.com/c/legacy',
    });

    const result = await runChatGptPrompt('Prompt 1', {
      promptLabel: 'Prompt 1',
      warmupDelayMs: 0,
    });

    expect(result.status).toBe('success');
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(1);
    expect(chromeMock.chrome.windows.remove).toHaveBeenCalledTimes(1);
  });

  it('closes a cached popup when the active run is canceled', async () => {
    ensureActiveRun({ runId: 'run-cancel', phase: 'running', inFlight: true });
    await getOrOpenChatGptRunSession('run-cancel', { warmupDelayMs: 0 });

    await requestActiveRunCancel({ runId: 'run-cancel', reason: 'user' });

    expect(chromeMock.chrome.windows.remove).toHaveBeenCalledTimes(1);

    await getOrOpenChatGptRunSession('run-cancel', { warmupDelayMs: 0 });
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(2);
  });
});
