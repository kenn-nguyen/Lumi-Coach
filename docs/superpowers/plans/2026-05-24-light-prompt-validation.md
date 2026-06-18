# Light Prompt 1 and Prompt 2 Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Prompt 1 and Prompt 2 failure rate by replacing full-schema validation with minimal handoff validation and normalization, while keeping Prompt 3 strict and preserving Prompt 1 `flex_notes` for the hiring-manager persona path.

**Architecture:** Keep Prompt 3 as the only strict final-artifact gate. Prompt 1 and Prompt 2 should validate only the minimum required keys and basic types needed for downstream prompts, then normalize missing optional fields into the existing full object shape before storing them in `promptContext`. This preserves current prompt templates and debug exports while reducing schema pressure on Claude and Gemini.

**Tech Stack:** MV3 Chrome extension, plain JS content/runtime modules, Vitest

---

## File map

- Modify: `apps/chrome-extension/src/runtime/validation.js`
  - Add minimal Prompt 1 / Prompt 2 validators
  - Add Prompt 1 / Prompt 2 normalizers that fill optional fields with defaults
- Modify: `apps/chrome-extension/src/runtime/orchestrator.js`
  - Switch raw-response validation for Prompt 1 / Prompt 2 to minimal validators
  - Switch parsed handoff extraction for Prompt 1 / Prompt 2 to minimal validators plus normalization
  - Keep Prompt 3 strict
- Modify: `apps/chrome-extension/src/runtime/validation.test.js`
  - Add focused tests for minimal Prompt 1 / Prompt 2 validation and normalization
- Modify: `apps/chrome-extension/src/runtime/orchestrator.test.js`
  - Add end-to-end tests that sparse Prompt 1 / Prompt 2 payloads now pass and are normalized
- Modify: `apps/chrome-extension/src/runtime/prompt-loader.test.js`
  - Add a regression test proving `flex_notes` still drives the hiring-manager persona path after normalization

---

### Task 1: Add minimal Prompt 1 and Prompt 2 validators plus normalizers

**Files:**
- Modify: `apps/chrome-extension/src/runtime/validation.js`
- Test: `apps/chrome-extension/src/runtime/validation.test.js`

- [ ] **Step 1: Write failing validation tests for sparse Prompt 1 and Prompt 2 payloads**

Add tests that describe the new contract:

```js
import {
  normalizePrompt1Data,
  normalizePrompt2Data,
  validatePrompt1MinimalData,
  validatePrompt2MinimalData,
} from "./validation.js";

it("accepts sparse Prompt 1 data when required handoff fields exist", () => {
  const sparse = {
    target_role: "Technical Product Manager",
    target_seniority: "Senior",
    target_domain: "AI products",
    gating_requirements: [{ keyword: "SQL", priority: 9, type: "exact" }],
    high_signal_requirements: [{ keyword: "roadmap", priority: 8, type: "inferred" }],
    flex_notes: "Hiring manager persona: builder-first PM."
  };

  expect(validatePrompt1MinimalData(sparse)).toEqual([]);
});

it("accepts sparse Prompt 2 data when required handoff fields exist", () => {
  const sparse = {
    positioning_thesis: "Builder PM with execution depth.",
    recommended_title: "Senior Technical Product Manager",
    summary_lead: "Technical PM shipping AI products.",
    top_resume_goals: ["Show product ownership", "Show execution", "Show AI domain fit"],
    final_skills_list: ["Roadmapping", "SQL"],
    cannot_claim: ["Direct people management"],
  };

  expect(validatePrompt2MinimalData(sparse)).toEqual([]);
});

it("normalizes sparse Prompt 1 and Prompt 2 data into the legacy full shape", () => {
  const prompt1 = normalizePrompt1Data({
    target_role: "TPM",
    target_seniority: "Senior",
    target_domain: "AI",
    gating_requirements: [],
    high_signal_requirements: [],
    flex_notes: null,
  });
  const prompt2 = normalizePrompt2Data({
    positioning_thesis: "Thesis",
    recommended_title: "Title",
    summary_lead: "Lead",
    top_resume_goals: ["A", "B", "C"],
    final_skills_list: [],
    cannot_claim: [],
  });

  expect(prompt1.medium_signal_requirements).toEqual([]);
  expect(prompt1.flex_notes).toBeNull();
  expect(prompt2.summary_sentences).toBe(2);
  expect(prompt2.signal_map).toEqual([]);
});
```

