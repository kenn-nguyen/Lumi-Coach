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

## Fixed Interaction Contract

These interaction rules are product requirements for the extension UI and should not be changed unless the user explicitly asks to change them.

### Launcher And Board Model

- The default visible state on page load is the floating launcher icon.
- The floating board is not open by default.
- Clicking the floating launcher opens the floating board.
- When the board opens, the launcher hides.
- Minimizing the board returns it to the floating launcher state.
- The launcher reappears at the same docked position as the board.
- Only one surface is visible at a time:
  - floating launcher
  - or floating board

### Dragging And Docking

- Both the floating launcher and the floating board can be moved by click-and-hold drag.
- The floating board can be dragged from any non-interactive region.
- The floating launcher is dragged from its body.
- While dragging, the object may move freely with the pointer.
- On mouse release, the object must snap to the nearest horizontal edge.
- Resting states are limited to:
  - left edge
  - right edge
- The launcher or board must never remain resting in the middle of the window.

### Edge Gap

- Both the floating launcher and the floating board must always keep a small fixed gap from the Chrome window edge.
- Target gap: about `8px`.

### Shared Position Model

- The floating launcher and the floating board share the same docked position state:
  - `side`
  - `top`
- Expanding or minimizing must preserve that same docked position.

### Navigation And Sizing

- The board contains exactly three views:
  - `Run`
  - `Runs`
  - `Settings`
- `Run` is the default open view.
- `Runs` and `Settings` should render about `30%` wider than `Run`.
- The header contains:
  - website/logo button
  - home button
  - runs button
  - settings button
  - minimize button
- The app title is `Lumi Coach`.
- Clicking the logo opens:
  - `https://som-career-coach-iota.vercel.app/`
- Clicking the home button always returns to `Run`.

### Error Notification

- If the board is minimized and a run hits an error, the floating launcher shows a small `!` alert badge.

### Persistence

- The extension should remember the most recent dock side and vertical offset.
- Reopening the launcher or board should restore that same docked position.

## MECE Product Model

The extension must be organized into these non-overlapping layers:

1. `Surface state`
2. `Navigation state`
3. `Workflow state`
4. `System/setup state`

### Surface State

- `Launcher Visible`
  - minimized presence only
  - hover reveals close affordance
  - optional `!` badge for minimized error
- `Board Open`
  - expanded operational surface
  - one board only
- `Hidden`
  - explicitly dismissed
  - restored only from the Chrome extension toolbar

### Navigation State

- `Run`
  - operational surface for the current LinkedIn job
- `Runs`
  - recent-run recall and reopen
- `Settings`
  - repair and configuration only

### Workflow State: Run

- `Job Detected`
  - show title, company, location, applicants only if trustworthy
- `Job Partially Parsed`
  - hide weak metadata instead of showing noisy LinkedIn text
- `Loading Job`
  - when the page does not yet have enough job data, show a non-alert loading/info state
  - wait until the extension has enough job details to start; do not wait for full page completion
  - after a short timeout, escalate to `Refresh page`
- `Ready to Run`
  - one primary action: `Tailor`
- `Blocked: Google Sign-In Required`
  - one next step: `Sign in`
- `Blocked: Resume Required`
  - one next step: `Settings`
- `Blocked: Storyboard Required`
  - one next step: `Settings` or `Continue` when explicitly allowed
- `Running`
  - compact stage/progress state inside `Run`
- `Success`
  - deterministic behavior:
    - open the web automatically
    - then show a concise opened/success state if still visible
- `Error`
  - one concise failure state
  - one clear recovery action

### Workflow State: Runs

- `No History`
  - simple empty state
- `History Present`
  - dense rows only:
    - title
    - company
    - time
    - status
    - open action

### Workflow State: Settings

- `Resume`
  - filename/status
  - compact file chip row
  - left: filename or placeholder
  - right: small icon upload/replace action
