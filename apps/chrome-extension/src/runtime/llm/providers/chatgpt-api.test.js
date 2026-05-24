import { afterEach, describe, expect, it, vi } from "vitest";

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
});
