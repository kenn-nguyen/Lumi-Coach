# Profile4 Single-Stage Tailoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `profile4` as a one-shot tailoring profile that skips Prompt 1 and Prompt 2, sends one final writer prompt using `CURRENT_RESUME` plus the JD, and still enforces the existing final resume JSON validation-and-repair flow.

**Architecture:** `profile4` is a new prompt profile, not a replacement for Prompt 4 master-resume extraction. The extension runtime will branch in the tailoring path: `profile1/2/3` keep their current multi-stage flow, while `profile4` renders and runs a single final prompt and reuses the current Prompt 3 validation, repair, patch, and preview pipeline. To keep churn low, the one-shot run will reuse the existing `prompt3Input`, `prompt3Raw`, `prompt3Parsed`, and `promptMetadata` artifact fields, with `promptProfileId: "profile4"` as the differentiator.

**Tech Stack:** Chrome MV3 extension JavaScript, backend FastAPI prompt-sync config, Vitest, Python pytest for backend config API.

---

## File Map

**Create**
- `apps/chrome-extension/src/prompts/profiles/profile4/prompt3.txt`
- `apps/backend/app/prompts/extension_defaults/profiles/profile4/prompt3.txt`

**Modify**
- `apps/chrome-extension/src/runtime/prompt-defaults.js`
- `apps/chrome-extension/src/runtime/storage.js`
- `apps/chrome-extension/src/runtime/prompt-loader.test.js`
- `apps/chrome-extension/src/runtime/orchestrator.js`
- `apps/chrome-extension/src/runtime/orchestrator.test.js`
- `apps/chrome-extension/src/content/linkedin-job.js`
- `apps/backend/app/routers/config.py`
- `apps/backend/tests/integration/test_config_api.py`

**Verify**
- `apps/chrome-extension/src/runtime/prompt-loader.test.js`
- `apps/chrome-extension/src/runtime/orchestrator.test.js`
- `apps/backend/tests/integration/test_config_api.py`
- full extension suite in `apps/chrome-extension`

---

### Task 1: Register `profile4` Across Prompt Profile State And UI

**Files:**
- Modify: `apps/chrome-extension/src/runtime/prompt-defaults.js`
- Modify: `apps/chrome-extension/src/runtime/storage.js`
- Modify: `apps/chrome-extension/src/content/linkedin-job.js`
- Test: `apps/chrome-extension/src/runtime/storage.test.js`

- [ ] **Step 1: Write the failing storage test for `profile4` profile registration**

Add a test near the existing prompt-profile storage coverage that proves `profile4` can be stored as the active prompt profile:

```js
it("accepts profile4 as a stored prompt profile", async () => {
  await setExtensionAuth(createAuth(userA));
  await activateAccountWorkspace(userA);

  const profiles = await savePromptTemplateProfileSelection("profile4");

  expect(profiles.activeProfileId).toBe("profile4");
  expect((await getUserAssets()).activePromptProfileId).toBe("profile4");
});
```

- [ ] **Step 2: Run the focused storage test and watch it fail**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/storage.test.js
```

Expected: fail because `profile4` is not in the `PROMPT_PROFILE_IDS` allowlist yet.

- [ ] **Step 3: Add `profile4` to the extension prompt-profile registries**

Update the profile ID lists and defaults:

```js
// apps/chrome-extension/src/runtime/prompt-defaults.js
export const PROMPT_PROFILE_IDS = ["profile1", "profile2", "profile3", "profile4"];

// apps/chrome-extension/src/runtime/storage.js
const PROMPT_PROFILE_IDS = ["profile1", "profile2", "profile3", "profile4"];
```

Do **not** change `DEFAULT_ACTIVE_PROMPT_PROFILE_ID`; leave the default as `profile2`.

- [ ] **Step 4: Add the run/settings UI label and description for `profile4`**

Extend the prompt-profile UI metadata in `apps/chrome-extension/src/content/linkedin-job.js` with a fourth entry, for example:

```js
profile4: {
  label: "Direct",
  stretch: "Medium",
  detail: "One-shot tailoring. No planning stages. Review before submission.",
},
```

Also update any hardcoded `{ profile1, profile2, profile3 }` tab seed objects so `profile4` appears in both settings and run view.

- [ ] **Step 5: Rerun the focused storage test**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/storage.test.js
```

Expected: PASS.

---

### Task 2: Add The `profile4` Prompt Asset And Backend Mirror

**Files:**
- Create: `apps/chrome-extension/src/prompts/profiles/profile4/prompt3.txt`
- Create: `apps/backend/app/prompts/extension_defaults/profiles/profile4/prompt3.txt`
- Modify: `apps/chrome-extension/src/runtime/prompt-defaults.js`
- Modify: `apps/backend/app/routers/config.py`
- Test: `apps/chrome-extension/src/runtime/prompt-loader.test.js`
- Test: `apps/backend/tests/integration/test_config_api.py`

