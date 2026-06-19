# Evals System for Tailoring Pipeline

## Goal

Give the admin a lightweight system to collect real tailor runs as eval cases, score them across recruiting-relevant metrics in manual steps, and export the full eval set (with judge instructions) as JSONL for external use.

Normal users have zero visibility into evals. All endpoints and UI are admin-only.

---

## Architecture

```
Collection
  User completes a tailor run
  Admin sees "Save as eval case" on the result (admin-only button)
  → POST /admin/evals/cases  (snapshot stored in eval_cases table)

Evaluation (manual, step-by-step)
  Admin opens /admin/evals dashboard
  Selects cases → clicks "Run structural + heuristics"
  → POST /admin/evals/runs  { case_ids, steps: ["structural"] }
  → POST /admin/evals/runs  { case_ids, steps: ["heuristics"] }
  Later clicks "Run judge" on passing cases only
  → POST /admin/evals/runs  { case_ids, steps: ["judge"] }
  Each step call is a separate action — the UI never batches all three together.
  Results stored in eval_runs table.

Export
  Admin clicks "Export JSONL"
  → GET /admin/evals/export
  → download: eval-set-YYYY-MM-DD.jsonl
  Each line: case + latest scores + judge_instructions embedded
```

---

## Database

Two new tables. Migrations follow the existing `_ensure_*_schema()` pattern in `database.py` (DDL runs in `Database.__init__`, guarded by `IF NOT EXISTS` / column existence checks — same as `_ensure_resume_schema()`, `_ensure_extension_runs_schema()`).

### `eval_cases`

Stores a snapshot of each eval case at collection time. Snapshots are stable — original resumes or JDs may change, eval cases do not.

```python
class EvalCaseModel(Base):
    __tablename__ = "eval_cases"

    id: Mapped[str]                    # "ec_<uuid4_hex[:12]>"
    created_at: Mapped[datetime]
    tags: Mapped[list | None]          # JSONB: ["good", "edge-case", ...]
    notes: Mapped[str | None]          # admin free-text

    # Snapshot at collection time
    prompt_profile_id: Mapped[str]     # "profile1" | "profile2" | "profile3" | "profile4"
    jd_source: Mapped[str]             # "linkedin_url" | "raw_text"
    jd_url: Mapped[str | None]
    jd_text: Mapped[str]               # always populated (extracted or raw)
    master_resume: Mapped[dict]        # JSONB snapshot
    tailored_resume: Mapped[dict]      # JSONB snapshot

    # Traceability back to live records
    source_resume_id: Mapped[str]      # master resume id
    tailored_resume_id: Mapped[str]    # tailored resume id
    tailor_job_id: Mapped[str]         # job_id from tailor_job JSONB
```

**DB lookup when creating a case** (from `tailored_resume_id`):
1. Load `ResumeModel` by `tailored_resume_id` → get `tailor_job` JSONB (contains `jd_text`, `jd_url`, `jd_source`, `prompt_profile_id`, `job_id`) and `linked_master_resume_id`
2. Load `ResumeModel` by `linked_master_resume_id` → get master resume data (via `_serialize_resume()`)
3. `tailored_resume` snapshot: serialize the tailored `ResumeModel`

`linked_master_resume_id` is present on all tailor pipeline outputs (set in the tailor service). The field is already included in `_serialize_resume()` and the frontend resume API response.

### `eval_runs`

One row per (case, step, run invocation). Old runs accumulate — not deleted — so scores can be compared across prompt versions.

```python
class EvalRunModel(Base):
    __tablename__ = "eval_runs"

    id: Mapped[str]                    # "er_<uuid4_hex[:12]>"
    case_id: Mapped[str]               # FK → eval_cases.id
    created_at: Mapped[datetime]
    step: Mapped[str]                  # "structural" | "heuristics" | "judge"
    passed: Mapped[bool]               # result of this run
    scores: Mapped[dict]               # JSONB — step-specific payload
    error: Mapped[str | None]          # populated if scorer raised an exception
```

Note: a row is only written after scoring completes. `passed` is always a concrete boolean — never null.

---

## Profile ID Mapping

`prompt_profile_id` is stored and transmitted as `"profile1"` through `"profile4"`. The canonical name and adjective map (used in judge prompt):

| ID | Name | Judge adjective |
|---|---|---|
| profile1 | Safe | conservative, accurate, understated |
| profile2 | Competitive | bold, differentiated, achievement-focused |
| profile3 | Lean | concise, minimal, high signal-to-noise |
| profile4 | Direct | direct, concrete, no fluff |

---

## Scoring

### Step 1 — Structural (free, instant)

All checks boolean. Any failure → `passed: False`.

