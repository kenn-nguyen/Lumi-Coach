import { afterEach, describe, expect, it, vi } from "vitest";

import { getDefaultLlmSettings } from "../profiles.js";
import { runDeepSeekApiPrompt } from "./deepseek-api.js";

describe("runDeepSeekApiPrompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses prompt-stage model, thinking, reasoning effort, and stable-prefix input ordering", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "deepseek-response-1",
        choices: [
          {
            message: {
              content: '{"ok":true}',
            },
          },
        ],
        usage: {
          prompt_cache_hit_tokens: 100,
          prompt_cache_miss_tokens: 20,
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const profile = {
      ...getDefaultLlmSettings().profiles["deepseek:api"],
      apiKey: "deepseek-test",
    };

    const result = await runDeepSeekApiPrompt("Original prompt order", {
      profile,
      promptLabel: "Prompt 3",
      promptStage: "prompt3",
      systemPrompt: "System guardrails",
      apiPromptBlocks: [
        { text: "Static prompt instructions", cacheable: true },
        { text: "Dynamic Prompt 1 JSON", cacheable: false },
        { text: "Master resume text", cacheable: true },
      ],
    });

    expect(result).toMatchObject({
      status: "success",
      rawText: '{"ok":true}',
      responseId: "deepseek-response-1",
      usage: {
        prompt_cache_hit_tokens: 100,
        prompt_cache_miss_tokens: 20,
      },
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(options.headers.authorization).toBe("Bearer deepseek-test");
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: { type: "enabled" },
      reasoning_effort: "medium",
      response_format: { type: "json_object" },
      stream: false,
    });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("System guardrails");
    expect(body.messages[0].content).toContain("JSON");
    expect(body.messages[1]).toEqual({
      role: "user",
      content:
        "Static prompt instructions\n\nMaster resume text\n\nDynamic Prompt 1 JSON",
    });
  });

  it("allows a loopback proxy endpoint without an API key", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runDeepSeekApiPrompt('Return {"ok":true}', {
      profile: {
        id: "deepseek:api",
        mode: "api",
        apiBaseUrl: "http://127.0.0.1:8318/chat/completions",
        model: "deepseek-v4-pro",
        apiKey: "",
      },
      promptLabel: "Prompt 1",
    });

    expect(result).toMatchObject({
      status: "success",
      rawText: '{"ok":true}',
    });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.authorization).toBeUndefined();
  });
});
