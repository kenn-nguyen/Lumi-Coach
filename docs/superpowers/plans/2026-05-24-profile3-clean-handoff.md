# Profile3 Clean Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `profile3` use leaner Prompt 1 and Prompt 2 stages with code-cleaned freeform handoffs, while keeping Prompt 3 strict and still anchored to `CURRENT_RESUME`.

**Architecture:** Keep `profile3` freeform for Prompt 1 and Prompt 2, but stop passing raw runner text directly downstream. Introduce a small freeform-response cleaner in the extension runtime, feed cleaned Prompt 1 output into Prompt 2, feed cleaned Prompt 1 plus cleaned Prompt 2 plus JD into Prompt 3, and mirror the prompt-template changes to the backend-owned extension defaults. Prompt 3 validation remains unchanged.

**Tech Stack:** MV3 Chrome extension runtime (`orchestrator.js`, `prompt-loader.js`), Vitest, backend prompt-default sync, pytest.

---

## File Map

- Create: `apps/chrome-extension/src/runtime/freeform-handoff.js`
- Create: `apps/chrome-extension/src/runtime/freeform-handoff.test.js`
- Modify: `apps/chrome-extension/src/runtime/orchestrator.js`
- Modify: `apps/chrome-extension/src/runtime/prompt-loader.test.js`
- Modify: `apps/chrome-extension/src/runtime/orchestrator.test.js`
- Modify: `apps/chrome-extension/src/prompts/profiles/profile3/prompt1.txt`
- Modify: `apps/chrome-extension/src/prompts/profiles/profile3/prompt2.txt`
- Modify: `apps/chrome-extension/src/prompts/profiles/profile3/prompt3.txt`
- Modify: `apps/backend/app/prompts/extension_defaults/profiles/profile3/prompt1.txt`
- Modify: `apps/backend/app/prompts/extension_defaults/profiles/profile3/prompt2.txt`
- Modify: `apps/backend/app/prompts/extension_defaults/profiles/profile3/prompt3.txt`
- Test: `apps/backend/tests/integration/test_config_api.py`

## Target Behavior

- `profile3` Prompt 1 returns only:
  - ATS keywords/signals
  - hiring-manager persona
- Prompt 1 raw runner output is preserved for debugging, but downstream handoff uses a cleaned version.
- Prompt 2 input order becomes:
  1. cleaned Prompt 1 output
  2. Prompt 2 hiring-manager instructions
  3. current resume
  4. JD at the bottom
- Prompt 3 input includes:
  - cleaned Prompt 1 output
  - cleaned Prompt 2 output
  - JD
  - current resume
- Prompt 1 and Prompt 2 stay freeform for `profile3`; no strict schema validation is added.
- Prompt 3 validation remains strict and unchanged.

### Task 1: Add a freeform handoff cleaner

**Files:**
- Create: `apps/chrome-extension/src/runtime/freeform-handoff.js`
- Test: `apps/chrome-extension/src/runtime/freeform-handoff.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from "vitest";

import { cleanFreeformHandoffText } from "./freeform-handoff.js";

describe("cleanFreeformHandoffText", () => {
  it("strips transcript chrome from Claude web automation output", () => {
    const dirty = [
      "You said: You are an ATS and hiring-manager analyst.",
      "ATS",
      "- APIs",
      "- Payments",
      "",
      "Hiring manager persona",
      "- Trusts: measurable product delivery",
      "",
      "Show more",
      "7:30 PM",
    ].join("\n");

    expect(cleanFreeformHandoffText(dirty)).toBe(
      [
        "ATS",
        "- APIs",
        "- Payments",
        "",
        "Hiring manager persona",
        "- Trusts: measurable product delivery",
      ].join("\n"),
    );
  });

  it("keeps already clean freeform text intact", () => {
    const clean = [
      "ATS",
      "- Product management",
      "- Payments",
      "",
      "Hiring manager persona",
      "- Wants strong roadmap ownership",
    ].join("\n");

    expect(cleanFreeformHandoffText(clean)).toBe(clean);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/freeform-handoff.test.js`

Expected: FAIL with module-not-found or missing export for `cleanFreeformHandoffText`.

- [ ] **Step 3: Write minimal implementation**