- [ ] **Step 1: Write the failing prompt-loader test for packaged `profile4` prompt resolution**

Add a focused test next to the existing `profile3` prompt-loader coverage:

```js
it("loads the profile4 prompt3 template from the profile4 packaged path", async () => {
  getUserAssets.mockResolvedValue({
    activePromptProfileId: "profile4",
    prompt3TemplateAsset: null,
    systemPromptTemplateAsset: null,
  });
  getServerPromptDefaults.mockResolvedValue({ artifacts: {} });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      createFetchResponse(
        String(url).includes("profiles/profile4/prompt3.txt")
          ? "PROFILE4 TEMPLATE {{JOB_DESCRIPTION}} {{CURRENT_RESUME}}"
          : "PACKAGED",
      ),
    ),
  );

  const promptLoader = await import("./prompt-loader.js");
  const rendered = await promptLoader.renderPrompt3WithMetadata(
    { jobDescriptionRawText: "JD", currentResume: { personalInfo: { name: "T" } } },
    {},
  );

  expect(rendered.text).toContain("PROFILE4 TEMPLATE");
});
```

- [ ] **Step 2: Run the focused prompt-loader test and watch it fail**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/prompt-loader.test.js
```

Expected: fail because `profile4` has no prompt path mapping yet.

- [ ] **Step 3: Create the `profile4` one-shot tailoring prompt asset**

Create `apps/chrome-extension/src/prompts/profiles/profile4/prompt3.txt` with a minimal one-shot writer prompt:

```text
---
prompt_artifact: profile4.prompt3.template
prompt_version: v1.0.0
prompt_label: direct-one-shot-writer
prompt_notes: One-shot tailoring prompt using CURRENT_RESUME and the JD only.
---
/resume_writer: write the resume using the current resume and the job description below.

Job description:
{{JOB_DESCRIPTION}}

Current resume:
{{CURRENT_RESUME}}
```

Do not add extra planning sections. Keep it aligned with the user’s instruction.

- [ ] **Step 4: Mirror the same asset into the backend-owned extension defaults**

Create:

```text
apps/backend/app/prompts/extension_defaults/profiles/profile4/prompt3.txt
```

with the same contents and metadata as the packaged extension copy.

- [ ] **Step 5: Register `profile4` in prompt defaults and backend sync mapping**

Add the profile4 prompt3 path in:

```js
// apps/chrome-extension/src/runtime/prompt-defaults.js
profile4: {
  prompt3: "src/prompts/profiles/profile4/prompt3.txt",
  systemPrompt: "src/prompts/system-prompt.txt",
},
```

and in:

```python
# apps/backend/app/routers/config.py
"profile4": {
    "prompt3": "profiles/profile4/prompt3.txt",
},
```

Keep `prompt1` and `prompt2` absent for `profile4`; the runtime branch will not request them.

- [ ] **Step 6: Add a backend sync test for the new profile mapping**

Extend `apps/backend/tests/integration/test_config_api.py` with an assertion that the sync manifest can serve `profile4.prompt3.template` from the backend mirror.

- [ ] **Step 7: Run focused prompt and backend tests**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/prompt-loader.test.js
```

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/backend
uv run pytest tests/integration/test_config_api.py -q
```

Expected: both PASS.

---

### Task 3: Branch The Tailoring Orchestrator For Single-Stage `profile4`

**Files:**
- Modify: `apps/chrome-extension/src/runtime/orchestrator.js`
- Test: `apps/chrome-extension/src/runtime/orchestrator.test.js`

- [ ] **Step 1: Write the failing orchestrator test for skipping Prompt 1 and Prompt 2**

Add a test proving `profile4` runs only the final writer stage:

```js
it("runs profile4 as a single-stage tailoring flow", async () => {
  // Arrange a profile4 run with prompt3 renderer and runPrompt stubs
  // Assert:
  // - renderPrompt1WithMetadata is not used
  // - renderPrompt2WithMetadata is not used
  // - renderPrompt3WithMetadata is used once
  // - validatePrompt3RawOutput / buildPrompt3RepairPrompt path is still used
});
```

If the existing test style uses spies or injected mocks, follow that pattern exactly; do not invent a new harness.

- [ ] **Step 2: Run the focused orchestrator test and watch it fail**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/orchestrator.test.js
```

Expected: fail because the runtime still always enters Prompt 1 and Prompt 2.

- [ ] **Step 3: Add a profile4 flow predicate**

Near `isFreeformPromptProfileId(...)`, add a dedicated helper:

```js
function isSingleStagePromptProfileId(promptProfileId = "") {
  return String(promptProfileId || "").trim() === "profile4";
}
```

Keep `profile3` freeform behavior separate; `profile4` is not just another freeform variant.

- [ ] **Step 4: Implement the single-stage branch in `generateResumeForLinkedInJob(...)`**

In the main tailoring flow:

