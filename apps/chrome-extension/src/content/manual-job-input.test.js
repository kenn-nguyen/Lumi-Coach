import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LINKEDIN_JOB_PATH = resolve(__dirname, "linkedin-job.js");

function extractFunctionSource(source, signature) {
  const startIndex = source.indexOf(signature);
  if (startIndex === -1) {
    throw new Error(`Could not find helper starting with ${signature}`);
  }

  let parameterDepth = 0;
  let bodyStartIndex = -1;
  let braceDepth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") {
      parameterDepth += 1;
      continue;
    }
    if (char === ")") {
      parameterDepth -= 1;
      continue;
    }
    if (char === "{" && parameterDepth === 0) {
      if (bodyStartIndex === -1) {
        bodyStartIndex = index;
      }
      braceDepth += 1;
      continue;
    }
    if (char === "}" && bodyStartIndex !== -1) {
      braceDepth -= 1;
      if (braceDepth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error(`Could not find the end of helper starting with ${signature}`);
}

function loadManualJobInputHelpers() {
  const source = readFileSync(LINKEDIN_JOB_PATH, "utf8");
  const signatures = [
    "function extractLinkedInViewJobIdFromPathname(pathname)",
    "function normalizeJobSourceUrl(url)",
    'function pickManualJobMetadataValue(manualValue = null, fallbackValue = "")',
    "function resolveManualJobSourceUrl(",
    "function createManualJobInput(",
  ];

  const functionSource = signatures.map((signature) =>
    extractFunctionSource(source, signature),
  );

  return Function(
    `"use strict"; ${functionSource.join("\n\n")}; return { createManualJobInput };`,
  )();
}

const { createManualJobInput } = loadManualJobInputHelpers();

describe("createManualJobInput", () => {
  it("falls back to current job metadata when optional manual fields are untouched", () => {
    expect(
      createManualJobInput({
        rawText: "  Full pasted JD text  ",
        currentJob: {
          title: "Senior PM",
          company: "Acme",
          location: "Remote",
          datePosted: "2026-06-01",
          sourceUrl: "https://www.linkedin.com/jobs/view/123/?currentJobId=123",
        },
        locationHref: "https://example.com/random-page",
      }),
    ).toEqual({
      source: "manual_text",
      rawText: "Full pasted JD text",
      title: "Senior PM",
      company: "Acme",
      location: "Remote",
      datePosted: "2026-06-01",
      sourceUrl: "https://www.linkedin.com/jobs/view/123/",
    });
  });

  it("carries no job identity for a standalone paste (no currentJob, no page href)", () => {
    // Explicit manual mode passes currentJob:null + locationHref:"" so the paste
    // never inherits the LinkedIn job the user is viewing (which would be injected
    // into the prompt as the target role and mis-link the result).
    expect(
      createManualJobInput({
        rawText: "  A pasted JD for a different job  ",
        currentJob: null,
        locationHref: "",
      }),
    ).toEqual({
      source: "manual_text",
      rawText: "A pasted JD for a different job",
      title: "",
      company: "",
      location: "",
      datePosted: "",
      sourceUrl: "",
    });
  });

  it("prefers manual title, company, and JD link overrides when provided", () => {
    expect(
      createManualJobInput({
        rawText: "JD",
        currentJob: {
          title: "Existing Title",
          company: "Existing Company",
          location: "Austin, TX",
          datePosted: "2026-06-01",
          sourceUrl: "https://www.linkedin.com/jobs/view/123/",
        },
        manualTitle: "Manual Title",
        manualCompany: "Manual Company",
        manualSourceUrl: "https://example.com/jobs/pm-role?ref=mail",
        locationHref: "https://example.com/fallback",
      }),
    ).toEqual({
      source: "manual_text",
      rawText: "JD",
      title: "Manual Title",
      company: "Manual Company",
      location: "Austin, TX",
      datePosted: "2026-06-01",
      sourceUrl: "https://example.com/jobs/pm-role",
    });
  });

  it("allows explicit blank title and company overrides while keeping the pasted JD usable", () => {
    expect(
      createManualJobInput({
        rawText: "JD",
        currentJob: {
          title: "Existing Title",
          company: "Existing Company",
          location: "Remote",
          datePosted: "2026-06-01",
          sourceUrl: "https://www.linkedin.com/jobs/view/123/",
        },
        manualTitle: "",
        manualCompany: "",
        manualSourceUrl: "",
        locationHref: "https://example.com/fallback",
      }),
    ).toEqual({
      source: "manual_text",
      rawText: "JD",
      title: "",
      company: "",
      location: "Remote",
      datePosted: "2026-06-01",
      sourceUrl: "",
    });
  });

  it("falls back to known source URLs when the optional JD link is invalid", () => {
    expect(
      createManualJobInput({
        rawText: "JD",
        currentJob: {
          title: "",
          company: "",
          location: "",
          datePosted: "",
          sourceUrl: "https://www.linkedin.com/jobs/search/?currentJobId=456",
        },
        manualSourceUrl: "not-a-url",
        locationHref: "https://example.com/fallback",
      }),
    ).toEqual({
      source: "manual_text",
      rawText: "JD",
      title: "",
      company: "",
      location: "",
      datePosted: "",
      sourceUrl: "https://www.linkedin.com/jobs/view/456/",
    });
  });
});
