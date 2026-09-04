# ChatGPT "Frame Lost" Recovery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a ChatGPT popup navigation from silently killing a whole tailoring run — wait for the popup's first page load before injecting, recover once when the injected frame is lost anyway, and log the failure as an error.

**Architecture:** Three independent changes to the ChatGPT web-automation driver, in increasing order of risk. (1) `openChatGptSession` waits for the popup's top frame to finish loading before probing/injecting, reusing the existing `waitForTopFrameLoad` helper that today is only wired into the reload paths. (2) The "injected script returned nothing" case becomes a recoverable `frame_lost` status routed through the existing `recoverOrReturn` one-shot retry, instead of a bare `throw` that fails the run and deletes the cloned resume. (3) That case gets a `logError` so it appears in exported logs. A fourth, optional task applies fixes (1) and (3) to the mirrored generic provider used by Claude-web and Gemini-web.

**Tech Stack:** Chrome MV3 extension (service worker), vanilla ES modules, Vitest.

---

## Background: what we are fixing

Two exported log bundles (`2026-08-29T15:12`, `2026-09-03T14:35`) show the identical failure. Abbreviated from the Sep 3 export:

```
14:17:47.547  ChatGptAutomation: Injecting ChatGPT prompt runner   tabId 75461677
14:17:51.554  ChatGptAutomation: prompt runner in progress          phase "submit", tab.status "loading", watcher null
14:17:52.873  ChatGptAutomation: Script execution completed         hasResult: false, status: null, timings: null
14:17:53.346  ResumeApi: Deleting resume fb60bba6…
14:17:53.767  Orchestrator: Discarded uncommitted tailored resume clone   { reason: "failed" }
```

`chrome.scripting.executeScript` resolved with an empty frame result ~5 s after injection while the tab was still `loading`. That is the signature of the injected frame being torn down by a document-level navigation. Root cause: `waitForChatGptTab` (`src/runtime/chatgpt.js:276`) returns as soon as *a tab with a chatgpt.com URL exists* — it never waits for that tab to finish loading — so `openChatGptSession` probes and injects into a document that ChatGPT may still replace.

The codebase already contains the fix, `waitForTopFrameLoad` (`src/runtime/chatgpt.js:321`), whose own comment names this exact symptom ("a readiness probe / prompt inject races against the reload tearing the page down (observed: a refreshed prompt returning no result)"). It is called only from the two reload paths (lines 2043 and 2109), never from the fresh-popup-open path.

Supporting signal — the gap between the `ChatGPT tab reachable` and `Probing ChatGPT startup readiness` log lines (that gap is `installVisibilityKeepAlive`, a MAIN-world `executeScript`, so it stretches when the page is still busy loading):

| Run | Gap | Outcome |
|---|---|---|
| Aug 29 15:10 | 6.0 s | failed |
| Sep 3 14:17 | 3.7 s | failed |
| Sep 3 14:30 | 0.14 s | succeeded |

Three samples is suggestive, not conclusive. **This is why Task 2 matters independently of Task 1:** ChatGPT can also navigate *after* the initial load completes (e.g. committing the conversation URL on submit), which no amount of pre-injection waiting prevents. Task 1 narrows the window; Task 2 is the actual safety net. Do not skip Task 2 on the theory that Task 1 fixed it.

### Blast radius (checked before writing this plan)

- `waitForChatGptTab` is called only from `openChatGptSession` (`src/runtime/chatgpt.js:1943`). Task 1 touches one call site.
- The `popup_closed` / `error_page` statuses never escape `chatgpt.js` — `grep -rn "popup_closed\|error_page" src/` returns hits only inside `chatgpt.js`. `recoverOrReturn` always converts them before returning. The new `frame_lost` status must obey the same rule; Task 2 Step 7 enforces it for the legacy path.
- Safety net if `frame_lost` ever did leak: `orchestrator.js:1813-1821` treats any non-`success` status as a clean failure (`logError` + a thrown message), which is strictly better than today's bare throw. Leaking is undesirable, not catastrophic.
- **Mirrored implementation:** `src/runtime/llm/providers/web-automation.js` has the same two defects — no top-frame-load wait (line 1821) and the same `throw` with no error log (lines 1976-1991). It has no `waitForTopFrameLoad` helper and no `recoverOrReturn` machinery. It serves `claude-web.js` and `gemini-web.js`. Task 4 covers it and is optional.
- `apps/backend` is untouched. No prompt, schema, or UI changes. No extension version bump (per CLAUDE.md rule 7 — these are iterative fixes, not a store release).

