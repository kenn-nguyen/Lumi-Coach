# ChatGPT Popup Speed Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the visible delay before ChatGPT web-automation fills and submits prompts, while keeping the popup unfocused and preserving fresh-context resets between prompt stages.

**Architecture:** Keep the current run-scoped ChatGPT popup/session model. Make the injected runner composer-first instead of send-button-first, remove fixed waits that do not add signal, then hide reset cost behind Prompt 1/2 parsing and Prompt 2/3 rendering. Preserve the current response-completion model of assistant-turn change plus stop-button disappearance plus short text stability. Use event-driven signals whenever possible, reserve slow polling for expensive browser-context probes, and keep faster polling only for short-lived cheap in-page submit-state checks.

**Tech Stack:** Chrome MV3 extension runtime, `chrome.tabs`, `chrome.windows`, `chrome.scripting`, Vitest.

---

### Polling and readiness policy

- [ ] Prefer **event-driven** signals first:
  - `MutationObserver` for composer appearance
  - `MutationObserver` plus text-stability debounce for assistant completion

- [ ] Prefer **in-page DOM checks** over browser-level checks whenever the runner is already injected.

- [ ] Treat `chrome.scripting.executeScript(...)` and repeated `chrome.tabs.get(...)` as **expensive outer probes**:
  - default them to coarse polling, around `300ms` to `500ms`
  - avoid `100ms` outer probing unless measurement proves it is necessary

- [ ] Treat in-page checks like:
  - composer interactivity
  - send button enabled
  - submission-start detection

  as **cheap short-lived checks**:
  - `100ms` to `200ms` is acceptable for composer/send readiness
  - `200ms` to `250ms` is acceptable for submission-start detection

- [ ] Do not move every loop to `500ms` or `1000ms`. That is too slow for the short local transitions around fill and submit.

- [ ] Do not use the stop button as the sole completion signal. Completion remains:
  - new assistant turn exists
  - stop button is gone
  - assistant text is stable for a short debounce window

- [ ] Treat large timeout values as guardrails only, not as the normal timing model. Normal speed should come from earlier signal detection, not from shrinking failure budgets.

### Task 1: Add timing telemetry around the real wait points

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js`
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] Add structured timing logs around:
  - popup created
  - tab reachable
  - startup readiness probe start/end
  - composer found
  - composer interactive
  - fill start/end
  - send-ready start/end
  - pre-submit delay
  - submit start
  - first assistant turn seen
  - response complete

- [ ] Keep the log payload small and consistent:
  - `runId`
  - `promptLabel`
  - `tabId`
  - `elapsedMs`
  - `phase`
  - `probeType`

- [ ] Do not add user-content logging beyond prompt length and existing debug surfaces.

- [ ] Include enough telemetry to distinguish:
  - expensive outer probes
  - in-page readiness loops
  - fixed waits
  so later tuning can slow the right probes without degrading local submit responsiveness.

- [ ] Add or update tests only if the logging change alters public behavior or helper signatures.

- [ ] Run:
  - `cd apps/chrome-extension && /Users/kennng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../frontend/node_modules/vitest/vitest.mjs run --config vitest.config.js src/runtime/chatgpt.test.js`

### Task 2: Fill as soon as the composer is interactive

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js`
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] Change `waitForComposerReady(...)` so it only proves:
  - the composer exists
  - the composer is interactive

- [ ] Stop requiring the send button to be enabled before `fillComposer(...)`.

- [ ] Change the injected runner flow from:
  - `waitForComposer(...)`
  - `waitForComposerReady(...)`
  - `waitForAssistantBaseline(...)`
  - `fillComposer(...)`
  - `submitPrompt(...)`

  to:
  - `waitForComposer(...)`
  - `waitForComposerReady(...)` where “ready” means interactive composer only
  - capture assistant baseline
  - `fillComposer(...)` immediately
  - `waitForSendReady(...)`
  - pre-submit delay
  - submit

- [ ] Preserve current fallbacks:
  - send button path
  - keyboard-submit path when no send button is present

- [ ] Keep completion detection unchanged in this task:
  - new assistant turn
  - stop button gone
  - short stability debounce

- [ ] Do not introduce any new browser-level polling here. This task should move work from outer gating into the already-injected page context.

- [ ] Run:
  - `cd apps/chrome-extension && /Users/kennng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../frontend/node_modules/vitest/vitest.mjs run --config vitest.config.js src/runtime/chatgpt.test.js`

