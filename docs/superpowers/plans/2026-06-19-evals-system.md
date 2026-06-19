# Evals System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only eval system that collects tailor pipeline runs as eval cases, scores them across recruiting-relevant metrics in manual steps, and exports the dataset as JSONL.

**Architecture:** Two new PostgreSQL tables (`eval_cases`, `eval_runs`) store snapshots and scoring results. A backend service layer (collector, scorers, runner, exporter) behind admin-only FastAPI endpoints. A minimal frontend dashboard under `/admin/evals` with a "Save as eval case" button wired into the resume detail page.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), Next.js/React/Tailwind (frontend), pure-Python TF-IDF cosine similarity for relevance scoring (zero new deps), `litellm.acompletion` for the LLM judge.

---

## Chunk 1: Backend — DB, Schemas, Collector

### Task 1: DB Models + `_ensure_evals_schema`

**Files:**
- Modify: `apps/backend/app/database.py`

The two new models go just after `ExtensionRunModel` (before the `class Database:` definition). `_ensure_evals_schema` is added to `Database` and called from `init_schema`.

- [ ] **Step 1: Add `EvalCaseModel` and `EvalRunModel` to `database.py`**

Insert after `class ExtensionRunModel(Base): ...` block, before `class Database:`:

```python
class EvalCaseModel(Base):
    __tablename__ = "eval_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_profile_id: Mapped[str] = mapped_column(String(32), nullable=False)
    jd_source: Mapped[str] = mapped_column(String(32), nullable=False)
    jd_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    jd_text: Mapped[str] = mapped_column(Text, nullable=False)
    master_resume: Mapped[dict] = mapped_column(JSONB, nullable=False)
    tailored_resume: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source_resume_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    tailored_resume_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    tailor_job_id: Mapped[str] = mapped_column(String(128), nullable=False)


class EvalRunModel(Base):
    __tablename__ = "eval_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    case_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    step: Mapped[str] = mapped_column(String(32), nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    scores: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 2: Add `_ensure_evals_schema` method and `get_resume_admin` to `Database`**

In `Database.init_schema()`, add `self._ensure_evals_schema()` after the existing `_ensure_llm_config_schema()` call.

Add the method body:
```python
def _ensure_evals_schema(self) -> None:
    """No-op for now — eval_cases and eval_runs are created by create_all.
    Place future additive column migrations here."""
    pass

def get_resume_admin(self, resume_id: str) -> dict[str, Any] | None:
    """Load a resume by ID without user-scope filtering (admin only)."""
    with self._session() as session:
        resume = session.get(ResumeModel, resume_id)
        return self._serialize_resume(resume) if resume else None

def create_eval_case(self, case: dict[str, Any]) -> dict[str, Any]:
    """Persist an eval case snapshot. Returns the serialized case."""
    with self._session() as session:
        row = EvalCaseModel(**case)
        session.add(row)
        session.commit()
        session.refresh(row)
        return self._serialize_eval_case(row)

def list_eval_cases(
    self,
    profile: str | None = None,
    tag: str | None = None,
) -> list[dict[str, Any]]:
    with self._session() as session:
        query = session.query(EvalCaseModel).order_by(EvalCaseModel.created_at.desc())
        if profile:
            query = query.filter(EvalCaseModel.prompt_profile_id == profile)
        if tag:
            query = query.filter(EvalCaseModel.tags.contains([tag]))
        return [self._serialize_eval_case(r) for r in query.all()]

def get_eval_case(self, case_id: str) -> dict[str, Any] | None:
    with self._session() as session:
        row = session.get(EvalCaseModel, case_id)
        return self._serialize_eval_case(row) if row else None

def delete_eval_case(self, case_id: str) -> bool:
    with self._session() as session:
        row = session.get(EvalCaseModel, case_id)
        if not row:
            return False
        session.query(EvalRunModel).filter(EvalRunModel.case_id == case_id).delete()
        session.delete(row)
        session.commit()
        return True

def create_eval_run(self, run: dict[str, Any]) -> dict[str, Any]:
    with self._session() as session:
        row = EvalRunModel(**run)
        session.add(row)
        session.commit()
        session.refresh(row)
        return self._serialize_eval_run(row)

def get_latest_eval_runs_for_cases(
    self, case_ids: list[str]
) -> dict[str, dict[str, dict[str, Any]]]:
    """Return {case_id: {step: latest_run_scores}} for a list of case IDs."""
    if not case_ids:
        return {}
    with self._session() as session:
        rows = (
            session.query(EvalRunModel)
            .filter(EvalRunModel.case_id.in_(case_ids))
            .order_by(EvalRunModel.created_at.desc())
            .all()
        )
    result: dict[str, dict[str, dict[str, Any]]] = {}
    for row in rows:
        cid = row.case_id
        if cid not in result:
            result[cid] = {}
        if row.step not in result[cid]:
            result[cid][row.step] = self._serialize_eval_run(row)
    return result

def _serialize_eval_case(self, row: EvalCaseModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "tags": row.tags or [],
        "notes": row.notes,
        "prompt_profile_id": row.prompt_profile_id,
        "jd_source": row.jd_source,
        "jd_url": row.jd_url,
        "jd_text": row.jd_text,
        "master_resume": row.master_resume,
        "tailored_resume": row.tailored_resume,
        "source_resume_id": row.source_resume_id,
        "tailored_resume_id": row.tailored_resume_id,
        "tailor_job_id": row.tailor_job_id,
    }

def _serialize_eval_run(self, row: EvalRunModel) -> dict[str, Any]:
    return {
        "id": row.id,
        "case_id": row.case_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "step": row.step,
        "passed": row.passed,
        "scores": row.scores or {},
        "error": row.error,
    }
