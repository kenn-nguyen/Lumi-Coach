# Landing Page Red-Wine Rebrand Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the frontend landing page for MBA students close to graduation who are chasing just-in-time job openings, while reskinning the experience into a premium red-wine visual system aligned with the extension.

**Architecture:** Keep the work inside the existing homepage route and home components. Replace generic SaaS messaging with audience-specific recruiting language, establish a dedicated homepage palette and component treatment, and rebuild the page around a sharper hero, premium proof blocks, and clearer conversion structure.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, existing app router homepage components.

---

## File Map

**Primary frontend files**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/(default)/page.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`
- Evaluate/remove usage of: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/hero.tsx`

**Supporting style/context files**
- Inspect: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/(default)/css/globals.css`
- Inspect: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/layout.tsx`

**Validation**
- Run: `npm run lint` in `/Users/kennng/Documents/Resume-Matcher/apps/frontend`
- Run: `npm run format` in `/Users/kennng/Documents/Resume-Matcher/apps/frontend`

---

## Chunk 1: Content Strategy And Narrative

### Task 1: Audit current landing-page messaging

**Files:**
- Read: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`

- [ ] **Step 1: List the current homepage claims**
  Capture the existing hero line, body copy, CTA labels, support cards, proof section, and footer summary.

- [ ] **Step 2: Mark weak claims against the target audience**
  Flag copy that is too generic, product-led, or utility-led.
  Specific examples to catch:
  - “Fast tailoring, right inside LinkedIn.”
  - “Tailor for every job you apply.”
  - “Why this converts.”

- [ ] **Step 3: Define the new message hierarchy**
  Rewrite the hierarchy around:
  - timing pressure
  - just-in-time recruiting
  - stronger applications without extra friction
  - MBA candidates near graduation

- [ ] **Step 4: Write the new copy themes before coding**
  Prepare concise copy buckets:
  - Hero headline
  - Hero supporting paragraph
  - Benefit chips
  - Three value pillars
  - Final CTA section
  - Footer summary

- [ ] **Step 5: Commit the copy direction**
  ```bash
  git add /Users/kennng/Documents/Resume-Matcher/docs/superpowers/plans/2026-04-18-landing-page-redwine-rebrand.md
  git commit -m "docs: plan landing page red-wine rebrand"
  ```

### Task 2: Define the premium red-wine visual language

**Files:**
- Modify later: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`
- Inspect: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/(default)/css/globals.css`

- [ ] **Step 1: Choose a constrained palette**
  Use a premium palette, not a noisy “red theme.”
  Recommended set:
  - Background ivory: `#F6EEE9`
  - Surface blush: `#EED9D6`
  - Deep wine: `#6F102D`
  - Dark plum: `#32111D`
  - Rose highlight: `#B14A68`
  - Soft gold-rose accent: `#CBA48A`

- [ ] **Step 2: Define page-level usage rules**
  Apply colors with discipline:
  - backgrounds stay light and warm
  - primary CTAs use deep wine
  - headings use dark plum
  - accents use rose/gold sparingly
  - errors remain semantically distinct from the theme

- [ ] **Step 3: Define typography behavior**
  Keep the page premium and urgent:
  - hero headings large, compressed, editorial
  - body copy shorter and tighter
  - labels/capsules restrained and high-contrast

- [ ] **Step 4: Define component treatment**
  Replace generic blue-glass UI with:
  - warmer translucent cards
  - deeper shadows
  - more expensive-looking contrast
  - less “friendly SaaS,” more “serious recruiting tool”

---

## Chunk 2: Homepage Structure Redesign

### Task 3: Rebuild the hero around urgency and audience fit

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`

- [ ] **Step 1: Rewrite the hero headline**
  Use a headline that speaks to timing pressure, for example:
  - “When the right role opens, move fast.”
  - or a nearby variant with the same strategic meaning

- [ ] **Step 2: Rewrite the supporting paragraph**
  Make it clear that Lumi is for:
  - MBA students
  - close to graduation
  - applying from LinkedIn
  - trying to avoid weak, rushed applications

- [ ] **Step 3: Replace the current benefit chips**
  Current chips are too generic.
  Replace with sharper phrases such as:
  - “Built for late-cycle recruiting”
  - “Tailor from the job page”
  - “Move before the window closes”

- [ ] **Step 4: Keep dual CTA structure**
  Preserve:
  - primary CTA: install / add to Chrome
  - secondary CTA: sign in
  But rewrite labels to feel more decisive and premium.

- [ ] **Step 5: Upgrade the hero mock**
  Keep the extension mock, but restyle it to match the red-wine system and the premium tone.
  The mock should visually support:
  - immediacy
  - polish
  - confidence

### Task 4: Replace generic supporting cards with audience-specific value pillars

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`

- [ ] **Step 1: Replace current card titles**
  Remove generic titles like:
  - “No copy-paste workflow”
  - “Tailor faster”
  - “Stay organized”

- [ ] **Step 2: Write three stronger pillars**
  Recommended directions:
  - “React while the role is still fresh”
  - “Tailor without breaking focus”
  - “Keep every application coherent”