- [ ] **Step 2: Run the focused validation test file and verify it fails for missing exports**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/validation.test.js
```

Expected:
- FAIL because `validatePrompt1MinimalData`, `validatePrompt2MinimalData`, `normalizePrompt1Data`, and `normalizePrompt2Data` do not exist yet

- [ ] **Step 3: Implement minimal validators and normalizers in `validation.js`**

Add four exports:

```js
export function validatePrompt1MinimalData(data) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Prompt 1 data must be an object."];
  }

  ["target_role", "target_seniority", "target_domain"].forEach((field) => {
    if (!isString(data[field])) {
      errors.push(`prompt1.${field} must be a string.`);
    }
  });

  validateKeywordObjects(
    data.gating_requirements,
    "prompt1.gating_requirements",
    errors,
  );
  validateKeywordObjects(
    data.high_signal_requirements,
    "prompt1.high_signal_requirements",
    errors,
  );

  if (!isNullableString(data.flex_notes)) {
    errors.push("prompt1.flex_notes must be a string or null.");
  }

  return errors;
}

export function normalizePrompt1Data(data) {
  return {
    target_role: data.target_role,
    target_seniority: data.target_seniority,
    target_domain: data.target_domain,
    company_context: typeof data.company_context === "string" ? data.company_context : "",
    role_archetype: typeof data.role_archetype === "string" ? data.role_archetype : "",
    gating_requirements: Array.isArray(data.gating_requirements) ? data.gating_requirements : [],
    high_signal_requirements: Array.isArray(data.high_signal_requirements) ? data.high_signal_requirements : [],
    medium_signal_requirements: Array.isArray(data.medium_signal_requirements) ? data.medium_signal_requirements : [],
    nice_to_have_keywords: Array.isArray(data.nice_to_have_keywords) ? data.nice_to_have_keywords : [],
    target_native_phrases_to_validate: Array.isArray(data.target_native_phrases_to_validate) ? data.target_native_phrases_to_validate : [],
    gating_qualifications: Array.isArray(data.gating_qualifications) ? data.gating_qualifications : [],
    near_gate_qualifications: Array.isArray(data.near_gate_qualifications) ? data.near_gate_qualifications : [],
    preferred_qualifications: Array.isArray(data.preferred_qualifications) ? data.preferred_qualifications : [],
    core_responsibilities: Array.isArray(data.core_responsibilities) ? data.core_responsibilities : [],
    recruiter_hooks: Array.isArray(data.recruiter_hooks) ? data.recruiter_hooks : [],
    hiring_manager_proof: Array.isArray(data.hiring_manager_proof) ? data.hiring_manager_proof : [],
    domain_terms: Array.isArray(data.domain_terms) ? data.domain_terms : [],
    metrics_kpis: Array.isArray(data.metrics_kpis) ? data.metrics_kpis : [],
    tools_platforms: Array.isArray(data.tools_platforms) ? data.tools_platforms : [],
    soft_skills: Array.isArray(data.soft_skills) ? data.soft_skills : [],
    do_not_fake: Array.isArray(data.do_not_fake) ? data.do_not_fake : [],
    deprioritize: Array.isArray(data.deprioritize) ? data.deprioritize : [],
    jd_notes: Array.isArray(data.jd_notes) ? data.jd_notes : [],
    flex_notes: isNullableString(data.flex_notes) ? data.flex_notes : null,
  };
}
```

```js
export function validatePrompt2MinimalData(data) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Prompt 2 data must be an object."];
  }

  ["positioning_thesis", "recommended_title", "summary_lead"].forEach((field) => {
    if (!isString(data[field])) {
      errors.push(`prompt2.${field} must be a string.`);
    }
  });

  validateStringArrayField(data.top_resume_goals, "prompt2.top_resume_goals", errors);
  if (Array.isArray(data.top_resume_goals) && data.top_resume_goals.length !== 3) {
    errors.push("prompt2.top_resume_goals must contain exactly 3 items.");
  }

  validateStringArrayField(data.final_skills_list, "prompt2.final_skills_list", errors);
  validateStringArrayField(data.cannot_claim, "prompt2.cannot_claim", errors);

  if (data.summary_sentences != null && (!isInteger(data.summary_sentences) || ![1, 2].includes(data.summary_sentences))) {
    errors.push("prompt2.summary_sentences must be 1 or 2.");
  }

  if (!isNullableString(data.flex_notes)) {
    errors.push("prompt2.flex_notes must be a string or null.");
  }

  return errors;
}

