import { describe, expect, it } from "vitest";

import { getDefaultLlmSettings, mergeLlmSettings, updateLlmSettings } from "./profiles.js";

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
});
