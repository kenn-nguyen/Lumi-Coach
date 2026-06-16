import { afterEach, describe, expect, it, vi } from "vitest";

import { getDefaultLlmSettings } from "../profiles.js";
import { runClaudeApiPrompt } from "./claude-api.js";

describe("runClaudeApiPrompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses prompt-stage model, thinking, and cache-control blocks", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"ok":true}' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const profile = {
      ...getDefaultLlmSettings().profiles["claude:api"],
      apiKey: "claude-test",
    };

    const result = await runClaudeApiPrompt('Return {"ok":true}', {
      profile,
      promptLabel: "Prompt 2",
      promptStage: "prompt2",
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
    });
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.thinking).toEqual({
      type: "enabled",
      budget_tokens: 8192,
    });
    expect(body.max_tokens).toBe(18000);
    expect(body.output_config).toEqual({
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: true,
        },
      },
    });
    expect(body.system).toEqual([
      expect.objectContaining({
        type: "text",
        cache_control: { type: "ephemeral" },
      }),
    ]);
    expect(body.system[0].text).toContain("System guardrails");
    expect(body.system[0].text).toContain("JSON");
    expect(body.messages[0].content).toEqual([
      {
        type: "text",
        text: "Static prompt instructions",
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: "Dynamic Prompt 1 JSON",
      },
      {
        type: "text",
        text: "Master resume text",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("does not enable thinking for Prompt 1 by default", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"ok":true}' }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const profile = {
      ...getDefaultLlmSettings().profiles["claude:api"],
      apiKey: "claude-test",
    };

    await runClaudeApiPrompt('Return {"ok":true}', {
      profile,
      promptLabel: "Prompt 1",
      promptStage: "prompt1",
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.thinking).toBeUndefined();
    expect(body.max_tokens).toBe(4096);
  });
});