- `Google Sign-In`
  - represented by a single Google-branded button, not a separate status label
  - if website session exists but extension token is missing, the extension should self-heal automatically without exposing a separate `Connect` state
  - button text is `Sign in with Google` when a real Google sign-in is required
  - when fully connected, keep the Google mark and change the text to `Sign out`
  - sign-out should route through the frontend app sign-out URL instead of clearing extension auth locally first
  - when the app knows the extension identity and the user becomes authenticated on the website, the app should automatically sync auth to the extension
  - when the user signs out on the website, the app should automatically notify the extension and clear extension auth
- `Storyboard`
  - filename/status
  - compact file chip row
  - left: filename or placeholder
  - trailing in-chip icon action
  - empty state action: upload
  - populated state action: delete/clear
  - the upload icon must stay visually secondary, not dominate the chip
- `Provider`
  - provider selection is the controlling field
  - only the required field boxes for the selected provider/mode may be visible
  - all other provider-specific fields must be hidden, not merely disabled
- `Advanced`
  - collapsed by default
  - contains:
    - prompting file uploads
    - prompt meaning should live inside each chip row, not in a separate label line
    - default packaged prompts should be downloadable where they exist
    - app URL
    - API URL
    - custom feature flag
    - danger actions
  - the custom feature row must render a visible checkbox before the label text
  - prompting appears before the app/API URL fields

## Component Inventory

### Shared Shell Components

- `FloatingLauncher`
- `FloatingBoardShell`
- `BoardHeader`
- `IconButton`

### Run Components

- `JobSummaryBlock`
- `RunReadyIndicator`
- `RunMetaInline`
- `RunStatusCard`
- `RunMessageField`
- `RunActionRow`
- `RunStatusActions`

### Runs Components

- `RunsList`
- `RunHistoryRow`
- `RunStatusPill`

### Settings Components

- `SettingsGroup`
- `SettingsRow`
- `FileAssetRow`
  - rendered as a compact single-row chip
  - not a large input-pill plus text button
- `GoogleSignInRow`
- `ProviderRow`
- `AdvancedSection`

### Provider Progressive Disclosure

- The provider selector controls which provider-specific fields are visible.
- Only fields required by the currently selected provider should be shown.
- Provider fields that do not belong to the selected provider must be hidden.
- Hidden provider fields should not remain visually present as disabled or empty boxes.
- Example:
  - `web_automation`
    - show only web-automation fields such as target URL
    - hide API-only fields such as API base, model, and API key
  - `api`
    - show only API-related fields such as API base, model, and API key
    - hide web-only fields such as target URL

## UI Principles

- `Run` must stay operational and minimal, not admin-heavy.
- `Runs` and `Settings` must not compete visually with `Run`.
- Use one dominant state and one primary action at a time.
- Do not expose extension-internal auth plumbing such as a manual `Connect` step or a dedicated connect page.
- Hide weak or noisy metadata instead of displaying raw scrape output.
- Prefer labels inside inputs where obvious.
- Avoid box-in-box unless hierarchy truly requires it.

## UI State Contract

These visual states are fixed product/UI requirements for the extension. Do not invent new tones casually, and do not remap their meanings unless the user explicitly changes the contract.

### State Palette

- `Neutral`
  - meaning:
    - default surface
    - quiet metadata
    - non-blocking secondary information
  - UI:
    - glass/white surface
    - dark text
    - no alert tint

- `Ready`
  - meaning:
    - all blocking requirements are satisfied
    - safe to run
  - UI:
    - green readiness check or green success pill
    - should be compact, not a large banner
    - use only in `Run` job/readiness context and true completion/success contexts

- `Info`
  - meaning:
    - informative but not blocking
    - contextual details or non-urgent state
  - UI:
    - cool blue tint
    - subdued border
    - dark readable text

- `Running`
  - meaning:
    - work is actively in progress
    - orchestration is happening now
  - UI:
    - blue state treatment
    - compact progress/status card
    - primary action becomes disabled or running
    - secondary action becomes `Minimize`

