import { describe, expect, it } from "vitest";
import { qaCheckDescription } from "./qa.js";

describe("qaCheckDescription", () => {
  it("hard-blocks obvious short junk", () => {
    const result = qaCheckDescription("too short");
    expect(result.shouldBlock).toBe(true);
    expect(result.issues[0]?.code).toBe("too_short");
  });

  it("keeps a plausible JD as pass with no hard block", () => {
    const text = `
Responsibilities:
- Lead roadmap planning and execution
- Partner with engineering and design

Requirements:
- 5+ years of product experience
- Strong communication skills
`;
    const result = qaCheckDescription(text);
    expect(result.shouldBlock).toBe(false);
    expect(result.metrics.length).toBeGreaterThanOrEqual(120);
  });

  it("warns when expanding the job description does not produce more text", () => {
    const text = `
Responsibilities include leading roadmap planning and requirements gathering
across engineering, design, analytics, and go-to-market teams. Requirements
include 5+ years of product management experience and strong communication.
`;
    const result = qaCheckDescription(text, {
      expandedAttempted: true,
      expandedSucceeded: false,
      textLengthBefore: 280,
      textLengthAfter: 280,
    });
    expect(result.shouldBlock).toBe(false);
    expect(result.issues.some((issue) => issue.code === "expand_no_gain")).toBe(
      true,
    );
  });
});
