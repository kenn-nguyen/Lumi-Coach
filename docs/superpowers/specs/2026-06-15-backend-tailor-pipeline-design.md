# Backend Tailor Pipeline

Bring the Chrome extension's 3-stage prompt pipeline into the web app as a server-side feature. Users select a prompt profile, provide a job description (LinkedIn URL or raw text), and the backend runs Prompt 1 > 2 > 3 to produce a tailored resume.

## Context

The Chrome extension already runs a Prompt 1 > 2 > 3 pipeline that analyzes a job description, strategizes positioning, and writes a tailored resume. This pipeline works well but requires the extension. The web app's existing "improve" flow uses a different, simpler approach (diff-based improvements). This spec adds the extension's full 3-stage pipeline as a backend-orchestrated feature.

## Goals

- Replicate the extension's Prompt 1 > 2 > 3 pipeline on the backend
- Support all 4 prompt template profiles (profile1-4)
- Extract JD from LinkedIn URLs via Apify with fallback actors
- Run jobs in the background so users don't wait on a blocked request
- Write results to the existing database schema (no new tables)
- Use the server's default API key; fall back to telling the user to configure their own key if rate-limited

## Non-goals

- Real-time streaming of LLM output to the frontend
- WebSocket or SSE connections
- Prompt template editing UI
- Concurrent jobs per user (one at a time)
- New database tables

---

## Architecture

```
Frontend                          Backend
--------                          -------
TailorDialog                      POST /api/v1/resumes/{id}/tailor
  - Profile selector (1-4)          -> validate inputs
  - JD input (URL or text)          -> write tailor_job JSONB (status: "running")
  - Submit                          -> kick off BackgroundTasks
  |                                    |
  | polls every 3s                     | Background task (sync function, runs in threadpool):
  v                                    |  1. If URL -> Apify extract JD
GET /api/v1/resumes/{id}/tailor-status |  2. Render Prompt 1 template -> LLM -> parse P1 JSON
  <- { status, progress_stage }        |  3. Render Prompt 2 template (with P1) -> LLM -> parse P2 JSON
  |                                    |  4. Render Prompt 3 template (with P1+P2) -> LLM -> parse P3 JSON
  | when status == "completed"         |  5. Post-process P3 output
  v                                    |  6. Create Job record, tailored resume, improvement record
Load tailored resume                   |  7. Update tailor_job status -> "completed"
```

---

## Database Changes

No new tables. One new column on the existing `resumes` table.

### New JSONB column: `tailor_job`

Add to `ResumeModel` in `app/database.py`:

```python
tailor_job: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
```

This column is **not encrypted** (it contains no PII — just job status, stage, and IDs). It is excluded from the PII encryption helpers.

**Schema creation:** Add to `_ensure_resume_schema()` alongside existing `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` calls.

**Serialization:** Add `"tailor_job": row.tailor_job` to `_serialize_resume()`.

**JSONB shape:**

```python
{
    "job_id": "tj_abc123",           # Unique identifier
    "status": "running",             # "running" | "completed" | "failed" | "canceled"
    "progress_stage": "prompt2",     # "apify" | "prompt1" | "prompt2" | "prompt3" | "postprocess"
    "prompt_profile_id": "profile2", # Which prompt profile was used
    "jd_source": "linkedin_url",     # "linkedin_url" | "raw_text"
    "jd_text": "...",                # Extracted/provided JD text
    "jd_url": "https://...",         # Original LinkedIn URL (if provided)
    "error_message": null,           # Error details if failed
    "started_at": "2026-06-15T...",
    "completed_at": null,
    "tailored_resume_id": null       # ID of created tailored resume when done
}
```

### How the result is persisted (no new tables)

When a tailor job completes, it creates records using the existing database methods:

1. **Job record** via `db.create_job(content=jd_text, resume_id=source_resume_id)` — stores the JD text. Required for the improvement audit trail.
2. **Tailored resume** via `db.create_resume()` with `parent_id = source_resume_id` and `linked_master_resume_id = master_resume_id`. Note: the existing improve flow does not set `linked_master_resume_id`, but the tailor pipeline does because it always runs from a master resume context.
3. **Improvement record** via `db.create_improvement(original_resume_id, tailored_resume_id, job_id, improvements=[])` — links everything together for the audit trail.

