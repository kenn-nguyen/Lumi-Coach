# Extension-First Onboarding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Chrome extension the primary first-run surface so users can understand, configure, and start tailoring from the extension, while the website opens only for Google sign-in and final resume review.

**Architecture:** Keep the current auth bridge and pending-action resume flow, but move setup orchestration into a shared extension-side state model. The LinkedIn in-page board becomes the primary contextual experience, the side panel becomes a lightweight setup hub, and the website is reduced to auth handoff plus deep editing.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS content/background scripts, Next.js 16, NextAuth, Chrome storage/runtime messaging

---

## File Map

- Create: `apps/chrome-extension/src/runtime/setup-state.js`
  - Shared selector/helper module that computes the user-facing setup state from extension auth, website session, stored assets, and LLM profile settings.
- Modify: `apps/chrome-extension/src/background.js`
  - Centralize gating rules around the new setup-state helper and keep pending-action resume behavior intact.
- Modify: `apps/chrome-extension/src/content/linkedin-job.js`
  - Convert the current run screen into a state-driven onboarding and generation flow with one primary action at a time.
- Modify: `apps/chrome-extension/src/sidepanel/index.html`
  - Reframe the side panel from “settings first” to “setup hub + advanced options”.
- Modify: `apps/chrome-extension/src/sidepanel/panel.js`
  - Render setup progress, next-step CTAs, and advanced controls without forcing first-time users through full settings.
- Modify: `apps/chrome-extension/src/sidepanel/styles.css`
  - Support the new setup-progress and next-step layout while preserving the established visual system.
- Modify: `apps/chrome-extension/src/runtime/api.js`
  - Keep website open behavior narrow and explicit: sign-in and preview only.
- Modify: `apps/frontend/components/auth/auth-extension-bridge-client.tsx`
  - Preserve silent auth sync back to the extension after Google sign-in.
- Modify: `apps/frontend/lib/auth/extension-bridge.ts`
  - Keep bridge state stable enough to resume the exact interrupted extension action.
- Modify: `apps/frontend/app/sign-in/page.tsx`
  - Make the sign-in page clearly extension-originated when `extensionId` is present and avoid drifting users into broader website onboarding.

## Product Rules

- The extension owns:
  - first-run education
  - setup progress
  - auth-required messaging
  - resume/storyboard/provider setup
  - generation
  - recent run access
- The website opens only for:
  - Google sign-in
  - final resume preview/edit
- Storyboard stays recommended, not a hard first-run blocker.
- Provider API keys remain local to extension storage and are requested only when the selected mode requires them.

## State Model

- `unsupported_page`
- `signed_out`
- `missing_resume`
- `missing_provider_config`
- `ready`
- `generating`
- `result_ready`
- `error`

The extension UI should never collapse these into a single vague “setup incomplete” state.

## Chunk 1: Shared Setup State

### Task 1: Add a shared setup-state helper

**Files:**
- Create: `apps/chrome-extension/src/runtime/setup-state.js`
- Modify: `apps/chrome-extension/src/background.js`

- [ ] Define a single helper that reads:
  - extension auth validity
  - website session availability
  - master resume presence
  - storyboard presence
  - active LLM profile and whether the selected mode requires an API key
- [ ] Return a normalized shape with:
  - `state`
  - `title`
  - `detail`
  - `primaryAction`
  - `secondaryAction`
  - `blocking`
- [ ] Move the message strings currently scattered across `background.js` into this helper so content script and side panel present the same status language.
- [ ] Keep storyboard outside the blocking path for first successful generation.
- [ ] Update `background.js` to call the helper before:
  - starting generation
  - resuming a pending action
  - responding to status-check messages

### Task 2: Keep pending-action resume narrow and reliable

**Files:**
- Modify: `apps/chrome-extension/src/background.js`
- Modify: `apps/chrome-extension/src/runtime/api.js`

- [ ] Preserve the existing `setPendingExtensionAction` / `resumePendingExtensionAction` flow.
- [ ] Ensure the pending action survives the sign-in detour without sending the user through dashboard setup.
- [ ] Keep `openWebsiteSignInTab()` limited to sign-in and callback handling.
- [ ] Do not add any new website-first “connect extension” route.

## Chunk 2: LinkedIn In-Page Experience

### Task 3: Turn the LinkedIn board into the primary first-run flow

**Files:**
- Modify: `apps/chrome-extension/src/content/linkedin-job.js`

- [ ] Replace the current first-run mental model of “open settings, fill everything” with a progressive run flow.
- [ ] In the `run` view, render exactly one primary next step based on setup state:
  - `signed_out` -> `Sign in with Google`
  - `missing_resume` -> `Upload resume`
  - `missing_provider_config` -> `Choose provider` or `Add API key`
  - `ready` -> `Tailor this job`
