# Skin-Only Migration Checklist

This is the enforcement document for the future rollout.

The refresh is a skin migration, not a redesign.

## Non-Negotiable Rule

If a change affects structure, layout logic, information architecture, or interaction flow, it is out of scope.

The migration may only change:

- color
- typography styling
- borders
- shadows
- radii
- surface materials
- background treatment
- hover, focus, selected, and disabled visual states
- visual polish spacing where needed to support the new skin

The migration may not change:

- routes
- component hierarchy
- section order
- layout positions
- column structure
- action order
- modal logic
- tab logic
- form logic
- data flow
- generation flow

## Global Pass Checklist

Before touching any live file:

- confirm the change is token-driven or component-skin-driven
- confirm the change does not require new layout wrappers except purely visual ones
- confirm the same DOM order can be preserved
- confirm the same states still exist and behave the same way

## Allowed Changes

- swap flat colors for new bright theme tokens
- restyle existing buttons, inputs, selects, textareas, chips, tabs, cards, and shells
- change border weights and shadow weights
- update heading/body/meta typography treatment
- add subtle page-level background texture
- slightly refine internal spacing for visual rhythm

## Disallowed Changes

- moving blocks between columns
- changing split-pane proportions for product reasons
- turning one section into multiple sections
- merging separate sections into one
- introducing new feature modules
- reordering buttons or controls
- replacing tabs with another navigation pattern
- converting pages into new layouts

## Page Audit Checklist

For every live page, verify all of the following:

1. The route is unchanged.
2. The major sections are in the same order.
3. The same actions appear in the same order.
4. The same lists, forms, and documents occupy the same location.
5. The same data states are represented.
6. The same flows still work without relearning.
7. Only the visual skin changed.

## Dashboard Checklist

- header remains in the same place
- master resume module remains in the same place
- search and sort remain in the same toolbar area
- resume rows remain in the same structure
- no new dashboard panels are introduced

## Builder Checklist

- left editor and right preview stay in the same split layout
- top toolbar stays in the same place
- tabs stay in the same position
- form sections stay in the same order
- preview remains dominant on the right
- no structural wrappers change editing flow

## Tailor Checklist

- back action remains where it is
- prompt selector remains above the textarea
- textarea remains the dominant input
- generate CTA remains in the same final action position
- warning/result flow remains unchanged

## Viewer Checklist

- top action cluster stays where it is
- feedback remains above or alongside the document exactly as in the live page
- document preview remains the center of the page
- edit/download/delete behavior remains unchanged

## Settings Checklist

- section ordering remains unchanged
- provider controls remain grouped the same way
- feature flags remain grouped the same way
- danger zone remains where it is
- no new settings categories are introduced

## Sign-In Checklist

- single primary sign-in action remains
- supporting copy remains
- back/home action remains
- no new auth steps are introduced

## Connect Checklist

- connection messaging remains centered
- success/error states remain in the same flow
- retry/close actions remain in the same logic path

## QA Signoff Rule

Do not consider a screen complete unless both are true:

1. It clearly looks like the new skin.
2. A current user would not have to relearn the screen.

If a user has to relearn the screen, the work exceeded skin scope.