---

## Prompt Templates

### Location

The backend already has the extension's prompt templates at:

```
apps/backend/app/prompts/extension_defaults/
  system-prompt.txt
  prompt1.txt
  prompt2.txt
  prompt3.txt
  prompt4.txt
  patches/
    prompt1.output-contract.txt
    prompt2.output-contract.txt
    prompt3.output-contract.txt
    prompt4.output-contract.txt
    system.guardrails.txt
  profiles/
    profile2/
      prompt1.txt
      prompt2.txt
      prompt3.txt
    profile3/
      prompt1.txt
      prompt2.txt
      prompt3.txt
    profile4/
      prompt3.txt
```

The tailor pipeline reads from this existing directory. No new `packages/prompts/` directory needed. If the extension's prompts are updated, `extension_defaults/` should be synced manually or via a copy script (out of scope for this spec).

### Template variable resolution

Prompt templates use `{{PLACEHOLDER}}` syntax. The backend resolves these the same way the extension does:

| Variable | Source |
|----------|--------|
| `{{JOB_TITLE}}` | Extracted from JD or Apify response |
| `{{COMPANY}}` | Extracted from JD or Apify response |
| `{{LOCATION}}` | Extracted from JD or Apify response |
| `{{SOURCE_URL}}` | LinkedIn URL if provided |
| `{{JOB_DESCRIPTION}}` | Full JD text |
| `{{CURRENT_RESUME}}` | Master resume content (markdown) |
| `{{PROMPT1_JSON}}` | Stringified P1 output (for P2/P3) |
| `{{PROMPT1_RESPONSE}}` | Cleaned P1 text (for P2/P3) |
| `{{PROMPT2_JSON}}` | Stringified P2 output (for P3) |
| `{{PROMPT2_RESPONSE}}` | Cleaned P2 text (for P3) |

### Profile resolution cascade

