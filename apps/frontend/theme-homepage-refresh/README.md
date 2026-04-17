# Homepage Refresh Theme Workspace

This folder is the isolated workspace for the future visual refresh.

Scope rules:

- Do not edit live routes, components, or existing app styling from here.
- Do not change layout structure or logic flow.
- Do not introduce new product logic.
- Only define the visual system, screen guidance, and static previews for a later reskin.

## Design Position

The right target is not "homepage pasted onto product."

The right target is a product UI that inherits the homepage's discipline:

- warm and bright
- editorial, not theatrical
- technical, not sterile
- precise, not ornamental
- calm enough for long work sessions

## What Was Wrong With The First Theme Pass

The first pass improved the tone, but it still had three structural problems:

1. It used too many visual materials.
Glass, gradients, blur, soft cards, and oversized radii were all competing at once.

2. It made every screen feel equally branded.
That is the wrong model. Builder, viewer, and settings are work tools. They should be quieter than dashboard, sign-in, and connect.

3. It described "premium" without operational rules.
"Premium" is not gradients and rounded corners. In this app it should mean hierarchy, restraint, rhythm, and confidence.

## Corrected Theme Direction

The corrected direction is:

- bright premium skin
- one dominant accent family
- fewer depths and fewer materials
- stronger typography-led hierarchy
- document-first behavior on dense screens

This should feel like:

- a mature product
- easier to scan
- calmer to use for long sessions
- related to the homepage without impersonating it

## System Model

There should only be three surface roles:

1. App background
2. Standard elevated card
3. Focused work surface

There should only be two screen modes:

1. Brand-led
- dashboard
- sign-in
- connect

2. Work-led
- builder
- tailor
- viewer
- settings

Brand-led screens can carry more blueprint texture and softer flourish.
Work-led screens should be more solid, more exact, and more document-oriented.

## Implementation Constraints

- Same screen structure
- Same placement
- Same interactions
- Same logic flow
- Only visual treatment changes

## Files In This Workspace

- `tokens.css`
  The corrected token system for the bright refresh.
- `component-rules.md`
  Visual rules for each existing component category.
- `screen-guidelines.md`
  Screen-level rules and mode splits.
- `skin-only-migration-checklist.md`
  The hard boundary for implementation. Use this to prevent layout, structure, or logic drift during rollout.
- `preview-shared.css`
  Shared preview implementation styles.
- `preview.html`
  Hub for all screen previews.
- `*-spec.md`
  Page-specific implementation specs for later live adoption.

## Better Design Priorities

1. Readability
2. Hierarchy
3. Precision
4. Emotional tone
5. Flourish

## Corrected Implementation Order

1. Finalize tokens
2. Finalize component rules
3. Finalize screen specs
4. Tighten static previews
5. Apply to auth and dashboard first
6. Apply to tailor and settings
7. Apply to viewer
8. Apply to builder last
