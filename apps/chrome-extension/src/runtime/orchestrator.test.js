import { describe, expect, it } from "vitest";

import {
  getMasterResumeImportProviderIssue,
  getPrompt4ResumeRejectionMessage,
  prefixGenerationFeedbackSummary,
  preserveGeneratedResumeFacts,
  shouldAcceptLocalSnapshot,
  stripPromptFlexNotesFromServerArtifact,
} from "./orchestrator.js";

describe("shouldAcceptLocalSnapshot", () => {
  it("accepts a high-confidence local snapshot when the guardrail passes", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          rawText: "A".repeat(400),
          quality: {
            confidence: "high",
            descriptionLength: 400,
            looksTruncated: false,
          },
        },
        guardrail: {
          is_job_description: true,
        },
      }),
    ).toBe(true);
  });

  it("accepts a medium-confidence local snapshot when the JD is long enough", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          rawText: "A".repeat(1600),
          quality: {
            confidence: "medium",
            descriptionLength: 1600,
            looksTruncated: false,
          },
        },
        guardrail: {
          is_job_description: true,
          confidence: "medium",
        },
      }),
    ).toBe(true);
  });

  it("rejects a medium-confidence local snapshot when the JD is too short for the guardrail confidence", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          rawText: "A".repeat(700),
          quality: {
            confidence: "medium",
            descriptionLength: 700,
            looksTruncated: false,
          },
        },
        guardrail: {
          is_job_description: true,
          confidence: "high",
        },
      }),
    ).toBe(false);
  });

  it("accepts a medium-confidence local snapshot even when it looks truncated if it is long enough", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          rawText: "A".repeat(1800),
          quality: {
            confidence: "medium",
            descriptionLength: 1800,
            looksTruncated: true,
          },
        },
        guardrail: {
          is_job_description: true,
          confidence: "medium",
        },
      }),
    ).toBe(true);
  });

  it("accepts a shorter medium-confidence local snapshot when the guardrail confidence is high", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          rawText: "A".repeat(950),
          quality: {
            confidence: "medium",
            descriptionLength: 950,
            looksTruncated: true,
          },
        },
        guardrail: {
          is_job_description: true,
          confidence: "high",
        },
      }),
    ).toBe(true);
  });

  it("accepts a guardrail-valid snapshot when the adapter already marked it full_jd_ready", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          readiness: "full_jd_ready",
          rawText: "A".repeat(2012),
          quality: {
            confidence: "medium",
            descriptionLength: 2012,
            looksTruncated: true,
          },
        },
        guardrail: {
          is_job_description: true,
          confidence: "high",
        },
      }),
    ).toBe(true);
  });
});

describe("preserveGeneratedResumeFacts", () => {
  it("preserves work experience website values from the master resume", () => {
    const masterResume = {
      personalInfo: {},
      workExperience: [
        {
          id: 1,
          title: "Product Manager",
          company: "Amazon",
          location: "Seattle, WA",
          context: "Seller services marketplace",
          website: "https://amazon.com/seller-services",
          years: "2021 - Present",
          description: ["Launched seller-facing workflows"],
        },
      ],
    };
    const generatedResume = {
      personalInfo: {},
      workExperience: [
        {
          id: 1,
          title: "Tailored Product Manager",
          company: "Amazon",
          location: "Seattle, WA",
          context: "Seller services marketplace",
          website: "https://example.com/incorrect",
          years: "2021 - Present",
          description: ["Tailored seller workflows for the target role"],
        },
      ],
    };

    const preserved = preserveGeneratedResumeFacts(
      masterResume,
      generatedResume,
      true,
    );

    expect(preserved.workExperience[0].website).toBe(
      "https://amazon.com/seller-services",
    );
  });

  it("copies work experience website values when Prompt 3 omits them", () => {
    const masterResume = {
      personalInfo: {},
      workExperience: [
        {
          id: 1,
          title: "Product Manager",
          company: "Amazon",
          website: "https://amazon.com/seller-services",
          years: "2021 - Present",
        },
      ],
    };
    const generatedResume = {
      personalInfo: {},
      workExperience: [
        {
          id: 1,
          title: "Product Manager",
          company: "Amazon",
          years: "2021 - Present",
          description: ["Tailored seller workflows for the target role"],
        },
      ],
    };

    const preserved = preserveGeneratedResumeFacts(
      masterResume,
      generatedResume,
      true,
    );

    expect(preserved.workExperience[0].website).toBe(
      "https://amazon.com/seller-services",
    );
  });
});

describe("getMasterResumeImportProviderIssue", () => {
  it("accepts complete ChatGPT API settings for Master Resume import", () => {
    expect(
      getMasterResumeImportProviderIssue({
        id: "chatgpt:api",
        mode: "api",
        apiBaseUrl: "https://api.openai.com/v1/responses",
        model: "gpt-5-mini",
        apiKey: "test-key",
      }),
    ).toBe("");
  });

  it("requires a complete API provider before Master Resume import", () => {
    expect(
      getMasterResumeImportProviderIssue({
        id: "claude:api",
        mode: "api",
        apiBaseUrl: "https://api.anthropic.com/v1/messages",
        model: "claude-sonnet-4-5",
        apiKey: "",
      }),
    ).toMatch(/AI setup needs attention/i);
  });

  it("accepts a ready web automation provider", () => {
    expect(
      getMasterResumeImportProviderIssue({
        id: "chatgpt:web_automation",
        mode: "web_automation",
        targetUrl: "https://chatgpt.com/?temporary-chat=true",
      }),
    ).toBe("");
  });
});

describe("getPrompt4ResumeRejectionMessage", () => {
  it("maps Prompt 4 non-resume rejection to a user-facing upload error", () => {
    expect(
      getPrompt4ResumeRejectionMessage({
        error: "not_resume",
        message: "The uploaded file does not contain enough resume information.",
      }),
    ).toMatch(/does not look like a resume/i);
  });

  it("ignores normal ResumeData payloads", () => {
    expect(
      getPrompt4ResumeRejectionMessage({
        personalInfo: {},
        summary: "",
      }),
    ).toBe("");
  });
});

describe("stripPromptFlexNotesFromServerArtifact", () => {
  it("removes prompt-only flex notes before sending server artifacts", () => {
    expect(
      stripPromptFlexNotesFromServerArtifact({
        recommended_title: "Product Manager",
        flex_notes: "local-only prompt note",
      }),
    ).toEqual({
      recommended_title: "Product Manager",
    });
  });
});

describe("prefixGenerationFeedbackSummary", () => {
  it("adds provider, prompt profile, and prompt version summary details", () => {
    expect(
      prefixGenerationFeedbackSummary(
        { summary: "Tailored toward the role." },
        { label: "ChatGPT API" },
        {
          promptProfileId: "profile2",
          prompts: {
            prompt3: {
              versionId: "prompt3-version-abcdef123456",
            },
          },
          systemPrompt: {
            versionId: "system-version-fedcba654321",
          },
        },
      ),
    ).toEqual({
      summary:
        "CHATGPT API: Tailored toward the role.\nPrompt setup: Profile profile2 | Prompt 3 prompt3-vers | System system-versi",
      prompt_setup: {
        prompt_profile_id: "profile2",
        prompt3_version_id: "prompt3-version-abcdef123456",
        system_prompt_version_id: "system-version-fedcba654321",
      },
    });
  });
});