### Files

| File | Responsibility | Change |
|---|---|---|
| `apps/chrome-extension/src/runtime/chatgpt.js` | ChatGPT popup driver | Modify (Tasks 1, 2, 3) |
| `apps/chrome-extension/src/runtime/chatgpt.test.js` | Its unit tests | Modify (Tasks 1, 2, 3) |
| `apps/chrome-extension/src/runtime/llm/providers/web-automation.js` | Generic web-automation driver (Claude-web, Gemini-web) | Modify (Task 4, optional) |
| `apps/chrome-extension/src/runtime/llm/providers/web-automation.test.js` | Its unit tests | Modify (Task 4, optional) |

All paths below are relative to the repo root `/Users/kennng/Documents/Lumi`.

### Running the tests

From `apps/chrome-extension`:

```bash
npm test -- src/runtime/chatgpt.test.js
```

The suite uses a hand-rolled `chrome` mock (`createChromeMock`, `chatgpt.test.js:23`). Two mock behaviors matter for this plan:

- `createTab` sets `status: defaultTabStatus`, which defaults to `'complete'`. `setDefaultTabStatus('loading')` overrides it.
- `chrome.windows.create` does **not** fire `webNavigation.onCompleted`; only `chrome.tabs.reload` does (`chatgpt.test.js:119-122`).

Consequence for Task 1: the new wait **must** short-circuit when the tab is already `complete`, or every existing test that opens a popup will hang until the 20 s timeout. That constraint is baked into the implementation below.

---

## Chunk 1: Pre-injection load wait and error visibility

### Task 1: Wait for the popup's top frame to load before probing

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js` (add helper after `waitForTopFrameLoad`, which ends at line 345; call it at line 1943)
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] **Step 1: Write the failing test**

Add inside the `describe('chatgpt run-scoped popup reuse', ...)` block in `apps/chrome-extension/src/runtime/chatgpt.test.js`, immediately after the existing test at line 331:

```js
  it('waits for the popup top frame to finish loading before probing readiness', async () => {
    ensureActiveRun({ runId: 'run-slow-load', phase: 'running', inFlight: true });
    chromeMock.setDefaultTabStatus('loading');

    let settled = false;
    const sessionPromise = getOrOpenChatGptRunSession('run-slow-load', {
      warmupDelayMs: 0,
    }).then((value) => {
      settled = true;
      return value;
    });

    // Let the open path run up to the load wait.
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(
      chromeMock.chrome.scripting.executeScript.mock.calls.some(
        ([request]) => request?.func?.name === 'injectedChatGptReadinessProbe',
      ),
    ).toBe(false);

    chromeMock.completeTopFrameLoad();

    const session = await sessionPromise;
    expect(session.tabId).toBeTruthy();
  });
