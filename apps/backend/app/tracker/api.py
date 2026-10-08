"""Tracker API.

Mirrors what the sheet's menu could do, minus the actions that only made sense in a
spreadsheet. Routes are deliberately thin: the rules live in ``app.tracker`` so they
can be tested without HTTP.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.tracker import repo
from app.tracker.auth import TrackerUser, current_tracker_user, require_owner
from app.tracker.enums import (
    ACTION_OPTIONS,
    OWNER_OPTIONS,
    PRIORITY_OPTIONS,
    STATUS_OPTIONS,
    VISA_OPTIONS,
)
from app.tracker.models import init_tracker_schema
from app.tracker.prune import DEFAULT_PRUNE_DAYS, PruneDates
from app.tracker.routing import RoutingRules, route_jobs

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tracker", tags=["tracker"])

_engine = None
_Session: sessionmaker | None = None


def _database_url() -> str:
    return (
        os.environ.get("TRACKER_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql+psycopg://postgres:postgres@localhost:5432/som_career_coach"
    )


def get_session() -> Session:
    """One engine per process, created on first use so imports stay cheap."""
    global _engine, _Session
    if _Session is None:
        _engine = create_engine(_database_url(), future=True, pool_pre_ping=True)
        init_tracker_schema(_engine)
        _Session = sessionmaker(bind=_engine, expire_on_commit=False, future=True)
    with _Session() as session:
        yield session


# --- shapes -------------------------------------------------------------------

class JobPatch(BaseModel):
    status: str | None = None
    owner: str | None = None
    action: str | None = None
    notes: str | None = None
    referral_contact: str | None = None
    resume_file: str | None = None


class BulkRequest(BaseModel):
    job_ids: list[str] = Field(min_length=1, max_length=500)
    op: Literal["assign", "assign_prep", "take_back", "skip", "rescore", "unskip"]


class SettingsPut(BaseModel):
    values: dict[str, str]


class PrunePayload(BaseModel):
    days: int = Field(default=DEFAULT_PRUNE_DAYS, ge=1, le=3650)
    posted_at: bool = False
    listed_at: bool = True
    imported_at: bool = True


class RunRequest(BaseModel):
    mode: Literal["import", "detail", "reevaluate"] = "import"
    job_urls: list[str] = Field(default_factory=list)


def _serialise(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _row(data: dict[str, Any]) -> dict[str, Any]:
    return {k: _serialise(v) for k, v in data.items()}


# --- reference ----------------------------------------------------------------

@router.get("/meta")
def meta(user: TrackerUser = Depends(current_tracker_user)) -> dict[str, Any]:
    """Everything the UI needs to render its controls, so nothing is hardcoded twice."""
    return {
        "role": user.role,
        "email": user.email,
        "statuses": list(STATUS_OPTIONS),
        "owners": list(OWNER_OPTIONS),
        "actions": list(ACTION_OPTIONS),
        "priorities": list(PRIORITY_OPTIONS),
        "visas": list(VISA_OPTIONS),
    }


# --- jobs ---------------------------------------------------------------------

@router.get("/jobs")
def list_jobs(
    view: Literal["assigned", "all"] = "assigned",
    q: str | None = None,
    job_status: str | None = Query(default=None, alias="status"),
    priority: str | None = None,
    us_visa: str | None = None,
    owner: str | None = None,
    sort: str | None = None,
    direction: str = "asc",
    offset: int = 0,
    limit: int = repo.PAGE_SIZE,
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(current_tracker_user),
) -> dict[str, Any]:
    filters = repo.JobFilters(view=view, q=q, status=job_status, priority=priority,
                              us_visa=us_visa, owner=owner, sort=sort, direction=direction)
    rows, total = repo.list_jobs(session, user_id=user.user_id, filters=filters,
                                 offset=offset, limit=limit)
    return {
        "jobs": [_row(r) for r in rows],
        "total": total,
        "offset": offset,
        "limit": limit,
        "counts": repo.queue_counts(session, user_id=user.user_id),
    }


@router.get("/jobs/{job_id}")
def get_job(
    job_id: str,
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(current_tracker_user),
) -> dict[str, Any]:
    job = repo.get_job(session, user_id=user.user_id, job_id=job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such job")
    return _row(job)


@router.patch("/jobs/{job_id}")
def patch_job(
    job_id: str,
    patch: JobPatch,
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(current_tracker_user),
) -> dict[str, Any]:
    changes = patch.model_dump(exclude_none=True)
    if changes.get("status") and changes["status"] not in STATUS_OPTIONS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown status")
    if changes.get("owner") is not None and changes["owner"] not in ("",) + tuple(OWNER_OPTIONS):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown owner")

    # Flagging hands a job back to the owner, and a flag with no reason gives them
    # nothing to act on. Enforced here as well as in the page, because the rule
    # belongs to the data rather than to one client.
    if changes.get("status") == "Flagged":
        current = repo.get_job(session, user_id=user.user_id, job_id=job_id) or {}
        note = changes.get("notes") if changes.get("notes") is not None else current.get("notes")
        if not (note or "").strip():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                "A flagged job needs a note explaining why")

    # The assignee works the same rows but must not be able to re-assign them away
    # from themselves or edit the owner's own fields.
    if not user.is_owner:
        allowed = {"status", "notes", "resume_file"}
        if set(changes) - allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                "The assignee can only change status, notes and the resume")

    updated = repo.update_job(session, user_id=user.user_id, job_id=job_id, changes=changes)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such job")
    return _row(updated)


@router.post("/jobs/{job_id}/dead-link")
def dead_link(
    job_id: str,
    link_id: str = Body(..., embed=True),
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(current_tracker_user),
) -> dict[str, Any]:
    updated = repo.mark_link_dead(session, user_id=user.user_id, job_id=job_id, link_id=link_id)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such job")
    return _row(updated)


BULK_CHANGES: dict[str, dict[str, Any]] = {
    "assign": {"owner": "Assignee", "action": "Fill & Submit"},
    "assign_prep": {"owner": "Assignee", "action": "Fill Only"},
    "take_back": {"owner": "Me", "action": ""},
    "skip": {"status": "Skip"},
    "unskip": {"status": "New"},
}


@router.post("/jobs/bulk")
def bulk(
    request: BulkRequest,
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(require_owner),
) -> dict[str, Any]:
    if request.op == "rescore":
        # Clearing the fingerprint is what makes the next run re-score it; the score
        # itself stays visible until a new one replaces it.
        changed = repo.bulk_update(session, user_id=user.user_id,
                                   job_ids=request.job_ids, changes={})
        session.execute(
            __import__("sqlalchemy").update(repo.TrackerJob)
            .where(repo.TrackerJob.job_id.in_(request.job_ids))
            .values(scoring_fingerprint=None)
        )
        session.commit()
        return {"updated": changed, "op": request.op}

    changed = repo.bulk_update(session, user_id=user.user_id, job_ids=request.job_ids,
                               changes=BULK_CHANGES[request.op])
    return {"updated": changed, "op": request.op}


# --- settings -----------------------------------------------------------------

@router.get("/settings")
def get_settings(
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(require_owner),
) -> dict[str, Any]:
    return {"settings": repo.get_settings(session, user_id=user.user_id),
            "apify_accounts": repo.list_apify_accounts(session, user_id=user.user_id)}


@router.put("/settings")
def put_settings(
    payload: SettingsPut,
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(require_owner),
) -> dict[str, Any]:
    written = repo.put_settings(session, user_id=user.user_id, values=payload.values)
    return {"written": written}


# --- runs ---------------------------------------------------------------------

@router.get("/runs")
def list_runs(
    limit: int = 20,
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(current_tracker_user),
) -> dict[str, Any]:
    runs = repo.list_runs(session, user_id=user.user_id, limit=limit)
    return {"runs": [{
        "run_id": r.run_id, "mode": r.mode, "status": r.status, "phase": r.phase,
        "counters": r.counters, "errors": r.errors[:5],
        "started_at": _serialise(r.started_at), "finished_at": _serialise(r.finished_at),
        "cancel_requested": r.cancel_requested,
    } for r in runs]}


def _execute_run(run_id: str, user_id: str) -> None:
    """Run the pipeline outside the request, so the button returns immediately.

    A background task dies with the process, which is why the run records its
    progress as it goes: an interrupted run is re-runnable without re-scraping or
    re-paying for what it already did.
    """
    from pathlib import Path

    from app.tracker.pipeline import run_pipeline
    from app.tracker.scorer import build_scorer

    rubric_path = Path(__file__).resolve().parent / "default_rubric.txt"
    session_factory = _Session
    if session_factory is None:
        return

    with session_factory() as session:
        run = session.get(repo.TrackerRun, run_id)
        if run is None:
            return
        try:
            settings = repo.get_settings(session, user_id=user_id, redact=False)
            run_pipeline(
                session, user_id=user_id, run=run,
                score_job=build_scorer(settings),
                rubric=rubric_path.read_text() if rubric_path.exists() else "",
            )
            repo.finish_run(session, run=run, status="Completed")
        except Exception as error:  # the run record is how the owner learns what broke
            logger.exception("Tracker run %s failed", run_id)
            run.errors = [str(error)][:50]
            repo.finish_run(session, run=run, status="Failed")


@router.post("/runs")
def start_run(
    request: RunRequest,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(require_owner),
) -> dict[str, Any]:
    existing = repo.active_run(session, user_id=user.user_id)
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A run is already in progress")
    run = repo.create_run(session, user_id=user.user_id, mode=request.mode)
    if request.job_urls:
        run.cursor = {"job_urls": request.job_urls[:50]}
        session.commit()
    background.add_task(_execute_run, run.run_id, user.user_id)
    return {"run_id": run.run_id, "status": run.status}


@router.post("/runs/{run_id}/cancel")
def cancel_run(
    run_id: str,
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(require_owner),
) -> dict[str, Any]:
    run = session.get(repo.TrackerRun, run_id)
    if run is None or run.user_id != user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such run")
    run.cancel_requested = True
    repo.finish_run(session, run=run, status="Cancelled")
    return {"run_id": run_id, "status": "Cancelled"}


# --- maintenance --------------------------------------------------------------

@router.post("/maintenance/reassign")
def reassign(
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(require_owner),
) -> dict[str, Any]:
    """Re-apply the routing rules to every row they are allowed to touch."""
    settings = repo.get_settings(session, user_id=user.user_id, redact=False)
    rules = RoutingRules.from_settings(settings)
    filters = repo.JobFilters(view="all")
    rows, _ = repo.list_jobs(session, user_id=user.user_id, filters=filters, limit=repo.MAX_PAGE_SIZE)

    offset, counts = 0, {"assigned": 0, "reserved": 0, "skipped": 0}
    while rows:
        decisions = route_jobs(rows, rules)
        for job_id, decision in decisions.decisions.items():
            changes = {"owner": decision.owner, "status": decision.status}
            if decision.action is not None:
                changes["action"] = decision.action
            repo.update_job(session, user_id=user.user_id, job_id=job_id, changes=changes)
        counts["assigned"] += decisions.assigned
        counts["reserved"] += decisions.reserved
        counts["skipped"] += decisions.skipped
        offset += repo.MAX_PAGE_SIZE
        rows, _ = repo.list_jobs(session, user_id=user.user_id, filters=filters,
                                 offset=offset, limit=repo.MAX_PAGE_SIZE)
    return counts


@router.post("/maintenance/skip-no-visa")
def skip_no_visa(
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(require_owner),
) -> dict[str, Any]:
    """Sweep every row scored 'No (0%)' into Skip (auto), owned or not."""
    import sqlalchemy as sa
    result = session.execute(
        sa.update(repo.TrackerJob)
        .where(repo.TrackerJob.user_id == user.user_id,
               repo.TrackerJob.us_visa == "No (0%)",
               repo.TrackerJob.status.notin_(["Skip", "Skip (auto)", "Closed", "Submitted"]))
        .values(status="Skip (auto)")
    )
    session.commit()
    return {"updated": result.rowcount or 0}


@router.post("/maintenance/prune")
def prune(
    payload: PrunePayload,
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(require_owner),
) -> dict[str, Any]:
    """Age out old rows and drop descriptions nothing will read again."""
    import sqlalchemy as sa

    from app.tracker.prune import PAYLOAD_EXPENDABLE, cutoff_for

    dates = PruneDates(payload.posted_at, payload.listed_at, payload.imported_at)
    cutoff = cutoff_for(datetime.now(tz=__import__("datetime").timezone.utc), payload.days)

    # Descriptions first: they are the bulk of the storage and the rule is simple.
    dropped = session.execute(
        sa.update(repo.TrackerJobDoc)
        .where(repo.TrackerJobDoc.job_id.in_(
            sa.select(repo.TrackerJob.job_id).where(
                repo.TrackerJob.user_id == user.user_id,
                repo.TrackerJob.status.in_(list(PAYLOAD_EXPENDABLE)))))
        .values(raw_ref=None, jd_text=None)
    ).rowcount or 0

    conditions = []
    if dates.posted_at:
        conditions.append(repo.TrackerJob.posted < cutoff)
    if dates.imported_at:
        conditions.append(repo.TrackerJob.imported_at < cutoff)
    pruned = 0
    if conditions:
        import sqlalchemy as sa2
        result = session.execute(
            sa.delete(repo.TrackerJob).where(
                repo.TrackerJob.user_id == user.user_id,
                repo.TrackerJob.status.notin_(["Submitted", "Networking"]),
                sa2.or_(*conditions))
        )
        pruned = result.rowcount or 0
    session.commit()
    return {"pruned_jobs": pruned, "dropped_descriptions": dropped, "days": payload.days}


@router.post("/maintenance/validate")
def validate(
    session: Session = Depends(get_session),
    user: TrackerUser = Depends(require_owner),
) -> dict[str, Any]:
    """Check the setup can actually run, and say plainly what is missing."""
    settings = repo.get_settings(session, user_id=user.user_id, redact=False)
    accounts = repo.list_apify_accounts(session, user_id=user.user_id)
    problems: list[str] = []

    route = (settings.get("GEMINI_API_ROUTE") or "").strip().lower()
    if route not in ("vertex", "developer"):
        problems.append("GEMINI_API_ROUTE must be 'vertex' or 'developer'")
    if route == "vertex" and not (settings.get("VERTEX_PROJECT_ID") or "").strip():
        problems.append("Vertex route needs VERTEX_PROJECT_ID")
    if route == "developer" and not (settings.get("GEMINI_API_KEY") or "").strip():
        problems.append("Gemini route needs an API key")
    if not any(a["active"] and a["batch_key_set"] for a in accounts):
        problems.append("No active Apify account with a search key")
    if not (settings.get("TARGET_PROFILE") or "").strip():
        problems.append("No profile to score against")

    return {
        "ok": not problems,
        "problems": problems,
        "route": route,
        "model": settings.get("SCORING_MODEL"),
        "apify_accounts": len([a for a in accounts if a["active"]]),
        "jobs": repo.queue_counts(session, user_id=user.user_id),
    }
