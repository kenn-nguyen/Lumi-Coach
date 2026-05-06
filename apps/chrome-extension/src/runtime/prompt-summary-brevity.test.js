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

    expect(prompt).toContain("prompt_version: v2.1.0");
    expect(prompt).toContain("the 2-3 highest-value proof themes");
    expect(prompt).toContain(
      "use 1 by default; use 2 only when the role fit needs a second sentence",
    );
    expect(contract).toContain("summary_sentences` must be `1` or `2`");
    expect(prompt).not.toContain("the 3-5 proof themes");
    expect(prompt).not.toContain("use 2 unless there is a strong reason not to");
    expect(contract).not.toContain("must be `2` unless");
  });

  it("documents the Prompt 3 final summary budget", () => {
    const prompt = readPrompt("prompt3.txt");
    const contract = readPrompt("patches/prompt3.output-contract.txt");

    expect(prompt).toContain("prompt_version: v2.1.1");
    expect(prompt).toContain("Target 35-45 words, with a hard maximum of 50 words.");
    expect(prompt).toContain("Do not stack proof lists; move extra proof into role bullets.");
    expect(contract).toContain("target 35-45 words, and hard maximum 50 words");
  });
});