```

- [ ] **Step 2: Add the `completeTopFrameLoad` helper to the chrome mock**

The mock has no way to fire `webNavigation.onCompleted` for a *newly created* window (only `tabs.reload` fires it). Add the helper.

In `apps/chrome-extension/src/runtime/chatgpt.test.js`, inside `createChromeMock`'s returned object (the block starting at line 178 with `chrome,`), add:

```js
    completeTopFrameLoad(tabId) {
      const targetIds =
        typeof tabId === 'number' ? [tabId] : Array.from(tabsById.keys());
      for (const id of targetIds) {
        const tab = tabsById.get(id);
        if (tab) tab.status = 'complete';
        for (const fn of Array.from(webNavCompletedListeners)) {
          fn({ tabId: id, frameId: 0 });
        }
      }
    },
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test -- src/runtime/chatgpt.test.js -t "waits for the popup top frame"
```

Expected: FAIL. The assertion `expect(settled).toBe(false)` fails because today the session resolves without waiting for any load.

- [ ] **Step 4: Add the load-wait helper**

In `apps/chrome-extension/src/runtime/chatgpt.js`, insert immediately after `waitForTopFrameLoad` ends (after line 345, before `async function closeWindow`):

```js
// Wait for a freshly opened popup's top frame to finish loading. `waitForChatGptTab`
// returns as soon as a chatgpt.com tab EXISTS, which is well before its document is
// done — injecting a prompt runner into that still-loading document lets a later
// navigation tear the frame down, and `executeScript` then resolves with no result
// (observed in the 2026-08-29 and 2026-09-03 log exports: `hasResult: false` while
// `tab.status` was still "loading"). Register the listener BEFORE reading the tab
// status so a load that completes in between cannot be missed. Bounded by a timeout
// so a page that never reports complete can still proceed — the same forgiving
// posture the readiness probe already takes.
async function waitForChatGptTabLoaded(tabId, timeoutMs = 15000) {
  const loaded = waitForTopFrameLoad(tabId, timeoutMs);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.status === 'complete') return true;
  } catch {
    // Tab lookup failed — fall through and let the load wait / timeout settle.
  }
  return loaded;
}
```

Note: `waitForTopFrameLoad` always resolves (never rejects) and cleans up its own listener on both the event and timeout paths, so the early `return true` leaves no leak beyond a pending timer that clears itself.

- [ ] **Step 5: Call it from the open path**

In `apps/chrome-extension/src/runtime/chatgpt.js:1943-1944`, change:

```js
    const tabId = await waitForChatGptTab(popupWindowId);
    logInfo('ChatGptAutomation', 'ChatGPT tab reachable.', { promptLabel, popupWindowId, tabId });
    await installVisibilityKeepAlive(tabId);
```

to:

```js
    const tabId = await waitForChatGptTab(popupWindowId);
    logInfo('ChatGptAutomation', 'ChatGPT tab reachable.', { promptLabel, popupWindowId, tabId });
    // Let the first document finish before probing or injecting; see
    // waitForChatGptTabLoaded for why.
    const topFrameLoaded = await waitForChatGptTabLoaded(tabId);
    if (!topFrameLoaded) {
      logWarn(
        'ChatGptAutomation',
        'ChatGPT popup did not report a finished top-frame load; continuing anyway.',
        { promptLabel, popupWindowId, tabId },
      );
    }
    await installVisibilityKeepAlive(tabId);
