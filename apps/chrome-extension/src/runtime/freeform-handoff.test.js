import { describe, expect, it } from "vitest";

import { cleanFreeformHandoffText } from "./freeform-handoff.js";

describe("cleanFreeformHandoffText", () => {
  it("strips echoed prompt transcript chrome before the first expected heading", () => {
    const dirty = [
      "You said: You are an ATS and hiring-manager analyst.",
      "Read the job description and return a short plain-text brief.",
      "Return plain text with exactly these sections:",
      "ATS",
      "- Priority keywords:",
      "",
      "ATS",
      "- Payments",
      "- Product strategy",
      "",
      "Hiring manager persona",
      "- Trusts: measurable product delivery",
      "- Rejects: vague claims",
      "",
      "Show more",
      "7:30 PM",
    ].join("\n");

    expect(
      cleanFreeformHandoffText(dirty, {
        expectedHeadings: ["ATS", "Hiring manager persona"],
      }),
    ).toBe(
      [
        "ATS",
        "- Payments",
        "- Product strategy",
        "",
        "Hiring manager persona",
        "- Trusts: measurable product delivery",
        "- Rejects: vague claims",
      ].join("\n"),
    );
  });

  it("keeps already clean freeform text intact", () => {
    const clean = [
      "Ideal-match priorities from the JD",
      "- Payments product strategy",
      "",
      "Best transferable proof from this resume",
      "- API-first risk platform delivery",
    ].join("\n");

    expect(
      cleanFreeformHandoffText(clean, {
        expectedHeadings: [
          "Ideal-match priorities from the JD",
          "Best transferable proof from this resume",
        ],
      }),
    ).toBe(clean);
  });

  it("cuts off leaked prompt scaffolding markers like Input and Prompt 1 output", () => {
    const dirty = [
      "ATS",
      "- Priority keywords: payments, roadmap, discovery",
      "",
      "Hiring manager",
      "- Trusts: measurable product delivery",
      "- Rejects: vague ownership claims",
      "",
      "Input:",
      "job_title: Concourse Product Manager",
      "",
      "Prompt 1 output:",
      "ATS",
      "- should not remain",
    ].join("\n");

    expect(
      cleanFreeformHandoffText(dirty, {
        expectedHeadings: ["ATS", "Hiring manager persona"],
      }),
    ).toBe(
      [
        "ATS",
        "- Priority keywords: payments, roadmap, discovery",
        "",
        "Hiring manager",
        "- Trusts: measurable product delivery",
        "- Rejects: vague ownership claims",
      ].join("\n"),
    );
  });
});