### Task 3: Remove or reduce fixed waits that are not real readiness signals

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js`
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] Replace the fixed `500ms` wait in `waitForAssistantBaseline()` with an immediate snapshot, or at most a single animation-frame delay if a debounce is still needed after real-page validation.

- [ ] Keep the new `400ms` to `800ms` pre-submit jitter in place.

- [ ] Do not shorten the large timeout budgets in this task:
  - `composerWaitTimeoutMs`
  - `composeReadyTimeoutMs`
  - `sendReadyTimeoutMs`
  - response timeouts

- [ ] If a delay is removed, replace it with a signal-based condition, not a shorter fixed sleep.

- [ ] Verify that same-thread repair prompts still baseline correctly against the previous assistant turn without the fixed `500ms` sleep.

- [ ] Run:
  - `cd apps/chrome-extension && /Users/kennng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../frontend/node_modules/vitest/vitest.mjs run --config vitest.config.js src/runtime/chatgpt.test.js`

### Task 4: Overlap reset with local parse/render work

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js`
- Modify: `apps/chrome-extension/src/runtime/orchestrator.js`
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`
- Test: `apps/chrome-extension/src/runtime/orchestrator.test.js`

- [ ] Keep reset between stages as a product requirement.

- [ ] Add a background reset primitive in `apps/chrome-extension/src/runtime/chatgpt.js`, for example:
  - `prepareChatGptRunSessionForNextStage(runId, options = {})`

- [ ] After a validated Prompt 1 success, start reset immediately and do **not** wait for it before:
  - Prompt 1 output parsing
  - Prompt 2 rendering
  - extension-state updates

- [ ] After a validated Prompt 2 success, start reset immediately and do **not** wait for it before:
  - Prompt 2 output parsing
  - Prompt 3 rendering
  - extension-state updates

- [ ] Right before Prompt 2 and Prompt 3 execution, await the in-flight reset only if it has not already completed.

- [ ] Keep repair attempts inside the current thread/session and do not start background reset until a stage is fully accepted.

- [ ] Add tests that prove:
  - a successful stage marks reset in flight immediately
  - the next stage does not start a second reset for the same transition
  - repair attempts still stay in-thread
  - cancel/error cleanup still closes the popup cleanly

- [ ] Run:
  - `cd apps/chrome-extension && /Users/kennng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../frontend/node_modules/vitest/vitest.mjs run --config vitest.config.js src/runtime/chatgpt.test.js src/runtime/orchestrator.test.js`

### Task 5: Stop waiting for full tab completion when the composer is already usable

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js`
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] Keep the popup unfocused.

- [ ] Keep navigation to a fresh temporary-chat URL for reset.

- [ ] Replace strict dependence on:
  - `waitForChatGptTab(...)`
  - `waitForChatGptTabById(...)`

  as the final gate before automation with an earlier readiness path:
  - tab exists
  - script injection succeeds
  - composer probe can run

- [ ] After popup open or reset navigation, begin probing for the composer immediately instead of waiting for `tab.status === "complete"` to become the only gate.

- [ ] Keep the existing startup-readiness probe only as a fallback or observability surface if it still adds value after early composer probing.

- [ ] If browser-level startup probing remains after this task, slow it down to a coarse interval such as `300ms` to `500ms` unless measurements show a real regression.

- [ ] Keep fast checks only inside the injected page context, not in repeated cross-context probes.

- [ ] Add tests that prove:
  - the automation path can proceed when readiness probe succeeds before tab-complete
  - the old timeout/error path still works if the composer never appears

- [ ] Run:
  - `cd apps/chrome-extension && /Users/kennng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../frontend/node_modules/vitest/vitest.mjs run --config vitest.config.js src/runtime/chatgpt.test.js`

### Task 6: Full verification and rollout order

**Files:**
- Verify: `apps/chrome-extension`

- [ ] Implement and verify in this order:
  1. telemetry
  2. early fill
  3. remove fixed baseline wait
  4. background reset overlap
  5. early post-reset probing instead of tab-complete gating

- [ ] After each step, capture before/after timing for:
  - Prompt 1 popup open -> fill start
  - Prompt 2 reset start -> fill start
  - Prompt 3 reset start -> fill start
  - fill start -> submit start
  - first assistant token/turn -> completion

- [ ] Record the poll strategy used after each step:
  - event-driven
  - coarse outer polling
  - fast in-page polling
  so regressions can be tied to the right class of readiness check.

- [ ] Run the focused tests:
  - `cd apps/chrome-extension && /Users/kennng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../frontend/node_modules/vitest/vitest.mjs run --config vitest.config.js src/runtime/chatgpt.test.js src/runtime/orchestrator.test.js`

- [ ] Run the extension suite:
  - `cd apps/chrome-extension && npm test`

- [ ] Manual smoke test with the ChatGPT web profile:
  - prompt 1 opens and fills promptly
  - prompt 2 reset happens while prompt 1 is parsing/rendering
  - prompt 3 reset happens while prompt 2 is parsing/rendering
  - popup remains unfocused
  - the send button may still change to stop-button during streaming
  - completion still waits for assistant text stability after the stop button disappears

### Notes and non-goals

- [ ] Do not remove stage-to-stage reset.
- [ ] Do not change provider behavior for Claude or Gemini.
- [ ] Do not use the stop button alone as the response-complete signal.
- [ ] Do not start by shrinking the large timeout budgets; eliminate redundant fixed waits and duplicated gates first.
- [ ] Do not replace event-driven or cheap in-page checks with blanket `500ms` or `1000ms` polling across the whole flow.