```

Confirm `logWarn` is already imported in this module (it is — used at line 2441).

- [ ] **Step 6: Run the new test to verify it passes**

```bash
npm test -- src/runtime/chatgpt.test.js -t "waits for the popup top frame"
```

Expected: PASS.

- [ ] **Step 7: Run the whole file and fix the one test this intentionally breaks**

```bash
npm test -- src/runtime/chatgpt.test.js
```

Expected: the test at line 331, `'opens a reusable session without waiting for tab completion when the page is already reachable'`, now hangs or times out. That test asserts the exact behavior we are deliberately changing — it pins "don't wait for tab completion", which is the bug.

Do **not** delete it. Its underlying intent is still valid: *a tab that never reports complete must not hang the run.* Rewrite it to assert that intent against the new bounded wait:

```js
  it('opens a reusable session even when the page never reports a finished load', async () => {
    vi.useFakeTimers();
    ensureActiveRun({ runId: 'run-loading-tab', phase: 'running', inFlight: true });
    chromeMock.setDefaultTabStatus('loading');

    const sessionPromise = getOrOpenChatGptRunSession('run-loading-tab', {
      warmupDelayMs: 0,
    });

    // No webNavigation.onCompleted ever fires; the bounded wait must give up.
    await vi.advanceTimersByTimeAsync(15000);

    const session = await sessionPromise;
    expect(session.tabId).toBeTruthy();
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 8: Run the full extension suite**

```bash
npm test
```

Expected: all pass. If another test hangs, it is opening a popup with a non-`complete` tab status — apply the same `completeTopFrameLoad()` or fake-timer treatment.

- [ ] **Step 9: Commit**

```bash
git add apps/chrome-extension/src/runtime/chatgpt.js apps/chrome-extension/src/runtime/chatgpt.test.js
git commit -m "fix(extension): wait for ChatGPT popup top-frame load before injecting"
```

---

### Task 3: Log the empty-result failure as an error

> Sequenced before Task 2 on purpose: it is a one-line change with no behavioral risk, and it makes Task 2's new path observable while you build it.

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js:2501-2509`
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

- [ ] **Step 1: Write the failing test**

Add to `apps/chrome-extension/src/runtime/chatgpt.test.js`. This needs the `logError` import spied on. `chatgpt.js:3` imports it from `./log.js` (not `./log-buffer.js`, which supplies `recordRawEmission`). Add the mock at the **top of the file**, next to the existing `fire-gate.js` mock (line 5), so the module registry picks it up:

```js
vi.mock('./log.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, logError: vi.fn(actual.logError) };
});
```

Then the test:

```js
  it('logs an error when the injected runner returns no result', async () => {
    const { logError } = await import('./log.js');
    logError.mockClear();
    ensureActiveRun({ runId: 'run-empty', phase: 'running', inFlight: true });
    // Injected runner resolves with no result — the frame was torn down.
    chromeMock.scriptingResults.push(undefined);

    await runChatGptPrompt('Prompt 1', {
      promptLabel: 'Prompt 1',
      warmupDelayMs: 0,
    }).catch(() => {});

    expect(
      logError.mock.calls.some(([, message]) =>
        String(message).includes('returned no result'),
      ),
    ).toBe(true);
  });
```

Note the mock's `executeScript` uses `scriptingResults.shift() ?? {default success}`, so pushing `undefined` falls through to the default. Instead push a sentinel and make the mock honor it — in `createChromeMock`, change the fallthrough to distinguish "queue empty" from "queued an empty result":

```js
        const nextResult =
          scriptingResults.length > 0
            ? scriptingResults.shift()
            : {
                status: 'success',
                rawText: '{"ok":true}',
                conversationUrl: 'https://chatgpt.com/c/default',
              };
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- src/runtime/chatgpt.test.js -t "logs an error when the injected runner"
```

Expected: FAIL — no `logError` call matches.

- [ ] **Step 3: Add the error log**

In `apps/chrome-extension/src/runtime/chatgpt.js`, replace lines 2501-2509:

```js
  if (!result) {
    if (!tab) {
      return {
        status: 'canceled',
        message: 'Run canceled.',
      };
    }
    throw new Error(`Prompt automation did not return a result. Tab URL: ${tab?.url ?? 'unknown'}`);
  }
```

with:

```js
  if (!result) {
    if (!tab) {
      return {
        status: 'canceled',
        message: 'Run canceled.',
      };
    }
    // The injected runner resolved with nothing — its frame was almost certainly
    // torn down by a navigation mid-run. Log it as an ERROR: before this, two
    // separate failed runs produced log exports containing zero error entries,
    // with the failure visible only as an info-level "Discarded uncommitted
    // tailored resume clone { reason: 'failed' }".
    logError('ChatGptAutomation', 'Prompt automation returned no result (injected frame was lost).', {
      promptLabel,
      tabId: session.tabId,
      tabUrl: tab?.url ?? null,
    });
    throw new Error(`Prompt automation did not return a result. Tab URL: ${tab?.url ?? 'unknown'}`);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- src/runtime/chatgpt.test.js -t "logs an error when the injected runner"
```

Expected: PASS.

- [ ] **Step 5: Run the full file**

```bash
npm test -- src/runtime/chatgpt.test.js
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/chrome-extension/src/runtime/chatgpt.js apps/chrome-extension/src/runtime/chatgpt.test.js
git commit -m "fix(extension): log an error when the ChatGPT prompt runner returns no result"
```

---

## Chunk 2: Recovery

### Task 2: Recover once from a lost frame instead of failing the run

**Files:**
- Modify: `apps/chrome-extension/src/runtime/chatgpt.js` (lines 2501-2515, the `recoverOrReturn` comment at 2769-2770, its body, the status check at 2836, and the legacy path at 2853-2855)
- Test: `apps/chrome-extension/src/runtime/chatgpt.test.js`

**Design.** Today the empty-result case throws, which `runChatGptPrompt` does not catch (only `isPopupClosedError` is caught), so the run dies and the orchestrator deletes the cloned resume. Instead, return a `frame_lost` status and route it through the existing one-shot `recoverOrReturn`.

Recovery action for `frame_lost`: the popup window is still alive and has probably just finished loading a fresh ChatGPT page. So mark the session `needsReset = true` and re-run once — `runReusableChatGptPromptOnce` then calls the already-tested `performChatGptRunSessionReset`, which refreshes the same popup, waits for the top frame via `waitForTopFrameLoad`, re-installs the keep-alive, and waits for readiness. Do **not** reuse the `error_page` path: it does an aggressive cookie purge and a 1-2 s stall that are wrong here.

**Recursion is bounded at exactly one retry** — `recoverOrReturn` returns `runReusableChatGptPromptOnce(...)` directly and its result is never re-checked, matching how `error_page` already behaves.

- [ ] **Step 1: Write the failing test — recovery succeeds**

```js
  it('recovers a run once when the injected frame is lost mid-prompt', async () => {
    ensureActiveRun({ runId: 'run-frame-lost', phase: 'running', inFlight: true });
    // First attempt: frame torn down (no result). Second: succeeds.
    chromeMock.scriptingResults.push(undefined, {
      status: 'success',
      rawText: '{"recovered":true}',
      conversationUrl: 'https://chatgpt.com/c/recovered',
    });

    const result = await runChatGptPrompt('Prompt 1', {
      promptLabel: 'Prompt 1',
      runId: 'run-frame-lost',
      reusePopupSession: true,
      warmupDelayMs: 0,
    });

    expect(result.status).toBe('success');
    expect(result.rawText).toContain('recovered');
    // Recovered by refreshing the SAME popup, not by opening a new one.
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(1);
    expect(chromeMock.chrome.tabs.reload).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Write the failing test — a user cancel is not fought**

This guards the CLAUDE.md rule about never fighting a deliberate user action.

```js
  it('does not retry a lost frame when the user canceled the run', async () => {
    ensureActiveRun({ runId: 'run-frame-cancel', phase: 'running', inFlight: true });
    chromeMock.scriptingResults.push(undefined);

    const runPromise = runChatGptPrompt('Prompt 1', {
      promptLabel: 'Prompt 1',
      runId: 'run-frame-cancel',
      reusePopupSession: true,
      warmupDelayMs: 0,
    });
    await requestActiveRunCancel({ runId: 'run-frame-cancel', reason: 'user' });

    const result = await runPromise.catch((error) => ({
      status: 'threw',
      message: String(error),
    }));
    expect(result.status).toBe('canceled');
    expect(chromeMock.chrome.windows.create).toHaveBeenCalledTimes(1);
  });
```

If the cancel races ahead of the empty result and this proves flaky, use `chromeMock.holdNextTabReload()` to pin the ordering rather than weakening the assertion.

- [ ] **Step 3: Run both tests to verify they fail**

```bash
npm test -- src/runtime/chatgpt.test.js -t "frame"
```

Expected: FAIL — today the empty result throws and neither test's expectation is met.

- [ ] **Step 4: Return `frame_lost` instead of throwing**

In `apps/chrome-extension/src/runtime/chatgpt.js`, in the `if (!result)` block you edited in Task 3, replace the trailing `throw new Error(...)` with:

```js
    return {
      status: 'frame_lost',
      message: 'The ChatGPT page reloaded before the prompt finished.',
    };
```

Keep the `logError` from Task 3 directly above it.

- [ ] **Step 5: Teach `recoverOrReturn` about `frame_lost`**

In `apps/chrome-extension/src/runtime/chatgpt.js`, update the comment at lines 2769-2770:

```js
    // Recover a reusable-popup run by refreshing or reopening the popup and
    // retrying the prompt once. `reason` is 'popup_closed', 'error_page', or
    // 'frame_lost'.
```

Then inside `recoverOrReturn`, add a branch **after** the `wasUserCanceled()` guard and **before** the `popup_closed` branch:

```js
      // The injected runner's frame was torn down by a navigation while the
      // popup itself stayed healthy. Refresh the same popup (which waits for the
      // top frame to load) and run the prompt once more, rather than the
      // error_page path's aggressive cookie purge — nothing here suggests a
      // cookie or network problem.
      if (reason === 'frame_lost') {
        const lostSession = chatGptRunSessions.get(reusableRunId);
        if (lostSession && !(await isPopupWindowGone(lostSession.popupWindowId))) {
          logWarn(
            'ChatGptAutomation',
            'Retrying the prompt after the injected frame was lost.',
            { runId: reusableRunId, promptLabel, tabId: lostSession.tabId },
          );
          lostSession.needsReset = true;
          return runReusableChatGptPromptOnce(prompt, options, reusableRunId);
        }
        // Window is gone — fall through to the reopen path below.
      }
```

- [ ] **Step 6: Add `frame_lost` to the status check**

At `apps/chrome-extension/src/runtime/chatgpt.js:2836`, change:

```js
      if (result.status === 'popup_closed' || result.status === 'error_page') {
```

to:

```js
      if (
        result.status === 'popup_closed' ||
        result.status === 'error_page' ||
        result.status === 'frame_lost'
      ) {
```

- [ ] **Step 7: Keep `frame_lost` from escaping on the legacy path**

The non-reusable branch has no `recoverOrReturn`, and `frame_lost` must never reach the orchestrator (matching how `popup_closed` and `error_page` are contained today). At lines 2853-2855, change:

```js
  try {
    return await runChatGptPromptInExistingSession(prompt, session, options);
  } finally {
    await closeChatGptSession(session);
  }
```

to:

```js
  try {
    const result = await runChatGptPromptInExistingSession(prompt, session, options);
    if (result.status === 'frame_lost') {
      // No reusable session to refresh here, so preserve the pre-existing
      // legacy behavior: surface it as a thrown error.
      throw new Error(`Prompt automation did not return a result. Tab URL: ${session.targetUrl}`);
    }
    return result;
  } finally {
    await closeChatGptSession(session);
  }
```

- [ ] **Step 8: Run both new tests**

```bash
npm test -- src/runtime/chatgpt.test.js -t "frame"
```

Expected: PASS.

- [ ] **Step 9: Run the full extension suite**

```bash
npm test
```

Expected: all pass. Pay particular attention to `'preserves the legacy open-close behavior when popup reuse is disabled'` (line 473) and `'closes a cached popup when the active run is canceled'` (line 490) — Steps 5 and 7 touch both paths.

- [ ] **Step 10: Verify no leak of the new status**

```bash
grep -rn "frame_lost" apps/chrome-extension/src | grep -v "\.test\.js"
```

Expected: hits **only** in `src/runtime/chatgpt.js`. Any hit elsewhere means the status escaped its module.

- [ ] **Step 11: Commit**

```bash
git add apps/chrome-extension/src/runtime/chatgpt.js apps/chrome-extension/src/runtime/chatgpt.test.js
git commit -m "fix(extension): retry once when the ChatGPT injected frame is lost"
```

---

## Chunk 3: Mirror and verification

### Task 4 (OPTIONAL): Apply the same two fixes to the generic web-automation provider

Skip this task if you want the change confined to ChatGPT. Include it to satisfy the CLAUDE.md mirrored-implementations rule.

`src/runtime/llm/providers/web-automation.js` carries the same two defects and serves `claude-web.js` and `gemini-web.js`. It has **no** `waitForTopFrameLoad` helper and **no** `recoverOrReturn` machinery, so port only Task 1 and Task 3 — **not** Task 2.

**Files:**
- Modify: `apps/chrome-extension/src/runtime/llm/providers/web-automation.js` (line 1821; lines 1983-1991)
- Test: `apps/chrome-extension/src/runtime/llm/providers/web-automation.test.js`

- [ ] **Step 1: Read the existing tests for the shape of the mock**

```bash
sed -n 617,740p apps/chrome-extension/src/runtime/llm/providers/web-automation.test.js
```

This file has its own chrome mock, separate from `chatgpt.test.js`. Check whether it stubs `chrome.webNavigation` at all; if not, add it mirroring `chatgpt.test.js:126-131`.

- [ ] **Step 2: Port the load-wait helper**

Copy `waitForTopFrameLoad` and `waitForChatGptTabLoaded` from `chatgpt.js` into `web-automation.js`, renaming the latter to `waitForProviderTabLoaded`. Call it at line 1821, immediately before `await installVisibilityKeepAlive(tabId);`, guarded by the same `logWarn` on timeout using `config.scope`.

If duplication feels wrong, note it and stop — extracting a shared module is a larger refactor than this plan authorizes, and CLAUDE.md's surgical-changes rule says not to broaden scope unasked. Duplicate it, and leave a `// Mirrors waitForChatGptTabLoaded in ../../chatgpt.js` comment on both copies.

- [ ] **Step 3: Port the error log**

At `web-automation.js:1983-1991`, add the `logError` above the existing `throw`, matching Task 3 but using `config.scope` and `config.providerLabel`. Leave the `throw` in place — there is no recovery path here.

- [ ] **Step 4: Add tests mirroring Task 1 Step 1 and Task 3 Step 1**

Adapt them to this file's mock and to `runWebAutomationPrompt`'s signature (`prompt, config, options`).

- [ ] **Step 5: Run the tests**

```bash
npm test -- src/runtime/llm/providers/web-automation.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/chrome-extension/src/runtime/llm/providers/web-automation.js apps/chrome-extension/src/runtime/llm/providers/web-automation.test.js
git commit -m "fix(extension): mirror frame-loss load wait and error log in web-automation provider"
```

---

### Task 5: Full verification

- [ ] **Step 1: Full extension test suite**

```bash
cd apps/chrome-extension && npm test
```

Expected: all pass.

- [ ] **Step 2: Lint and format the frontend**

Per CLAUDE.md rules 3 and 4. The extension has no lint script of its own; run the frontend's, which is what the repo gates on:

```bash
cd apps/frontend && npm run lint && npm run format
```

Expected: clean. If `npm run format` rewrites files outside `apps/chrome-extension`, revert those — they are unrelated churn.

- [ ] **Step 3: Confirm no version bump crept in**

```bash
git diff main --stat -- apps/chrome-extension/manifest.json
```

Expected: **empty**. Per CLAUDE.md rule 7, these iterative fixes must not bump the extension version.

- [ ] **Step 4: Manual smoke test against real ChatGPT**

Automated tests cannot reproduce a real mid-load navigation. Load the unpacked extension, then:

1. Run a normal tailoring job end to end. Expected: unchanged behavior, and the `ChatGPT tab reachable` → `Probing ChatGPT startup readiness` gap in the exported log should now be small, because the load wait absorbs it.
2. Force the failure: start a run, and the instant the ChatGPT popup appears, press <kbd>Cmd</kbd>+<kbd>R</kbd> in it to reload mid-submit. Expected: the log shows `Prompt automation returned no result (injected frame was lost)` at **error** level, then `Retrying the prompt after the injected frame was lost`, and the run **completes** rather than discarding the clone.
3. Cancel test: repeat (2) but hit Stop in the extension before the retry fires. Expected: the run ends `canceled` and **no** new popup opens.

- [ ] **Step 5: Export logs and confirm the failure is now visible**

Use the extension's Export Logs button after test (2). Confirm the export contains at least one `"level": "error"` entry — the two exports that motivated this work contained none.

---

## Definition of Done

- [ ] `npm test` passes in `apps/chrome-extension`
- [ ] `npm run lint` and `npm run format` pass in `apps/frontend`
- [ ] `grep -rn "frame_lost" apps/chrome-extension/src | grep -v "\.test\.js"` returns hits only in `chatgpt.js`
- [ ] `apps/chrome-extension/manifest.json` is unchanged
- [ ] Manual smoke test 2 shows a recovered run with an error-level log entry
- [ ] Manual smoke test 3 shows a user cancel is not overridden by the retry
