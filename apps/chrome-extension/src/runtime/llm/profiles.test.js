import { describe, expect, it } from "vitest";

import {
  getDefaultLlmSettings,
  mergeLlmSettings,
  resolveLlmStageSettings,
  updateLlmSettings,
} from "./profiles.js";

describe("llm profile settings", () => {
  it("keeps the default Claude web automation target URL on fresh settings", () => {
    const settings = getDefaultLlmSettings();

    expect(settings.profiles["claude:web_automation"].targetUrl).toBe(
      "https://claude.ai/new?incognito",
    );
  });

  it("preserves an explicitly saved Claude web automation target URL", () => {
    const current = getDefaultLlmSettings();
    const updated = updateLlmSettings(current, "claude:web_automation", {
      targetUrl: "https://claude.ai/new",
    });

    const roundTripped = mergeLlmSettings(updated);

    expect(roundTripped.profiles["claude:web_automation"].targetUrl).toBe(
      "https://claude.ai/new",
    );
  });

  it("ships stage-specific API model defaults for ChatGPT, Claude, and DeepSeek", () => {
    const settings = getDefaultLlmSettings();

    expect(settings.profiles["chatgpt:api"].stageModels.prompt1).toMatchObject({
      model: "gpt-5.4-mini",
      reasoning: { effort: "low" },
    });
    expect(settings.profiles["chatgpt:api"].stageModels.prompt2).toMatchObject({
      model: "gpt-5.4",
      reasoning: { effort: "high" },
    });
    expect(settings.profiles["claude:api"].stageModels.prompt2).toMatchObject({
      model: "claude-sonnet-4-6",
      maxTokens: 18000,
      thinking: {
        type: "enabled",
        budget_tokens: 8192,
      },
    });
    expect(settings.profiles["deepseek:api"].stageModels.prompt1).toMatchObject({
      model: "deepseek-v4-pro",
    });
    expect(settings.profiles["deepseek:api"].stageModels.prompt2).toMatchObject({
      model: "deepseek-v4-pro",
    });
    expect(settings.profiles["deepseek:api"].stageModels.prompt3).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: { type: "enabled" },
      reasoning_effort: "medium",
    });
  });

  it("deep-merges saved stage model edits over defaults", () => {
    const settings = mergeLlmSettings({
      profiles: {
        "chatgpt:api": {
          stageModels: {
            prompt2: {
              model: "manual-gpt-model",
            },
          },
        },
      },
    });

    expect(settings.profiles["chatgpt:api"].stageModels.prompt1).toMatchObject({
      model: "gpt-5.4-mini",
      reasoning: { effort: "low" },
    });
    expect(settings.profiles["chatgpt:api"].stageModels.prompt2).toMatchObject({
      model: "manual-gpt-model",
      reasoning: { effort: "high" },
    });
  });

  it("resolves prompt-stage model settings without mutating provider identity", () => {
    const profile = getDefaultLlmSettings().profiles["chatgpt:api"];
    const stageSettings = resolveLlmStageSettings(profile, "prompt2");

    expect(stageSettings).toMatchObject({
      id: "chatgpt:api",
      vendor: "chatgpt",
      mode: "api",
      model: "gpt-5.4",
      reasoning: { effort: "high" },
      promptStage: "prompt2",
    });
  });
});
