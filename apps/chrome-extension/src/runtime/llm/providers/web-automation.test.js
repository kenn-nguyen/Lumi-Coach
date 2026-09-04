import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub the fire-gate so provider fires are instant under test (its 400–1000ms
// throttle is covered by fire-gate.test.js).
vi.mock('../../fire-gate.js', () => ({
  acquireWebFireSlot: () => Promise.resolve(),
  resetWebFireGate: () => {},
}));

// Spy on logError so a lost injected frame can be asserted to surface at error
// level rather than only as a generic downstream failure.
vi.mock('../../log.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, logError: vi.fn(actual.logError) };
});

import { injectedProviderPromptEntry, runWebAutomationPrompt } from './web-automation.js';

function flushMicrotasks() {
  return Promise.resolve();
}

describe('injectedProviderPromptEntry completion detection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      width: 120,
      height: 32,
      top: 0,
      left: 0,
      right: 120,
      bottom: 32,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }));
    vi.stubGlobal(
      'InputEvent',
      globalThis.InputEvent ??
        class InputEvent extends Event {
          constructor(type, init = {}) {
            super(type, init);
            this.data = init.data ?? null;
            this.inputType = init.inputType ?? '';
          }
        }
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback) => setTimeout(() => callback(0), 0))
    );
    window.history.replaceState({}, '', '/claude/new?incognito');
    document.body.innerHTML = `
      <main>
        <form id="composer-form">
          <textarea id="composer"></textarea>
          <button id="send-button" type="submit" aria-label="Send">Send</button>
        </form>
        <section id="messages"></section>
      </main>
    `;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('waits for Claude streaming indicators to clear before settling the response', async () => {
    const CLAUDE_TEST_CONFIG = {
      providerLabel: 'Claude',
      urlMatchers: [`${window.location.origin}/`],
      inputSelectors: ['#composer'],
      sendButtonSelectors: ['#send-button'],
      stopButtonSelectors: ['button[aria-label*="Stop"]'],
      responseBusySelectors: ['[data-is-streaming="true"]'],
      assistantTextSelectors: ['[data-assistant]'],
      loginSelectors: [],
      authRequiredMessage: 'Please log into Claude in a normal browser tab first.',
    };
    const composer = document.getElementById('composer');
    const sendButton = document.getElementById('send-button');
    const messages = document.getElementById('messages');

    sendButton.addEventListener('click', (event) => {
      event.preventDefault();
      composer.value = '';
      sendButton.setAttribute('aria-label', 'Stop');

      const assistant = document.createElement('div');
      assistant.setAttribute('data-assistant', 'true');
      assistant.setAttribute('data-is-streaming', 'true');
      assistant.textContent = 'partial {"summary":';
      messages.appendChild(assistant);
    });

    const runPromise = injectedProviderPromptEntry('Return valid JSON only.', CLAUDE_TEST_CONFIG, {
      responseTimeoutMs: 30000,
      responseIdleTimeoutMs: 30000,
      responseFirstTokenTimeoutMs: 30000,
      composeReadyTimeoutMs: 1000,
      sendReadyTimeoutMs: 1000,
      responseSettleDelayMs: 2000,
    });

    let settled = false;
    let result = null;
    runPromise.then((value) => {
      settled = true;
      result = value;
    });

    await vi.advanceTimersByTimeAsync(700);
    await flushMicrotasks();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();
    expect(settled).toBe(false);

    const assistant = messages.querySelector('[data-assistant]');
    assistant.textContent = '{"summary":"done"}';
    assistant.removeAttribute('data-is-streaming');
    sendButton.setAttribute('aria-label', 'Send');

    await vi.advanceTimersByTimeAsync(1500);
    await flushMicrotasks();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();
    expect(settled).toBe(true);
    expect(result).toMatchObject({
      status: 'success',
      rawText: '{"summary":"done"}',
      conversationUrl: `${window.location.origin}/claude/new?incognito`,
    });
    expect(window.__resumeMatcherWebAutomationState).toMatchObject({
      phase: 'completed',
      resultStatus: 'success',
      rawText: '{"summary":"done"}',
      busy: false,
    });
  });

  it('does not treat data-is-streaming=false as still busy', async () => {
    const CLAUDE_TEST_CONFIG = {
      providerLabel: 'Claude',
      urlMatchers: [`${window.location.origin}/`],
      inputSelectors: ['#composer'],
      sendButtonSelectors: ['#send-button'],
      stopButtonSelectors: ['button[aria-label*="Stop"]'],
      responseBusySelectors: ['[data-is-streaming]', '[aria-busy="true"]'],
      assistantTextSelectors: ['[data-assistant]'],
      loginSelectors: [],
      authRequiredMessage: 'Please log into Claude in a normal browser tab first.',
    };
    const composer = document.getElementById('composer');
    const sendButton = document.getElementById('send-button');
    const messages = document.getElementById('messages');

    sendButton.addEventListener('click', (event) => {
      event.preventDefault();
      composer.value = '';
      sendButton.setAttribute('aria-label', 'Stop');

      const assistant = document.createElement('div');
      assistant.setAttribute('data-assistant', 'true');
      assistant.setAttribute('data-is-streaming', 'true');
      assistant.textContent = 'partial {"summary":';
      messages.appendChild(assistant);
    });

    const runPromise = injectedProviderPromptEntry('Return valid JSON only.', CLAUDE_TEST_CONFIG, {
      responseTimeoutMs: 30000,
      responseIdleTimeoutMs: 30000,
      responseFirstTokenTimeoutMs: 30000,
      composeReadyTimeoutMs: 1000,
      sendReadyTimeoutMs: 1000,
      responseSettleDelayMs: 2000,
    });

    let settled = false;
    let result = null;
    runPromise.then((value) => {
      settled = true;
      result = value;
    });

    await vi.advanceTimersByTimeAsync(700);
    await flushMicrotasks();
    expect(settled).toBe(false);

    const assistant = messages.querySelector('[data-assistant]');
    assistant.textContent = '{"summary":"done"}';
    assistant.setAttribute('data-is-streaming', 'false');
    sendButton.setAttribute('aria-label', 'Send');

    await vi.advanceTimersByTimeAsync(2500);
    await flushMicrotasks();
    expect(settled).toBe(true);
    expect(result).toMatchObject({
      status: 'success',
      rawText: '{"summary":"done"}',
    });
  });

  it('extracts the Claude assistant response from the assistant turn instead of a later prompt echo wrapper', async () => {
    const CLAUDE_TEST_CONFIG = {
      providerLabel: 'Claude',
      urlMatchers: [`${window.location.origin}/`],
      inputSelectors: ['#composer'],
      sendButtonSelectors: ['#send-button'],
      stopButtonSelectors: ['button[aria-label*="Stop"]'],
      responseBusySelectors: ['[data-is-streaming="true"]'],
      assistantTextSelectors: ['[data-test-render-count]'],
      assistantTurnContainerSelectors: ['[data-test-render-count]'],
      assistantTurnRoleHeadingSelectors: ['h2.sr-only'],
      assistantTurnRoleHeadingPattern: '^Claude responded:',
      assistantContentSelectors: [
        '.font-claude-response .standard-markdown',
        '.font-claude-response',
      ],
      loginSelectors: [],
      authRequiredMessage: 'Please log into Claude in a normal browser tab first.',
      responseSettleDelayMs: 0,
    };
    const composer = document.getElementById('composer');
    const sendButton = document.getElementById('send-button');
    const messages = document.getElementById('messages');

    sendButton.addEventListener('click', (event) => {
      event.preventDefault();
      composer.value = '';
      sendButton.setAttribute('aria-label', 'Send');

      messages.innerHTML = `
        <div data-test-render-count="1">
          <div data-is-streaming="false" class="group relative relative pb-3">
            <h2 class="sr-only select-none">Claude responded: ATS</h2>
            <div class="font-claude-response">
              <div class="standard-markdown">
                <p>ATS</p>
                <ul>
                  <li>Priority keywords: payments, APIs</li>
                  <li>Hard filters: 8+ years</li>
                </ul>
                <p>Hiring manager persona</p>
                <ul>
                  <li>Trusts: full product ownership</li>
                </ul>
              </div>
            </div>
            <div role="group" aria-label="Message actions">
              <button data-testid="action-bar-copy" aria-label="Copy">Copy</button>
            </div>
          </div>
        </div>
        <div data-test-render-count="2">
          <div class="whitespace-pre-wrap">
            ATS
            - Priority keywords:
            - Hard filters:
            - Proof themes:
            Hiring manager persona
            - Trusts:
            - Rejects:
            - Wants first on page one:
          </div>
        </div>
      `;
    });

    let settled = false;
    let result = null;
    const runPromise = injectedProviderPromptEntry(
      'Return valid plain text only.',
      CLAUDE_TEST_CONFIG,
      {
        responseTimeoutMs: 30000,
        responseIdleTimeoutMs: 30000,
        responseFirstTokenTimeoutMs: 30000,
        composeReadyTimeoutMs: 1000,
        sendReadyTimeoutMs: 1000,
        responseSettleDelayMs: 0,
      }
    ).then((value) => {
      settled = true;
      result = value;
      return value;
    });

    await vi.advanceTimersByTimeAsync(3000);
    await flushMicrotasks();

    expect(settled).toBe(true);
    expect(result).toMatchObject({
      status: 'success',
    });
    expect(result.rawText).toContain('Priority keywords: payments, APIs');
    expect(result.rawText).toContain('Trusts: full product ownership');
    expect(result.rawText).not.toContain('Proof themes:');
    expect(result.rawText).not.toContain('Wants first on page one:');
    await runPromise;
  });

  it('extracts the Claude assistant response from the incognito chat layout', async () => {
    const CLAUDE_TEST_CONFIG = {
      providerLabel: 'Claude',
      urlMatchers: [`${window.location.origin}/`],
      inputSelectors: ['#composer'],
      sendButtonSelectors: ['#send-button'],
      stopButtonSelectors: ['button[aria-label*="Stop"]'],
      responseBusySelectors: ['[data-is-streaming="true"]'],
      assistantTextSelectors: ['#main-content [data-test-render-count]'],
      assistantTurnContainerSelectors: ['#main-content [data-test-render-count]'],
      assistantTurnRoleHeadingSelectors: ['h2.sr-only'],
      assistantTurnRoleHeadingPattern: '^Claude responded:',
      assistantContentSelectors: [
        '.font-claude-response .standard-markdown',
        '.font-claude-response .progressive-markdown',
        '.font-claude-response',
      ],
      loginSelectors: [],
      authRequiredMessage: 'Please log into Claude in a normal browser tab first.',
      responseSettleDelayMs: 0,
    };
    const composer = document.getElementById('composer');
    const sendButton = document.getElementById('send-button');
    const messages = document.getElementById('messages');

    sendButton.addEventListener('click', (event) => {
      event.preventDefault();
      composer.value = '';
      sendButton.setAttribute('aria-label', 'Send');

      messages.innerHTML = `
        <div id="main-content">
          <div class="flex flex-1 h-full w-full overflow-hidden">
            <div class="h-full flex flex-col overflow-hidden" style="flex: 100 1 0%;">
              <div class="overflow-y-auto overflow-x-hidden pt-6 flex-1">
                <div class="relative w-full min-h-full flex flex-col">
                  <div class="mx-auto flex w-full flex-1 flex-col max-w-3xl md:px-2">
                    <div class="flex-1 flex flex-col px-4 max-w-3xl mx-auto w-full pt-1">
                      <div class="pb-8 -mb-8">
                        <div data-test-render-count="2">
                          <div class="contents">
                            <div class="mb-1 mt-6 group">
                              <h2 class="sr-only select-none">You said: abcde</h2>
                              <div data-user-message-bubble="true">
                                <div data-testid="user-message">
                                  <p class="whitespace-pre-wrap break-words">abcde</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div data-test-render-count="1">
                            <div class="group">
                              <div class="contents">
                                <div data-is-streaming="false" class="group relative relative pb-3">
                                  <h2 class="sr-only select-none">Claude responded: Hey!</h2>
                                  <div class="font-claude-response relative leading-[1.65rem]">
                                    <div>
                                      <div class="standard-markdown grid-cols-1 grid gap-3">
                                        <p class="font-claude-response-body break-words whitespace-normal leading-[1.7]">
                                          Hey! It looks like you just typed "abcde" — was that a test, or is there something I can help you with?
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div class="flex justify-start" role="group" aria-label="Message actions">
                                <button data-testid="action-bar-copy" aria-label="Copy">Copy</button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="fixed left-0 right-0 z-header flex items-center gap-2 text-bg-000 py-1.5 pr-2 draggable pl-5">
                          <span class="text-sm select-none">Incognito chat</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    let settled = false;
    let result = null;
    const runPromise = injectedProviderPromptEntry(
      'Return valid plain text only.',
      CLAUDE_TEST_CONFIG,
      {
        responseTimeoutMs: 30000,
        responseIdleTimeoutMs: 30000,
        responseFirstTokenTimeoutMs: 30000,
        composeReadyTimeoutMs: 1000,
        sendReadyTimeoutMs: 1000,
        responseSettleDelayMs: 0,
      }
    ).then((value) => {
      settled = true;
      result = value;
      return value;
    });

    await vi.advanceTimersByTimeAsync(3000);
    await flushMicrotasks();

    expect(settled).toBe(true);
    expect(result).toMatchObject({
      status: 'success',
    });
    expect(result.rawText).toContain('Hey! It looks like you just typed "abcde"');
    expect(result.rawText).not.toContain('You said: abcde');
    await runPromise;
  });

  it('self-heals a stale role-heading via the lenient scrape and the Stop->Send transition', async () => {
    const CLAUDE_TEST_CONFIG = {
      providerLabel: 'Claude',
      urlMatchers: [`${window.location.origin}/`],
      inputSelectors: ['#composer'],
      sendButtonSelectors: ['#send-button'],
      stopButtonSelectors: ['button[aria-label*="Stop"]'],
      responseBusySelectors: ['[data-is-streaming="true"]'],
      assistantTextSelectors: ['.standard-markdown'],
      assistantTurnContainerSelectors: ['[data-test-render-count]'],
      assistantTurnRoleHeadingSelectors: ['h2.sr-only'],
      // The DOM heading below intentionally does NOT match this pattern,
      // simulating Claude changing its accessibility heading. The gated
      // snapshot will find nothing; the run must still heal.
      assistantTurnRoleHeadingPattern: '^Claude responded:',
      assistantContentSelectors: ['.font-claude-response .standard-markdown'],
      loginSelectors: [],
      authRequiredMessage: 'Please log into Claude in a normal browser tab first.',
    };
    const composer = document.getElementById('composer');
    const sendButton = document.getElementById('send-button');
    const messages = document.getElementById('messages');

    sendButton.addEventListener('click', (event) => {
      event.preventDefault();
      composer.value = '';
      // Generating: Send becomes Stop, answer streams in.
      sendButton.setAttribute('aria-label', 'Stop');
      messages.innerHTML = `
        <div data-test-render-count="1">
          <div data-is-streaming="true" class="group">
            <h2 class="sr-only">Assistant said: stale heading</h2>
            <div class="font-claude-response">
              <div class="standard-markdown"><p>{"summary":"healed"}</p></div>
            </div>
          </div>
        </div>
      `;
    });

    let settled = false;
    let result = null;
    const runPromise = injectedProviderPromptEntry('Return valid JSON only.', CLAUDE_TEST_CONFIG, {
      responseTimeoutMs: 30000,
      responseIdleTimeoutMs: 30000,
      responseFirstTokenTimeoutMs: 30000,
      composeReadyTimeoutMs: 1000,
      sendReadyTimeoutMs: 1000,
      responseSettleDelayMs: 500,
    }).then((value) => {
      settled = true;
      result = value;
      return value;
    });

    // Still streaming (Stop shown, data-is-streaming=true) -> must not settle.
    await vi.advanceTimersByTimeAsync(1500);
    await flushMicrotasks();
    expect(settled).toBe(false);

    // Finished: streaming stops and Stop reverts to Send.
    const streamingNode = messages.querySelector('[data-is-streaming]');
    streamingNode.setAttribute('data-is-streaming', 'false');
    sendButton.setAttribute('aria-label', 'Send');

    await vi.advanceTimersByTimeAsync(1500);
    await flushMicrotasks();

    expect(settled).toBe(true);
    expect(result).toMatchObject({ status: 'success' });
    expect(result.rawText).toContain('{"summary":"healed"}');
  });
});

function createChromeMock() {
  let nextWindowId = 1;
  let nextTabId = 101;
  const windowsById = new Map();
  const tabsById = new Map();
  const readinessResults = [];
  const executionResults = [];
  // Completion-watchdog simulation: watchdog state reads, the scrape text, and
  // whether the in-page watcher is held pending (hidden-popup / starved settle).
  const watchdogStateReads = [];
  let lastWatchdogState = null;
  let scrapeResult = '';
  let holdWatcher = false;
  // How many upcoming prompt-runner injections resolve with no frame result
  // (i.e. the injected frame was torn down by a navigation mid-run).
  let lostFrameRuns = 0;

  function createTab(url, windowId) {
    const tab = {
      id: nextTabId++,
      windowId,
      url,
      status: 'complete',
      title: 'Claude',
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
    },
    scripting: {
      executeScript: vi.fn(async (request) => {
        if (request?.func?.name === 'injectedProviderReadinessProbe') {
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
        // Watchdog reads are inline arrows (name 'func'); gate on that so the
        // NAMED watcher doesn't match.
        if (name === 'func' && src.includes('__rmScrapeAssistant')) {
          return [{ result: scrapeResult, request }];
        }
        if (name === 'func' && src.includes('__resumeMatcherWebAutomationState')) {
          const state =
            watchdogStateReads.length > 0
              ? watchdogStateReads.shift()
              : lastWatchdogState;
          lastWatchdogState = state ?? lastWatchdogState;
          return [{ result: state ?? null, request }];
        }
        if (name === 'injectedProviderPromptEntry' && lostFrameRuns > 0) {
          lostFrameRuns -= 1;
          return [{ request }];
        }
        if (name === 'injectedProviderPromptEntry' && holdWatcher) {
          return new Promise(() => {});
        }
        const nextResult =
          executionResults.shift() ?? {
            status: 'success',
            rawText: '{"ok":true}',
            conversationUrl: 'https://claude.ai/chats/default',
          };
        return [{ result: nextResult, request }];
      }),
    },
  };

  return {
    chrome,
    readinessResults,
    executionResults,
    watchdogStateReads,
    setScrapeResult(text) {
      scrapeResult = text;
    },
    holdWatcher() {
      holdWatcher = true;
    },
    loseNextFrames(count = 1) {
      lostFrameRuns = count;
    },
  };
}

describe('runWebAutomationPrompt startup readiness', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('skips the fixed warmup delay when the provider reports readiness immediately', async () => {
    vi.useFakeTimers();
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock.chrome);
    chromeMock.readinessResults.push({
      ready: true,
      composerFound: true,
      composerInteractive: true,
      authRequired: false,
    });

    const config = {
      providerLabel: 'Claude',
      scope: 'ClaudeAutomation',
      defaultTargetUrl: 'https://claude.ai/new',
      urlMatchers: ['https://claude.ai/'],
      inputSelectors: ['#composer'],
      sendButtonSelectors: ['#send-button'],
      stopButtonSelectors: ['button[aria-label*="Stop"]'],
      responseBusySelectors: [],
      assistantTextSelectors: ['[data-assistant]'],
      loginSelectors: [],
      authRequiredMessage: 'Please log into Claude in a normal browser tab first.',
      openPopupMessage: 'Opening Claude popup.',
      popupCreatedMessage: 'Claude popup created.',
      waitForTabMessage: 'Waiting for Claude tab.',
      tabReadyMessage: 'Claude tab ready.',
      waitForHydrationMessage: 'Waiting for Claude startup readiness.',
      progressMessage: 'Claude prompt runner in progress.',
      retryMessage: 'Retrying Claude prompt.',
      partialSuccessMessage: 'Claude partial success.',
      partialRetrySuccessMessage: 'Claude partial retry success.',
      responseTimeoutMs: 120000,
      responseIdleTimeoutMs: 25000,
      responseFirstTokenTimeoutMs: 60000,
    };

    let settled = false;
    let result = null;
    const runPromise = runWebAutomationPrompt('Return JSON', config, {
      promptLabel: 'Prompt',
      warmupDelayMs: 1500,
    }).then((value) => {
      settled = true;
      result = value;
      return value;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(result).toMatchObject({
      status: 'success',
      rawText: '{"ok":true}',
    });
    expect(
      chromeMock.chrome.scripting.executeScript.mock.calls.some(
        ([request]) => request?.func?.name === 'injectedProviderReadinessProbe',
      ),
    ).toBe(true);

    await runPromise;
  });

  it('recovers a completed response via the watchdog when a hidden popup starves the in-page settle', async () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock.chrome);
    // In-page watcher never resolves (its settle timers are suspended while
    // hidden); the watchdog must recover the answer from the `busy` signal.
    chromeMock.holdWatcher();
    chromeMock.setScrapeResult('{"resume":"final answer"}');
    chromeMock.watchdogStateReads.push(
      { phase: 'waiting_for_response', resultStatus: null, busy: true, rawText: '', latestTextLength: 100, updatedAt: 1, conversationUrl: 'https://claude.ai/chats/x' },
      { phase: 'waiting_for_response', resultStatus: null, busy: false, rawText: '', latestTextLength: 500, updatedAt: 2, conversationUrl: 'https://claude.ai/chats/x' },
      { phase: 'waiting_for_response', resultStatus: null, busy: false, rawText: '', latestTextLength: 500, updatedAt: 3, conversationUrl: 'https://claude.ai/chats/x' },
      { phase: 'waiting_for_response', resultStatus: null, busy: false, rawText: '', latestTextLength: 500, updatedAt: 4, conversationUrl: 'https://claude.ai/chats/x' },
    );

    const config = {
      providerLabel: 'Claude',
      scope: 'ClaudeAutomation',
      defaultTargetUrl: 'https://claude.ai/new',
      urlMatchers: ['https://claude.ai/'],
      inputSelectors: ['#composer'],
      sendButtonSelectors: ['#send-button'],
      stopButtonSelectors: ['button[aria-label*="Stop"]'],
      responseBusySelectors: [],
      assistantTextSelectors: ['[data-assistant]'],
      loginSelectors: [],
      authRequiredMessage: 'x',
      openPopupMessage: 'x',
      popupCreatedMessage: 'x',
      waitForTabMessage: 'x',
      tabReadyMessage: 'x',
      waitForHydrationMessage: 'x',
      progressMessage: 'x',
      retryMessage: 'x',
      partialSuccessMessage: 'x',
      partialRetrySuccessMessage: 'x',
      responseTimeoutMs: 120000,
      responseIdleTimeoutMs: 25000,
      responseFirstTokenTimeoutMs: 60000,
    };

    const result = await runWebAutomationPrompt('Return JSON', config, {
      promptLabel: 'Prompt',
      warmupDelayMs: 0,
      watchdogPollIntervalMs: 5,
    });

    expect(result.status).toBe('success');
    expect(result.rawText).toContain('final answer');
    expect(result.recoveredByWatchdog).toBe(true);
  });

  it('logs an error when the injected runner returns no result', async () => {
    const { logError } = await import('../../log.js');
    logError.mockClear();
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock.chrome);
    chromeMock.loseNextFrames(1);

    const config = {
      providerLabel: 'Claude',
      scope: 'ClaudeAutomation',
      defaultTargetUrl: 'https://claude.ai/new',
      urlMatchers: ['https://claude.ai/'],
      inputSelectors: ['#composer'],
      sendButtonSelectors: ['#send-button'],
      stopButtonSelectors: ['button[aria-label*="Stop"]'],
      responseBusySelectors: [],
      assistantTextSelectors: ['[data-assistant]'],
      loginSelectors: [],
      authRequiredMessage: 'x',
      openPopupMessage: 'x',
      popupCreatedMessage: 'x',
      waitForTabMessage: 'x',
      tabReadyMessage: 'x',
      waitForHydrationMessage: 'x',
      progressMessage: 'x',
      retryMessage: 'x',
      partialSuccessMessage: 'x',
      partialRetrySuccessMessage: 'x',
      responseTimeoutMs: 120000,
      responseIdleTimeoutMs: 25000,
      responseFirstTokenTimeoutMs: 60000,
    };

    await expect(
      runWebAutomationPrompt('Return JSON', config, {
        promptLabel: 'Prompt',
        warmupDelayMs: 0,
      }),
    ).rejects.toThrow('did not return a result');

    expect(
      logError.mock.calls.some(([, message]) =>
        String(message).includes('returned no result'),
      ),
    ).toBe(true);
  });
});
