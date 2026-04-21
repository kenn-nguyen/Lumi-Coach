# Engineering Guide

This document defines the preferred architecture and coding practices for the Chrome extension.

## Architecture Goal

Build the first version as a small monolith with clear internal boundaries.

That means:
- one extension workspace
- one orchestration flow
- minimal moving parts
- modular files and folders so pieces can be split later without a rewrite

Do not over-engineer the MVP into micro-systems.
Do not tightly couple everything into one giant file either.

The target shape is:
- monolith at the product level
- modular at the code level

## Recommended Architecture

### 1. Orchestrator

One central orchestration layer should own the end-to-end generation flow:

1. load user assets
2. scrape LinkedIn job
3. render Prompt 1
4. run Prompt 1
5. parse/store Prompt 1 result
6. render Prompt 2
7. run Prompt 2
8. parse/store Prompt 2 result
9. render Prompt 3
10. run Prompt 3
11. validate Prompt 3 result
12. create or patch target resume
13. open app preview
14. save history entry

This orchestrator should be the only place that knows the full workflow.

### 2. Stable Internal Boundaries

Keep these concerns separate:

- `content/`
  page scraping and page-specific adapters

- `providers/llm/`
  prompt rendering, automation, parsing, and future repair flows

- `shared/`
  contracts, session shape, storage keys, and cross-cutting utilities

- side panel UI
  uploads, history, and user actions

- app API client
  create/patch/open resume integration

### 3. Monolith-First Rule

For MVP:
- one orchestration module
- one storage module
- one app API module
- one LinkedIn adapter
- one ChatGPT automation provider

Do not create plugin systems, abstraction-heavy factories, or excessive provider hierarchies unless a second implementation actually exists.

## Future Expansion Strategy

The code should be easy to split later into separate replaceable components:

- job sources
  LinkedIn first, other job boards later

- LLM providers
  ChatGPT web automation first, API-based provider later

- resume backends
  SOM Career Coach first, other targets later if ever needed

- validation and repair
  basic validation first, future Prompt 4 repair later

To support this, keep interfaces narrow and data contracts explicit.

## Data Contracts

Use explicit typed shapes for:

- `jobSnapshot`
- `prompt1Result`
- `prompt2Result`
- `prompt3Parsed`
- `extensionSession`
- `historyEntry`
- `userAssets`

Do not pass around loose untyped objects once data has crossed a stage boundary.

Recommended rule:
- raw external data may be loose
- internal checkpointed data must be normalized

## Storage Rules

Persist only what is needed for resume generation, retry, and history.

Device-global assets only:
- app origin
- API origin
- feature flags
- launcher position and other browser-local UI placement

Account-scoped assets:
- current master resume context
- current storyboard
- prompt templates and prompt profile selection
- provider / LLM settings
- onboarding progress

Session checkpoints:
- job snapshot
- prompt outputs
- validation errors
- patch payload
- patch error
- pending action
- extension session state

History:
- job title
- company
- generated timestamp
- resume id
- preview link
- status

Isolation requirements:
- account-scoped local data must be keyed by signed-in user identity
- do not reuse one shared local workspace across different signed-in users
- a pending action created under account A must never resume under account B
- if website session and extension auth disagree on user identity, treat that as an account switch and re-sync auth before considering the extension connected
- do not expose the existence or identity of other locally stored accounts in the UI

Do not store unnecessary duplicated payloads.

## Failure and Retry Rules

These are hard rules:

- If Prompt 3 fails, do not rerun Prompt 1 and Prompt 2 by default.
- If patch fails, do not lose Prompt 3 output.
- Validate before patching.
- Patch is a separate retriable step.
- Prefer rerunning the smallest possible stage.

## Best Practices For Agents

When coding in this extension, agents should follow these rules:

### Scope

- Change only `apps/chrome-extension`
- Do not modify the main app unless explicitly approved

### Simplicity

- Prefer straightforward code over clever abstractions
- Prefer one good module over many thin wrappers
- Prefer explicit flow over hidden magic
- Remove dead or superseded code when changing direction
- Do not leave residual placeholder paths, unused handlers, or obsolete files behind after a feature replacement

### Boundaries

- Keep scraping logic out of prompt logic
- Keep prompt rendering out of orchestration
- Keep storage code out of UI components
- Keep API patch/create logic out of the scraper and prompt files

### Cleanup

- When a new implementation replaces an old one, delete the old implementation unless it is still actively referenced
- Do not patch around stale code just to preserve it
- Keep the extension lean by removing unused assets, placeholders, and abandoned code paths during the same change

### Types

- Define explicit TypeScript interfaces for persisted and cross-stage data
- Validate untrusted model output before using it
- Treat ChatGPT output as untrusted input

### State Management

- Use one clear session object instead of scattered state flags
- Persist checkpoint state after each successful stage
- Make the flow resumable

### Error Handling

- Return actionable errors
- Preserve useful artifacts on failure
- Log stage name, failure reason, and recoverable next step

### Prompt Discipline

- Keep prompt text in prompt files
- Keep placeholder rendering in the prompt loader
- Keep prompt-specific logic out of the scraper and UI

### UI Discipline

- Side panel should show status and simple actions only
- Do not build complex management UI in the MVP
- Prefer clarity over density
- Keep launcher visibility and job activation as separate concerns:
  - launcher may appear on browsing surfaces
  - scraping and run activation require a concrete selected job
- Browsing surfaces without a selected job must show a dormant `Run` state:
  - `Select a job to start`
  - `Choose a job from the list, then I’ll load it here.`
- Plain LinkedIn jobs home (`/jobs`, `/jobs/`) should not mount the extension surface
- Route handling requirements:
  - background is the source of truth for LinkedIn jobs route changes
  - before route or launcher messages are sent, background must verify the content script is present in the target tab and inject it if needed
  - content script may keep a fallback URL poller at `1s` cadence for LinkedIn jobs pages only
  - that fallback poller must stay cheap:
    - compare only a route signature
    - do not scrape the page, reconcile auth, or perform expensive UI work unless the signature changed

### API Discipline

- Centralize SOM Career Coach API calls in one module
- Keep request/response translation logic in one place
- Never patch the app with unvalidated Prompt 3 output

## Suggested Module Shape

For MVP, a good structure is:

- `src/content/site-adapters/linkedin/`
- `src/providers/llm/prompting/`
- `src/providers/llm/web-automation/`
- `src/shared/types/`
- `src/shared/`
- `src/background/` or background coordinator module
- `src/integrations/resume-matcher/`

The current scaffold does not need all of these fully built yet.
This is the target direction.

## Testing Priorities

Test these first:

1. prompt placeholder rendering
2. schema validation for Prompt 3 output
3. job-to-resume history persistence
4. retry behavior for Prompt 3 failure and patch failure
5. LinkedIn scrape normalization

Do not start with exhaustive UI tests.

## Refactor Trigger Rules

Only split the monolith further when one of these becomes true:

- a second job source is added
- a second LLM provider is added
- side panel UI becomes hard to maintain
- orchestration becomes hard to reason about in one module
- storage and runtime state logic become entangled

When that happens, extract by boundary, not by abstract pattern.

## Non-Goals For MVP

- no version history
- no generalized workflow engine
- no plugin architecture
- no speculative support for many providers
- no premature background job scheduler

## Summary

Build a small monolith with sharp module boundaries.
Checkpoint every stage.
Treat model output as untrusted.
Keep the user flow simple.
Make retry and recovery first-class.
Refactor only when a real second implementation or maintenance pain appears.