```

- [ ] **Step 3: Start the backend and verify tables are created**

```bash
cd apps/backend
uv run uvicorn app.main:app --reload --port 8000
```

Expected: server starts, logs show no migration errors. Then run:
```bash
uv run python -c "from app.database import db; db.init_schema(); print('OK')"
```
Expected: prints `OK` with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/database.py
git commit -m "feat(evals): add EvalCaseModel, EvalRunModel, DB methods"
```

---

### Task 2: Pydantic Schemas

**Files:**
- Create: `apps/backend/app/schemas/evals.py`

- [ ] **Step 1: Create the file**

```python
"""Pydantic schemas for the evals system."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CreateEvalCaseRequest(BaseModel):
    tailored_resume_id: str
    tags: list[str] = Field(default_factory=list)
    notes: str | None = None


class EvalCaseResponse(BaseModel):
    id: str
    created_at: str
    tags: list[str]
    notes: str | None
    prompt_profile_id: str
    jd_source: str
    jd_url: str | None
    jd_text: str
    source_resume_id: str
    tailored_resume_id: str
    tailor_job_id: str
    latest_runs: dict[str, dict[str, Any]] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class EvalCaseListResponse(BaseModel):
    items: list[EvalCaseResponse]
    total: int


class RunEvalStepRequest(BaseModel):
    case_ids: list[str] = Field(min_length=1)
    step: Literal["structural", "heuristics", "judge"]


class EvalRunResponse(BaseModel):
    id: str
    case_id: str
    created_at: str
    step: str
    passed: bool
    scores: dict[str, Any]
    error: str | None

    model_config = {"from_attributes": True}


class RunEvalStepResponse(BaseModel):
    results: list[EvalRunResponse]
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
cd apps/backend
uv run python -c "from app.schemas.evals import CreateEvalCaseRequest, RunEvalStepRequest; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/schemas/evals.py
git commit -m "feat(evals): add Pydantic schemas for evals API"
```

---

### Task 3: ATS Skills Word List

**Files:**
- Create: `apps/backend/evals/data/skills.txt`

- [ ] **Step 1: Create the directory and skills file**

```bash
mkdir -p apps/backend/evals/data
```

Create `apps/backend/evals/data/skills.txt` with one skill per line:

```
python
javascript
typescript
react
nextjs
nodejs
sql
postgresql
mysql
mongodb
redis
docker
kubernetes
aws
gcp
azure
terraform
ansible
git
linux
bash
java
golang
rust
c++
swift
kotlin
android
ios
machine learning
deep learning
tensorflow
pytorch
scikit-learn
pandas
numpy
spark
kafka
airflow
dbt
bigquery
snowflake
elasticsearch
graphql
rest
grpc
fastapi
django
flask
spring
rails
vue
angular
figma
sketch
product management
agile
scrum
roadmap
okr
a/b testing
user research
data analysis
excel
tableau
looker
powerbi
sql
etl
data engineering
data science
analytics
growth
marketing
seo
sem
paid acquisition
crm
salesforce
hubspot
b2b
saas
fundraising
investor relations
p&l
operations
supply chain
finance
accounting
revenue
enterprise
startup
leadership
cross-functional
stakeholder
communication
presentation
strategy
API
REST
SQL
CI/CD
DevOps
SRE
ML
AI
LLM
NLP
CV
```

- [ ] **Step 2: Verify file exists**

```bash
wc -l apps/backend/evals/data/skills.txt
```
Expected: ≥ 80 lines

- [ ] **Step 3: Commit**

```bash
git add apps/backend/evals/data/skills.txt
git commit -m "feat(evals): add ATS skills keyword list"
```

---

### Task 4: Collector Service

**Files:**
- Create: `apps/backend/app/services/evals/__init__.py`
- Create: `apps/backend/app/services/evals/collector.py`

- [ ] **Step 1: Create `__init__.py`**

```python
"""Evals service package."""
```

- [ ] **Step 2: Create `collector.py`**

```python
"""Collector: snapshot a completed tailor run as an eval case."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.database import db

logger = logging.getLogger(__name__)


def collect_eval_case(
    tailored_resume_id: str,
    tags: list[str],
    notes: str | None,
) -> dict[str, Any]:
    """
    Load a completed tailor run by its tailored_resume_id and snapshot it
    as an eval case. Raises HTTPException on bad input.
    """
    # Load tailored resume (admin-scoped, no user filter)
    tailored = db.get_resume_admin(tailored_resume_id)
    if tailored is None:
        raise HTTPException(status_code=404, detail="Tailored resume not found")

    tailor_job = tailored.get("tailor_job")
    if not tailor_job or tailor_job.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail="Resume was not produced by a completed tailor pipeline run",
        )

    master_id = tailored.get("linked_master_resume_id")
    if not master_id:
        raise HTTPException(
            status_code=400,
            detail="Resume has no linked master resume (not a tailor pipeline output)",
        )

    master = db.get_resume_admin(master_id)
    if master is None:
        raise HTTPException(status_code=404, detail="Master resume not found")

    case_id = "ec_" + uuid4().hex[:12]

    case = {
        "id": case_id,
        "created_at": datetime.now(timezone.utc),
        "tags": tags or [],
        "notes": notes,
        "prompt_profile_id": tailor_job.get("prompt_profile_id", "profile2"),
        "jd_source": tailor_job.get("jd_source", "raw_text"),
        "jd_url": tailor_job.get("jd_url"),
        "jd_text": tailor_job.get("jd_text", ""),
        "master_resume": master.get("processed_data") or {},
        "tailored_resume": tailored.get("processed_data") or {},
        "source_resume_id": master_id,
        "tailored_resume_id": tailored_resume_id,
        "tailor_job_id": tailor_job.get("job_id", ""),
    }

    if not case["jd_text"]:
        raise HTTPException(status_code=400, detail="Tailor job has no jd_text — cannot create eval case")

    return db.create_eval_case(case)
```

- [ ] **Step 3: Verify imports**

