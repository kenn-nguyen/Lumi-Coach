# MVP Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the smallest production-ready MVP that can acquire users, complete the core tailor flow, and generate enough product and failure signals to learn quickly.

**Architecture:** Keep the current product architecture intact. Add launch-critical instrumentation, recovery UX polish, basic abuse protection, and lightweight marketing/distribution readiness without redesigning storage or credential strategy. Prioritize visibility into success and failure over feature expansion.

**Tech Stack:** Next.js 16, React 19, PostHog, FastAPI, Chrome Extension MV3, Vitest, Tailwind CSS v4

---

## File Map

**Frontend app**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/layout.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/analytics/posthog-provider.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/lib/analytics/posthog.ts`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/auth/google-sign-in-button.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/dashboard/resume-upload-dialog.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/common/error-boundary.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/privacy/page.tsx`
- Create: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/robots.ts`
- Create: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/sitemap.ts`

**Chrome extension**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/orchestrator.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/linkedin.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/apify.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/log.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/background.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/content/linkedin-job.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/manifest.json`

**Backend**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/main.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/routers/resumes.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/routers/jobs.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/routers/enrichment.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/routers/health.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/config.py`
- Create: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/services/rate_limit.py`

**Tests**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/apify.test.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/api.test.js`
- Create: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/tests/posthog-events.test.tsx`
- Create: `/Users/kennng/Documents/Resume-Matcher/apps/backend/tests/unit/test_rate_limit.py`

---

## Chunk 1: Funnel Tracking

### Task 1: Expand PostHog Event Taxonomy For MVP Funnel

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/lib/analytics/posthog.ts`
- Test: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/tests/posthog-events.test.tsx`

- [ ] **Step 1: Add the missing MVP events**

Add events for:
- `landing_cta_clicked`
- `resume_upload_started`
- `resume_upload_succeeded`
- `resume_upload_failed`
- `tailor_started`
- `tailor_succeeded`
- `tailor_failed`
- `support_link_clicked`

- [ ] **Step 2: Write a unit test that validates exported event names**

```ts
import { describe, expect, it } from 'vitest';
import { POSTHOG_EVENTS } from '@/lib/analytics/posthog';

