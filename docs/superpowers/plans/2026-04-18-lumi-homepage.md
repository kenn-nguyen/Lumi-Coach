# Lumi Homepage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current root homepage with a public-first Lumi Coach landing page that explains the product, highlights the Chrome extension workflow, and offers immediate sign-in.

**Architecture:** Keep routing unchanged at `app/(default)/page.tsx`, replace the current homepage component with a fuller landing-page component, and keep all copy/image needs self-contained so the page is publishable without extra assets.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, existing global theme tokens, Next `Image`, Next `Link`.

---

## Chunk 1: Homepage Composition

### Task 1: Replace the root homepage entry

**Files:**
- Create: `apps/frontend/components/home/homepage.tsx`
- Modify: `apps/frontend/app/(default)/page.tsx`

- [ ] Create a new homepage component that contains the final landing page sections.
- [ ] Keep the page server-rendered and static with no client hooks.
- [ ] Update the root page to render the new homepage component instead of the old hero-only component.

### Task 2: Build the public-first sections

**Files:**
- Create: `apps/frontend/components/home/homepage.tsx`

- [ ] Add a header with brand, navigation anchors, and login CTA.
- [ ] Add a proof-led hero with product explanation and visible Google sign-in CTA.
- [ ] Add sections for workflow, product value, Chrome extension convenience, and FAQ/public trust copy.
- [ ] Add a final CTA section that routes users to `/sign-in`.

## Chunk 2: Content and Polish

### Task 3: Fill final copy and publishing details

**Files:**
- Create: `apps/frontend/components/home/homepage.tsx`

- [ ] Write self-contained production-ready marketing copy.
- [ ] Explicitly explain the Chrome extension and why it is convenient in the user flow.
- [ ] Avoid placeholder text, stock screenshots, or dependency on new assets.

### Task 4: Verify formatting and linting

**Files:**
- Modify: `apps/frontend/components/home/homepage.tsx`
- Modify: `apps/frontend/app/(default)/page.tsx`

- [ ] Run targeted ESLint on the touched frontend files.
- [ ] Run targeted Prettier check on the touched frontend files.
- [ ] Report any remaining risks briefly.
