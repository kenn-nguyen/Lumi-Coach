import { describe, expect, it } from "vitest";

import { toServerRunSummary } from "./extension-runs.js";

describe("toServerRunSummary", () => {
  it("maps local history entries to the backend run shape", () => {
    const payload = toServerRunSummary({
      jobKey: "https://www.linkedin.com/jobs/view/123/",
      sourceUrl: "https://www.linkedin.com/jobs/view/123/",
      title: "Senior Product Manager",
      company: "Acme",
      location: "Remote",
      datePosted: "2026-05-01",
      generatedAt: "2026-05-06T12:00:00Z",
      resumeId: "resume-123",
      previewUrl: "http://localhost:3000/resumes/resume-123",
      status: "generated",
      runId: "run-123",
      providerId: "chatgpt-api",
      providerLabel: "ChatGPT API",
      providerVendor: "openai",
      providerMode: "api",
      jobSource: "linkedin",
      jobReadiness: "ready",
      descriptionProvenance: "linkedin_dom",
      descriptionLength: 1234,
      scrapeConfidence: 95,
      manualJobInputUsed: false,
      customContextProvided: true,
      customContextLength: 77,
      storyboardPresent: true,
      prompt1DurationMs: 100,
      prompt1Input: "Prompt 1 input",
      prompt1Raw: '{"analysis":"raw"}',
      prompt1Result: { analysis: "parsed" },
      prompt2DurationMs: 200,
      prompt2Input: "Prompt 2 input",
      prompt2Raw: '{"strategy":"raw"}',
      prompt2Result: { strategy: "parsed" },
      prompt3DurationMs: 300,
      prompt3Input: "Prompt 3 input",
      prompt3Raw: '{"resume":"raw"}',
      prompt3Parsed: { personalInfo: { name: "Candidate" } },
      prompt3Feedback: { summary: "Looks good" },
      patchDurationMs: 400,
      totalDurationMs: 1000,
      prompt3ValidationErrorCount: 0,
    });

    expect(payload).toMatchObject({
      run_id: "run-123",
      status: "generated",
      title: "Senior Product Manager",
      company: "Acme",
      source_url: "https://www.linkedin.com/jobs/view/123/",
      resume_id: "resume-123",
      provider_id: "chatgpt-api",
      total_duration_ms: 1000,
    });
    expect(payload.summary).toMatchObject({
      job_key: "https://www.linkedin.com/jobs/view/123/",
      manual_job_input_used: false,
      custom_context_provided: true,
      storyboard_present: true,
      prompt1_duration_ms: 100,
      provider_vendor: "openai",
    });
    expect(payload.prompt_artifacts).toMatchObject({
      prompt1: {
        input: "Prompt 1 input",
        raw: '{"analysis":"raw"}',
        result: { analysis: "parsed" },
      },
      prompt3: {
        parsed: { personalInfo: { name: "Candidate" } },
        feedback: { summary: "Looks good" },
      },
    });
  });

  it("keeps prompt artifacts separate from the small run summary", () => {
    const payload = toServerRunSummary({
      runId: "run-123",
      status: "generated",
      prompt1Raw: "secret prompt 1",
      prompt1Input: { rawResume: "secret resume" },
      prompt2Raw: "secret prompt 2",
      prompt3Raw: "secret prompt 3",
      prompt3Parsed: { personalInfo: { name: "Private" } },
      prompt4Raw: "secret prompt 4",
      prompt4Result: { personalInfo: { name: "Private" } },
      summary: {
        prompt1Raw: "secret",
      },
    });

    expect(payload.summary).not.toHaveProperty("prompt1Raw");
    expect(payload.summary).not.toHaveProperty("prompt3Parsed");
    expect(payload.prompt_artifacts).toMatchObject({
      prompt1: {
        raw: "secret prompt 1",
        input: { rawResume: "secret resume" },
      },
      prompt3: {
        raw: "secret prompt 3",
        parsed: { personalInfo: { name: "Private" } },
      },
      prompt4: {
        raw: "secret prompt 4",
        result: { personalInfo: { name: "Private" } },
      },
    });
  });

  it("skips entries without a run id", () => {
    expect(toServerRunSummary({ status: "generated" })).toBeNull();
  });
});