```js
const TRANSCRIPT_PREFIX_PATTERNS = [
  /^You said:\s*/i,
  /^Claude responded:\s*/i,
];

const TRANSCRIPT_NOISE_LINE_PATTERNS = [
  /^Show more$/i,
  /^\d{1,2}:\d{2}\s*(AM|PM)$/i,
];

export function cleanFreeformHandoffText(rawText) {
  const source = typeof rawText === "string" ? rawText : "";
  if (!source.trim()) return "";

  let cleaned = source.trim();
  for (const pattern of TRANSCRIPT_PREFIX_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !TRANSCRIPT_NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line.trim())));

  return lines.join("\n").trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/freeform-handoff.test.js`

Expected: PASS, `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-extension/src/runtime/freeform-handoff.js apps/chrome-extension/src/runtime/freeform-handoff.test.js
git commit -m "feat: add freeform prompt handoff cleaner"
```

### Task 2: Use cleaned freeform handoffs in the orchestrator

**Files:**
- Modify: `apps/chrome-extension/src/runtime/orchestrator.js`
- Test: `apps/chrome-extension/src/runtime/orchestrator.test.js`

- [ ] **Step 1: Write the failing test**

```js
it("uses cleaned Prompt 1 and Prompt 2 responses for profile3 downstream context", async () => {
  const dirtyPrompt1 = "You said: ATS\n- Payments\n\nHiring manager persona\n- Wants ownership\nShow more\n7:30 PM";
  const dirtyPrompt2 = "Claude responded: Ideal-match priorities\n- Payments PM\n\nDo not do\n- Overclaim\nShow more";

  const result = await runProfile3HappyPath({
    prompt1RawText: dirtyPrompt1,
    prompt2RawText: dirtyPrompt2,
  });

  expect(result.promptContext.prompt1Response).toBe(
    "ATS\n- Payments\n\nHiring manager persona\n- Wants ownership",
  );
  expect(result.promptContext.prompt2Response).toBe(
    "Ideal-match priorities\n- Payments PM\n\nDo not do\n- Overclaim",
  );
  expect(result.savedState.prompt1Raw).toBe(dirtyPrompt1);
  expect(result.savedState.prompt2Raw).toBe(dirtyPrompt2);
  expect(result.savedState.prompt1Result).toEqual({
    response: "ATS\n- Payments\n\nHiring manager persona\n- Wants ownership",
  });
  expect(result.savedState.prompt2Result).toEqual({
    response: "Ideal-match priorities\n- Payments PM\n\nDo not do\n- Overclaim",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/orchestrator.test.js`

Expected: FAIL because `promptContext.prompt1Response` and `promptContext.prompt2Response` still equal raw contaminated text.

- [ ] **Step 3: Write minimal implementation**

```js
import { cleanFreeformHandoffText } from "./freeform-handoff.js";

function buildFreeformPromptStageArtifact(rawText) {
  return {
    response: cleanFreeformHandoffText(rawText),
  };
}

// After Prompt 1 succeeds
const prompt1CleanResponse = cleanFreeformHandoffText(prompt1Raw);
promptContext.prompt1Response = prompt1CleanResponse;
prompt1Result = buildFreeformPromptStageArtifact(prompt1Raw);

// After Prompt 2 succeeds
const prompt2CleanResponse = cleanFreeformHandoffText(prompt2Raw);
promptContext.prompt2Response = prompt2CleanResponse;
prompt2Result = buildFreeformPromptStageArtifact(prompt2Raw);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/orchestrator.test.js`

