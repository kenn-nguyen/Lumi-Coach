import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  injectedChatGptPromptEntry,
  injectedVisibilityKeepAlive,
} from "./chatgpt.js";

// Runs the in-page ChatGPT watcher against markup captured from the live site,
// so a ChatGPT DOM change shows up here instead of as an empty-response run.
const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures",
);
const readFixture = (name) =>
  fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");

// Captured 2026-09-26 from chatgpt.com (signed-out temporary chat) for the
// prompt below: the assistant <li> mid-stream and after completion.
const STREAMING_MESSAGE = readFixture(
  "chatgpt-assistant-message-2026-09.streaming.html",
);
const COMPLETE_MESSAGE = readFixture("chatgpt-assistant-message-2026-09.html");
// Captured 2026-09-27 from a signed-in Plus account (attribute values trimmed):
// the finished turn, user message + assistant reply + its action bar.
const PLUS_TURN = readFixture("chatgpt-assistant-turn-plus-2026-09.html");
// Mid-stream: partial reply and no action bar yet ("Regenerate response"
// only appears once the reply is finished).
const plusStreaming = (html) =>
  html
    .replace(":[1,2,3]<span>}</span>", ":[1,2")
    .replace(
      /<button[^>]*aria-label="Regenerate response"[^>]*><\/button>/,
      "",
    );
const PROMPT =
  'Reply with exactly this JSON and nothing else: {"probe":"LUMI_PROBE_OK","items":[1,2,3]}';
const EXPECTED = '{"probe":"LUMI_PROBE_OK","items":[1,2,3]}';

const WATCHER_OPTIONS = {
  responseTimeoutMs: 60000,
  responseIdleTimeoutMs: 60000,
  responseFirstTokenTimeoutMs: 60000,
  composeReadyTimeoutMs: 1000,
  sendReadyTimeoutMs: 1000,
  preSubmitDelayMinMs: 0,
  preSubmitDelayMaxMs: 0,
};

// Mirrors the live composer: a textarea in a form whose submit button flips its
// aria-label between "Send message" and "Stop generating".
function mountChatGptShell() {
  document.body.innerHTML = `
    <main>
      <ol aria-label="Conversation" data-conversation-transcript=""></ol>
      <form action="/unauth-mweb/conversation" method="post">
        <textarea name="prompt" placeholder="Ask ChatGPT" aria-label="Chat with ChatGPT"></textarea>
        <button type="submit" aria-label="Send message" data-composer-submit="">Send</button>
      </form>
    </main>
  `;
  return {
    transcript: document.querySelector("[data-conversation-transcript]"),
    composer: document.querySelector("textarea"),
    submit: document.querySelector("button[data-composer-submit]"),
  };
}

// Submitting starts generation: Stop label on, user turn + first assistant
// markup appended. Returns a function that finishes generation with `finalHtml`.
function simulateGeneration(
  { transcript, composer, submit },
  streamingHtml,
  finalHtml,
) {
  submit.addEventListener("click", (event) => {
    event.preventDefault();
    composer.value = "";
    submit.setAttribute("aria-label", "Stop generating");
    transcript.insertAdjacentHTML(
      "beforeend",
      `<li data-message-role="user" id="user-1"><p>${PROMPT}</p></li>${streamingHtml}`,
    );
  });
  return () => {
    transcript.lastElementChild.outerHTML = finalHtml;
    submit.setAttribute("aria-label", "Send message");
  };
}

async function runPrompt(finish) {
  let result = null;
  injectedChatGptPromptEntry(PROMPT, WATCHER_OPTIONS).then((value) => {
    result = value;
  });
  // Submit and let a few watcher ticks see the Stop button while streaming.
  await vi.advanceTimersByTimeAsync(3000);
  const settledWhileStreaming = result !== null;
  finish();
  await vi.advanceTimersByTimeAsync(5000);
  return { result, settledWhileStreaming };
}