```bash
cd apps/backend
uv run python -c "from app.services.evals.collector import collect_eval_case; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/services/evals/
git commit -m "feat(evals): add collector service"
```

---

## Chunk 2: Backend — Scorers + Runner + Exporter

### Task 5: Structural Scorer

**Files:**
- Create: `apps/backend/app/services/evals/scorer_structural.py`

- [ ] **Step 1: Create the file**

```python
"""Layer 1 structural scorer — deterministic, zero cost."""

from __future__ import annotations

from typing import Any


REQUIRED_KEYS = {"personal", "experience", "education", "skills"}


def score_structural(
    master: dict[str, Any],
    tailored: dict[str, Any],
) -> tuple[bool, dict[str, Any]]:
    """
    Run structural checks. Returns (passed, scores_dict).
    All checks must pass for passed=True.
    """
    failed: list[str] = []

    # 1. Required top-level keys
    missing_keys = REQUIRED_KEYS - set(tailored.keys())
    valid_structure = len(missing_keys) == 0
    if not valid_structure:
        failed.append("valid_structure")

    # 2. Sections that are non-empty in master must be non-empty in tailored
    no_empty_sections = True
    for key in master:
        master_val = master.get(key)
        tailored_val = tailored.get(key)
        if master_val and not tailored_val:
            no_empty_sections = False
            break
        if isinstance(master_val, list) and len(master_val) > 0:
            if not isinstance(tailored_val, list) or len(tailored_val) == 0:
                no_empty_sections = False
                break
    if not no_empty_sections:
        failed.append("no_empty_sections")

    # 3. Experience entries validity
    experience_entries_valid = True
    experience = tailored.get("experience") or []
    if isinstance(experience, list):
        for entry in experience:
            if not isinstance(entry, dict):
                experience_entries_valid = False
                break
            bullets = entry.get("bullets") or entry.get("description") or []
            if not entry.get("company") or not entry.get("title"):
                experience_entries_valid = False
                break
            if not isinstance(bullets, list) or len(bullets) == 0:
                experience_entries_valid = False
                break
    if not experience_entries_valid:
        failed.append("experience_entries_valid")

    # 4. Section completeness — tailored must have all sections master has
    master_sections = {k for k, v in master.items() if v}
    tailored_sections = {k for k, v in tailored.items() if v}
    sections_complete = master_sections.issubset(tailored_sections)
    if not sections_complete:
        failed.append("sections_complete")

    scores = {
        "valid_structure": valid_structure,
        "no_empty_sections": no_empty_sections,
        "experience_entries_valid": experience_entries_valid,
        "sections_complete": sections_complete,
        "failed_checks": failed,
    }
    return (len(failed) == 0, scores)
```

- [ ] **Step 2: Quick sanity check**

```bash
cd apps/backend
uv run python -c "
from app.services.evals.scorer_structural import score_structural
master = {'personal': {'name': 'Alice'}, 'experience': [{'company': 'X', 'title': 'E', 'bullets': ['did stuff']}], 'education': [{'school': 'MIT'}], 'skills': ['Python']}
tailored = {'personal': {'name': 'Alice'}, 'experience': [{'company': 'X', 'title': 'E', 'bullets': ['did stuff']}], 'education': [{'school': 'MIT'}], 'skills': ['Python', 'FastAPI']}
passed, scores = score_structural(master, tailored)
print('passed:', passed, 'failed:', scores['failed_checks'])
"
```
Expected: `passed: True failed: []`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/services/evals/scorer_structural.py
git commit -m "feat(evals): add structural scorer (Layer 1)"
```

---

### Task 6: Heuristics Scorer

**Files:**
- Create: `apps/backend/app/services/evals/scorer_heuristics.py`

- [ ] **Step 1: Create the file**

```python
"""Layer 2 heuristic scorer — relevance delta, ATS keywords, hallucination, quantification."""

from __future__ import annotations

import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Skills keyword list (loaded once)
# ---------------------------------------------------------------------------
_SKILLS_FILE = Path(__file__).parent.parent.parent.parent / "evals" / "data" / "skills.txt"


def _load_skills() -> set[str]:
    if not _SKILLS_FILE.exists():
        return set()
    lines = _SKILLS_FILE.read_text(encoding="utf-8").splitlines()
    return {ln.strip().lower() for ln in lines if ln.strip() and not ln.startswith("#")}


_SKILL_TERMS: set[str] = _load_skills()

# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------

def _resume_to_text(resume: dict[str, Any]) -> str:
    """Flatten a structured resume dict to plain text for similarity scoring."""
    parts: list[str] = []

    def _walk(obj: Any) -> None:
        if isinstance(obj, str):
            parts.append(obj)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item)
        elif isinstance(obj, dict):
            for v in obj.values():
                _walk(v)

    _walk(resume)
    return " ".join(parts)


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z]{2,}", text.lower())