export function normalizePrompt2Data(data) {
  return {
    validated_role: typeof data.validated_role === "string" ? data.validated_role : "",
    validated_domain: typeof data.validated_domain === "string" ? data.validated_domain : "",
    positioning_thesis: data.positioning_thesis,
    top_resume_goals: Array.isArray(data.top_resume_goals) ? data.top_resume_goals : [],
    recommended_title: data.recommended_title,
    summary_lead: data.summary_lead,
    summary_focus: Array.isArray(data.summary_focus) ? data.summary_focus : [],
    summary_sentences: isInteger(data.summary_sentences) && [1, 2].includes(data.summary_sentences) ? data.summary_sentences : 2,
    voice: typeof data.voice === "string" ? data.voice : "",
    adjacent_framing: typeof data.adjacent_framing === "string" ? data.adjacent_framing : "",
    signal_map: Array.isArray(data.signal_map) ? data.signal_map : [],
    selected_storylines: Array.isArray(data.selected_storylines) ? data.selected_storylines : [],
    experience_emphasis: Array.isArray(data.experience_emphasis) ? data.experience_emphasis : [],
    company_context_guidance: Array.isArray(data.company_context_guidance) ? data.company_context_guidance : [],
    bullet_rewrite_instructions: Array.isArray(data.bullet_rewrite_instructions) ? data.bullet_rewrite_instructions : [],
    education_notes: Array.isArray(data.education_notes) ? data.education_notes : [],
    final_skills_list: Array.isArray(data.final_skills_list) ? data.final_skills_list : [],
    phrases_to_mirror: Array.isArray(data.phrases_to_mirror) ? data.phrases_to_mirror : [],
    cannot_claim: Array.isArray(data.cannot_claim) ? data.cannot_claim : [],
    skills_to_avoid: Array.isArray(data.skills_to_avoid) ? data.skills_to_avoid : [],
    signals_to_avoid: Array.isArray(data.signals_to_avoid) ? data.signals_to_avoid : [],
    gaps: Array.isArray(data.gaps) ? data.gaps : [],
    excitement_anchor: data.excitement_anchor && typeof data.excitement_anchor === "object" ? data.excitement_anchor : { placement: "summary", sentence: "", reason: "" },
    flex_notes: isNullableString(data.flex_notes) ? data.flex_notes : null,
  };
}
```

- [ ] **Step 4: Run the focused validation tests again**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/validation.test.js
```

Expected:
- PASS for the new sparse-payload cases

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-extension/src/runtime/validation.js apps/chrome-extension/src/runtime/validation.test.js
git commit -m "refactor: add light prompt handoff validation"
```

---

### Task 2: Switch Prompt 1 and Prompt 2 runtime gates to the lighter contract

**Files:**
- Modify: `apps/chrome-extension/src/runtime/orchestrator.js`
- Test: `apps/chrome-extension/src/runtime/orchestrator.test.js`

- [ ] **Step 1: Write failing orchestrator tests for sparse Prompt 1 and Prompt 2 acceptance**

Add tests proving:
- Prompt 1 accepts sparse JSON and stores normalized `prompt1Result`
- Prompt 2 accepts sparse JSON and stores normalized `prompt2Result`
- Prompt 3 remains strict and still validates final `ResumeData`

Example assertions:

```js
expect(result.prompt1Result.flex_notes).toBe("Hiring manager persona: builder-first PM.");
expect(result.prompt1Result.medium_signal_requirements).toEqual([]);
expect(result.prompt2Result.signal_map).toEqual([]);
expect(result.prompt2Result.summary_sentences).toBe(2);
```

- [ ] **Step 2: Run the focused orchestrator tests and verify they fail**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/orchestrator.test.js
```

Expected:
- FAIL because Prompt 1 / Prompt 2 still use strict validators during repair and parse

- [ ] **Step 3: Update `orchestrator.js` to use the minimal validators for Prompt 1 and Prompt 2**

Change imports to include the new helpers from `validation.js`, then update:

```js
function validatePrompt1RawOutput(rawText) {
  return buildStructuredPromptValidationResult(rawText, validatePrompt1MinimalData);
}

function validatePrompt2RawOutput(rawText) {
  return buildStructuredPromptValidationResult(rawText, validatePrompt2MinimalData);
}
```

Change parsed handoff extraction:

```js
prompt1Result = normalizePrompt1Data(
  extractJsonFromText(prompt1Raw, {
    validate: (candidate) => validatePrompt1MinimalData(candidate).length === 0,
  }),
);
```

```js
prompt2Result = normalizePrompt2Data(
  extractJsonFromText(prompt2Raw, {
    validate: (candidate) => validatePrompt2MinimalData(candidate).length === 0,
  }),
);
```

Do **not** change Prompt 3:

```js
validateResponse: validatePrompt3RawOutput
validationErrors = validateResumeData(prompt3Parsed);
```

- [ ] **Step 4: Run the focused orchestrator tests again**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/orchestrator.test.js
```

Expected:
- PASS with sparse Prompt 1 / Prompt 2 payloads normalized into stored runtime state

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-extension/src/runtime/orchestrator.js apps/chrome-extension/src/runtime/orchestrator.test.js
git commit -m "refactor: lighten prompt handoff validation"
```

---

### Task 3: Preserve the hiring-manager persona path from Prompt 1 `flex_notes`

**Files:**
- Test: `apps/chrome-extension/src/runtime/prompt-loader.test.js`

- [ ] **Step 1: Write a regression test for the Prompt 1 `flex_notes` path**

Add a test around the existing replacement path in `prompt-loader.js`:

```js
it("keeps the hiring manager persona path when Prompt 1 is normalized from sparse data", async () => {
  const rendered = await renderPrompt2WithMetadata(
    {
      prompt1Json: {
        target_role: "TPM",
        target_seniority: "Senior",
        target_domain: "AI",
        gating_requirements: [],
        high_signal_requirements: [],
        flex_notes: "Hiring manager persona: operator-builder PM.",
      },
      prompt2Json: null,
      systemPrompt: "",
    },
    { id: "claude:api", label: "Claude API" },
  );

  expect(rendered.text).toContain("operator-builder PM");
});
```

- [ ] **Step 2: Run the prompt-loader test file and verify it fails if the persona path regresses**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/prompt-loader.test.js
```

Expected:
- PASS after Task 2 implementation
- If it fails, fix the normalized Prompt 1 object so `flex_notes` survives unchanged

- [ ] **Step 3: Commit**

```bash
git add apps/chrome-extension/src/runtime/prompt-loader.test.js
git commit -m "test: lock prompt1 flex-notes persona path"
```

---

### Task 4: Full verification and manual regression check

**Files:**
- No code changes expected unless verification fails

- [ ] **Step 1: Run the full extension test suite**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test
```

Expected:
- PASS with all existing tests green

- [ ] **Step 2: Manual validation in the unpacked extension**

Manual checks:

```text
1. Reload the unpacked extension.
2. Run one ChatGPT API or Claude API tailoring job with a sparse-but-valid Prompt 1/2 response fixture if available.
3. Confirm Prompt 1/2 no longer fail on missing nonessential arrays/objects.
4. Confirm Prompt 2 still receives the hiring-manager persona from Prompt 1 flex_notes.
5. Confirm Prompt 3 still fails when final ResumeData is malformed.
```

- [ ] **Step 3: Final integration commit**

```bash
git add apps/chrome-extension/src/runtime/validation.js \
        apps/chrome-extension/src/runtime/validation.test.js \
        apps/chrome-extension/src/runtime/orchestrator.js \
        apps/chrome-extension/src/runtime/orchestrator.test.js \
        apps/chrome-extension/src/runtime/prompt-loader.test.js
git commit -m "refactor: simplify prompt handoff validation"
```

---

## Self-review

- Spec coverage:
  - Light Prompt 1 validation: covered in Task 1 and Task 2
  - Light Prompt 2 validation: covered in Task 1 and Task 2
  - Preserve Prompt 1 `flex_notes` hiring-manager persona: covered in Task 1 and Task 3
  - Keep Prompt 3 strict: covered in Task 2 and Task 4
- Placeholder scan:
  - No `TODO` / `TBD` placeholders left
- Type consistency:
  - Minimal validator names and normalizer names are consistent across tasks

