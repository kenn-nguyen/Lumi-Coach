# JSON Child Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard flow that uploads a ResumeData JSON file plus optional JD URL and pasted JD text, creates a non-master child resume linked to the current master, and opens it for normal editing without treating it as a tailored resume.

**Architecture:** Keep this separate from the existing master upload route. Add a dedicated backend import endpoint and two new resume metadata fields: one for the master linkage and one for import provenance. The frontend uses a dedicated dialog and routes the imported child into the existing resume workspace.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy/Postgres, Next.js, React, existing dashboard upload patterns.

---

### Task 1: Backend contract for JSON child import

**Files:**
- Modify: `apps/backend/app/schemas/models.py`
- Modify: `apps/backend/app/routers/resumes.py`
- Test: `apps/backend/tests/integration/test_resume_api.py`

- [ ] Add request/response schema types for the new import endpoint, including `jd_url` and `jd_text`.
- [ ] Extend resume fetch/list response types to expose import provenance and master linkage.
- [ ] Write integration tests for:
  - valid import with master resume
  - import rejected when no master exists
  - invalid ResumeData JSON rejected
  - imported child remains non-master and non-tailored

### Task 2: Database support for imported child resumes

**Files:**
- Modify: `apps/backend/app/database.py`
- Test: `apps/backend/tests/integration/test_resume_api.py`

- [ ] Add additive resume columns for `linked_master_resume_id` and `import_context`.
- [ ] Update schema migration helpers to add those columns safely to existing databases.
- [ ] Update resume serialization, create, update, fetch, and list helpers to carry the new fields.
- [ ] Add a helper path that creates a non-master imported child linked to the current master.

### Task 3: Dedicated backend import endpoint

**Files:**
- Modify: `apps/backend/app/routers/resumes.py`
- Test: `apps/backend/tests/integration/test_resume_api.py`

- [ ] Add `POST /api/v1/resumes/import-json-child` using multipart form data.
- [ ] Parse uploaded JSON, validate it as `ResumeData`, and reject malformed payloads with user-safe messages.
- [ ] Require an existing master resume for the authenticated user.
- [ ] Persist:
  - `is_master = false`
  - `parent_id = null`
  - `linked_master_resume_id = current master resume id`
  - `import_context = { mode, jd_url, jd_text }`
  - `processed_data` and JSON `content`

### Task 4: Frontend API helper and import dialog

**Files:**
- Modify: `apps/frontend/lib/api/resume.ts`
- Create: `apps/frontend/components/dashboard/resume-json-import-dialog.tsx`
- Modify: `apps/frontend/app/(default)/dashboard/page.tsx`

- [ ] Add a frontend helper that submits multipart form data to the new import endpoint.
- [ ] Build a dedicated dashboard dialog with:
  - JSON file input
  - JD URL input
  - JD text textarea
  - submit button
- [ ] On success, route directly to `/resumes/<newResumeId>`.
- [ ] Keep the existing master upload dialog unchanged.

### Task 5: Resume workspace provenance display

**Files:**
- Modify: `apps/frontend/components/builder/resume-builder.tsx`
- Modify: `apps/frontend/app/(default)/resumes/[id]/page.tsx`
- Modify: `apps/frontend/messages/en.json`

- [ ] Surface imported JD provenance in the workspace/viewer for imported children.
- [ ] Keep tailored-only features disabled unless the resume is a true tailored resume.
- [ ] Preserve AI regenerate/edit flows for imported children because they are resume-id based, not tailored-only.

### Task 6: Verification

**Files:**
- Test: `apps/backend/tests/integration/test_resume_api.py`
- Verify: `apps/frontend`

- [ ] Run targeted backend tests for resume API import behavior.
- [ ] Run frontend lint.
- [ ] Manually verify that imported child resumes:
  - appear in the dashboard list
  - open in the editor
  - do not enable tailored-only tabs
  - do show JD provenance