1. keep base-resume resolution and `promptContext` creation unchanged
2. after prompt metadata/system prompt setup, branch on `profile4`
3. in that branch:
   - render only `prompt3`
   - run only `prompt3`
   - reuse:
     - `validatePrompt3RawOutput`
     - `buildPrompt3RepairPrompt`
     - current JSON extraction / parse / normalize / patch path
   - do **not** render or run Prompt 1 or Prompt 2

The intended shape is:

```js
if (isSingleStagePromptProfileId(activePromptProfileId)) {
  const prompt3Rendered = await renderPrompt3WithMetadata(promptContext, activeLlmProfile);
  // persist prompt3Input
  // run prompt3 with existing final validator + repair prompt
  // parse final resume JSON
  // continue into patch/rename/preview exactly like the existing Prompt 3 success path
}
```

- [ ] **Step 5: Preserve current artifact storage with the minimum field churn**

For `profile4`, keep:

```js
prompt1Input = null;
prompt1Raw = null;
prompt1Result = null;
prompt2Input = null;
prompt2Raw = null;
prompt2Result = null;
```

and still persist:

```js
prompt3Input;
prompt3Raw;
prompt3Parsed;
prompt3Feedback;
promptMetadata;
```

That keeps export/debug payloads compatible while clearly showing that the run was single-stage.

- [ ] **Step 6: Skip Prompt 1/2 stage analytics events for `profile4`**

Do not emit `prompt_stage_started/succeeded` for stages 1 and 2 in a `profile4` run. Only emit the final writer stage event, reusing the existing stage-3 writer event shape unless the repo already has a cleaner single-stage event convention.

- [ ] **Step 7: Rerun the focused orchestrator test**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/orchestrator.test.js
```

Expected: PASS.

---

### Task 4: Hide Prompt 1 / Prompt 2 Editing Controls For `profile4`

**Files:**
- Modify: `apps/chrome-extension/src/content/linkedin-job.js`
- Test: `apps/chrome-extension/src/runtime/prompt-loader.test.js` (coverage only for prompt rendering paths if no content-script UI test harness exists)

- [ ] **Step 1: Update the settings prompt-file list to be profile-aware**

The settings panel currently renders Prompt 1/2/3 upload rows unconditionally. Add a helper that returns the prompt templates relevant to the active profile:

```js
function getEditablePromptTemplateNamesForProfile(profileId) {
  if (profileId === "profile4") {
    return ["prompt3", "systemPrompt"];
  }
  return ["prompt1", "prompt2", "prompt3", "systemPrompt"];
}
```

Use that helper when rendering the Prompting section so `profile4` shows only the one actual tailoring prompt plus system prompt.

- [ ] **Step 2: Disable profile4 prompt downloads/uploads for Prompt 1/2 paths**

Any action handlers that currently assume Prompt 1/2 exist for every profile should respect the helper above and never request/download/upload Prompt 1/2 when `profile4` is active.

- [ ] **Step 3: Smoke-check the settings rendering manually**

After implementation, reload the unpacked extension and verify:
- `profile4` appears in style selection
- Prompting settings show only the relevant prompt row(s) for `profile4`
- Switching back to `profile1/2/3` restores the multi-prompt rows

No automated UI test is required if the repo has no existing content-script settings renderer test harness for this section.

---

### Task 5: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused extension tests**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test -- src/runtime/prompt-loader.test.js src/runtime/orchestrator.test.js src/runtime/storage.test.js
```

Expected: PASS.

- [ ] **Step 2: Run the full extension suite**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension
npm test
```

Expected: PASS.

- [ ] **Step 3: Run the backend config sync test**

Run:

```bash
cd /Users/kennng/Documents/Resume-Matcher/apps/backend
uv run pytest tests/integration/test_config_api.py -q
```

Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run this manually in the browser:

1. reload the unpacked extension
2. switch to `profile4`
3. start a tailoring run
4. verify the exported run data shows:
   - `prompt1*` empty
   - `prompt2*` empty
   - `prompt3Input` populated
   - `prompt3Raw` populated
   - `promptProfileId: "profile4"`
5. verify invalid final JSON still triggers one repair/reask attempt

- [ ] **Step 5: Commit**

```bash
git add \
  apps/chrome-extension/src/prompts/profiles/profile4/prompt3.txt \
  apps/backend/app/prompts/extension_defaults/profiles/profile4/prompt3.txt \
  apps/chrome-extension/src/runtime/prompt-defaults.js \
  apps/chrome-extension/src/runtime/storage.js \
  apps/chrome-extension/src/runtime/prompt-loader.test.js \
  apps/chrome-extension/src/runtime/orchestrator.js \
  apps/chrome-extension/src/runtime/orchestrator.test.js \
  apps/chrome-extension/src/content/linkedin-job.js \
  apps/backend/app/routers/config.py \
  apps/backend/tests/integration/test_config_api.py \
  docs/superpowers/plans/2026-05-24-profile4-single-stage-tailoring.md
git commit -m "feat: add profile4 single-stage tailoring flow"
```