- [ ] Keep provider and storyboard controls accessible from the board, but demote them behind explicit setup actions instead of presenting them all at once.
- [ ] When auth is required, reopen the board in context and resume the exact action after sign-in.
- [ ] When generation succeeds, keep the success state in the board and present:
  - primary: `Open in Lumi Coach`
  - secondary: `Tailor another job`

### Task 4: Clarify copy for first-time users

**Files:**
- Modify: `apps/chrome-extension/src/content/linkedin-job.js`

- [ ] Update first-run copy so the board answers:
  - what this does
  - why this page is supported
  - what the next step is
- [ ] Avoid ambiguous labels like:
  - `missing credentials`
  - `connect extension`
  - `setup incomplete`
- [ ] Use product language that distinguishes:
  - account sign-in
  - local provider API key
  - resume context

## Chunk 3: Side Panel as Setup Hub

### Task 5: Reframe the side panel for onboarding, not administration

**Files:**
- Modify: `apps/chrome-extension/src/sidepanel/index.html`
- Modify: `apps/chrome-extension/src/sidepanel/panel.js`
- Modify: `apps/chrome-extension/src/sidepanel/styles.css`

- [ ] Change the top section from “Run Setup” to a clearer progress-based setup hub.
- [ ] Show a compact checklist at the top:
  - Google sign-in
  - resume uploaded
  - provider ready
  - storyboard optional
- [ ] Keep prompt templates, runtime URLs, and destructive actions inside the advanced foldout only.
- [ ] Do not remove power-user controls; only demote them so first-time users are not forced into them.
- [ ] Keep history available, but secondary to setup and run readiness.

### Task 6: Add “continue where you left off” behavior in the side panel

**Files:**
- Modify: `apps/chrome-extension/src/sidepanel/panel.js`

- [ ] Render the same normalized setup-state summary used by the LinkedIn board.
- [ ] If the user opens the side panel before visiting LinkedIn, show:
  - “Open a LinkedIn job post to tailor your resume.”
- [ ] If the user is mid-setup, show the next smallest action instead of the full control surface.
- [ ] If a pending action exists, show a clear continuation path rather than generic settings.

## Chunk 4: Website Handoff

### Task 7: Make sign-in feel like a short detour, not a product switch

**Files:**
- Modify: `apps/frontend/app/sign-in/page.tsx`
- Modify: `apps/frontend/components/auth/auth-extension-bridge-client.tsx`
- Modify: `apps/frontend/lib/auth/extension-bridge.ts`

- [ ] When `extensionId` is present in the sign-in request, show extension-specific copy:
  - “Sign in with Google to continue in Lumi Coach.”
- [ ] Keep the page focused on auth completion only; do not introduce website onboarding steps here.
- [ ] After successful auth sync, keep the user mentally anchored to the extension action that triggered sign-in.
- [ ] Maintain stable bridge state long enough for the extension to resume the interrupted action.

### Task 8: Keep the website for deep review only

**Files:**
- Modify: `apps/chrome-extension/src/runtime/api.js`
- Modify: `apps/chrome-extension/src/content/linkedin-job.js`

- [ ] Open the website automatically only for:
  - sign-in
  - previewing the generated resume
- [ ] Do not open the dashboard as a generic onboarding destination.
- [ ] Make successful generation feel complete inside the extension before opening the preview tab.

## Chunk 5: Verification

### Task 9: Verify the core first-run journeys

**Files:**
- Modify as needed based on defects found during verification

- [ ] Manually verify:
  - install -> unsupported page -> helpful guidance
  - LinkedIn job -> signed out -> sign-in -> resume upload -> tailor
  - LinkedIn job -> signed in -> missing resume -> upload -> tailor
  - LinkedIn job -> API provider selected without key -> key entry -> tailor
  - LinkedIn job -> no storyboard -> recommendation only -> continue
  - successful run -> preview opens in web app
- [ ] Confirm provider API keys remain stored locally and are not framed as website account credentials.
- [ ] Confirm no path still references the removed `/extension/connect` flow.

### Task 10: Run quality checks

**Files:**
- N/A

- [ ] Run: `cd apps/frontend && npm run lint`
- [ ] Run: `cd apps/frontend && npm run build`
- [ ] Smoke-test the unpacked extension against a LinkedIn job page.
- [ ] Commit in small slices:
  - shared setup state
  - LinkedIn board
  - side panel
  - website auth copy

## Acceptance Criteria

- A first-time user can understand the extension without leaving the extension.
- The first forced website visit is Google sign-in.
- After sign-in, the extension resumes the interrupted action automatically.
- Resume upload and provider setup happen inside the extension.
- Storyboard remains optional for first value.
- The website is opened intentionally for preview/edit, not for generic onboarding.