describe("injectedChatGptPromptEntry against captured ChatGPT markup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({
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
      }),
    );
    // jsdom has no layout; treat anything not [hidden] as visible.
    HTMLElement.prototype.checkVisibility = function checkVisibility() {
      return !this.closest("[hidden]");
    };
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback) => setTimeout(() => callback(0), 0)),
    );
  });

  afterEach(() => {
    delete HTMLElement.prototype.checkVisibility;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("reads the reply from the current (Sept 2026) assistant message markup", async () => {
    const shell = mountChatGptShell();
    const finish = simulateGeneration(
      shell,
      STREAMING_MESSAGE,
      COMPLETE_MESSAGE,
    );

    const { result, settledWhileStreaming } = await runPrompt(finish);

    expect(settledWhileStreaming).toBe(false);
    expect(result).toMatchObject({ status: "success", rawText: EXPECTED });
  });

  it("recovers the reply via the lenient scrape when the text selectors miss", async () => {
    // Simulate the next drift: the markdown wrapper loses the attribute the
    // primary selector keys on. Only the lenient scrape can still find it.
    const drift = (html) =>
      html.replaceAll('data-assistant-markdown=""', 'data-assistant-body=""');
    const shell = mountChatGptShell();
    const finish = simulateGeneration(
      shell,
      drift(STREAMING_MESSAGE),
      drift(COMPLETE_MESSAGE),
    );

    const { result } = await runPrompt(finish);

    expect(result).toMatchObject({ status: "success", rawText: EXPECTED });
  });

  it("reads the reply from the paid-account (Plus) markup", async () => {
    // Finishing shows "Regenerate response", which the watcher also treats as a
    // failure signal when it has seen no text — so this only passes if the
    // reply text is found before that button appears.
    const shell = mountChatGptShell();
    const finish = simulateGeneration(
      shell,
      plusStreaming(PLUS_TURN),
      PLUS_TURN,
    );

    const { result, settledWhileStreaming } = await runPrompt(finish);

    expect(settledWhileStreaming).toBe(false);
    expect(result).toMatchObject({ status: "success", rawText: EXPECTED });
    // "Regenerate response" on a finished reply is not an error. The background
    // poll's hidden-popup backstop only runs while hasError is false.
    expect(window.__rmWatcherState.hasError).toBe(false);
  });

  it("returns the new reply for a follow-up in the same Plus thread", async () => {
    // Repair prompts are sent into the same chat, so a finished reply (with its
    // Regenerate button) is already on the page. The watcher must wait for and
    // return the second reply, not resolve with the first.
    const FOLLOWUP = '{"probe":"FOLLOWUP_OK","turn":2}';
    const secondTurn = (text) =>
      PLUS_TURN.replaceAll(
        "65643bf9-bc8d-4077-b7c0-ec7bbe93d496",
        "second-reply-id",
      ).replace(
        '<span>{"probe":"LUMI_PROBE_OK","items"</span>:[1,2,3]<span>}</span>',
        text,
      );
    const shell = mountChatGptShell();
    shell.transcript.insertAdjacentHTML("beforeend", PLUS_TURN);
    const finish = simulateGeneration(
      shell,
      plusStreaming(secondTurn('{"probe":')),
      secondTurn(FOLLOWUP),
    );

    const { result, settledWhileStreaming } = await runPrompt(finish);

    expect(settledWhileStreaming).toBe(false);
    expect(result).toMatchObject({ status: "success", rawText: FOLLOWUP });
  });

  it("recovers the Plus reply via the lenient scrape, not its role heading", async () => {
    // The only element Plus marks "assistant" is <h4>ChatGPT said:</h4>. With
    // the body selector gone, the lenient scrape must read the message the
    // heading belongs to — 0.4.5 returned the heading text as the answer.
    const drift = (html) =>
      html.replaceAll(
        'data-markdown-text-style="assistant-message"',
        'data-markdown-text-style="assistant-body"',
      );
    const shell = mountChatGptShell();
    const finish = simulateGeneration(
      shell,
      drift(plusStreaming(PLUS_TURN)),
      drift(PLUS_TURN),
    );

    const { result } = await runPrompt(finish);

    expect(result).toMatchObject({ status: "success", rawText: EXPECTED });
  });

  it("never returns the Plus role heading as the answer when the body is missing", async () => {
    const headingOnly = PLUS_TURN.replace(/<p dir="auto">.*?<\/p>/, "");
    const shell = mountChatGptShell();
    const finish = simulateGeneration(shell, headingOnly, headingOnly);

    const { result } = await runPrompt(finish);

    expect(result.status).toBe("dom_changed");
    expect(result.rawText).toBeUndefined();
    expect(result.partialRawText ?? "").not.toContain("said:");
    // A turn with Regenerate but no reply text is a real error state.
    expect(result.message).toContain("error state detected");
  });

  it("still reads the older data-message-author-role markup", async () => {
    const legacy = (text) =>
      `<article data-testid="conversation-turn-2"><h6 class="sr-only">ChatGPT said:</h6>` +
      `<div data-message-author-role="assistant"><div class="markdown prose"><p>${text}</p></div></div></article>`;
    const shell = mountChatGptShell();
    const finish = simulateGeneration(
      shell,
      legacy('{"probe":'),
      legacy(EXPECTED),
    );

    const { result } = await runPrompt(finish);

    expect(result).toMatchObject({ status: "success", rawText: EXPECTED });
  });
});

describe("injectedVisibilityKeepAlive status", () => {
  const SPOOFED = [
    "hidden",
    "visibilityState",
    "webkitHidden",
    "webkitVisibilityState",
    "hasFocus",
  ];

  beforeEach(() => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    // Undo the MAIN-world spoofing so it can't leak into other tests.
    for (const prop of SPOOFED) delete document[prop];
    delete window.__rmVisibilityKeepAlive;
    delete window.__rmVisibilityKeepAliveRaf;
    vi.unstubAllGlobals();
  });

  it("reports a fresh install, then already_active on the same document", () => {
    // A document that reloaded has no flag -> "installed" is what a log shows
    // when the keep-alive had been lost before the prompt.
    expect(injectedVisibilityKeepAlive()).toEqual({
      status: "installed",
      rafShim: true,
      hidden: false,
    });
    expect(injectedVisibilityKeepAlive()).toEqual({
      status: "already_active",
      rafShim: true,
      hidden: false,
    });
  });

  it("reports the real hidden state, not the value it spoofs", () => {
    injectedVisibilityKeepAlive();
    const realHidden = vi
      .spyOn(Document.prototype, "hidden", "get")
      .mockReturnValue(true);

    expect(document.hidden).toBe(false);
    expect(injectedVisibilityKeepAlive()).toMatchObject({
      status: "already_active",
      hidden: true,
    });
    realHidden.mockRestore();
  });
});
