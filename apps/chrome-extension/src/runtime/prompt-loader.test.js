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

function withFrontmatter(frontmatter, body) {
  const fields = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return `---\n${fields}\n---\n${body}`;
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
  it("prefers user prompt overrides and uses cached server artifacts for contracts", async () => {
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
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createFetchResponse("PACKAGED")),
    );

    const promptLoader = await import("./prompt-loader.js");
    const result = await promptLoader.loadPromptTemplate("prompt1", {});

    expect(result).toContain("USER PROMPT 1");
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
      vi.fn(async (url) =>
        createFetchResponse(
          withFrontmatter(
            {
              prompt_artifact: "packaged.test",
              prompt_version: "v1",
              prompt_label: "packaged-test",
            },
            `PACKAGED:${url}`,
          ),
        ),
      ),
    );

    const promptLoader = await import("./prompt-loader.js");
    const result = await promptLoader.loadPromptTemplate("prompt2", {});
    const systemPrompt = await promptLoader.loadSystemPromptGuardrails();

    expect(result).toContain("PACKAGED:src/prompts/prompt2.txt");
    expect(result).toContain(
      "PACKAGED:src/prompts/patches/prompt2.output-contract.txt",
    );
    expect(systemPrompt).toBe(
      "PACKAGED:src/prompts/patches/system.guardrails.txt",
    );
    expect(result).not.toContain("prompt_version");
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createFetchResponse("PACKAGED")),
    );

    const promptLoader = await import("./prompt-loader.js");
    const systemPrompt = await promptLoader.loadSystemPromptGuardrails();

    expect(systemPrompt).toBe("SERVER SYSTEM PROMPT");
  });

  it("returns forward-only metadata for the exact prompt artifacts used", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile2",
      prompt1TemplateAsset: {
        filename: "prompt1-v2.txt",
        content: "USER PROMPT {{JOB_TITLE}}",
        uploadedAt: "2026-05-03T00:00:00.000Z",
      },
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "prompt1.output_contract": "SERVER CONTRACT",
        "system.guardrails": "SERVER SYSTEM PROMPT",
      },
      manifest: {
        "prompt1.output_contract": "contract-hash",
        "system.guardrails": "system-hash",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createFetchResponse("PACKAGED")),
    );

    const promptLoader = await import("./prompt-loader.js");
    const prompt = await promptLoader.renderPrompt1WithMetadata(
      { jobTitle: "Product Manager" },
      {
        id: "chatgpt:web_automation",
        label: "ChatGPT Web Automation",
        vendor: "chatgpt",
        mode: "web_automation",
        targetUrl: "https://chatgpt.com/?temporary-chat=true",
      },
    );
    const systemPrompt =
      await promptLoader.loadSystemPromptGuardrailsWithMetadata();
    const runMetadata = await promptLoader.buildPromptRunMetadata({
      profile: {
        id: "chatgpt:web_automation",
        label: "ChatGPT Web Automation",
        vendor: "chatgpt",
        mode: "web_automation",
        targetUrl: "https://chatgpt.com/?temporary-chat=true",
      },
      prompts: {
        prompt1: prompt.metadata,
      },
      systemPrompt: systemPrompt.metadata,
    });

    expect(prompt.text).toContain("USER PROMPT Product Manager");
    expect(prompt.metadata).toMatchObject({
      templateName: "prompt1",
      activePromptProfileId: "profile2",
    });
    expect(prompt.metadata.versionId).toEqual(expect.any(String));
    expect(prompt.metadata.renderedHash).toEqual(expect.any(String));
    expect(prompt.metadata.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactKey: "prompt1.template",
          source: "user_override",
          filename: "prompt1-v2.txt",
          uploadedAt: "2026-05-03T00:00:00.000Z",
        }),
        expect.objectContaining({
          artifactKey: "prompt1.output_contract",
          source: "server",
          hash: "contract-hash",
        }),
      ]),
    );
    expect(runMetadata).toMatchObject({
      schemaVersion: 1,
      provider: {
        id: "chatgpt:web_automation",
        targetUrl: "https://chatgpt.com/?temporary-chat=true",
      },
      prompts: {
        prompt1: prompt.metadata,
      },
    });
    expect(runMetadata.promptSetId).toEqual(expect.any(String));
    expect(runMetadata.systemPrompt.artifacts[0]).toMatchObject({
      artifactKey: "system.guardrails",
      hash: "system-hash",
    });
  });

  it("strips prompt frontmatter from server artifacts and preserves it in metadata", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile1",
      prompt1TemplateAsset: null,
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "prompt1.template": withFrontmatter(
          {
            prompt_artifact: "prompt1.template",
            prompt_version: "v7",
            prompt_label: "jd-analysis-test",
            prompt_notes: "Test prompt metadata.",
            ai_update_notes: "Update this metadata when the prompt changes.",
          },
          "SERVER TEMPLATE {{JOB_TITLE}}",
        ),
        "prompt1.output_contract": withFrontmatter(
          {
            prompt_artifact: "prompt1.output_contract",
            prompt_version: "v3",
            prompt_label: "prompt1-contract",
          },
          "SERVER CONTRACT",
        ),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createFetchResponse("PACKAGED")),
    );

    const promptLoader = await import("./prompt-loader.js");
    const prompt = await promptLoader.renderPrompt1WithMetadata(
      { jobTitle: "Product Manager" },
      {},
    );

    expect(prompt.text).toContain("SERVER TEMPLATE Product Manager");
    expect(prompt.text).toContain("SERVER CONTRACT");
    expect(prompt.text).not.toContain("prompt_version");
    expect(prompt.metadata.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactKey: "prompt1.template",
          promptArtifact: "prompt1.template",
          promptVersion: "v7",
          promptLabel: "jd-analysis-test",
          promptNotes: "Test prompt metadata.",
          aiUpdateNotes: "Update this metadata when the prompt changes.",
          frontmatter: expect.objectContaining({
            prompt_version: "v7",
          }),
        }),
        expect.objectContaining({
          artifactKey: "prompt1.output_contract",
          promptVersion: "v3",
        }),
      ]),
    );
  });

  it("strips prompt frontmatter from user overrides and records the override version", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile1",
      prompt2TemplateAsset: {
        filename: "prompt2-custom.txt",
        uploadedAt: "2026-05-03T00:00:00.000Z",
        content: withFrontmatter(
          {
            prompt_artifact: "prompt2.template",
            prompt_version: "v12",
            prompt_label: "custom-positioning",
            ai_update_notes:
              "Update version metadata when this override changes.",
          },
          "USER TEMPLATE {{PROMPT1_JSON}}",
        ),
      },
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "prompt2.output_contract": "SERVER CONTRACT",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createFetchResponse("")),
    );

    const promptLoader = await import("./prompt-loader.js");
    const prompt = await promptLoader.renderPrompt2WithMetadata(
      { prompt1Json: { target_role: "PM" } },
      {},
    );

    expect(prompt.text).toContain('"target_role": "PM"');
    expect(prompt.text).not.toContain("prompt_version");
    expect(prompt.metadata.artifacts[0]).toMatchObject({
      artifactKey: "prompt2.template",
      source: "user_override",
      filename: "prompt2-custom.txt",
      uploadedAt: "2026-05-03T00:00:00.000Z",
      promptVersion: "v12",
      promptLabel: "custom-positioning",
      aiUpdateNotes: "Update version metadata when this override changes.",
    });
  });
});