- `Warning`
  - meaning:
    - user attention needed
    - recoverable issue
    - optional-but-important missing input
  - UI:
    - orange/amber tint
    - darker amber text
    - should not look like success or catastrophic failure

- `Blocked`
  - meaning:
    - run cannot proceed until a prerequisite is fixed
    - missing account / resume / required storyboard / unusable page parse
  - UI:
    - same family as warning by default
    - one concise message
    - one clear next-step CTA
    - avoid multiple competing actions

- `Error`
  - meaning:
    - run failed
    - something broke unexpectedly
  - UI:
    - red tint
    - high-contrast text
    - one recovery action
    - if minimized, propagate to launcher `!` badge

- `Success`
  - meaning:
    - run completed successfully
    - output opened or is ready to open
  - UI:
    - green tint or green compact success marker
    - concise, not celebratory
    - avoid large success panels

- `Danger`
  - meaning:
    - destructive settings actions only
  - UI:
    - red text/button treatment
    - only in `Advanced`

### State Usage By Area

#### Launcher

- default:
  - neutral launcher only
- minimized error:
  - red `!` badge only
- launcher should not display detailed running/success/error copy
- launcher should not become a status panel

#### Run

- `Job summary`
  - neutral surface
  - compact green ready indicator only when truly ready
- `Blocked`
  - use warning/blocked treatment
  - examples:
    - `Add resume`
  - `Google sign-in required`
    - `Storyboard required`
    - `Refresh page`
- `Running`
  - blue progress state
  - short stage label only
- `Error`
  - red status card
  - one recovery action
- `Success`
  - green concise confirmation
  - if the web opens automatically, state should read as “opened” not “ready”

#### Runs

- default rows are neutral
- status pills may use:
  - green for completed/success
  - blue for active/in-progress if ever shown
  - orange for waiting/blocked if ever shown
  - red for failed if ever shown
- the list should remain visually quiet; status color is secondary to scanability

#### Settings

- default rows are neutral
- connected/healthy states:
  - compact green or dark-neutral status text
- missing-but-fixable setup:
  - warning/blocked treatment
- destructive actions:
  - danger only inside `Advanced`

### Run State To UI Mapping

- `Job Partially Parsed`
  - neutral or warning, depending on severity
  - hide weak metadata instead of showing junk

- `Ready to Run`
  - compact ready indicator
  - primary CTA enabled

- `Blocked: Account Required`
  - blocked/warning card
  - CTA: `Sign in`

- `Blocked: Resume Required`
  - blocked/warning card
  - CTA: `Settings`

- `Blocked: Storyboard Required`
  - blocked/warning card
  - CTA: `Settings` or explicit `Continue` when that path is allowed

- `Running`
  - blue status card
  - stage text only

- `Success`
  - green compact success state
  - deterministic language:
    - `Opened in web app`
    - or `Ready to open`

- `Error`
  - red status card
  - one recovery action

### Component Contract

- `RunStatusCard`
  - exactly one dominant tone at a time
  - allowed tones:
    - `running`
    - `warning/blocked`
    - `error`
    - `success`
  - should not stack multiple alerts at once

- `RunReadyIndicator`
  - compact only
  - green when ready
  - muted/neutral when not ready
  - never red

- `RunStatusActions`
  - only actions relevant to the current state
  - avoid showing more than two actions

- `RunHistoryRow`
  - compact neutral row
  - status pill optional, never dominant

- `SettingsRow`
  - neutral by default
  - warning only if setup is missing
  - danger only for destructive advanced actions

### Copy Contract

- warning/blocked copy:
  - short, directive, repair-oriented
- running copy:
  - stage-based, not verbose
- success copy:
  - concise and final
- error copy:
  - useful and specific
  - no generic failure walls of text

### Anti-Patterns

- Do not use red for non-failing states.
- Do not use green for merely informational states.
- Do not show multiple simultaneous alert cards in `Run`.
- Do not promote warnings to full-screen or large-panel treatment.
- Do not turn `Runs` or `Settings` into high-chroma dashboards.