| Check | Description |
|---|---|
| `valid_structure` | Required top-level keys present: `personal`, `experience`, `education`, `skills` |
| `no_empty_sections` | Every section non-empty in master is non-empty in tailored |
| `experience_entries_valid` | Every experience entry has `company`, `title`, `bullets` (list, len ≥ 1) |
| `sections_complete` | Sections in tailored ⊇ sections in master |

Scores JSONB:
```json
{
  "valid_structure": true,
  "no_empty_sections": true,
  "experience_entries_valid": true,
  "sections_complete": false,
  "failed_checks": ["sections_complete"]
}
```

### Step 2 — Heuristics (free, rule-based)

Recruiting-domain metrics. `passed` = True only if all four conditions hold.

| Metric | How | Pass condition |
|---|---|---|
| `relevance_delta` | `embed_sim(tailored, jd) - embed_sim(master, jd)` | > 0.0 |
| `ats_keyword_delta` | Keyword hit rate delta (see below) | ≥ 0 |
| `hallucination_free` | All employer/school names in tailored ⊆ same in master | True |
| `quantification_rate_ok` | % bullets with a number in tailored ≥ master rate AND ≥ 20% floor | True |

**Embeddings**: Use the existing `app/llm.py` LiteLLM embeddings call — no new ML dependencies. Call `litellm.aembedding()` with the user's configured model (or fall back to `text-embedding-3-small` if the provider supports it). Do NOT add `sentence-transformers` or PyTorch.

**ATS keyword extraction**: Regex-based. Extract tokens that match: (a) words from a curated 300-term skill/tech list (Python, SQL, React, AWS, etc. — stored as a plain text file in `evals/data/skills.txt`), OR (b) all-caps acronyms (API, REST, CI/CD). No NLP library required.

**Hallucination check**: Extract `company` fields from `experience` array and `institution` fields from `education` array in both resumes. Tailored set must be a subset of master set (case-insensitive).

**Quantification rate**: Count bullets matching regex `\d+[\d,\.]*\s*(%|x|X|\$|k|K|M|B|million|billion|percent|people|users|teams?)` or containing a bare integer ≥ 2 digits. Rate = matching / total bullets. Pass if tailored rate ≥ master rate AND ≥ 0.20.

Scores JSONB:
```json
{
  "relevance_delta": 0.18,
  "embed_sim_master": 0.61,
  "embed_sim_tailored": 0.79,
  "ats_keyword_delta": 0.12,
  "ats_hit_rate_master": 0.48,
  "ats_hit_rate_tailored": 0.60,
  "hallucination_free": true,
  "hallucinated_entities": [],
  "quantification_rate_master": 0.45,
  "quantification_rate_tailored": 0.52,
  "quantification_rate_ok": true
}
```

### Step 3 — LLM Judge (costs money, admin triggers explicitly)

One LLM call per case. Model is configured via env var `EVAL_JUDGE_MODEL` (default: `"gemini/gemini-2.0-flash-lite"`). Deliberately uses a different model than the one that generated the output to avoid self-grading bias.

**Judge prompt** (stored verbatim in `scorer_judge.py` — this exact string is also embedded in the JSONL export):

```
You are a senior technical recruiter reviewing a tailored resume application.

Job Description:
{jd_text}

Master Resume (original, unmodified):
{master_resume_json}

Tailored Resume (AI-generated for this role):
{tailored_resume_json}

Score on each dimension from 1 to 5. Be strict — a 5 means you would
confidently shortlist this candidate for an interview.

1. Positioning (1-5): Does this candidate's experience read as a strong match
   for THIS specific role? Not generic quality — fit to this JD.

2. Credibility (1-5): Do the bullets feel trustworthy and grounded in real
   work, or do they feel exaggerated / generic / AI-written?

3. Keyword alignment (1-5): Without keyword-stuffing, does this resume speak
   the natural language of this job posting?

4. Profile character (1-5): This resume was generated in "{profile_name}" style,
   intended to feel {profile_adjective}. Does it succeed?

5. Verdict: Would you shortlist this candidate based on this resume alone?

Return valid JSON only, no other text:
{
  "positioning": <1-5>,
  "credibility": <1-5>,
  "keyword_alignment": <1-5>,
  "profile_character": <1-5>,
  "verdict": "shortlist" | "maybe" | "reject",
  "reason": "<one sentence>"
}
```

Scores JSONB:
```json
{
  "positioning": 4,
  "credibility": 4,
  "keyword_alignment": 3,
  "profile_character": 5,
  "verdict": "shortlist",
  "reason": "Strong systems experience, clearly positioned for the distributed role.",
  "judge_model": "gemini/gemini-2.0-flash-lite"
}
```

---

## API Endpoints

All under `/admin/evals` in `app/routers/evals.py`, protected by `_require_admin_user` (same guard as `app/routers/admin.py`).

