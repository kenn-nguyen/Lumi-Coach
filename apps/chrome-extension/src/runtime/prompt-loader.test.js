import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePrompt1Data } from "./validation.js";

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

  it("uses packaged extension prompts instead of server artifacts when prompt source mode is extension", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile2",
      promptDefaultsMode: "extension",
      prompt1TemplateAsset: null,
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "profile2.prompt1.template": "SERVER PROFILE2 TEMPLATE {{JOB_TITLE}}",
        "prompt1.output_contract": "SERVER CONTRACT",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        createFetchResponse(
          withFrontmatter(
            {
              prompt_artifact: "profile2.prompt1.template",
              prompt_version: "v1",
              prompt_label: "packaged-profile2",
            },
            `PACKAGED:${url}`,
          ),
        ),
      ),
    );

    const promptLoader = await import("./prompt-loader.js");
    const result = await promptLoader.loadPromptTemplate("prompt1", {});

    expect(result).toContain("PACKAGED:src/prompts/profiles/profile2/prompt1.txt");
    expect(result).toContain(
      "PACKAGED:src/prompts/patches/prompt1.output-contract.txt",
    );
    expect(result).not.toContain("SERVER PROFILE2 TEMPLATE");
    expect(result).not.toContain("SERVER CONTRACT");
  });

  it("keeps system guardrails shared while allowing profile-scoped system prompt bodies", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile1",
      prompt1TemplateAsset: null,
      systemPromptTemplateAsset: {
        filename: "system-prompt.txt",
        content: "USER SYSTEM PROMPT",
      },
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "system.template": "SERVER SYSTEM BODY",
        "system.guardrails": "SERVER SYSTEM PROMPT",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createFetchResponse("PACKAGED")),
    );

    const promptLoader = await import("./prompt-loader.js");
    const systemPrompt = await promptLoader.renderSystemPromptWithMetadata({}, {});

    expect(systemPrompt.text).toContain("SERVER SYSTEM PROMPT");
    expect(systemPrompt.text).toContain("USER SYSTEM PROMPT");
    expect(systemPrompt.metadata.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactKey: "system.guardrails",
          source: "server",
        }),
        expect.objectContaining({
          artifactKey: "systemPrompt.template",
          source: "user_override",
          filename: "system-prompt.txt",
        }),
      ]),
    );
  });

  it("injects the hiring manager persona extracted from Prompt 1 flex_notes into Prompt 2 templates", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile2",
      prompt2TemplateAsset: null,
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "profile2.prompt2.template":
          "Persona: {{PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES}}\nPrompt1={{PROMPT1_JSON}}",
        "prompt2.output_contract": "SERVER CONTRACT",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createFetchResponse("PACKAGED")),
    );

    const promptLoader = await import("./prompt-loader.js");
    const rendered = await promptLoader.renderPrompt2WithMetadata(
      {
        prompt1Json: {
          target_role: "pm",
          flex_notes:
            "hiring_manager_persona: skeptical identity-platform manager who trusts concrete scale and mechanism proof",
        },
      },
      {},
    );

    expect(rendered.text).toContain(
      "Persona: skeptical identity-platform manager who trusts concrete scale and mechanism proof",
    );
    expect(rendered.text).not.toContain(
      "{{PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES}}",
    );
  });

  it("preserves the Prompt 1 hiring-manager persona after Prompt 1 normalization", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile2",
      prompt2TemplateAsset: null,
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "profile2.prompt2.template":
          "Persona: {{PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES}}\nPrompt1={{PROMPT1_JSON}}",
        "prompt2.output_contract": "SERVER CONTRACT",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createFetchResponse("PACKAGED")),
    );

    const promptLoader = await import("./prompt-loader.js");
    const rendered = await promptLoader.renderPrompt2WithMetadata(
      {
        prompt1Json: normalizePrompt1Data({
          target_role: "pm",
          target_seniority: "senior",
          target_domain: "identity",
          gating_requirements: [],
          high_signal_requirements: [],
          flex_notes:
            "hiring_manager_persona: skeptical identity-platform manager who trusts concrete scale and mechanism proof",
        }),
      },
      {},
    );

    expect(rendered.text).toContain(
      "Persona: skeptical identity-platform manager who trusts concrete scale and mechanism proof",
    );
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
        "profile2.systemPrompt.template": "SERVER SYSTEM BODY",
        "system.guardrails": "SERVER SYSTEM PROMPT",
      },
      manifest: {
        "prompt1.output_contract": "contract-hash",
        "profile2.systemPrompt.template": "system-body-hash",
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
      await promptLoader.renderSystemPromptWithMetadata({}, {});
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
    expect(runMetadata.systemPrompt.artifacts[1]).toMatchObject({
      artifactKey: "profile2.systemPrompt.template",
      hash: "system-body-hash",
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
        "profile1.prompt1.template": withFrontmatter(
          {
            prompt_artifact: "profile1.prompt1.template",
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
          artifactKey: "profile1.prompt1.template",
          promptArtifact: "profile1.prompt1.template",
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

  it("uses profile-scoped server defaults for profile 2 prompt bodies", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile2",
      prompt1TemplateAsset: null,
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "profile2.prompt1.template": withFrontmatter(
          {
            prompt_artifact: "profile2.prompt1.template",
            prompt_version: "v1.0.0",
            prompt_label: "profile2-jd-analysis",
          },
          "PROFILE2 TEMPLATE {{JOB_TITLE}}",
        ),
        "prompt1.output_contract": "SERVER CONTRACT",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createFetchResponse("PACKAGED")),
    );

    const promptLoader = await import("./prompt-loader.js");
    const prompt = await promptLoader.renderPrompt1WithMetadata(
      { jobTitle: "Staff Product Manager" },
      {},
    );

    expect(prompt.text).toContain("PROFILE2 TEMPLATE Staff Product Manager");
    expect(prompt.metadata.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactKey: "profile2.prompt1.template",
          promptLabel: "profile2-jd-analysis",
        }),
        expect.objectContaining({
          artifactKey: "prompt1.output_contract",
        }),
      ]),
    );
  });

  it("does not append the shared Prompt 1 output contract for profile 3", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile3",
      prompt1TemplateAsset: null,
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {},
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).includes("profiles/profile3/prompt1.txt")) {
          return createFetchResponse(
            withFrontmatter(
              {
                prompt_artifact: "profile3.prompt1.template",
                prompt_version: "v1.0.0",
                prompt_label: "lean-jd-ats-hiring-manager-brief",
              },
              "PROFILE3 PROMPT1 {{JOB_TITLE}}",
            ),
          );
        }
        if (String(url).includes("prompt1.output-contract.txt")) {
          return createFetchResponse("SHARED CONTRACT SHOULD NOT APPEAR");
        }
        return createFetchResponse("PACKAGED");
      }),
    );

    const promptLoader = await import("./prompt-loader.js");
    const prompt = await promptLoader.renderPrompt1WithMetadata(
      { jobTitle: "Platform PM" },
      {},
    );

    expect(prompt.text).toContain("PROFILE3 PROMPT1 Platform PM");
    expect(prompt.text).not.toContain("SHARED CONTRACT SHOULD NOT APPEAR");
    expect(prompt.metadata.artifacts).toEqual([
      expect.objectContaining({
        artifactKey: "profile3.prompt1.template",
      }),
    ]);
  });

  it("renders profile 3 freeform prompts with cleaned handoffs and JD context", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile3",
      prompt1TemplateAsset: null,
      prompt2TemplateAsset: null,
      prompt3TemplateAsset: null,
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({
      artifacts: {
        "prompt3.output_contract": "PROMPT3 CONTRACT",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).includes("profiles/profile3/prompt1.txt")) {
          return createFetchResponse(
            withFrontmatter(
              {
                prompt_artifact: "profile3.prompt1.template",
                prompt_version: "v1.1.0",
                prompt_label: "lean-jd-ats-persona-brief",
              },
              [
                "ATS",
                "Hiring manager persona",
                "job={{JOB_TITLE}}",
              ].join("\n"),
            ),
          );
        }
        if (String(url).includes("profiles/profile3/prompt2.txt")) {
          return createFetchResponse(
            withFrontmatter(
              {
                prompt_artifact: "profile3.prompt2.template",
                prompt_version: "v1.1.0",
                prompt_label: "lean-hiring-manager-resume-note",
              },
              [
                "Prompt 1 output:",
                "{{PROMPT1_RESPONSE}}",
                "",
                "You are the hiring manager for this role.",
                "",
                "Current resume:",
                "{{CURRENT_RESUME}}",
                "",
                "Job description:",
                "{{JOB_DESCRIPTION}}",
              ].join("\n"),
            ),
          );
        }
        if (String(url).includes("profiles/profile3/prompt3.txt")) {
          return createFetchResponse(
            withFrontmatter(
              {
                prompt_artifact: "profile3.prompt3.template",
                prompt_version: "v1.1.0",
                prompt_label: "lean-ats-resume-writer",
              },
              [
                "Prompt 1 output:",
                "{{PROMPT1_RESPONSE}}",
                "",
                "Prompt 2 output:",
                "{{PROMPT2_RESPONSE}}",
                "",
                "Job description:",
                "{{JOB_DESCRIPTION}}",
                "",
                "Current resume:",
                "{{CURRENT_RESUME}}",
              ].join("\n"),
            ),
          );
        }
        return createFetchResponse("PACKAGED");
      }),
    );

    const promptLoader = await import("./prompt-loader.js");
    const prompt1 = await promptLoader.renderPrompt1WithMetadata(
      {
        jobTitle: "Platform PM",
      },
      {},
    );
    const prompt2 = await promptLoader.renderPrompt2WithMetadata(
      {
        prompt1Response:
          "ATS\n- identity verification\n\nHiring manager persona\n- Trusts platform metrics",
        currentResume: { personalInfo: { name: "Test" } },
        jobDescriptionRawText: "JD body",
      },
      {},
    );
    const prompt3 = await promptLoader.renderPrompt3WithMetadata(
      {
        prompt1Response:
          "ATS\n- identity verification\n- risk platform\n\nHiring manager persona\n- trusts concrete scale proof",
        prompt2Response:
          "Page-one focus\n- Lead with platform outcomes\n- Keep current role tight",
        jobDescriptionRawText: "JD body",
        currentResume: { personalInfo: { name: "Test" } },
      },
      {},
    );

    expect(prompt1.text).toContain("ATS");
    expect(prompt1.text).toContain("Hiring manager persona");
    expect(prompt2.text).toContain("Trusts platform metrics");
    expect(prompt2.text.indexOf("Prompt 1 output:")).toBeLessThan(
      prompt2.text.indexOf("You are the hiring manager for this role."),
    );
    expect(prompt2.text.indexOf("Current resume:")).toBeLessThan(
      prompt2.text.indexOf("Job description:"),
    );
    expect(prompt2.text).toContain("JD body");
    expect(prompt2.text).not.toContain("PROMPT1_RESPONSE");
    expect(prompt3.text).toContain("identity verification");
    expect(prompt3.text).toContain("Lead with platform outcomes");
    expect(prompt3.text).toContain("Job description:\nJD body");
    expect(prompt3.text).toContain("Current resume:");
    expect(prompt3.text).toContain("PROMPT3 CONTRACT");
    expect(prompt3.text).not.toContain("PROMPT1_RESPONSE");
    expect(prompt3.text).not.toContain("PROMPT2_RESPONSE");
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

  it("loads the profile4 prompt3 template from the profile4 packaged path", async () => {
    getUserAssets.mockResolvedValue({
      activePromptProfileId: "profile4",
      prompt3TemplateAsset: null,
      systemPromptTemplateAsset: null,
    });
    getServerPromptDefaults.mockResolvedValue({ artifacts: {} });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        createFetchResponse(
          String(url).includes("profiles/profile4/prompt3.txt")
            ? "PROFILE4 TEMPLATE {{JOB_DESCRIPTION}} {{CURRENT_RESUME}}"
            : "PACKAGED",
        ),
      ),
    );

    const promptLoader = await import("./prompt-loader.js");
    const rendered = await promptLoader.renderPrompt3WithMetadata(
      {
        jobDescriptionRawText: "JD",
        currentResume: { personalInfo: { name: "T" } },
      },
      {},
    );

    expect(rendered.text).toContain("PROFILE4 TEMPLATE");
  });
});
