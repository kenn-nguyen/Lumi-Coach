import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  getExpandableTextButtonState,
  tryExpandJobDescription,
} from "../shared/expand-text.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// LinkedIn's live job-details DOM is built by JS (React), so it nests <ul>/<li>
// inside the <p>-wrapped `expandable-text-box`. Re-parsing the serialized HTML
// through jsdom would trigger the HTML5 rule "a <p> auto-closes at a <ul>",
// which would kick every bullet list OUT of the box — a parser artifact the live
// page never hits. Swap the single wrapping <p> for a <div> (which legally holds
// <ul>) so the fixture mirrors the real, JS-built DOM the content script reads.
function loadFixture(name) {
  const html = readFileSync(resolve(__dirname, "__fixtures__", name), "utf8");
  return html
    .replace(
      /<p\b[^>]*>(?=<span[^>]*data-testid="expandable-text-box")/,
      "<div data-rm-fixture-wrapper>",
    )
    .replace("</span></p>", "</span></div>");
}

function mountFixture(name) {
  document.body.innerHTML = loadFixture(name);
}

// Mirrors the content script's readInlineJobDescriptionText(): read the box, but
// via textContent (jsdom does not implement innerText). textContent is a superset
// of innerText's text, so "contains" / "excludes" checks still prove nothing is
// truncated or leaked in from outside the box.
function readBoxText() {
  const node = document.querySelector('[data-testid="expandable-text-box"]');
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("LinkedIn JD extraction (real markup fixtures)", () => {
  it("detects the collapsed 'see more' expander and attempts expansion (Workiva)", async () => {
    mountFixture("workiva-jd.html");
    const button = document.querySelector(
      '[data-testid="expandable-text-button"]',
    );
    expect(button).not.toBeNull();
    expect(getExpandableTextButtonState(button)).toBe("collapsed");

    const result = await tryExpandJobDescription(document, { waitMs: 0 });
    expect(result.expandedAttempted).toBe(true);
  });

  it("detects the collapsed 'see more' expander and attempts expansion (Instacart)", async () => {
    mountFixture("instacart-jd.html");
    const button = document.querySelector(
      '[data-testid="expandable-text-button"]',
    );
    expect(button).not.toBeNull();
    expect(getExpandableTextButtonState(button)).toBe("collapsed");

    const result = await tryExpandJobDescription(document, { waitMs: 0 });
    expect(result.expandedAttempted).toBe(true);
  });

  it("captures the full Workiva JD — every section, bullets, salary, and the final line", () => {
    mountFixture("workiva-jd.html");
    const text = readBoxText();

    for (const phrase of [
      "Senior AI Product Manager",
      "machine learning and artificial intelligence",
      "Product Strategy",
      "Deeply understand and articulate a compelling product vision",
      "Stakeholder Engagement",
      "Minimum Qualifications",
      "6+ years of product management experience in software development",
      "Preferred Qualifications",
      "Natural Language Processing (NLP)",
      "Working Conditions",
      "$129,000.00 - $261,000.00",
      "Restricted Stock Units granted at time of hire",
      "Why Join Workiva",
      // The trailing <em> sentence right before the "… more" button — must survive.
      "country of employment.",
    ]) {
      expect(text).toContain(phrase);
    }
  });

  it("excludes the out-of-box footer (Workiva)", () => {
    mountFixture("workiva-jd.html");
    const text = readBoxText();
    // "Benefits found in job post" is a sibling <p> AFTER the box — never scraped.
    expect(text).not.toContain("Benefits found in job post");
  });

  it("captures the full Instacart JD — intro, bullets, and every salary band", () => {
    mountFixture("instacart-jd.html");
    const text = readBoxText();

    for (const phrase of [
      "We're transforming the grocery industry",
      "Instacart is a Flex First team",
      "As a Product Manager, AI",
      "About The Job",
      "Own the product vision, strategy, and roadmap",
      "Minimum Qualifications",
      "6+ years of product management experience building B2B or enterprise software",
      "Preferred Qualifications",
      "$221,000",
      "$212,000",
      "$203,000",
      "All other states",
      "$184,000",
    ]) {
      expect(text).toContain(phrase);
    }
  });
});
