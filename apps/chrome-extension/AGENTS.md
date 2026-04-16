# Chrome Extension Agent Instructions

Scope: these instructions apply to all work under `apps/chrome-extension`.

## Primary Rule

Do not modify the existing SOM Career Coach app outside `apps/chrome-extension`.

That means:
- Do not edit `apps/frontend`
- Do not edit `apps/backend`
- Do not edit shared repo config unless the user explicitly asks
- Do not wire the extension into the main app without approval

## Working Boundary

You may create or edit files only inside:
- `apps/chrome-extension`

If integration with the main app becomes necessary:
- stop
- explain why
- ask the user before changing anything outside this folder

## Extension Goal

Build the Chrome extension as an isolated workspace that can later connect to SOM Career Coach through existing APIs.

Prefer:
- extension-local scripts
- extension-local prompts
- extension-local contracts
- clear placeholders for API base URL, `resume_id`, and auth/session assumptions

## Implementation Guidance

- Keep the extension architecture modular: `background`, `content`, `shared`, and prompt assets.
- Treat LinkedIn scraping and ChatGPT web automation as separate concerns.
- Keep prompt text in dedicated files when practical.
- Avoid hardcoding user-specific values.
- Document any required manual setup in this folder only.

## Safe Assumptions

- The extension may call existing SOM Career Coach APIs later, but should not require repo-side API changes unless explicitly approved.
- UI automation against external sites is brittle; isolate selectors and automation steps in dedicated files.

## Delivery

When making changes for this extension:
- summarize only files under `apps/chrome-extension`
- call out any blocked dependency on the main app
