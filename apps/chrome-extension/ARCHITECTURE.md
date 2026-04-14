# Extension Architecture

This document defines the intended runtime flow and checkpointing rules for the Chrome extension.

## Core Flow

1. User sets an optional master resume id override, uploads the local master resume context, and uploads the storyboard in the side panel admin board
2. User clicks the floating action on a LinkedIn job page
3. Scrape the LinkedIn job into a `jobSnapshot`
4. Create a fresh job-specific `resume_id` by cloning the app master resume
5. Run Prompt 1 and persist the parsed result
6. Run Prompt 2 using Prompt 1 output and persist the parsed result
7. Run Prompt 3 using Prompt 2 output, current resume, and storyboard
8. Parse and validate Prompt 3 output as `ResumeData`
9. Patch the validated JSON to the job-specific `resume_id`
10. Open the resume preview page and save the job-to-resume history entry

## Checkpoint Rule

Every stage should persist its usable output before moving to the next stage.

Minimum checkpoints:
- `jobSnapshot`
- `prompt1Result`
- `prompt2Result`
- `prompt3Raw`
- `prompt3Parsed`
- `prompt3ValidationErrors`
- `patchPayload`
- `patchError`

## Hard Retry Rules

These are required behaviors for the extension:

- If Prompt 3 fails, do not rerun Prompt 1 and Prompt 2 by default.
- If patching the resume fails, do not lose Prompt 3 output.
- Prompt 1 and Prompt 2 are reusable checkpoints.
- Prompt 3 output is a reusable artifact and must be persisted before patching.
- Patching is a separate retriable step from generation.

## Recovery Behavior

### Prompt 3 parse or schema failure

Keep:
- `prompt1Result`
- `prompt2Result`
- `prompt3Raw`
- validation errors

Allow:
- rerun Prompt 3 only
- future schema-repair flow

### Backend patch failure

Keep:
- `prompt3Parsed`
- `patchPayload`
- `patchError`

Allow:
- retry patch without rerunning ChatGPT

## Recommended Session Shape

```ts
type ExtensionSession = {
  sessionId: string;
  selectedResumeId: string;
  status:
    | 'idle'
    | 'scraped'
    | 'prompt1_done'
    | 'prompt2_done'
    | 'prompt3_done'
    | 'validated'
    | 'patched'
    | 'error';
  jobSnapshot: unknown;
  resumeSource: unknown;
  storyboard: unknown;
  prompt1Result: unknown;
  prompt2Result: unknown;
  prompt3Raw: string | null;
  prompt3Parsed: unknown;
  prompt3ValidationErrors: string[];
  patchPayload: unknown;
  patchError: string | null;
  updatedAt: string;
};
```

## Design Principles

- Use raw JD text as the primary source for Prompt 1.
- Treat each prompt as a checkpointed stage.
- Validate Prompt 3 output before patching the main app.
- Prefer rerunning the smallest necessary stage.
- Preserve user work and generated artifacts whenever a downstream step fails.

## Future Slot

A future `prompt4-repair` step may be added after Prompt 3 validation fails.

It is intentionally not implemented yet.
