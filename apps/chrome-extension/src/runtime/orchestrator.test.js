import { describe, expect, it } from "vitest";

import { shouldAcceptLocalSnapshot } from "./orchestrator.js";

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