def _cosine_sim(text_a: str, text_b: str) -> float:
    """TF-based cosine similarity (pure Python, no external deps)."""
    toks_a = _tokenize(text_a)
    toks_b = _tokenize(text_b)
    if not toks_a or not toks_b:
        return 0.0
    freq_a: Counter[str] = Counter(toks_a)
    freq_b: Counter[str] = Counter(toks_b)
    vocab = set(freq_a) | set(freq_b)
    dot = sum(freq_a.get(t, 0) * freq_b.get(t, 0) for t in vocab)
    mag_a = math.sqrt(sum(v * v for v in freq_a.values()))
    mag_b = math.sqrt(sum(v * v for v in freq_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return round(dot / (mag_a * mag_b), 4)


# ---------------------------------------------------------------------------
# ATS keyword extraction
# ---------------------------------------------------------------------------
_ACRONYM_RE = re.compile(r"\b[A-Z]{2,}(?:[/\-][A-Z]+)*\b")


def _extract_ats_keywords(text: str) -> set[str]:
    """Extract skill/tech terms from text using the skills list + acronyms."""
    lower = text.lower()
    found: set[str] = set()

    # Multi-word skill terms first (longer → more specific)
    for skill in sorted(_SKILL_TERMS, key=len, reverse=True):
        if skill in lower:
            found.add(skill)

    # All-caps acronyms (API, REST, CI/CD, AWS, etc.)
    for match in _ACRONYM_RE.findall(text):
        found.add(match.lower())

    return found


def _ats_hit_rate(resume_text: str, jd_text: str) -> float:
    jd_keywords = _extract_ats_keywords(jd_text)
    if not jd_keywords:
        return 1.0
    resume_keywords = _extract_ats_keywords(resume_text)
    hits = jd_keywords & resume_keywords
    return round(len(hits) / len(jd_keywords), 4)


# ---------------------------------------------------------------------------
# Hallucination check
# ---------------------------------------------------------------------------

def _extract_employer_names(resume: dict[str, Any]) -> set[str]:
    names: set[str] = set()
    for entry in resume.get("experience") or []:
        if isinstance(entry, dict) and entry.get("company"):
            names.add(entry["company"].strip().lower())
    for entry in resume.get("education") or []:
        if isinstance(entry, dict):
            school = entry.get("school") or entry.get("institution") or ""
            if school:
                names.add(school.strip().lower())
    return names


# ---------------------------------------------------------------------------
# Quantification rate
# ---------------------------------------------------------------------------
_QUANT_RE = re.compile(
    r"\b\d[\d,\.]*\s*(%|x|X|\$|k|K|M|B|million|billion|percent|people|users|teams?)\b"
    r"|\b\d{2,}\b",
    re.IGNORECASE,
)


def _extract_bullets(resume: dict[str, Any]) -> list[str]:
    bullets: list[str] = []
    for entry in resume.get("experience") or []:
        if isinstance(entry, dict):
            raw = entry.get("bullets") or entry.get("description") or []
            if isinstance(raw, list):
                bullets.extend(str(b) for b in raw)
            elif isinstance(raw, str):
                bullets.append(raw)
    return bullets


def _quantification_rate(resume: dict[str, Any]) -> float:
    bullets = _extract_bullets(resume)
    if not bullets:
        return 0.0
    quantified = sum(1 for b in bullets if _QUANT_RE.search(b))
    return round(quantified / len(bullets), 4)


# ---------------------------------------------------------------------------
# Main scorer
# ---------------------------------------------------------------------------

def score_heuristics(
    master: dict[str, Any],
    tailored: dict[str, Any],
    jd_text: str,
) -> tuple[bool, dict[str, Any]]:
    """
    Run heuristic metrics. Returns (passed, scores_dict).
    passed=True only if all four conditions hold.
    """
    master_text = _resume_to_text(master)
    tailored_text = _resume_to_text(tailored)

    # 1. Relevance delta
    sim_master = _cosine_sim(master_text, jd_text)
    sim_tailored = _cosine_sim(tailored_text, jd_text)
    relevance_delta = round(sim_tailored - sim_master, 4)
    relevance_ok = relevance_delta > 0.0

    # 2. ATS keyword delta
    ats_master = _ats_hit_rate(master_text, jd_text)
    ats_tailored = _ats_hit_rate(tailored_text, jd_text)
    ats_delta = round(ats_tailored - ats_master, 4)
    ats_ok = ats_delta >= 0.0

    # 3. Hallucination check
    master_entities = _extract_employer_names(master)
    tailored_entities = _extract_employer_names(tailored)
    phantoms = tailored_entities - master_entities
    hallucination_free = len(phantoms) == 0

    # 4. Quantification rate
    quant_master = _quantification_rate(master)
    quant_tailored = _quantification_rate(tailored)
    QUANT_FLOOR = 0.20
    quant_ok = quant_tailored >= quant_master and quant_tailored >= QUANT_FLOOR

    passed = relevance_ok and ats_ok and hallucination_free and quant_ok

    scores = {
        "relevance_delta": relevance_delta,
        "embed_sim_master": sim_master,
        "embed_sim_tailored": sim_tailored,
        "relevance_ok": relevance_ok,
        "ats_keyword_delta": ats_delta,
        "ats_hit_rate_master": ats_master,
        "ats_hit_rate_tailored": ats_tailored,
        "ats_ok": ats_ok,
        "hallucination_free": hallucination_free,
        "hallucinated_entities": sorted(phantoms),
        "quantification_rate_master": quant_master,
        "quantification_rate_tailored": quant_tailored,
        "quantification_rate_ok": quant_ok,
    }
    return (passed, scores)
```

- [ ] **Step 2: Quick sanity check**

```bash
cd apps/backend
uv run python -c "
from app.services.evals.scorer_heuristics import score_heuristics
master = {'experience': [{'company': 'Google', 'title': 'SWE', 'bullets': ['Built systems']}], 'education': [{'school': 'MIT'}]}
tailored = {'experience': [{'company': 'Google', 'title': 'SWE', 'bullets': ['Built distributed systems achieving 30% latency reduction']}], 'education': [{'school': 'MIT'}]}
jd = 'Looking for SWE with distributed systems Python AWS experience'
passed, scores = score_heuristics(master, tailored, jd)
print('passed:', passed)
print('relevance_delta:', scores['relevance_delta'])
print('hallucination_free:', scores['hallucination_free'])
"
```
Expected: prints scores without error. `hallucination_free: True`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/services/evals/scorer_heuristics.py
git commit -m "feat(evals): add heuristics scorer (Layer 2)"
```

---

### Task 7: LLM Judge Scorer

**Files:**
- Create: `apps/backend/app/services/evals/scorer_judge.py`

- [ ] **Step 1: Create the file**

```python
"""Layer 3 LLM-as-judge scorer — uses litellm.acompletion with a recruiter rubric."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import litellm

logger = logging.getLogger(__name__)

EVAL_JUDGE_MODEL = os.environ.get("EVAL_JUDGE_MODEL", "gemini/gemini-2.0-flash-lite")

_PROFILE_META: dict[str, dict[str, str]] = {
    "profile1": {"name": "Safe", "adjective": "conservative, accurate, understated"},
    "profile2": {"name": "Competitive", "adjective": "bold, differentiated, achievement-focused"},
    "profile3": {"name": "Lean", "adjective": "concise, minimal, high signal-to-noise"},
    "profile4": {"name": "Direct", "adjective": "direct, concrete, no fluff"},
}

JUDGE_PROMPT_TEMPLATE = """\
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
{{
  "positioning": <1-5>,
  "credibility": <1-5>,
  "keyword_alignment": <1-5>,
  "profile_character": <1-5>,
  "verdict": "shortlist" | "maybe" | "reject",
  "reason": "<one sentence>"
}}"""


def _build_prompt(
    jd_text: str,
    master: dict[str, Any],
    tailored: dict[str, Any],
    profile_id: str,
) -> str:
    meta = _PROFILE_META.get(profile_id, _PROFILE_META["profile2"])
    return JUDGE_PROMPT_TEMPLATE.format(
        jd_text=jd_text[:4000],  # cap to avoid token limits
        master_resume_json=json.dumps(master, ensure_ascii=False)[:6000],
        tailored_resume_json=json.dumps(tailored, ensure_ascii=False)[:6000],
        profile_name=meta["name"],
        profile_adjective=meta["adjective"],
    )


def _extract_json(raw: str) -> dict[str, Any]:
    """Extract JSON object from raw LLM response text."""
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise ValueError(f"No JSON found in judge response: {raw[:200]}")
    return json.loads(match.group())


async def score_judge(
    master: dict[str, Any],
    tailored: dict[str, Any],
    jd_text: str,
    profile_id: str,
) -> tuple[bool, dict[str, Any]]:
    """
    Call the LLM judge. Returns (passed, scores_dict).
    passed=True if verdict is 'shortlist' or 'maybe' (not 'reject').
    """
    prompt = _build_prompt(jd_text, master, tailored, profile_id)

    response = await litellm.acompletion(
        model=EVAL_JUDGE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=512,
    )
    raw = response.choices[0].message.content or ""

    try:
        result = _extract_json(raw)
    except (ValueError, json.JSONDecodeError) as e:
        raise RuntimeError(f"Judge returned unparseable output: {e}") from e

    verdict = result.get("verdict", "reject")
    passed = verdict in ("shortlist", "maybe")

    scores = {
        "positioning": result.get("positioning"),
        "credibility": result.get("credibility"),
        "keyword_alignment": result.get("keyword_alignment"),
        "profile_character": result.get("profile_character"),
        "verdict": verdict,
        "reason": result.get("reason", ""),
        "judge_model": EVAL_JUDGE_MODEL,
    }
    return (passed, scores)


def get_judge_instructions() -> str:
    """Return the judge prompt template for embedding in JSONL exports."""
    return JUDGE_PROMPT_TEMPLATE
```

- [ ] **Step 2: Verify imports**

```bash
cd apps/backend
uv run python -c "from app.services.evals.scorer_judge import score_judge, get_judge_instructions; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/services/evals/scorer_judge.py
git commit -m "feat(evals): add LLM judge scorer (Layer 3)"
```

---

### Task 8: Runner + Exporter

**Files:**
- Create: `apps/backend/app/services/evals/runner.py`
- Create: `apps/backend/app/services/evals/exporter.py`

- [ ] **Step 1: Create `runner.py`**

```python
"""Orchestrates running a single eval step across a batch of cases."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.database import db
from app.services.evals.scorer_structural import score_structural
from app.services.evals.scorer_heuristics import score_heuristics
from app.services.evals.scorer_judge import score_judge

logger = logging.getLogger(__name__)


async def run_step(case_ids: list[str], step: str) -> list[dict[str, Any]]:
    """
    Run one scoring step across all given case IDs.
    Returns a list of EvalRun dicts (one per case).
    Errors per case are captured — one failure doesn't abort the rest.
    """
    results: list[dict[str, Any]] = []

    for case_id in case_ids:
        case = db.get_eval_case(case_id)
        if case is None:
            logger.warning("Eval case not found: %s — skipping", case_id)
            continue

        master = case["master_resume"]
        tailored = case["tailored_resume"]
        jd_text = case["jd_text"]
        profile_id = case["prompt_profile_id"]

        run_id = "er_" + uuid4().hex[:12]
        passed = False
        scores: dict[str, Any] = {}
        error: str | None = None

        try:
            if step == "structural":
                passed, scores = score_structural(master, tailored)
            elif step == "heuristics":
                passed, scores = score_heuristics(master, tailored, jd_text)
            elif step == "judge":
                passed, scores = await score_judge(master, tailored, jd_text, profile_id)
            else:
                raise ValueError(f"Unknown eval step: {step}")
        except Exception as exc:
            logger.exception("Scorer error for case %s step %s", case_id, step)
            error = str(exc)
            passed = False
            scores = {}

        run = db.create_eval_run({
            "id": run_id,
            "case_id": case_id,
            "created_at": datetime.now(timezone.utc),
            "step": step,
            "passed": passed,
            "scores": scores,
            "error": error,
        })
        results.append(run)

    return results
```

- [ ] **Step 2: Create `exporter.py`**

```python
"""Generate JSONL export of all eval cases with embedded judge instructions."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.database import db
from app.services.evals.scorer_judge import get_judge_instructions


def export_jsonl() -> str:
    """
    Return a JSONL string: one JSON object per line.
    Each line: case data + latest_scores per step + judge_instructions.
    """
    cases = db.list_eval_cases()
    case_ids = [c["id"] for c in cases]
    runs_by_case = db.get_latest_eval_runs_for_cases(case_ids)

    judge_instructions = get_judge_instructions()
    exported_at = datetime.now(timezone.utc).isoformat()
    lines: list[str] = []

    for case in cases:
        case_runs = runs_by_case.get(case["id"], {})
        latest_scores: dict[str, Any] = {}
        for step, run in case_runs.items():
            latest_scores[step] = {
                "passed": run["passed"],
                "scores": run["scores"],
                "error": run.get("error"),
                "created_at": run["created_at"],
            }

        record = {
            "case_id": case["id"],
            "exported_at": exported_at,
            "created_at": case["created_at"],
            "tags": case["tags"],
            "notes": case["notes"],
            "prompt_profile_id": case["prompt_profile_id"],
            "jd_source": case["jd_source"],
            "jd_url": case["jd_url"],
            "jd_text": case["jd_text"],
            "master_resume": case["master_resume"],
            "tailored_resume": case["tailored_resume"],
            "latest_scores": latest_scores,
            "judge_instructions": judge_instructions,
        }
        lines.append(json.dumps(record, ensure_ascii=False))

    return "\n".join(lines)
```

- [ ] **Step 3: Verify imports**

```bash
cd apps/backend
uv run python -c "from app.services.evals.runner import run_step; from app.services.evals.exporter import export_jsonl; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/services/evals/runner.py apps/backend/app/services/evals/exporter.py
git commit -m "feat(evals): add eval runner and JSONL exporter"
```

---

### Task 9: Evals Router + Wire Up

**Files:**
- Create: `apps/backend/app/routers/evals.py`
- Modify: `apps/backend/app/routers/__init__.py`
- Modify: `apps/backend/app/main.py`

- [ ] **Step 1: Create `evals.py` router**

```python
"""Admin-only evals endpoints."""

from __future__ import annotations

from datetime import datetime

from fastapi import Depends, HTTPException, Query
from fastapi.responses import Response
from fastapi.routing import APIRouter

from app.database import db
from app.routers.admin import ALLOWED_ADMIN_EMAILS, _require_admin_user
from app.schemas.evals import (
    CreateEvalCaseRequest,
    EvalCaseListResponse,
    EvalCaseResponse,
    RunEvalStepRequest,
    RunEvalStepResponse,
    EvalRunResponse,
)
from app.security import AuthenticatedUser, require_current_user
from app.services.evals.collector import collect_eval_case
from app.services.evals.exporter import export_jsonl
from app.services.evals.runner import run_step

router = APIRouter(prefix="/admin/evals", tags=["Evals"])


def _enrich_case(case: dict) -> dict:
    """Add latest_runs to a case dict."""
    runs = db.get_latest_eval_runs_for_cases([case["id"]])
    case["latest_runs"] = runs.get(case["id"], {})
    return case


@router.post("/cases", response_model=EvalCaseResponse)
async def create_eval_case(
    body: CreateEvalCaseRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> EvalCaseResponse:
    _require_admin_user(current_user)
    case = collect_eval_case(
        tailored_resume_id=body.tailored_resume_id,
        tags=body.tags,
        notes=body.notes,
    )
    return EvalCaseResponse.model_validate(_enrich_case(case))


@router.get("/cases", response_model=EvalCaseListResponse)
async def list_eval_cases(
    profile: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> EvalCaseListResponse:
    _require_admin_user(current_user)
    cases = db.list_eval_cases(profile=profile, tag=tag)
    case_ids = [c["id"] for c in cases]
    runs_by_case = db.get_latest_eval_runs_for_cases(case_ids)
    items = []
    for case in cases:
        case["latest_runs"] = runs_by_case.get(case["id"], {})
        items.append(EvalCaseResponse.model_validate(case))
    return EvalCaseListResponse(items=items, total=len(items))


@router.delete("/cases/{case_id}", status_code=204)
async def delete_eval_case(
    case_id: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> None:
    _require_admin_user(current_user)
    deleted = db.delete_eval_case(case_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Eval case not found")


@router.post("/runs", response_model=RunEvalStepResponse)
async def run_eval_step(
    body: RunEvalStepRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> RunEvalStepResponse:
    _require_admin_user(current_user)
    results = await run_step(case_ids=body.case_ids, step=body.step)
    return RunEvalStepResponse(
        results=[EvalRunResponse.model_validate(r) for r in results]
    )


@router.get("/export")
async def export_eval_cases(
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> Response:
    _require_admin_user(current_user)
    content = export_jsonl()
    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    filename = f"eval-set-{date_str}.jsonl"
    return Response(
        content=content,
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

- [ ] **Step 2: Wire into `__init__.py`**

Add to `apps/backend/app/routers/__init__.py`:
```python
from app.routers.evals import router as evals_router

__all__ = [
    ...existing...
    "evals_router",
]
```

- [ ] **Step 3: Wire into `main.py`**

In `apps/backend/app/main.py`:
1. Import: `from app.routers import ..., evals_router`
2. Add: `app.include_router(evals_router, prefix="/api/v1")`

- [ ] **Step 4: Start server and verify endpoints appear**

```bash
cd apps/backend
uv run uvicorn app.main:app --reload --port 8000
```

Then open: `http://localhost:8000/docs` — verify you see the `/api/v1/admin/evals/cases` and `/api/v1/admin/evals/runs` endpoints.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/routers/evals.py apps/backend/app/routers/__init__.py apps/backend/app/main.py
git commit -m "feat(evals): add evals router and wire up to main"
```

---

## Chunk 3: Frontend

### Task 10: Frontend API Client

**Files:**
- Create: `apps/frontend/lib/api/evals.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * Evals API client — admin-only endpoints.
 */
import { apiFetch } from '@/lib/api/client';

export interface EvalRunSummary {
  passed: boolean;
  scores: Record<string, unknown>;
  error: string | null;
  created_at: string;
}

export interface EvalCase {
  id: string;
  created_at: string;
  tags: string[];
  notes: string | null;
  prompt_profile_id: string;
  jd_source: string;
  jd_url: string | null;
  jd_text: string;
  source_resume_id: string;
  tailored_resume_id: string;
  tailor_job_id: string;
  latest_runs: Record<string, EvalRunSummary>;
}

export interface EvalCaseListResponse {
  items: EvalCase[];
  total: number;
}

export interface EvalRunResult {
  id: string;
  case_id: string;
  created_at: string;
  step: string;
  passed: boolean;
  scores: Record<string, unknown>;
  error: string | null;
}

export interface RunEvalStepResponse {
  results: EvalRunResult[];
}

export async function fetchEvalCases(params?: {
  profile?: string;
  tag?: string;
}): Promise<EvalCaseListResponse> {
  const qs = new URLSearchParams();
  if (params?.profile) qs.set('profile', params.profile);
  if (params?.tag) qs.set('tag', params.tag);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch(`/api/v1/admin/evals/cases${query}`);
}

export async function createEvalCase(payload: {
  tailored_resume_id: string;
  tags: string[];
  notes: string | null;
}): Promise<EvalCase> {
  return apiFetch('/api/v1/admin/evals/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteEvalCase(caseId: string): Promise<void> {
  await apiFetch(`/api/v1/admin/evals/cases/${caseId}`, { method: 'DELETE' });
}

export async function runEvalStep(payload: {
  case_ids: string[];
  step: 'structural' | 'heuristics' | 'judge';
}): Promise<RunEvalStepResponse> {
  return apiFetch('/api/v1/admin/evals/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function downloadEvalExport(): Promise<void> {
  const res = await apiFetch('/api/v1/admin/evals/export', { raw: true } as never);
  const blob = await (res as unknown as Response).blob();
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eval-set-${date}.jsonl`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Note:** If `apiFetch` doesn't support `raw: true`, implement the export download by constructing a direct `fetch` call using the same auth token helper. Check `apps/frontend/lib/api/client.ts` for the exact pattern.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/lib/api/evals.ts
git commit -m "feat(evals): add frontend API client for evals"
```

---

### Task 11: Eval Dashboard Page

**Files:**
- Create: `apps/frontend/app/(default)/admin/evals/page.tsx`

Follow the same pattern as `apps/frontend/app/(default)/admin/extension-runs/page.tsx`: client component, session check with redirect, admin email guard.

- [ ] **Step 1: Create the page**

```typescript
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Download, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchEvalCases,
  deleteEvalCase,
  runEvalStep,
  downloadEvalExport,
  type EvalCase,
} from '@/lib/api/evals';

const ADMIN_EMAILS = new Set(['kenn.nguyen@aya.yale.edu']);

const PROFILE_LABELS: Record<string, string> = {
  profile1: 'Safe',
  profile2: 'Competitive',
  profile3: 'Lean',
  profile4: 'Direct',
};

function StepBadge({ step, run }: { step: string; run?: { passed: boolean; error: string | null } }) {
  if (!run) return <span className="font-mono text-[10px] text-gray-400">{step} —</span>;
  return (
    <span
      className={`font-mono text-[10px] px-1.5 py-0.5 border ${
        run.error
          ? 'border-red-200 bg-red-50 text-red-600'
          : run.passed
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      {step} {run.error ? '✗ error' : run.passed ? '✓' : '✗'}
    </span>
  );
}

export default function EvalsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [cases, setCases] = useState<EvalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState<'structural' | 'heuristics' | 'judge' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = session?.user?.email && ADMIN_EMAILS.has(session.user.email.toLowerCase());

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [authStatus, isAdmin, router]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEvalCases();
      setCases(res.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadCases();
  }, [isAdmin, loadCases]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRunStep = async (step: 'structural' | 'heuristics' | 'judge') => {
    const ids = selectedIds.size > 0 ? [...selectedIds] : cases.map((c) => c.id);
    if (ids.length === 0) return;
    setRunning(step);
    setError(null);
    try {
      await runEvalStep({ case_ids: ids, step });
      await loadCases();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  };

  const handleDelete = async (caseId: string) => {
    try {
      await deleteEvalCase(caseId);
      setCases((prev) => prev.filter((c) => c.id !== caseId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(caseId);
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadEvalExport();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  if (authStatus === 'loading' || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">Eval Cases</h1>
            <p className="font-mono text-xs text-gray-500 mt-1">
              {cases.length} cases · admin only
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || cases.length === 0}
            className="gap-2"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export JSONL
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Batch actions */}
        <div className="flex gap-2">
          {(['structural', 'heuristics', 'judge'] as const).map((step) => (
            <Button
              key={step}
              size="sm"
              variant="outline"
              onClick={() => handleRunStep(step)}
              disabled={running !== null}
              className="font-mono text-xs"
            >
              {running === step ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : null}
              Run {step} {selectedIds.size > 0 ? `(${selectedIds.size})` : '(all)'}
            </Button>
          ))}
        </div>

        {/* Cases list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white/40 py-16 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 font-mono text-sm text-gray-400">No eval cases yet.</p>
            <p className="font-mono text-xs text-gray-400">
              Open a tailored resume and click &ldquo;Save as eval case&rdquo;.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => {
              const structuralRun = c.latest_runs?.structural as { passed: boolean; error: string | null; scores: Record<string, unknown> } | undefined;
              const heuristicsRun = c.latest_runs?.heuristics as { passed: boolean; error: string | null; scores: Record<string, unknown> } | undefined;
              const judgeRun = c.latest_runs?.judge as { passed: boolean; error: string | null; scores: Record<string, unknown> } | undefined;
              const relDelta = (heuristicsRun?.scores?.relevance_delta as number | undefined);
              const atsDelta = (heuristicsRun?.scores?.ats_keyword_delta as number | undefined);
              const verdict = (judgeRun?.scores?.verdict as string | undefined);
              return (
                <div
                  key={c.id}
                  className={`rounded-2xl border bg-white/60 p-4 transition-colors ${
                    selectedIds.has(c.id) ? 'border-primary/40 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-gray-700">
                            {PROFILE_LABELS[c.prompt_profile_id] ?? c.prompt_profile_id}
                          </span>
                          <span className="font-mono text-[10px] text-gray-400">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                          {c.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-gray-600"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="font-mono text-[10px] text-red-500 hover:text-red-700 border border-red-200 px-2 py-0.5 hover:bg-red-50 transition-colors shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StepBadge step="structural" run={structuralRun} />
                        <StepBadge step="heuristics" run={heuristicsRun} />
                        <StepBadge step="judge" run={judgeRun} />
                        {relDelta !== undefined && (
                          <span className={`font-mono text-[10px] ${relDelta > 0 ? 'text-green-700' : 'text-red-600'}`}>
                            rel {relDelta > 0 ? '+' : ''}{relDelta.toFixed(3)}
                          </span>
                        )}
                        {atsDelta !== undefined && (
                          <span className={`font-mono text-[10px] ${atsDelta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            ats {atsDelta >= 0 ? '+' : ''}{Math.round(atsDelta * 100)}%
                          </span>
                        )}
                        {verdict && (
                          <span className={`font-mono text-[10px] font-bold ${
                            verdict === 'shortlist' ? 'text-green-700' :
                            verdict === 'maybe' ? 'text-amber-700' : 'text-red-600'
                          }`}>
                            {verdict}
                          </span>
                        )}
                      </div>
                      {c.notes && (
                        <p className="font-mono text-[11px] text-gray-500">{c.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
cd apps/frontend
npm run lint
```
Expected: no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/app/\(default\)/admin/evals/page.tsx
git commit -m "feat(evals): add admin evals dashboard page"
```

---

### Task 12: Save as Eval Case — Modal + Button

**Files:**
- Create: `apps/frontend/components/evals/SaveEvalCaseModal.tsx`
- Modify: resume detail page (find it: `apps/frontend/app/(default)/resumes/[id]/page.tsx` or similar)

- [ ] **Step 1: Find the resume detail page**

```bash
find apps/frontend/app -name "page.tsx" | xargs grep -l "linked_master_resume_id\|tailored\|ResumePage" 2>/dev/null
```

Note the file path — it's where the "Save as eval case" button will be added.

- [ ] **Step 2: Create `SaveEvalCaseModal.tsx`**

```typescript
'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { createEvalCase } from '@/lib/api/evals';

const TAG_OPTIONS = ['good', 'bad', 'edge-case', 'swe', 'pm', 'design', 'senior', 'junior'];

interface SaveEvalCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  tailoredResumeId: string;
}

export function SaveEvalCaseModal({
  isOpen,
  onClose,
  tailoredResumeId,
}: SaveEvalCaseModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await createEvalCase({
        tailored_resume_id: tailoredResumeId,
        tags: selectedTags,
        notes: notes.trim() || null,
      });
      setSaved(true);
      setTimeout(() => {
        onClose();
        setSaved(false);
        setSelectedTags([]);
        setNotes('');
      }, 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Save as Eval Case</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-2">
          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-gray-600">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                    selectedTags.includes(tag)
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-white text-gray-600 hover:bg-secondary'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-gray-600">
              Notes (optional)
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
              rows={3}
              placeholder="What makes this case interesting?"
              className="w-full resize-none rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>
          {error && (
            <p className="font-mono text-xs text-red-600">{error}</p>
          )}
        </div>
        <DialogFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || saved}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : null}
            {saved ? 'Saved!' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add the "Save as eval case" button to the resume detail page**

In the resume detail page:
1. Import `SaveEvalCaseModal` and `useSession`
2. Add state: `const [showEvalModal, setShowEvalModal] = useState(false)`
3. Check admin: `const isAdmin = ADMIN_EMAILS.has(session?.user?.email?.toLowerCase() ?? '')`
4. Render the button only when `isAdmin && resume.linked_master_resume_id`:

```tsx
{isAdmin && resume?.linked_master_resume_id && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowEvalModal(true)}
    className="font-mono text-xs"
  >
    Save as eval case
  </Button>
)}

<SaveEvalCaseModal
  isOpen={showEvalModal}
  onClose={() => setShowEvalModal(false)}
  tailoredResumeId={resume.resume_id}
/>
```

Define `ADMIN_EMAILS` at the top of the file:
```typescript
const ADMIN_EMAILS = new Set(['kenn.nguyen@aya.yale.edu']);
```

- [ ] **Step 4: Run lint**

```bash
cd apps/frontend
npm run lint
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/evals/ apps/frontend/app/
git commit -m "feat(evals): add SaveEvalCaseModal and button on resume detail page"
```

---

## Final Verification

- [ ] **Start backend and frontend**

```bash
# Terminal 1
cd apps/backend && uv run uvicorn app.main:app --reload --port 8000

# Terminal 2
cd apps/frontend && npm run dev
```

- [ ] **Manual smoke test**
  1. Log in as admin (`kenn.nguyen@aya.yale.edu`)
  2. Find a resume produced by the tailor pipeline
  3. Click "Save as eval case" → add tags → Save — confirm no error
  4. Navigate to `/admin/evals` — confirm the case appears
  5. Click "Run structural (all)" — confirm green badge appears
  6. Click "Run heuristics (all)" — confirm scores appear
  7. Click "Export JSONL" — confirm file downloads with judge_instructions field

- [ ] **Final lint check**

```bash
cd apps/frontend && npm run lint && npm run format
```
