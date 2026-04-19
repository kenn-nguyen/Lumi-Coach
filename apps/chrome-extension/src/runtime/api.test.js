import { describe, expect, it } from "vitest";

import { normalizeBackendApifyFallbackPayload } from "./api.js";

describe("normalizeBackendApifyFallbackPayload", () => {
  it("maps backend fallback payloads into the orchestrator snapshot shape", () => {
    const snapshot = normalizeBackendApifyFallbackPayload(
      {
        source: "apify_backend",
        source_url: "https://www.linkedin.com/jobs/view/4370473767/",
        title: "Forward Deployed Product Manager",
        company: "Glean",
        location: "San Francisco Bay Area",
        date_posted: "2026-04-15T17:51:38",
        raw_text:
          "Job Title: Forward Deployed Product Manager\nCompany: Glean\n\nJob Description:\nAbout Glean...",
        diagnostics: {
          actor_id: "apimaestro/linkedin-job-detail",
          item_count: 1,
        },
      },
      "https://www.linkedin.com/jobs/view/4370473767/",
    );

    expect(snapshot.source).toBe("apify_backend");
    expect(snapshot.sourceUrl).toBe(
      "https://www.linkedin.com/jobs/view/4370473767/",
    );
    expect(snapshot.title).toBe("Forward Deployed Product Manager");
    expect(snapshot.company).toBe("Glean");
    expect(snapshot.location).toBe("San Francisco Bay Area");
    expect(snapshot.datePosted).toBe("2026-04-15T17:51:38");
    expect(snapshot.rawText).toContain("Job Description:");
    expect(snapshot.diagnostics.actor_id).toBe(
      "apimaestro/linkedin-job-detail",
    );
    expect(snapshot.diagnostics.rawTextLength).toBe(snapshot.rawText.length);
  });

  it("throws when the backend payload does not contain readable JD text", () => {
    expect(() =>
      normalizeBackendApifyFallbackPayload({
        raw_text: "   ",
      }),
    ).toThrow(/readable job description/i);
  });
});
