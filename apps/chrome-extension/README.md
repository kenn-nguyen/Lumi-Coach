# Lumi Coach — Chrome Extension

The LinkedIn-to-resume Chrome extension (Manifest V3). This is Lumi Coach's **primary capture surface**: it runs on LinkedIn job pages, tailors the resume, and hands the result to the [web workspace](https://som-career-coach-iota.vercel.app/). This README is the behavioral/interaction contract for the extension.

Flow:
- Show a floating generate action on LinkedIn job pages
- Extract job data from LinkedIn
- Run the multi-step prompt pipeline
- Produce `ResumeData` JSON
- Create one job-specific `resume_id`
- Patch the tailored JSON into that record
- Open the resume preview page in the Lumi Coach web app
- Use the floating board for assets, runs, and settings

Interaction contract:
- default visible state is the floating launcher icon
- clicking the launcher opens the floating board
- minimizing the board returns to the launcher
- launcher and board share the same docked position
- both can be dragged
- on release, they snap to the nearer left/right edge
- they always keep a small fixed gap from the browser edge
- only one of them is visible at a time
- minimized errors are shown as a `!` badge on the launcher
- the board has three views:
  - `Run`
  - `Runs`
  - `Settings`
- `Run` is the default view
- `Runs` and `Settings` render wider than `Run`
- the title is `Lumi Coach`
- clicking the logo opens `https://som-career-coach-iota.vercel.app/`
- the home icon returns to `Run`

Jobs surface visibility contract:
- hide the extension on plain LinkedIn jobs home:
  - `/jobs`
  - `/jobs/`
- show the floating launcher on LinkedIn jobs browsing surfaces:
  - `/jobs/search...`
  - `/jobs/collections/...`
  - direct selected-job pages such as `/jobs/view/<id>`
  - any LinkedIn jobs URL carrying `currentJobId=<id>`
- on browsing surfaces with no selected job id yet, show the launcher and board but keep `Run` dormant
- dormant `Run` state must say:
  - `Select a job to start`
  - `Choose a job from the list, then I’ll load it here.`
- while dormant with no selected job, the extension must not:
  - scrape the job
  - auto-check auth for `Run`
  - auto-start or auto-resume a run
- once a concrete selected job exists, the extension may enter:
  - `Loading job`
  - then normal setup / ready / running states
- route detection must not rely on LinkedIn DOM churn alone:
  - background should notify the content script about LinkedIn jobs route changes
  - before sending route updates or launcher commands, background must ensure the LinkedIn content script is actually attached to the tab
- keep a lightweight fallback route watcher in the content script:
  - while on LinkedIn jobs surfaces, poll the URL signature every `1s`
  - the poller must only compare route state such as mode, pathname, query, and selected job id
  - the poller must not scrape, re-auth, or rerender unless the route signature actually changed

Product model:
- launcher = minimized surface
- run = operational console
- runs = recent-run recall
- settings = repair/configuration
- Google is the only supported sign-in method
- the user-facing auth model is only:
  - signed in
  - signed out
- the app should notify the extension when sign-in succeeds and when sign-out happens
- the extension should also reconcile directly against the backend/app session on active use
- there is no dedicated extension connect page
- there is no manual `Connect` step in normal flow
- App URL and API URL live under `Advanced`, not the default settings surface

Account isolation contract:
- the currently signed-in website user owns the active extension workspace
- account-bound local extension data must be isolated per signed-in user
- one user must never see, resume, or overwrite another user’s local extension state
- account-bound local data includes:
  - master resume context
  - storyboard
  - prompt templates and prompt profile selection
  - provider / LLM settings
  - onboarding progress
  - pending action
  - extension run session
  - history
  - last error
- signing out clears extension auth and stops resumable work for that account, but does not expose another account’s local data
- switching from account A to account B must activate B’s isolated workspace and must not resume A’s pending run
- settings must keep two destructive scopes distinct:
  - `Clear this account`
  - `Clear this browser`
- do not collapse these back into one shared destructive reset without explicit product approval

UI state contract:
- `Ready` / `Success`
  - green
- `Running` / active progress
  - blue
- `Warning` / `Blocked`
  - orange or amber
- `Error`
  - red
- `Neutral`
  - glass/white default surfaces

Rules:
- launcher stays neutral and only shows a red `!` badge when minimized + errored
- `Run` owns the dominant workflow state
- if job details are still loading, `Run` shows a blue loading state instead of an alert
- the extension becomes ready as soon as it has enough job data, even if LinkedIn is still finishing the page
- only after a short timeout should missing job details escalate to `Refresh page`
- `Runs` stays quiet and dense; status color is secondary
- `Settings` stays neutral except for missing setup warnings and advanced danger actions
- the Google sign-in row uses a single Google-branded button with no separate status label
- button text is:
  - `Sign in with Google` when signed out
  - `Sign out` when signed in
- use one dominant state at a time in `Run`
- provider selection controls provider-specific field visibility
- only the required field boxes for the selected provider are shown
- other provider-specific fields are hidden, not disabled in place
- resume and storyboard use compact single-row file chips
- left side shows filename or placeholder
- trailing in-chip icon action
- empty state action is upload
- populated state action becomes delete/clear
- the upload icon stays visually secondary inside the chip
- `Advanced` contains prompt file uploads before the App URL and API URL fields
- prompt meaning lives inside each chip row, with no separate prompt label line
- packaged default prompts are downloadable where a real default file exists

Key files:
- `manifest.json`: Chrome extension manifest (MV3)
- `src/background.js`: extension coordinator
- `src/content/linkedin-job.js`: LinkedIn floating action and trigger
- `src/prompts/prompt1.txt`: keyword extraction prompt
- `src/prompts/prompt2.txt`: planning/summarization prompt
- `src/prompts/prompt3.txt`: resume-tailoring prompt
- `src/shared/contracts.js`: shared request/response shape notes

Source-aligned port locations:
- `src/content/site-adapters/linkedin/adapter.ts`
- `src/providers/llm/web-automation/chatgpt-automation.ts`
- `src/providers/llm/prompting/web-automation-renderer.ts`
- `src/providers/llm/prompting/chatgpt-prompt-sequence.ts`

See `PORTING_MAP.md` for the exact source-to-target mapping.
See `ARCHITECTURE.md` for checkpointing and retry behavior.
See `ENGINEERING.md` for architecture and coding practices.
