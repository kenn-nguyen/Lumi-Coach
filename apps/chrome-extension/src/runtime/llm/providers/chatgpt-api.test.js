import { afterEach, describe, expect, it, vi } from "vitest";

import { getDefaultLlmSettings } from "../profiles.js";
import { runChatGptApiPrompt } from "./chatgpt-api.js";

describe("runChatGptApiPrompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("allows a loopback proxy endpoint without an API key", async () => {
    const fetchMock = vi.fn(async (_url, options = {}) => ({
      ok: true,
      json: async () => ({
        output_text: '{"ok":true}',
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runChatGptApiPrompt('Return {"ok":true}', {
      profile: {
        id: "chatgpt:api",
        mode: "api",
        apiBaseUrl: "http://127.0.0.1:8317/v1/responses",
        model: "gpt-5-mini",
        apiKey: "",
      },
      promptLabel: "Prompt 1",
    });

    expect(result).toMatchObject({
      status: "success",
      rawText: '{"ok":true}',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.authorization).toBeUndefined();
  });

  it("uses prompt-stage model and reasoning settings in the Responses API body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output_text: '{"ok":true}',
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const profile = {
      ...getDefaultLlmSettings().profiles["chatgpt:api"],
      apiKey: "sk-test",
    };

    const result = await runChatGptApiPrompt('Return {"ok":true}', {
      profile,
      promptLabel: "Prompt 2",
      promptStage: "prompt2",
      systemPrompt: "System guardrails",
    });

    expect(result.status).toBe("success");
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.model).toBe("gpt-5.4");
    expect(body.instructions).toContain("System guardrails");
    expect(body.instructions).toContain("JSON");
    expect(body.reasoning).toEqual({
      effort: "high",
    });
    expect(body.input).toBe('Return {"ok":true}');
    expect(body.text).toEqual({
      format: {
        type: "json_object",
      },
    });
  });
});
