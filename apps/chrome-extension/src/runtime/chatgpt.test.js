import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const windowsById = new Map();
  const tabsById = new Map();
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

    expect(resetSession.tabId).toBe(originalTabId);
    expect(chromeMock.chrome.tabs.update).toHaveBeenCalledTimes(1);
    const [, updateProperties] = chromeMock.chrome.tabs.update.mock.calls[0];
    expect(updateProperties.url).toContain('temporary-chat=true');
    expect(updateProperties.url).toContain('rm_run=');
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
    expect(chromeMock.chrome.tabs.update).toHaveBeenCalledTimes(1);
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
    const heldUpdate = chromeMock.holdNextTabUpdate();

    const firstReset = prepareChatGptRunSessionForNextStage('run-prepare', {
      warmupDelayMs: 0,
    });
    const secondReset = prepareChatGptRunSessionForNextStage('run-prepare', {
      warmupDelayMs: 0,
    });

    await Promise.resolve();
    expect(chromeMock.chrome.tabs.update).toHaveBeenCalledTimes(1);

    heldUpdate.release();
    const [firstSession, secondSession] = await Promise.all([
      firstReset,
      secondReset,
    ]);

    expect(firstSession.tabId).toBe(session.tabId);
    expect(secondSession.tabId).toBe(session.tabId);
    expect(session.needsReset).toBe(false);
    expect(session.pendingResetPromise).toBe(null);
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
