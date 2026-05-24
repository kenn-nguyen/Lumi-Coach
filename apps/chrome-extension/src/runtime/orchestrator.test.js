import { describe, expect, it } from "vitest";

import {
  getMasterResumeImportProviderIssue,
  isFreeformPromptProfileId,
  getPrompt4ResumeRejectionMessage,
  prefixGenerationFeedbackSummary,
  preserveGeneratedResumeFacts,
  resolveCanonicalJobSnapshot,
  shouldReuseChatGptPopupSession,
  shouldAcceptLocalSnapshot,
  stripPromptFlexNotesFromServerArtifact,
} from "./orchestrator.js";

describe("shouldAcceptLocalSnapshot", () => {
  it("accepts manual input when non-empty raw text is present", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          rawText: "Manual JD text",
        },
        isManualInput: true,
      }),
    ).toBe(true);
  });

  it("accepts a full_jd_ready local snapshot", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          readiness: "full_jd_ready",
          rawText: "A".repeat(400),
          quality: {
            confidence: "medium",
            descriptionLength: 400,
          },
        },
      }),
    ).toBe(true);
  });

  it("accepts a fallback snapshot when it has readable raw text", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          rawText: "A".repeat(200),
        },
      }),
    ).toBe(true);
  });

  it("rejects an empty snapshot", () => {
    expect(
      shouldAcceptLocalSnapshot({
        snapshot: {
          rawText: "   ",
        },
      }),
    ).toBe(false);
  });
});

describe("resolveCanonicalJobSnapshot", () => {
  it("fills missing strict scrape metadata from the active run fallback", () => {
    expect(
      resolveCanonicalJobSnapshot({
        jobSnapshot: {
          source: "linkedin",
          sourceUrl: "https://www.linkedin.com/jobs/view/123/",
          title: "",
          company: "Worldpay",
          location: "",
          datePosted: null,
          rawText: "JD text",
        },
        activeRunJob: {
          title: "Senior Product Manager",
          company: "Worldpay",
          location: "Cincinnati, OH",
          datePosted: "2026-05-20",
          sourceUrl: "https://www.linkedin.com/jobs/view/123/",
        },
      }),
    ).toMatchObject({
      title: "Senior Product Manager",
      company: "Worldpay",
      location: "Cincinnati, OH",
      datePosted: "2026-05-20",
      sourceUrl: "https://www.linkedin.com/jobs/view/123/",
      rawText: "JD text",
    });
  });

  it("prefers explicit manual job metadata over strict and fallback values", () => {
    expect(
      resolveCanonicalJobSnapshot({
        jobInput: {
          title: "Manual Title",
          company: "Manual Company",
          location: "Remote",
          datePosted: "2026-05-01",
          sourceUrl: "https://example.com/manual-jd",
        },
        jobSnapshot: {
          source: "manual_text",
          sourceUrl: "https://example.com/strict-jd",
          title: "Strict Title",
          company: "Strict Company",
          location: "New York, NY",
          datePosted: "2026-05-02",
          rawText: "Manual JD",
        },
        activeRunJob: {
          title: "Display Title",
          company: "Display Company",
          location: "Austin, TX",
          datePosted: "2026-05-03",
          sourceUrl: "https://example.com/display-jd",
        },
      }),
    ).toMatchObject({
      title: "Manual Title",
      company: "Manual Company",
      location: "Remote",
      datePosted: "2026-05-01",
      sourceUrl: "https://example.com/manual-jd",
      rawText: "Manual JD",
    });
  });

  it("does not overwrite non-empty strict metadata with fallback display values", () => {
    expect(
      resolveCanonicalJobSnapshot({
        jobSnapshot: {
          source: "linkedin",
          sourceUrl: "https://www.linkedin.com/jobs/view/456/",
          title: "Principal Product Manager",
          company: "Worldpay",
          location: "Atlanta, GA",
          datePosted: null,
          rawText: "JD text",
        },
        activeRunJob: {
          title: "Different DOM Title",
          company: "Different DOM Company",
          location: "Remote",
          datePosted: "2026-05-20",
          sourceUrl: "https://www.linkedin.com/jobs/view/456/",
        },
      }),
    ).toMatchObject({
      title: "Principal Product Manager",
      company: "Worldpay",
      location: "Atlanta, GA",
      sourceUrl: "https://www.linkedin.com/jobs/view/456/",
      rawText: "JD text",
    });
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

  it("accepts a localhost ChatGPT proxy without an API key for Master Resume import", () => {
    expect(
      getMasterResumeImportProviderIssue({
        id: "chatgpt:api",
        mode: "api",
        apiBaseUrl: "http://127.0.0.1:8317/v1/responses",
        model: "gpt-5-mini",
        apiKey: "",
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

describe("shouldReuseChatGptPopupSession", () => {
  it("enables popup reuse only for ChatGPT web automation runs with a run id", () => {
    expect(
      shouldReuseChatGptPopupSession(
        { id: "chatgpt:web_automation" },
        "run-1",
      ),
    ).toBe(true);
    expect(
      shouldReuseChatGptPopupSession({ id: "claude:web_automation" }, "run-1"),
    ).toBe(false);
    expect(
      shouldReuseChatGptPopupSession({ id: "chatgpt:api" }, "run-1"),
    ).toBe(false);
    expect(
      shouldReuseChatGptPopupSession(
        { id: "chatgpt:web_automation" },
        null,
      ),
    ).toBe(false);
  });
});

describe("isFreeformPromptProfileId", () => {
  it("enables freeform Prompt 1 and Prompt 2 only for profile 3", () => {
    expect(isFreeformPromptProfileId("profile3")).toBe(true);
    expect(isFreeformPromptProfileId("profile2")).toBe(false);
    expect(isFreeformPromptProfileId("")).toBe(false);
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
  it("adds provider prefix and attaches prompt setup metadata separately", () => {
    expect(
      prefixGenerationFeedbackSummary(
        { summary: "Tailored toward the role." },
        { label: "ChatGPT API" },
        {
          promptProfileId: "profile2",
          prompts: {
            prompt1: {
              versionId: "prompt1-version-aaaa1111bbbb",
            },
            prompt2: {
              versionId: "prompt2-version-cccc2222dddd",
            },
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
      summary: "CHATGPT API: Tailored toward the role.",
      prompt_setup: {
        prompt_profile_id: "profile2",
        prompt1_version_id: "prompt1-version-aaaa1111bbbb",
        prompt2_version_id: "prompt2-version-cccc2222dddd",
        prompt3_version_id: "prompt3-version-abcdef123456",
        system_prompt_version_id: "system-version-fedcba654321",
      },
    });
  });
});
