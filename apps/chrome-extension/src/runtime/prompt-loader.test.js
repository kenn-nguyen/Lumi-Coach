import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserAssets = vi.fn();
const getServerPromptDefaults = vi.fn();

vi.mock("./storage.js", () => ({
  getUserAssets,
  getServerPromptDefaults,
}));

function createFetchResponse(body) {
  return {
    ok: true,
    text: vi.fn(async () => body),
  };
}

beforeEach(() => {
  vi.resetModules();
  getUserAssets.mockReset();
  getServerPromptDefaults.mockReset();
  vi.stubGlobal("chrome", {
    runtime: {
      getURL: vi.fn((path) => path),
    },
  });
});

describe("prompt-loader", () => {
  it("prefers user prompt overrides and uses cached server artifacts for contracts and patches", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile1",
      prompt1TemplateAsset: {
        content: "USER PROMPT 1",
      },
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "prompt1.output_contract": "SERVER CONTRACT",
        "prompt1.patch.chatgpt-web": "SERVER PATCH",
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => createFetchResponse("PACKAGED")));

    const promptLoader = await import("./prompt-loader.js");
    const result = await promptLoader.loadPromptTemplate("prompt1", {
      patchKey: "chatgpt-web",
    });

    expect(result).toContain("USER PROMPT 1");
    expect(result).toContain("SERVER PATCH");
    expect(result).toContain("SERVER CONTRACT");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to packaged artifacts when the server cache is missing pieces", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile1",
      prompt2TemplateAsset: null,
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {},
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => createFetchResponse(`PACKAGED:${url}`)),
    );

    const promptLoader = await import("./prompt-loader.js");
    const result = await promptLoader.loadPromptTemplate("prompt2", {
      patchKey: "claude-api",
    });
    const systemPrompt = await promptLoader.loadSystemPromptGuardrails();

    expect(result).toContain("PACKAGED:src/prompts/prompt2.txt");
    expect(result).toContain(
      "PACKAGED:src/prompts/patches/prompt2.claude-api.txt",
    );
    expect(result).toContain(
      "PACKAGED:src/prompts/patches/prompt2.output-contract.txt",
    );
    expect(systemPrompt).toBe("PACKAGED:src/prompts/patches/system.guardrails.txt");
  });

  it("ignores user system prompt overrides and keeps system guardrails server-managed", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile1",
      prompt1TemplateAsset: null,
      systemPromptTemplateAsset: {
        content: "USER SYSTEM PROMPT",
      },
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "system.guardrails": "SERVER SYSTEM PROMPT",
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => createFetchResponse("PACKAGED")));

    const promptLoader = await import("./prompt-loader.js");
    const systemPrompt = await promptLoader.loadSystemPromptGuardrails();

    expect(systemPrompt).toBe("SERVER SYSTEM PROMPT");
  });
});
