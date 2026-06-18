# ChatGPT Popup Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse a single ChatGPT web-automation popup across Prompt 1, Prompt 2, and Prompt 3 for one tailoring run, while preserving the existing prompt-stage behavior and keeping Claude/Gemini untouched.

**Architecture:** Keep the current prompt pipeline intact. Add run-scoped ChatGPT session management in `chatgpt.js`, then have the orchestrator explicitly reset the same ChatGPT tab to a fresh temporary chat after each validated stage. Repairs stay in-thread for the current stage; stage-to-stage context remains isolated by tab re-navigation, not by opening new popups.

**Tech Stack:** Chrome MV3 extension, background/service-worker runtime, `chrome.tabs`, `chrome.windows`, Vitest.

---

### Task 1: Add run-scoped ChatGPT session primitives

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js`
- Create: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] Add failing tests for a run-scoped ChatGPT session cache:
  - opening a session twice with the same `runId` reuses the same popup/tab
  - different `runId` values create separate sessions
  - closing a cached session removes it from the cache

- [ ] Add internal session storage in `apps/chrome-extension/src/runtime/chatgpt.js`, keyed by `runId`, and keep it private to the ChatGPT runner.

- [ ] Add these helpers in `apps/chrome-extension/src/runtime/chatgpt.js`:
  - `getOrOpenChatGptRunSession(runId, options = {})`
  - `closeChatGptRunSession(runId)`
  - `resetChatGptRunSession(runId, options = {})`

- [ ] Keep the existing `openChatGptSession(...)` logic as the low-level constructor for a fresh popup. The new cache layer should call it, not replace it.

- [ ] Run:
  - `cd apps/chrome-extension && npm test -- chatgpt.test.js`

### Task 2: Separate “run prompt in existing session” from “open and close around one prompt”

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js`
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] Refactor `runChatGptPrompt(...)` so the prompt execution path can accept an already-open session instead of always calling `openChatGptSession(...)`.

- [ ] Keep `executeChatGptPromptInSession(...)` and `runChatGptPromptWithRetryInSession(...)` as the core per-stage logic.

- [ ] Preserve current behavior for all callers that do not opt into session reuse:
  - open popup
  - run prompt
  - repair if needed
  - close popup

- [ ] Add an explicit session-aware path, for example:
  - `runChatGptPrompt(prompt, { chatGptSession, ...options })`
  - or `runChatGptPromptInRunSession(runId, prompt, options)`

- [ ] Add tests that prove:
  - a repair prompt stays in the same ChatGPT thread/session
  - the session-aware path does not auto-close the popup after one prompt
  - the legacy path still auto-closes when no reusable session is provided

- [ ] Run:
  - `cd apps/chrome-extension && npm test -- chatgpt.test.js`

### Task 3: Add same-tab reset to fresh temporary chat

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js`
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] Add a reset helper that reuses the same ChatGPT tab by navigating it to a fresh temporary-chat URL with a new `rm_run` query value.

- [ ] Implement reset with `chrome.tabs.update(tabId, { url })`, then wait for:
  - tab completion
  - existing hydration delay

- [ ] Do not use `chrome.tabs.reload()` for stage isolation. The implementation should navigate to a fresh temporary-chat URL instead.

- [ ] Add tests that prove:
  - reset reuses the same `tabId`
  - reset changes the URL
  - reset waits for tab readiness before the next prompt begins

- [ ] Run:
  - `cd apps/chrome-extension && npm test -- chatgpt.test.js`

### Task 4: Wire the orchestrator to open once, reset between validated stages, and close once

**Files:**
- Modify: `apps/chrome-extension/src/runtime/orchestrator.js`
- Test: `apps/chrome-extension/src/runtime/orchestrator.test.js`

- [ ] In the tailoring flow, detect `activeLlmProfile.id === "chatgpt:web_automation"` before Prompt 1 starts.

- [ ] For ChatGPT web runs only:
  - open or claim the reusable ChatGPT run session before Prompt 1
  - pass that session into Prompt 1, Prompt 2, and Prompt 3 calls

- [ ] After **validated success** for Prompt 1:
  - after `prompt1Run.status === "success"`
  - after `prompt1Run.validationError` is clear
  - after `extractJsonFromText(...)` succeeds
  - call `resetChatGptRunSession(runId, ...)`

- [ ] After **validated success** for Prompt 2:
  - after `prompt2Run.status === "success"`
  - after `prompt2Run.validationError` is clear
  - after `extractJsonFromText(...)` succeeds
  - call `resetChatGptRunSession(runId, ...)`

- [ ] Do **not** reset:
  - before repair attempts
  - after failed validation
  - after canceled runs
  - after Prompt 3

- [ ] Close the reusable ChatGPT popup in a `finally` block around the Prompt 1/2/3 path so cleanup happens on:
  - success
  - thrown error
  - cancel

- [ ] Keep all non-ChatGPT providers on their existing paths. Claude and Gemini must continue using `runWebAutomationPrompt(...)` unchanged.

- [ ] Add orchestrator tests that prove:
  - ChatGPT web profile triggers two resets across three prompt stages
  - Claude/Gemini profiles do not call the ChatGPT session helpers
  - failure in Prompt 1 or Prompt 2 closes the cached popup and skips later resets

- [ ] Run:
  - `cd apps/chrome-extension && npm test -- orchestrator.test.js chatgpt.test.js`

### Task 5: Preserve cancel and stale-run cleanup semantics

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js`
- Modify: `apps/chrome-extension/src/runtime/run-control.test.js`
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] Make sure the cached ChatGPT session still registers with `registerRunCleanup(...)` so `requestActiveRunCancel(...)` closes the popup during cancel.

- [ ] Ensure cache cleanup is idempotent:
  - close on cancel
  - close on normal finish
  - close on thrown error
  - no double-close crashes

- [ ] Add regression tests for:
  - canceling a run with a cached ChatGPT session closes the popup
  - stale cached sessions are removed after cleanup

- [ ] Run:
  - `cd apps/chrome-extension && npm test -- run-control.test.js chatgpt.test.js`

### Task 6: Full extension verification

**Files:**
- Verify: `apps/chrome-extension`

- [ ] Run the full extension test suite:
  - `cd apps/chrome-extension && npm test`

- [ ] Manual smoke test with the `ChatGPT Web Automation` profile:
  - start one LinkedIn tailoring run
  - verify only one ChatGPT popup opens
  - verify Prompt 1 repair, if triggered, stays in the same thread
  - verify the tab navigates to a fresh temporary chat before Prompt 2
  - verify the tab navigates to a fresh temporary chat before Prompt 3
  - verify the popup closes once at the end of the full run

- [ ] Manual regression checks:
  - Claude web automation still opens/closes per prompt as before
  - Gemini web automation still opens/closes per prompt as before
  - API profiles are unaffected

### Notes and non-goals

- [ ] Do not change timeout values in this plan.
- [ ] Do not change retry policy in this plan.
- [ ] Do not refactor Claude or Gemini onto the ChatGPT implementation path.
- [ ] Do not change prompt contracts, validation rules, or repair prompt content.