Expected: PASS with the new clean handoff assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-extension/src/runtime/orchestrator.js apps/chrome-extension/src/runtime/orchestrator.test.js
git commit -m "feat: use clean freeform prompt handoffs for profile3"
```

### Task 3: Rewrite profile3 Prompt 1

**Files:**
- Modify: `apps/chrome-extension/src/prompts/profiles/profile3/prompt1.txt`
- Modify: `apps/backend/app/prompts/extension_defaults/profiles/profile3/prompt1.txt`
- Test: `apps/chrome-extension/src/runtime/prompt-loader.test.js`
- Test: `apps/backend/tests/integration/test_config_api.py`

- [ ] **Step 1: Write the failing test**

```js
it("renders profile3 Prompt 1 with only ATS and hiring-manager persona output sections", async () => {
  const rendered = await renderPrompt1WithMetadata(profile3Context, profile3Provider);

  expect(rendered.text).toContain("Return plain text with exactly these sections:");
  expect(rendered.text).toContain("ATS");
  expect(rendered.text).toContain("Hiring manager persona");
  expect(rendered.text).not.toContain("JD");
  expect(rendered.text).not.toContain("Target role:");
  expect(rendered.text).not.toContain("Core mission:");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/prompt-loader.test.js`

Expected: FAIL because current Prompt 1 still contains `JD`, `Target role`, `Domain`, and `Core mission`.

- [ ] **Step 3: Update the prompt**

```txt
You are an ATS and hiring-manager analyst.

Read the job description and return a short plain-text brief for downstream tailoring.

Return plain text with exactly these sections:

ATS
- Priority keywords:
- Hard filters:
- Proof themes:

Hiring manager persona
- Trusts:
- Rejects:
- Wants first on page one:

Input:
job_title: {{JOB_TITLE}}
company: {{COMPANY}}
location: {{LOCATION}}
source_url: {{SOURCE_URL}}
extracted_at: {{EXTRACTED_AT}}

Raw job description text:
{{JOB_DESCRIPTION}}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
- `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/prompt-loader.test.js`
- `cd /Users/kennng/Documents/Resume-Matcher/apps/backend && uv run pytest tests/integration/test_config_api.py -q`

Expected: both PASS; prompt sync still serves the updated `profile3` Prompt 1.

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-extension/src/prompts/profiles/profile3/prompt1.txt apps/backend/app/prompts/extension_defaults/profiles/profile3/prompt1.txt apps/chrome-extension/src/runtime/prompt-loader.test.js apps/backend/tests/integration/test_config_api.py
git commit -m "feat: slim profile3 prompt1 to ats and persona"
```

### Task 4: Rewrite profile3 Prompt 2

**Files:**
- Modify: `apps/chrome-extension/src/prompts/profiles/profile3/prompt2.txt`
- Modify: `apps/backend/app/prompts/extension_defaults/profiles/profile3/prompt2.txt`
- Test: `apps/chrome-extension/src/runtime/prompt-loader.test.js`

- [ ] **Step 1: Write the failing test**

```js
it("renders profile3 Prompt 2 with clean Prompt 1 output first, resume next, and JD at the bottom", async () => {
  const rendered = await renderPrompt2WithMetadata({
    ...profile3Context,
    prompt1Response: "ATS\n- Payments\n\nHiring manager persona\n- Wants roadmap ownership",
  }, profile3Provider);

  const prompt = rendered.text;
  const prompt1Index = prompt.indexOf("Prompt 1 output:");
  const instructionIndex = prompt.indexOf("You are the hiring manager for this role.");
  const resumeIndex = prompt.indexOf("Current resume:");
  const jdIndex = prompt.indexOf("Job description:");

  expect(prompt1Index).toBeGreaterThanOrEqual(0);
  expect(instructionIndex).toBeGreaterThan(prompt1Index);
  expect(resumeIndex).toBeGreaterThan(instructionIndex);
  expect(jdIndex).toBeGreaterThan(resumeIndex);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/prompt-loader.test.js`

Expected: FAIL because current Prompt 2 places the Prompt 1 brief after the instructions and does not include JD at the bottom.

- [ ] **Step 3: Update the prompt**

```txt
Prompt 1 output:
{{PROMPT1_RESPONSE}}

You are the hiring manager for this role.

Read the current resume and write a short note to the final resume writer.

Focus only on:
- what the ideal candidate should prove most clearly for this JD, in priority order;
- what this specific resume already proves best and can transfer toward that ideal match;
- what should be emphasized first;
- how the resume should be structured at a high level.

Keep it short. High level only.
Do not write JSON.
Do not write the final resume.

Return plain text with exactly these sections and short bullets:

Ideal-match priorities from the JD
- Give at least 6 bullets, highest priority first.

Best transferable proof from this resume
- Call out what already translates best toward the ideal match.

Page-one focus
-

Role and bullet structure
-

Do not do
-

Current resume:
{{CURRENT_RESUME}}

Job description:
{{JOB_DESCRIPTION}}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/prompt-loader.test.js`

Expected: PASS, including order assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-extension/src/prompts/profiles/profile3/prompt2.txt apps/backend/app/prompts/extension_defaults/profiles/profile3/prompt2.txt apps/chrome-extension/src/runtime/prompt-loader.test.js
git commit -m "feat: restructure profile3 prompt2 around clean prompt1 handoff"
```

### Task 5: Rewrite profile3 Prompt 3

**Files:**
- Modify: `apps/chrome-extension/src/prompts/profiles/profile3/prompt3.txt`
- Modify: `apps/backend/app/prompts/extension_defaults/profiles/profile3/prompt3.txt`
- Test: `apps/chrome-extension/src/runtime/prompt-loader.test.js`

- [ ] **Step 1: Write the failing test**

```js
it("renders profile3 Prompt 3 with clean Prompt 1 output, clean Prompt 2 output, JD, and current resume", async () => {
  const rendered = await renderPrompt3WithMetadata({
    ...profile3Context,
    prompt1Response: "ATS\n- Payments",
    prompt2Response: "Ideal-match priorities\n- Product strategy",
  }, profile3Provider);

  expect(rendered.text).toContain("Prompt 1 output:");
  expect(rendered.text).toContain("Prompt 2 output:");
  expect(rendered.text).toContain("Job description:");
  expect(rendered.text).toContain("Current resume:");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/prompt-loader.test.js`

Expected: FAIL because current Prompt 3 does not include JD and labels Prompt 1/2 as brief/note rather than explicit cleaned outputs.

- [ ] **Step 3: Update the prompt**

```txt
You are an expert ATS resume writer.

Use the cleaned upstream prompt outputs and the JD below to tailor the resume.
Use CURRENT_RESUME as the base object.

... keep existing Prompt 3 writing rules ...

Prompt 1 output:
{{PROMPT1_RESPONSE}}

Prompt 2 output:
{{PROMPT2_RESPONSE}}

Job description:
{{JOB_DESCRIPTION}}

Current resume:
{{CURRENT_RESUME}}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test -- src/runtime/prompt-loader.test.js`

Expected: PASS with the new Prompt 3 rendering assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-extension/src/prompts/profiles/profile3/prompt3.txt apps/backend/app/prompts/extension_defaults/profiles/profile3/prompt3.txt apps/chrome-extension/src/runtime/prompt-loader.test.js
git commit -m "feat: add jd and clean upstream outputs to profile3 prompt3"
```

### Task 6: Full verification

**Files:**
- Verify: `apps/chrome-extension/src/runtime/freeform-handoff.test.js`
- Verify: `apps/chrome-extension/src/runtime/orchestrator.test.js`
- Verify: `apps/chrome-extension/src/runtime/prompt-loader.test.js`
- Verify: `apps/backend/tests/integration/test_config_api.py`

- [ ] **Step 1: Run focused extension tests**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/freeform-handoff.test.js src/runtime/orchestrator.test.js src/runtime/prompt-loader.test.js src/runtime/llm/profiles.test.js
```

Expected: PASS for all focused prompt-flow and settings tests.

- [ ] **Step 2: Run full extension suite**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test
```

Expected: PASS, including existing web-automation, prompt-loader, and orchestrator suites.

- [ ] **Step 3: Run backend prompt-sync test**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/backend
uv run pytest tests/integration/test_config_api.py -q
```

Expected: PASS, confirming backend-owned `profile3` prompts still sync cleanly.

- [ ] **Step 4: Manual smoke test**

Run:

```text
1. Reload the unpacked extension.
2. Choose profile3.
3. Run one Claude or ChatGPT tailoring job.
4. Export or inspect the extension run record.
5. Confirm:
   - Prompt 1 output no longer contains "You said:", "Show more", or timestamps in the handoff used by Prompt 2.
   - Prompt 2 input starts with the cleaned Prompt 1 output.
   - Prompt 2 input includes CURRENT_RESUME and JD.
   - Prompt 3 input includes cleaned Prompt 1 output, cleaned Prompt 2 output, JD, and CURRENT_RESUME.
   - Prompt 3 output still goes through strict resume JSON validation.
```

- [ ] **Step 5: Commit verification-only follow-up if needed**

```bash
git add apps/chrome-extension apps/backend
git commit -m "test: verify profile3 clean handoff flow"
```

## Self-Review

- Spec coverage:
  - Prompt 1 reduced to ATS + hiring-manager persona: covered in Task 3.
  - Code cleaning for Prompt 1/2 outputs: covered in Task 1 and Task 2.
  - Prompt 2 structure with cleaned Prompt 1 first, then instructions, then resume, then JD: covered in Task 4.
  - Prompt 3 gets Prompt 1 output, Prompt 2 output, JD, and still uses current resume: covered in Task 5.
  - Prompt 3 remains validated: preserved in Task 2 by leaving the Prompt 3 path untouched.
- Placeholder scan:
  - No `TODO`, `TBD`, or “appropriate validation” placeholders remain.
- Type consistency:
  - The plan consistently uses `cleanFreeformHandoffText`, `prompt1Response`, `prompt2Response`, `CURRENT_RESUME`, and `JOB_DESCRIPTION`.

