import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectedProviderPromptEntry } from './web-automation.js';

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
});