```
POST   /admin/evals/cases              Create eval case from a completed tailor run
GET    /admin/evals/cases              List cases (filter: tag, profile, verdict, passed)
DELETE /admin/evals/cases/{case_id}   Delete a case and its runs

POST   /admin/evals/runs               Trigger ONE step on selected cases
                                       Body: { case_ids: [...], step: "structural" | "heuristics" | "judge" }
                                       (singular step per call — the UI issues separate calls per step)

GET    /admin/evals/export             Download JSONL
```

### POST /admin/evals/cases

Request body:
```json
{
  "tailored_resume_id": "res_abc123",
  "tags": ["good", "swe"],
  "notes": "Strong result on distributed systems JD"
}
```

Validation: `tailor_job` JSONB must exist on the resume and `status` must be `"completed"`. `linked_master_resume_id` must be non-null. Returns 400 if either condition fails.

---

## Export Format

One JSON object per line (JSONL). Self-contained — `judge_instructions` embeds the exact prompt text so any external tool can reproduce the evaluation.

```jsonl
{"case_id": "ec_abc123", "exported_at": "2026-06-19T...", "created_at": "...", "tags": ["good"], "notes": "...", "prompt_profile_id": "profile2", "jd_source": "linkedin_url", "jd_url": "https://...", "jd_text": "...", "master_resume": {...}, "tailored_resume": {...}, "latest_scores": {"structural": {...}, "heuristics": {...}, "judge": {...}}, "judge_instructions": "You are a senior technical recruiter..."}
```

`latest_scores` contains only the most recent run result per step (not full history). Filename: `eval-set-YYYY-MM-DD.jsonl`.

---

## Frontend

### New page: `/admin/evals`

Admin-only. Middleware or page-level check: if `session.user.email` not in admin set → redirect to `/dashboard`.

**Cases list:**

```
Eval Cases                                          [Export JSONL ↓]

Filter: [All profiles ▾]  [All verdicts ▾]

  ☐  ec_001  profile2  Jun 15  swe, good
       structural ✓   heuristics ✓   judge: shortlist (avg 4.0)
       rel_delta +0.18   ats_delta +12%
       [Run judge]  [Delete]

  ☐  ec_002  profile1  Jun 17  edge-case
       structural ✓   heuristics ✗  hallucination: "Meta"
       [Re-run heuristics]  [Delete]

  [Run structural on selected]  [Run heuristics on selected]  [Run judge on selected]
```

Each "Run X on selected" button → separate `POST /admin/evals/runs` call with `step: "structural"` etc.

### "Save as eval case" button

Visible on `/resumes/{id}` only when:
- Logged-in user's email is in `ALLOWED_ADMIN_EMAILS` (check via session)
- Resume has `linked_master_resume_id` set (confirming it's a tailor pipeline output)

Opens a small modal: tags multi-select (good, bad, edge-case, swe, pm, design, …) + notes textarea + Save button.

---

## What is NOT built

- Per-user eval visibility
- Scheduled or automated eval runs
- Run history UI (past runs are stored in DB but not surfaced in the UI)
- Per-stage scoring of P1/P2 intermediate outputs
- Profile A/B comparison mode

---

## File Map

```
Backend
  app/routers/evals.py
  app/services/evals/
    __init__.py
    collector.py            Save tailor run snapshot as eval case
    scorer_structural.py    Layer 1 structural checks
    scorer_heuristics.py    Layer 2 (relevance delta, ATS, hallucination, quantification)
    scorer_judge.py         Layer 3 LLM-as-judge
    runner.py               Run one step across a batch of cases
    exporter.py             Generate JSONL download
  app/schemas/evals.py      Pydantic request/response models
  app/database.py           EvalCaseModel, EvalRunModel, _ensure_evals_schema()
  evals/data/skills.txt     300-term skill/tech keyword list for ATS extraction

Frontend
  app/(default)/admin/evals/page.tsx
  components/evals/
    CaseList.tsx
    CaseRow.tsx
    RunStepButton.tsx
    SaveEvalCaseModal.tsx
  lib/api/evals.ts

Admin guard
  Reuse ALLOWED_ADMIN_EMAILS from app/routers/admin.py (import, don't duplicate)
  Frontend: check session email client-side for button visibility;
  backend: _require_admin_user dep on every endpoint
```

---

## Implementation Order

1. DB: `EvalCaseModel`, `EvalRunModel`, `_ensure_evals_schema()` in `database.py`
2. Pydantic schemas: `app/schemas/evals.py`
3. Collector service + `POST /admin/evals/cases`
4. Structural scorer + heuristics scorer + `skills.txt`
5. Runner service + `POST /admin/evals/runs` + `GET /admin/evals/cases`
6. LLM judge scorer
7. Exporter + `GET /admin/evals/export`
8. Frontend eval dashboard page + CaseList/CaseRow components
9. "Save as eval case" button + modal on the resume page
