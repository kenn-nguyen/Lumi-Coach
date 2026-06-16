import { afterEach, describe, expect, it, vi } from "vitest";

import { runGeminiApiPrompt } from "./gemini-api.js";

describe("runGeminiApiPrompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses structured JSON output for prompt stages", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"ok":true}' }],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGeminiApiPrompt('Return {"ok":true}', {
      profile: {
        id: "gemini:api",
        mode: "api",
        apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
        model: "gemini-2.5-flash",
        apiKey: "gemini-test",
      },
      promptLabel: "Prompt 1",
      promptStage: "prompt1",
      systemPrompt: "System guardrails",
    });

    expect(result).toMatchObject({
      status: "success",
      rawText: '{"ok":true}',
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.systemInstruction.parts[0].text).toContain("System guardrails");
    expect(body.systemInstruction.parts[0].text).toContain("JSON");
    expect(body.generationConfig).toEqual({
      responseFormat: {
        text: {
          mimeType: "application/json",
          schema: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    });
  });
});