- [ ] **Step 3: Shorten each supporting paragraph**
  Each card should make one point only.
  Avoid stacked claims inside a single paragraph.

- [ ] **Step 4: Make card styling feel premium**
  Use:
  - stronger contrast
  - warm surfaces
  - deeper shadows
  - cleaner spacing

### Task 5: Reframe the lower CTA section

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`

- [ ] **Step 1: Remove internal/product language**
  Remove “Why this converts.”

- [ ] **Step 2: Replace with buyer-facing language**
  Example direction:
  - “For the moment a strong role appears”
  - “Built for just-in-time applications”

- [ ] **Step 3: Rewrite the section body**
  Make the section explain:
  - why this workflow fits LinkedIn recruiting behavior
  - why speed matters near graduation
  - why Lumi helps without forcing context switching

- [ ] **Step 4: Keep the CTA pair**
  Preserve install + sign-in, but align the visuals and copy to the hero system.

### Task 6: Tighten the footer

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`

- [ ] **Step 1: Replace the current footer summary**
  Current summary is too explanatory and internal.
  Replace it with a shorter statement of value.

- [ ] **Step 2: Keep privacy and sign-in links**
  Do not remove useful navigation.
  Just make the footer tone sharper and quieter.

---

## Chunk 3: Implementation Details

### Task 7: Consolidate homepage data and section config

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`

- [ ] **Step 1: Replace existing copy arrays**
  Update:
  - `coreBenefits`
  - `supportingPoints`
  - lower CTA labels

- [ ] **Step 2: Keep content data-driven**
  Continue using arrays/objects for homepage sections instead of hardcoding every line inline.

- [ ] **Step 3: Keep component boundaries focused**
  If `Homepage` becomes too large, extract:
  - `HeroMock`
  - `ValuePillars`
  - `FinalCta`
  only if the split improves clarity

### Task 8: Apply the red-wine theme at component level

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`
- Inspect if needed: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/(default)/css/globals.css`

- [ ] **Step 1: Replace blue palette classes**
  Remove current blue-led classes and shadows.

- [ ] **Step 2: Apply red-wine backgrounds and surfaces**
  Rework:
  - page background
  - header pill
  - cards
  - CTA buttons
  - mock UI

- [ ] **Step 3: Preserve readability**
  Ensure:
  - no low-contrast wine-on-wine text
  - body copy stays easy to scan
  - CTA buttons remain unmistakable

- [ ] **Step 4: Keep desktop and mobile stable**
  Do not let the mock overpower the hero on small screens.
  Check stacking, spacing, and line lengths.

### Task 9: Decide whether `hero.tsx` remains part of the home system

**Files:**
- Inspect: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/hero.tsx`

- [ ] **Step 1: Confirm whether `hero.tsx` is still used**
  If unused, leave it alone unless cleanup is clearly safe and requested later.

- [ ] **Step 2: Avoid unrelated cleanup in this pass**
  Keep the redesign focused on the active homepage route only.

---

## Chunk 4: QA And Verification

### Task 10: Visual QA

**Files:**
- Verify rendered route from `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/(default)/page.tsx`

- [ ] **Step 1: Verify hero reads correctly on desktop**
  Confirm:
  - headline hierarchy is strong
  - CTA stands out
  - mock supports rather than distracts

- [ ] **Step 2: Verify mobile layout**
  Confirm:
  - no clipped mock
  - buttons wrap cleanly
  - text remains readable

- [ ] **Step 3: Verify theme consistency**
  Ensure the whole page feels intentionally red-wine, not partially recolored.

- [ ] **Step 4: Verify audience fit**
  Read the page top to bottom and ask:
  - does this sound like it understands MBA recruiting pressure?
  - does it sell immediacy and quality?
  - does it avoid generic AI/SaaS language?

### Task 11: Code quality checks

**Files:**
- Modify as needed: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`

- [ ] **Step 1: Run lint**
  Run:
  ```bash
  cd /Users/kennng/Documents/Resume-Matcher/apps/frontend
  npm run lint
  ```
  Expected: no errors

- [ ] **Step 2: Run format**
  Run:
  ```bash
  cd /Users/kennng/Documents/Resume-Matcher/apps/frontend
  npm run format
  ```
  Expected: formatting applied cleanly

- [ ] **Step 3: Re-run lint if format changed files**
  Run:
  ```bash
  cd /Users/kennng/Documents/Resume-Matcher/apps/frontend
  npm run lint
  ```

- [ ] **Step 4: Commit the implementation**
  ```bash
  git add /Users/kennng/Documents/Resume-Matcher/apps/frontend/app/\(default\)/page.tsx /Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx /Users/kennng/Documents/Resume-Matcher/apps/frontend/app/\(default\)/css/globals.css
  git commit -m "feat: rebrand landing page for just-in-time recruiting"
  ```

---

Plan complete and saved to `/Users/kennng/Documents/Resume-Matcher/docs/superpowers/plans/2026-04-18-landing-page-redwine-rebrand.md`. Ready to execute?