Same as the extension's `prompt-defaults.js`:
- Check `profiles/{profileId}/prompt{N}.txt` first
- Fall back to root `prompt{N}.txt`
- Profile 3: skip output contracts for prompt1/prompt2 (profile3 outputs are plain text, not JSON)
- Profile 4: only overrides prompt3; **skips P1 and P2 stages entirely** (one-shot mode, confirmed by `isSingleStagePromptProfileId()` in the extension's orchestrator)

### Prompt loading utility

New file: `app/services/prompt_loader.py`

```python
import re
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent.parent / "prompts" / "extension_defaults"
PLACEHOLDER_PATTERN = re.compile(r"\{\{([A-Z0-9_]+)\}\}")

def load_prompt_template(template_name: str, profile_id: str = "profile1") -> str:
    """Load a prompt template with profile cascade."""
    ...

def render_prompt(template: str, variables: dict[str, str]) -> str:
    """Replace {{PLACEHOLDER}} tokens. Raises if unresolved placeholders remain."""
    ...

def load_system_prompt() -> str:
    """Load system guardrails + system-prompt.txt, concatenated."""
    ...
```

---

## API Endpoints

### `POST /api/v1/resumes/{resume_id}/tailor`

Starts a tailor pipeline job in the background.

**Auth:** Required (`require_current_user`)

**Request body:**

```python
class TailorRequest(BaseModel):
    prompt_profile_id: str = "profile2"  # "profile1" | "profile2" | "profile3" | "profile4"
    jd_url: str | None = None            # LinkedIn job URL
    jd_text: str | None = None           # Raw JD text (alternative to URL)
    # At least one of jd_url or jd_text is required
```

**Validation:**
- `prompt_profile_id` must be in `{"profile1", "profile2", "profile3", "profile4"}`
- At least one of `jd_url` or `jd_text` must be provided
- If `jd_url` is provided, it must contain `linkedin.com` (basic domain check)

**Response (202 Accepted):**

```json
{
    "job_id": "tj_abc123",
    "status": "running",
    "message": "Tailor pipeline started."
}
```

**Error cases:**
- 400: No JD provided (neither URL nor text)
- 400: Invalid prompt profile ID
- 400: URL provided but not a LinkedIn URL
- 400: URL provided but no Apify API key configured
- 404: Resume not found
- 409: A tailor job is already running for this resume
- 503: No LLM API key available (server key not configured, user has no key either)

**Flow:**
1. Validate inputs
2. Check no active tailor job exists for this resume (`tailor_job` is null or `status` not `"running"`)
3. Resolve LLM config: `get_llm_config(user_id)` — server key first, then user's key
4. Resolve Apify key: from `APIFY_API_KEY` env var or `config.json`
5. Write `tailor_job` JSONB with status `"running"` to the resume row
6. Enqueue background task via `background_tasks.add_task(run_tailor_pipeline, ...)` — the function is `async def`; FastAPI handles async background tasks natively. DB calls inside are synchronous SQLAlchemy (fast, fine for this scale).
7. Return 202

### `GET /api/v1/resumes/{resume_id}/tailor-status`

Polls the current tailor job status.

**Auth:** Required

**Response:**

```json
{
    "job_id": "tj_abc123",
    "status": "running",
    "progress_stage": "prompt2",
    "prompt_profile_id": "profile2",
    "started_at": "2026-06-15T10:00:00Z",
    "completed_at": null,
    "tailored_resume_id": null,
    "error_message": null
}
```

When `status` is `"completed"`, `tailored_resume_id` contains the ID of the new tailored resume. The frontend redirects to that resume.

### `POST /api/v1/resumes/{resume_id}/tailor-cancel`

Cancels a running tailor job.

**Auth:** Required

**Response:**

```json
{
    "job_id": "tj_abc123",
    "status": "canceled"
}
```

Cancellation sets `tailor_job.status = "canceled"` in the DB. The background task reads `tailor_job` from the DB before each stage and aborts if status is `"canceled"`.

**Race condition note:** There is a small window where the cancel write commits after the background task has already read the old status and started the next LLM call. This is acceptable — in the worst case, one extra LLM call runs before the task checks again and stops. The alternative (in-memory flags, asyncio.Event) adds complexity for minimal gain.

---

## Backend Service: `app/services/tailor.py`

The core pipeline function. Mirrors the extension's orchestrator logic.

```python
async def run_tailor_pipeline(
    resume_id: str,
    user_id: str,
    jd_url: str | None,
    jd_text: str | None,
    prompt_profile_id: str,
    llm_config: LLMConfig,
    apify_api_key: str | None,
) -> None:
    """
    Background task (async — FastAPI BackgroundTasks handles async functions natively).
    LLM calls are awaited. DB calls (sync SQLAlchemy) are called directly — they are
    fast (milliseconds) so blocking the event loop briefly is acceptable at this scale
    (~dozen concurrent users). At larger scale, wrap DB calls in asyncio.to_thread().
    """
```

### Pipeline stages

Before each stage, the task reads `tailor_job` from the DB and checks if `status == "canceled"`. If so, it stops immediately.

**Stage 0: JD extraction (if URL provided)**
- Call Apify with fallback actor chain (same as extension)
- Normalize response into structured JD text via `normalize_apify_job_record()`
- Update `tailor_job.progress_stage = "apify"`
- If Apify fails, set status `"failed"` with error message

**Stage 1: Prompt 1 — Analyze JD** (skipped for profile4)
- Load prompt1 template for the selected profile via `prompt_loader.load_prompt_template("prompt1", profile_id)`
- Append output contract (unless profile3)
- Resolve template variables: `{{JOB_DESCRIPTION}}`, `{{CURRENT_RESUME}}`, etc.
- Build system prompt: guardrails + system-prompt.txt via `prompt_loader.load_system_prompt()`
- Call LLM via `llm.complete()` — returns raw text string
- For profile3: store raw text as `prompt1_response` (plain text, not JSON)
- For other profiles: parse JSON from raw text, validate minimal schema
- If JSON invalid, build repair prompt and call `llm.complete()` once more (max 1 repair attempt)
- Update `tailor_job.progress_stage = "prompt1"`
- Store P1 output in pipeline context dict

**Stage 2: Prompt 2 — Strategize positioning** (skipped for profile4)
- Load prompt2 template for the selected profile
- Append output contract (unless profile3)
- Resolve variables including `{{PROMPT1_JSON}}`, `{{PROMPT1_RESPONSE}}`
- Call `llm.complete()` with system prompt
- Parse and validate (profile3: store as plain text)
- If invalid, one repair attempt
- Update `tailor_job.progress_stage = "prompt2"`
- Store P2 output in pipeline context dict

**Stage 3: Prompt 3 — Write tailored resume** (all profiles)
- Load prompt3 template for the selected profile
- Append output contract
- Resolve variables including P1 and P2 outputs (for profile4, these are empty)
- Call `llm.complete()` with system prompt
- Parse JSON response — extract `resume_data` and `generation_feedback` (same shape as extension's `extractPrompt3PayloadFromText()`)
- Validate resume data schema
- If invalid, one repair attempt with directives: no em-dashes, no trailing periods on bullets
- Update `tailor_job.progress_stage = "prompt3"`

**Stage 4: Post-processing**
- Apply same safety nets as existing improve flow (from `app/services/improver.py`):
  - `_preserve_generated_resume_facts()` — restore protected personal info
  - `_restore_original_dates()` — recover month precision
  - `_preserve_original_skills()` — never drop skills
  - `_protect_custom_sections()` — revert fabricated descriptions
- Normalize section alignment to source resume
- Update `tailor_job.progress_stage = "postprocess"`

**Stage 5: Persist result**
1. Create Job record: `db.create_job(content=jd_text, resume_id=source_resume_id)`
2. Create tailored resume: `db.create_resume()` with:
   - `parent_id` = source resume ID
   - `linked_master_resume_id` = master resume ID (explicitly set — the improve flow does not do this, but the tailor pipeline does because it always operates from a master resume context)
   - `processed_data` = tailored resume JSON (the P3 output after post-processing)
   - `generation_feedback` = P3 feedback (if present)
   - `generation_artifacts` = `{ "prompt2": stripped_p2_output }`
   - `is_master` = False
3. Create improvement record: `db.create_improvement(original_resume_id, tailored_resume_id, job_id, improvements=[])`
4. Update `tailor_job`: status `"completed"`, `tailored_resume_id` = new resume ID, `completed_at` = now

**Error handling at any stage:**
- Wrap entire pipeline in try/except
- On exception: set `tailor_job.status = "failed"`, `error_message = str(error)`, `completed_at = now`
- Rate limit errors (HTTP 429 from LLM): set specific error message: `"API rate limit reached. Please configure your own API key in Settings."`
- Resume not found during write: set `"failed"` with message `"Source resume was deleted during processing."`

### Stale job cleanup

On server startup (in `main.py` lifespan): query all resumes where `tailor_job->>'status' = 'running'` and `tailor_job->>'started_at'` is older than 10 minutes. Mark them as `"failed"` with message `"Job interrupted by server restart."`.

---

## Backend Service: `app/services/apify.py`

Extracts JD text from LinkedIn URLs via Apify API. Direct port of the extension's `apify.js`.

```python
import httpx

def extract_jd_from_linkedin(
    url: str,
    apify_api_key: str,
    actor_ids: list[str] | None = None,
) -> dict:
    """
    Calls Apify actors with fallback chain to extract JD from LinkedIn URL.
    Returns dict with keys: title, company, location, description, labeled_text.
    Synchronous (called from sync background task).
    """
```

**Apify key source:** `APIFY_API_KEY` env var, or `apify_api_key` in `config.json` (add to existing `get_api_keys_from_config()` pattern).

**Fallback chain:** Same as extension — try default actor, then fallback actors in sequence until one succeeds.

**Response normalization:** Same field extraction logic as `normalizeApifyJobRecord()` in the extension:
- Try `job_info.description` > `jobInfo.descriptionText` > `description` > `text`
- Extract title, company, location from structured fields
- Build labeled text output

**HTTP client:** Use `httpx` (synchronous) since this runs in a threadpool. The backend already has `httpx` as a dependency.

---

## Backend Schema: `app/schemas/tailor.py`

```python
from pydantic import BaseModel, field_validator

VALID_PROMPT_PROFILES = {"profile1", "profile2", "profile3", "profile4"}

class TailorRequest(BaseModel):
    prompt_profile_id: str = "profile2"
    jd_url: str | None = None
    jd_text: str | None = None

    @field_validator("prompt_profile_id")
    @classmethod
    def validate_profile(cls, v: str) -> str:
        if v not in VALID_PROMPT_PROFILES:
            raise ValueError(f"Invalid prompt profile: {v}")
        return v

class TailorStatusResponse(BaseModel):
    job_id: str
    status: str  # "running" | "completed" | "failed" | "canceled"
    progress_stage: str | None = None
    prompt_profile_id: str
    started_at: str
    completed_at: str | None = None
    tailored_resume_id: str | None = None
    error_message: str | None = None

class TailorStartResponse(BaseModel):
    job_id: str
    status: str
    message: str
```

---

## Backend Router: `app/routers/tailor.py`

Thin router with 3 endpoints. All business logic lives in `services/tailor.py`.

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

router = APIRouter(prefix="/resumes", tags=["tailor"])

@router.post("/{resume_id}/tailor", status_code=202)
async def start_tailor(
    resume_id: str,
    request: TailorRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(require_current_user),
) -> TailorStartResponse: ...

@router.get("/{resume_id}/tailor-status")
async def get_tailor_status(
    resume_id: str,
    user_id: str = Depends(require_current_user),
) -> TailorStatusResponse: ...

@router.post("/{resume_id}/tailor-cancel")
async def cancel_tailor(
    resume_id: str,
    user_id: str = Depends(require_current_user),
) -> TailorStatusResponse: ...
```

---

## Frontend: `components/tailor/TailorDialog.tsx`

A single modal component triggered from the resume page. Uses the existing `<Dialog>` component from `components/ui/dialog.tsx`.

### UI layout

```
+------------------------------------------+
|  Tailor Resume to Job Description        |
|                                          |
|  Prompt Profile:  [Enhanced (Default)  v]|
|                                          |
|  LinkedIn Job URL (optional):            |
|  [______________________________________]|
|                                          |
|  Or paste job description:               |
|  [______________________________________]|
|  [______________________________________]|
|  [______________________________________]|
|                                          |
|  [Cancel]                  [Start Tailor]|
+------------------------------------------+
```

When running:

```
+------------------------------------------+
|  Tailoring Resume...                     |
|                                          |
|  [=====>          ] Analyzing JD (1/3)   |
|                                          |
|  This usually takes 30-60 seconds.       |
|                                          |
|  [Cancel]                                |
+------------------------------------------+
```

When complete:

```
+------------------------------------------+
|  Resume Tailored!                        |
|                                          |
|  Your tailored resume is ready.          |
|                                          |
|  [Close]               [View Resume ->]  |
+------------------------------------------+
```

### Behavior

1. User fills in profile + JD input, clicks "Start Tailor"
2. Frontend calls `POST /api/v1/resumes/{id}/tailor`
3. Dialog switches to progress view
4. Frontend polls `GET /api/v1/resumes/{id}/tailor-status` every 3 seconds
5. Progress bar updates based on `progress_stage`:
   - `"apify"` -> "Extracting job description..."
   - `"prompt1"` -> "Analyzing job description (1/3)..."
   - `"prompt2"` -> "Building strategy (2/3)..."
   - `"prompt3"` -> "Writing tailored resume (3/3)..."
   - `"postprocess"` -> "Finalizing..."
6. On completion: show success with link to tailored resume
7. On failure: show error message with retry option
8. On cancel: call `POST /api/v1/resumes/{id}/tailor-cancel`

### Profile selector options

| Value | Label | Description |
|-------|-------|-------------|
| `profile1` | Standard | Base prompt templates |
| `profile2` | Enhanced (Default) | Hiring-manager persona, detailed analysis |
| `profile3` | Lean / ATS-focused | Minimal output, ATS-optimized |
| `profile4` | One-shot Writer | Skips analysis, writes directly |

### Frontend API additions

New file: `lib/api/tailor.ts`

```typescript
export async function startTailorJob(resumeId: string, params: {
  prompt_profile_id: string;
  jd_url?: string;
  jd_text?: string;
}): Promise<TailorStartResponse> { ... }

export async function getTailorStatus(resumeId: string): Promise<TailorStatusResponse> { ... }

export async function cancelTailorJob(resumeId: string): Promise<TailorStatusResponse> { ... }
```

---

## API Key Strategy

1. **Server default key**: Backend reads from `config.json` or `LLM_API_KEY` env var (existing `get_llm_config()` pattern)
2. **User key fallback**: If server key is not configured, check `UserLlmConfigModel` for user's own key (existing `get_llm_config(user_id)` pattern)
3. **Rate limit handling**: If LLM call returns HTTP 429, the pipeline sets `tailor_job.status = "failed"` with message: `"API rate limit reached. Please configure your own API key in Settings."`
4. **No key available**: Return 503 from the start endpoint with message telling user to add a key in Settings
5. **Apify key**: Read from `APIFY_API_KEY` env var or `config.json`. If not configured and user provides a URL, return 400 with message: `"LinkedIn URL extraction requires an Apify API key. Please paste the job description text instead."`

---

## Concurrency

- **One job per resume**: Check `tailor_job.status == "running"` before starting. Return 409 if active.
- **Multiple users**: Each runs independently via `BackgroundTasks` (threadpool). No shared state beyond the API key.
- **Server restart**: Stale job cleanup marks orphaned "running" jobs as failed on startup.

---

## File Summary

### New files

| File | Purpose |
|------|---------|
| `apps/backend/app/routers/tailor.py` | 3 endpoints: start, status, cancel |
| `apps/backend/app/services/tailor.py` | Pipeline orchestration (P1 > P2 > P3) |
| `apps/backend/app/services/apify.py` | LinkedIn JD extraction via Apify |
| `apps/backend/app/services/prompt_loader.py` | Load and render prompt templates from `extension_defaults/` |
| `apps/backend/app/schemas/tailor.py` | Pydantic request/response models |
| `apps/frontend/components/tailor/TailorDialog.tsx` | Modal UI component |
| `apps/frontend/lib/api/tailor.ts` | API client functions |

### Modified files

| File | Change |
|------|--------|
| `apps/backend/app/database.py` | Add `tailor_job` JSONB column to `ResumeModel`, update `_ensure_resume_schema()`, update `_serialize_resume()` |
| `apps/backend/app/main.py` | Register tailor router, add stale job cleanup in lifespan |
| `apps/frontend/components/builder/resume-builder.tsx` | Add "Tailor" button that opens TailorDialog |
| `apps/frontend/app/(default)/resumes/[id]/page.tsx` | Import and render TailorDialog |

---

## Edge Cases

- **Apify key not configured**: If user provides URL, return 400 with helpful message suggesting they paste the JD text instead.
- **Profile 3 prompt1/prompt2 return plain text (not JSON)**: Store raw text as `prompt1_response` / `prompt2_response`. Skip JSON parsing for those stages. P3 still returns JSON.
- **Profile 4 skips P1 and P2 entirely**: Pipeline detects profile4 via check and jumps straight to P3 (one-shot mode). Template variables `{{PROMPT1_JSON}}` and `{{PROMPT2_JSON}}` resolve to empty strings.
- **LLM returns unparseable JSON**: One repair attempt per stage (same as extension). If repair fails, job fails with the validation error message.
- **User navigates away during job**: Job continues in background. User can check status when they return.
- **Resume deleted while job runs**: Background task catches "resume not found" on write, marks job as failed.
- **Cancel race condition**: A cancel request might arrive after the background task has already started the next LLM call. At worst, one extra LLM call completes before the task checks and stops. Acceptable tradeoff vs. added complexity.
- **Stale jobs on server restart**: Lifespan handler marks any "running" jobs older than 10 minutes as "failed".