describe('POSTHOG_EVENTS', () => {
  it('includes the MVP funnel events', () => {
    expect(POSTHOG_EVENTS.LANDING_CTA_CLICKED).toBe('landing_cta_clicked');
    expect(POSTHOG_EVENTS.TAILOR_STARTED).toBe('tailor_started');
    expect(POSTHOG_EVENTS.TAILOR_SUCCEEDED).toBe('tailor_succeeded');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/frontend && npm test -- posthog-events`

- [ ] **Step 4: Implement the event constants**

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/frontend && npm test -- posthog-events`

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/lib/analytics/posthog.ts apps/frontend/tests/posthog-events.test.tsx
git commit -m "feat: add mvp funnel analytics events"
```

### Task 2: Instrument The Web Funnel

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/auth/google-sign-in-button.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/dashboard/resume-upload-dialog.tsx`

- [ ] **Step 1: Add landing CTA capture**

Capture `landing_cta_clicked` from the main install/sign-in CTA.

- [ ] **Step 2: Add resume upload success/failure tracking**

Capture upload start, success, and failure in the existing dialog flow.

- [ ] **Step 3: Add support-link capture**

If support UI already exists, instrument it. If not, leave this event for the trust-copy task below.

- [ ] **Step 4: Manually test analytics fire paths**

Run the app and verify the events fire in the browser console/network.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/home/homepage.tsx apps/frontend/components/auth/google-sign-in-button.tsx apps/frontend/components/dashboard/resume-upload-dialog.tsx
git commit -m "feat: instrument web mvp funnel"
```

### Task 3: Instrument Extension Tailor Funnel

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/orchestrator.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/linkedin.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/apify.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/log.js`

- [ ] **Step 1: Define the extension event surface**

Track:
- `tailor_started`
- `tailor_succeeded`
- `tailor_failed`
- `fallback_local`
- `fallback_extension_apify`
- `fallback_backend_apify`
- `fallback_manual`

- [ ] **Step 2: Add a small analytics relay helper**

Use the existing runtime logging pattern as the transport boundary. Keep this implementation lightweight; do not build a full analytics SDK inside the extension.

- [ ] **Step 3: Emit events only at stable milestones**

Do not emit on every retry. Emit once for the selected fallback path and once for the terminal outcome.

- [ ] **Step 4: Extend tests for fallback path selection**

Add assertions in existing extension runtime tests that the fallback path and success/failure terminal state are observable.

- [ ] **Step 5: Run extension tests**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/chrome-extension && npm test`

- [ ] **Step 6: Commit**

```bash
git add apps/chrome-extension/src/runtime/orchestrator.js apps/chrome-extension/src/runtime/linkedin.js apps/chrome-extension/src/runtime/apify.js apps/chrome-extension/src/runtime/log.js apps/chrome-extension/src/runtime/apify.test.js apps/chrome-extension/src/runtime/api.test.js
git commit -m "feat: instrument extension mvp funnel"
```

---

## Chunk 2: Error Visibility And Operational Safety

### Task 4: Add Lightweight Error Monitoring Hooks

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/layout.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/common/error-boundary.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/main.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/background.js`

- [ ] **Step 1: Pick one error sink**

Use Sentry or equivalent. If you want to avoid new vendor cost immediately, at minimum centralize to one HTTP endpoint or provider already available to you.

- [ ] **Step 2: Add frontend global capture**

Hook the error boundary and uncaught errors into that sink.

- [ ] **Step 3: Add backend unhandled exception capture**

Add app-level exception capture in FastAPI startup/middleware or logging hooks.

- [ ] **Step 4: Add extension background fatal capture**

Forward fatal background/orchestrator failures to the same sink, with no token material.

- [ ] **Step 5: Verify one intentional test error per surface**

Confirm:
- frontend capture works
- backend capture works
- extension capture works

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/app/layout.tsx apps/frontend/components/common/error-boundary.tsx apps/backend/app/main.py apps/chrome-extension/src/background.js
git commit -m "feat: add mvp error monitoring hooks"
```

### Task 5: Add Basic Rate Limiting To Expensive Endpoints

**Files:**
- Create: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/services/rate_limit.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/main.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/routers/resumes.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/routers/jobs.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/routers/enrichment.py`
- Test: `/Users/kennng/Documents/Resume-Matcher/apps/backend/tests/unit/test_rate_limit.py`

- [ ] **Step 1: Write a failing unit test for simple fixed-window limiting**

```python
def test_fixed_window_blocks_after_limit() -> None:
    limiter = FixedWindowLimiter(limit=2, window_seconds=60)
    assert limiter.allow("u1") is True
    assert limiter.allow("u1") is True
    assert limiter.allow("u1") is False
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/backend && uv run pytest tests/unit/test_rate_limit.py -q`

- [ ] **Step 3: Implement a minimal in-process limiter**

Keep it simple for MVP:
- user-keyed when authenticated
- IP-keyed fallback when not authenticated
- no distributed coordination yet

- [ ] **Step 4: Apply the limiter to the expensive routes**

Protect:
- resume tailoring/generation
- enrichment/regeneration
- backend Apify fallback
- export-heavy endpoints if user-triggerable at volume

- [ ] **Step 5: Return a clean 429 message**

Use generic user-safe copy.

- [ ] **Step 6: Run backend tests**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/backend && uv run pytest tests/unit/test_rate_limit.py -q`

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/services/rate_limit.py apps/backend/app/main.py apps/backend/app/routers/resumes.py apps/backend/app/routers/jobs.py apps/backend/app/routers/enrichment.py apps/backend/tests/unit/test_rate_limit.py
git commit -m "feat: add mvp backend rate limiting"
```

### Task 6: Expand Health Status For Real Deploy Checks

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/routers/health.py`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/backend/app/config.py`

- [ ] **Step 1: Extend `/status` with launch-critical flags**

Add flags for:
- auth secret configured
- Apify token configured
- frontend base URL configured

- [ ] **Step 2: Keep the response lightweight**

Do not leak secret values; only expose booleans and high-level readiness.

- [ ] **Step 3: Smoke test the endpoint locally**

Run: `cd /Users/kennng/Documents/Resume-Matcher/apps/backend && uv run uvicorn app.main:app --reload --port 8000`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/routers/health.py apps/backend/app/config.py
git commit -m "feat: expand health readiness checks"
```

---

## Chunk 3: Fallback UX, Trust Copy, And MVP SEO

### Task 7: Make The Extension Failure Copy Fully Actionable

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/content/linkedin-job.js`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/runtime/orchestrator.js`

- [ ] **Step 1: Review every terminal failure state**

Cover:
- local scrape fail
- extension Apify fail
- backend Apify fail
- no Apify token configured
- manual JD invalid

- [ ] **Step 2: Shorten all terminal messages**

Each message should answer:
- what failed
- what the user should do next

- [ ] **Step 3: Explicitly mention Settings when there is no Apify token**

Use language like:
- `Enable Apify in Settings or paste the JD below.`

- [ ] **Step 4: Verify the UI only updates once per completed fallback chain**

No intermediate red failure flash while retries/fallbacks continue.

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-extension/src/content/linkedin-job.js apps/chrome-extension/src/runtime/orchestrator.js
git commit -m "fix: tighten extension failure and fallback copy"
```

### Task 8: Add Launch-Ready Trust And Support Copy

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/components/home/homepage.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/privacy/page.tsx`
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/src/content/linkedin-job.js`

- [ ] **Step 1: Add one short trust block on the landing page**

Explain:
- what stays local
- what goes to Lumi
- when Apify is used

- [ ] **Step 2: Add one obvious support path**

Use:
- support email
- feedback form link
- or issue link

- [ ] **Step 3: Add matching trust copy in extension settings**

Do not bury it in the privacy page only.

- [ ] **Step 4: Keep the copy minimal**

This is trust support, not legal theater.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/home/homepage.tsx apps/frontend/app/privacy/page.tsx apps/chrome-extension/src/content/linkedin-job.js
git commit -m "feat: add mvp trust and support copy"
```

### Task 9: Finish Lightweight SEO

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/layout.tsx`
- Create: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/robots.ts`
- Create: `/Users/kennng/Documents/Resume-Matcher/apps/frontend/app/sitemap.ts`

- [ ] **Step 1: Upgrade root metadata**

Add:
- stronger title
- clearer description
- `openGraph`
- `twitter`
- metadata base if appropriate

- [ ] **Step 2: Create a minimal `robots.ts`**

Allow indexing for the marketing surface only if that is your intent.

- [ ] **Step 3: Create a minimal `sitemap.ts`**

Include:
- home
- sign in
- privacy

- [ ] **Step 4: Verify social preview and metadata output**

Run the app and inspect page source/head output.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/app/layout.tsx apps/frontend/app/robots.ts apps/frontend/app/sitemap.ts
git commit -m "feat: add mvp seo primitives"
```

---

## Chunk 4: Manual QA And Release Discipline

### Task 10: Write And Execute An MVP QA Script

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/docs/superpowers/plans/2026-04-18-mvp-release-readiness.md`

- [ ] **Step 1: Add a release checklist section to this plan**

Document:
- sign-in flow
- resume upload flow
- direct LinkedIn `/jobs/view/...`
- collection URL with `currentJobId`
- local scrape success
- extension Apify success
- backend Apify success
- manual JD success
- signed-out behavior

- [ ] **Step 2: Execute the checklist manually**

Record pass/fail inline while testing.

- [ ] **Step 3: Fix only blocking failures**

Do not broaden scope mid-release.

- [ ] **Step 4: Commit checklist updates if useful**

```bash
git add docs/superpowers/plans/2026-04-18-mvp-release-readiness.md
git commit -m "docs: add mvp release qa checklist"
```

### Task 11: Bump Extension Release Metadata

**Files:**
- Modify: `/Users/kennng/Documents/Resume-Matcher/apps/chrome-extension/manifest.json`

- [ ] **Step 1: Replace `0.0.1` with a real release version**

Use a deliberate version, for example `0.1.0`.

- [ ] **Step 2: Verify host permissions are intentional**

Do not remove anything needed for the current MVP flow, but document any broad permissions you keep.

- [ ] **Step 3: Commit**

```bash
git add apps/chrome-extension/manifest.json
git commit -m "chore: prepare extension manifest for mvp release"
```

---

## MVP Release Gate

Only release once these are true:

- [ ] A new user can understand the landing page and find the primary CTA immediately
- [ ] A signed-in user can upload/select a resume and complete one successful tailor run
- [ ] Failed LinkedIn extraction does not dead-end the user
- [ ] Web and extension funnel events are visible
- [ ] Backend and frontend fatal failures are visible outside local dev consoles
- [ ] Expensive backend endpoints are protected from trivial abuse
- [ ] The marketing surface has basic SEO metadata, sitemap, and robots
- [ ] The product explains local vs server handling clearly enough to earn trust

---

## Suggested Execution Order

1. Chunk 1: Funnel Tracking
2. Chunk 2: Error Visibility And Operational Safety
3. Chunk 3: Fallback UX, Trust Copy, And MVP SEO
4. Chunk 4: Manual QA And Release Discipline

Plan complete and saved to `docs/superpowers/plans/2026-04-18-mvp-release-readiness.md`. Ready to execute?
