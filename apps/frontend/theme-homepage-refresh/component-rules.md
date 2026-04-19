# Component Rules

These rules define how existing component types should change visually without changing behavior or placement.

## Global Principles

- Keep current component boundaries.
- Prefer token-driven styling over page-specific decoration.
- Use fewer materials, not more.
- Let typography and spacing create hierarchy before adding color or effects.
- The work should feel intentional and quiet.

## Buttons

### Primary

- Use a single blue accent family.
- Keep silhouette strong and obvious.
- Gradient is allowed, but only subtle and vertical.
- No large glow, blur, or oversized rounding.

### Secondary

- Use solid light surfaces with visible border.
- Must remain clearly actionable.
- Should not disappear into the page.

### Danger

- Use quiet tinted background and crisp red text.
- Avoid loud destructive styling unless the live UI already demands urgency.

Do not change:

- button grouping
- action order
- disabled logic
- loading logic

## Inputs / Textareas / Selects

- Default to solid bright fields, not glass.
- Border must remain visible at rest.
- Focus state should be crisp and technical.
- Placeholder text should stay readable, not washed out.
- Dense editing views should favor stability over softness.

Do not change:

- field order
- labels/help/error logic
- field sizing logic unless visual polish requires small alignment fixes

## Cards / Panels

Use only three panel roles:

1. Standard card

- list rows
- settings groups
- info modules

2. Elevated shell

- dashboard outer container
- auth container
- major page wrapper

3. Work surface

- editor side
- preview side
- document framing chrome

Rules:

- Standard cards are mostly solid.
- Elevated shells may use mild tint or blueprint context.
- Work surfaces should be the cleanest and least decorative.

## Tabs / Segmented Controls

- Tabs on dense screens should feel structural, not playful.
- Builder tabs should be flatter and more anchored.
- Settings segmented controls may use stronger active fills, but still stay restrained.
- Keep selected state very clear.

Do not change:

- tab order
- routing/state behavior

## Status Chips

- Keep them compact.
- Use small uppercase style only where the live product already does.
- Reduce decorative saturation.
- Prefer trust and clarity over novelty.

Do not change:

- existing status taxonomy
- status calculation logic

## Dialogs / Modals

- Use solid bright elevated surfaces.
- Backdrop should separate, not dramatize.
- Confirm and cancel hierarchy should remain obvious.

Do not change:

- modal triggers
- modal content ordering
- confirm/cancel logic

## Preview Surfaces

Used in:

- builder preview
- resume viewer
- document previews

Rules:

- The document must remain the hero.
- Surrounding chrome should frame, not decorate.
- Document white should feel cleaner and slightly sharper than page cards.
- Any blueprint or brand cue should stop before the actual paper.
