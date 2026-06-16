import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_ROOT = resolve(__dirname, "..", "prompts");

function readPrompt(relativePath) {
  return readFileSync(resolve(PROMPTS_ROOT, relativePath), "utf8");
}

describe("packaged summary brevity prompt rules", () => {
  it("updates Prompt 2 summary direction without word-count enforcement", () => {
    const prompt = readPrompt("prompt2.txt");
    const contract = readPrompt("patches/prompt2.output-contract.txt");

    expect(prompt).toContain("prompt_version: v4.0.3");
    expect(prompt).toContain("the buyer-facing wedge and hook claim");
    expect(prompt).toContain("the smallest believable proof cluster");
    expect(prompt).toContain("Prompt 2 chooses which source bullets survive");
    expect(prompt).toContain("one impressiveness anchor");
    expect(prompt).toContain("signature proof detail");
    expect(contract).toContain('"merge_with": []');
    expect(contract).toContain('"placement_hint": "lead | top2 | normal"');
    expect(prompt).not.toContain("the 3-5 proof themes");
    expect(contract).not.toContain("summary_sentences");
    expect(contract).not.toContain("company_context_guidance");
  });

  it("documents the Prompt 3 final summary budget", () => {
    const prompt = readPrompt("prompt3.txt");
    const contract = readPrompt("patches/prompt3.output-contract.txt");

    expect(prompt).toContain("prompt_version: v4.0.6");
    expect(prompt).toContain("Target 35-45 words, with a hard maximum of 50 words.");
    expect(prompt).toContain("Do not stack proof lists; move extra proof into role bullets.");
    expect(prompt).toContain("buyer-facing positioning pitch");
    expect(prompt).toContain("reader's proof model");
    expect(prompt).toContain("Keep bullets concise, usually around 30-50 words.");
    expect(prompt).toContain("One secondary credibility, adoption, or deployment detail is allowed");
    expect(prompt).toContain("diagnosis, unmet-need discovery, problem reframing, or decision judgment");
    expect(contract).toContain("target 35-45 words, and hard maximum 50 words");
  });
});
