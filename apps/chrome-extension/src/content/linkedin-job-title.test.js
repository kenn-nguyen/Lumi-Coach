import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LINKEDIN_JOB_PATH = resolve(__dirname, "linkedin-job.js");

function loadInferJobTitleFromDocumentTitle() {
  const source = readFileSync(LINKEDIN_JOB_PATH, "utf8");
  const match = source.match(
    /function inferJobTitleFromDocumentTitle\(company = ""\) \{[\s\S]*?\n\}/,
  );

  if (!match) {
    throw new Error("Could not find inferJobTitleFromDocumentTitle in linkedin-job.js");
  }

  return Function(`"use strict"; ${match[0]}; return inferJobTitleFromDocumentTitle;`)();
}

const inferJobTitleFromDocumentTitle = loadInferJobTitleFromDocumentTitle();
const originalDocument = globalThis.document;

describe("inferJobTitleFromDocumentTitle", () => {
  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it("strips a pipe-suffixed company fragment from the document title fallback", () => {
    globalThis.document = {
      title: "Concourse Product Manager - Payments - Vice President | JPMorgan",
    };

    expect(inferJobTitleFromDocumentTitle("JPMorganChase")).toBe(
      "Concourse Product Manager - Payments - Vice President",
    );
  });

  it("still strips an exact dash-company suffix when present", () => {
    globalThis.document = {
      title: "Senior Product Manager - Worldpay | LinkedIn",
    };

    expect(inferJobTitleFromDocumentTitle("Worldpay")).toBe(
      "Senior Product Manager",
    );
  });
});
