"""Database access for the tracker.

Two rules hold everywhere in this file, because the queue is ~9,000 rows and the
list view is the most-used screen in the product:

1. **Filter, count and paginate in SQL**, never in Python. The sheet's own code
   scanned rows and filtered in memory, which is what made it slow at this size.
2. **Never load a job description in a list query.** They live in
   ``tracker_job_docs`` and are fetched only for a single job or for scoring.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Sequence

from sqlalchemy import Select, and_, delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, load_only

from .enums import is_assignee, is_dead_status
from .models import (
    TrackerApifyAccount,
    TrackerJob,
    TrackerJobDoc,
    TrackerRun,
    TrackerRunHandled,
    TrackerSetting,
)
from .ranking import build_sort_key

#: Columns the list view renders. Anything not here is a wasted byte per row.
LIST_COLUMNS = (
    TrackerJob.job_id, TrackerJob.priority, TrackerJob.score, TrackerJob.us_visa,
    TrackerJob.company, TrackerJob.title, TrackerJob.title_level, TrackerJob.jd_implied_level,
    TrackerJob.status, TrackerJob.owner, TrackerJob.action, TrackerJob.location,
    TrackerJob.posted, TrackerJob.applicants, TrackerJob.notes, TrackerJob.applied_at,
    TrackerJob.merged_job_ids, TrackerJob.dead_links, TrackerJob.resume_file,
    TrackerJob.sort_key, TrackerJob.in_assigned_queue, TrackerJob.referral_contact,
)

PAGE_SIZE = 25
MAX_PAGE_SIZE = 200


@dataclass
class JobFilters:
    view: str = "assigned"          # "assigned" | "all"
    q: str | None = None
    status: str | None = None
    priority: str | None = None
    us_visa: str | None = None
    owner: str | None = None        # "__none" means unowned
    #: Narrow to the jobs one run produced. This is how "show me what just arrived"
    #: works, since a new job is usually low-ranked and invisible near the top.
    from_run: str | None = None
    sort: str | None = None         # "fit" | "posted"
    direction: str = "asc"


def _apply_filters(stmt: Select, f: JobFilters, user_id: str) -> Select:
    stmt = stmt.where(TrackerJob.user_id == user_id)
    if f.view == "assigned":
        stmt = stmt.where(TrackerJob.in_assigned_queue.is_(True))
    if f.q:
        like = f"%{f.q.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(TrackerJob.company).like(like),
                              func.lower(TrackerJob.title).like(like)))
    if f.status:
        stmt = stmt.where(TrackerJob.status == f.status)
    if f.priority:
        stmt = stmt.where(TrackerJob.priority == f.priority)
    if f.us_visa:
        stmt = stmt.where(TrackerJob.us_visa == f.us_visa)
    if f.from_run:
        stmt = stmt.where(TrackerJob.job_id.in_(
            select(TrackerRunHandled.job_id).where(TrackerRunHandled.run_id == f.from_run)))
    if f.owner == "__none":
        stmt = stmt.where(or_(TrackerJob.owner == "", TrackerJob.owner.is_(None)))
    elif f.owner:
        stmt = stmt.where(TrackerJob.owner == f.owner)
    return stmt


def _ordering(f: JobFilters):
    descending = f.direction == "desc"
    if f.sort == "fit":
        col = TrackerJob.score
        return (col.asc() if descending else col.desc()).nullslast()
    if f.sort == "posted":
        col = TrackerJob.posted
        return (col.asc() if descending else col.desc()).nullslast()
    # Default: the sheet's own ranking, which is what sort_key encodes.
    return TrackerJob.sort_key.asc()


def list_jobs(
    session: Session, *, user_id: str, filters: JobFilters, offset: int = 0, limit: int = PAGE_SIZE
) -> tuple[list[dict[str, Any]], int]:
    """One page of the queue plus the total, both computed by the database."""
    limit = max(1, min(limit, MAX_PAGE_SIZE))

    total = session.scalar(
        _apply_filters(select(func.count()).select_from(TrackerJob), filters, user_id)
    ) or 0

    rows = session.execute(
        _apply_filters(select(*LIST_COLUMNS), filters, user_id)
        .order_by(_ordering(filters))
        .offset(max(0, offset))
        .limit(limit)
    ).all()

    return [dict(r._mapping) for r in rows], total


def get_job(session: Session, *, user_id: str, job_id: str) -> dict[str, Any] | None:
    """One job with its description — the only place the payload is read for display."""
    job = session.get(TrackerJob, job_id)
    if job is None or job.user_id != user_id:
        return None
    doc = session.get(TrackerJobDoc, job_id)
    data = {c.name: getattr(job, c.name) for c in TrackerJob.__table__.columns}
    data["jd_text"] = doc.jd_text if doc else None
    data["listed_at"] = doc.listed_at if doc else None
    return data


def _recompute_derived(job: TrackerJob) -> None:
    """Keep the ordering and the assigned flag true to the row after any edit."""
    job.sort_key = build_sort_key(job.status, job.priority, job.posted, job.imported_at, job.score)
    job.assigned_sort_key = job.sort_key
    job.in_assigned_queue = is_assignee(job.owner) and not is_dead_status(job.status)


#: Fields a user may change directly. Anything derived is recomputed, never set.
EDITABLE = {"status", "owner", "action", "notes", "referral_contact", "resume_file"}


def update_job(
    session: Session, *, user_id: str, job_id: str, changes: dict[str, Any]
) -> dict[str, Any] | None:
    """Apply an edit and the rules that follow from it.

    The sheet's edit handler encoded two behaviours worth keeping: submitting stamps
    the application date, and delegating a job that has no action yet gives it one,
    because the assignee needs to know what to do with it.
    """
    job = session.get(TrackerJob, job_id)
    if job is None or job.user_id != user_id:
        return None

    for field, value in changes.items():
        if field in EDITABLE and value is not None:
            setattr(job, field, value)

    if changes.get("status") == "Submitted" and job.applied_at is None:
        job.applied_at = datetime.now(timezone.utc)
    if is_assignee(job.owner) and not (job.action or "").strip():
        job.action = "Fill & Submit"
    if "notes" in changes or "status" in changes:
        job.assigned_updated_at = datetime.now(timezone.utc)

    _recompute_derived(job)
    session.commit()
    return get_job(session, user_id=user_id, job_id=job_id)


def bulk_update(
    session: Session, *, user_id: str, job_ids: Sequence[str], changes: dict[str, Any]
) -> int:
    """Apply the same change to many rows, recomputing each row's derived fields.

    Done row by row on purpose: a bulk SQL UPDATE cannot recompute a sort key, and a
    queue sorted by a stale key is worse than a slightly slower edit.
    """
    if not job_ids:
        return 0
    jobs = session.scalars(
        select(TrackerJob).where(
            and_(TrackerJob.user_id == user_id, TrackerJob.job_id.in_(list(job_ids))))
    ).all()
    for job in jobs:
        for field, value in changes.items():
            if field in EDITABLE and value is not None:
                setattr(job, field, value)
        if is_assignee(job.owner) and not (job.action or "").strip():
            job.action = "Fill & Submit"
        if changes.get("status") == "Submitted" and job.applied_at is None:
            job.applied_at = datetime.now(timezone.utc)
        _recompute_derived(job)
    session.commit()
    return len(jobs)


def set_link_state(
    session: Session, *, user_id: str, job_id: str, link_id: str, dead: bool
) -> dict | None:
    """Mark a posting as expired, or take that mark back.

    Reversible on purpose: a link can fail for a minute and work later, and a
    posting wrongly written off is one nobody will try again.
    """
    job = session.get(TrackerJob, job_id)
    if job is None or job.user_id != user_id:
        return None
    marks = dict(job.dead_links or {})
    if dead:
        marks[link_id] = True
    else:
        marks.pop(link_id, None)
    job.dead_links = marks
    session.commit()
    return get_job(session, user_id=user_id, job_id=job_id)


def queue_counts(session: Session, *, user_id: str) -> dict[str, int]:
    """The figures above the list, in one query.

    These are recomputed on every list request — including after each edit — so the
    cost is paid constantly. Five separate COUNTs meant five round trips to the
    database for numbers that come from a single scan of the same rows.
    """
    row = session.execute(
        select(
            func.count().filter(TrackerJob.status == "Flagged").label("flagged"),
            func.count().filter(
                TrackerJob.in_assigned_queue.is_(True),
                TrackerJob.status != "Submitted").label("assigned"),
            func.count().filter(TrackerJob.status == "Submitted").label("submitted"),
            func.count().filter(
                or_(TrackerJob.owner == "", TrackerJob.owner.is_(None)),
                TrackerJob.priority.in_(["P01", "P02"]),
                TrackerJob.status.notin_(["Skip", "Skip (auto)", "Closed"])).label("unowned_top"),
            func.count().label("total"),
        ).select_from(TrackerJob).where(TrackerJob.user_id == user_id)
    ).one()
    return {
        "flagged": row.flagged or 0,
        "assigned": row.assigned or 0,
        "submitted": row.submitted or 0,
        "unowned_top": row.unowned_top or 0,
        "total": row.total or 0,
    }


# --- settings -----------------------------------------------------------------

#: Never leaves the server. The UI shows whether a value exists, not the value.
SECRET_SETTINGS = {"GEMINI_API_KEY", "OPENAI_API_KEY"}


def get_settings(session: Session, *, user_id: str, redact: bool = True) -> dict[str, str]:
    rows = session.scalars(select(TrackerSetting).where(TrackerSetting.user_id == user_id)).all()
    out: dict[str, str] = {}
    for row in rows:
        if redact and row.key in SECRET_SETTINGS:
            out[row.key] = "__set__" if row.value else ""
        else:
            out[row.key] = row.value
    return out


def put_settings(session: Session, *, user_id: str, values: dict[str, str]) -> int:
    """Upsert settings, ignoring the placeholder the UI sends back for secrets."""
    written = 0
    for key, value in values.items():
        if key in SECRET_SETTINGS and value == "__set__":
            continue  # unchanged secret echoed back by the form
        session.execute(
            insert(TrackerSetting)
            .values(key=key, user_id=user_id, value="" if value is None else str(value))
            .on_conflict_do_update(index_elements=["key"],
                                   set_={"value": "" if value is None else str(value)})
        )
        written += 1
    session.commit()
    return written


def list_apify_accounts(session: Session, *, user_id: str) -> list[dict[str, Any]]:
    """Labels and whether a key is present — never the keys themselves."""
    rows = session.scalars(
        select(TrackerApifyAccount)
        .where(TrackerApifyAccount.user_id == user_id)
        .order_by(TrackerApifyAccount.position)
    ).all()
    return [{"label": r.label, "active": r.active,
             "batch_key_set": bool(r.batch_key), "detail_key_set": bool(r.detail_key)}
            for r in rows]


def active_apify_tokens(session: Session, *, user_id: str) -> list[tuple[str, str, str]]:
    """(label, batch_key, detail_key) for rotation. Server-side use only."""
    rows = session.scalars(
        select(TrackerApifyAccount)
        .where(TrackerApifyAccount.user_id == user_id, TrackerApifyAccount.active.is_(True))
        .order_by(TrackerApifyAccount.position)
    ).all()
    return [(r.label, r.batch_key, r.detail_key) for r in rows]


# --- runs ---------------------------------------------------------------------

def create_run(session: Session, *, user_id: str, mode: str) -> TrackerRun:
    run = TrackerRun(run_id=str(uuid.uuid4()), user_id=user_id, mode=mode,
                     status="Starting", phase="search", cursor={}, counters={}, errors=[])
    session.add(run)
    session.commit()
    return run


def active_run(session: Session, *, user_id: str) -> TrackerRun | None:
    return session.scalars(
        select(TrackerRun)
        .where(TrackerRun.user_id == user_id, TrackerRun.finished_at.is_(None))
        .order_by(TrackerRun.started_at.desc())
    ).first()


def list_runs(session: Session, *, user_id: str, limit: int = 20) -> list[TrackerRun]:
    return list(session.scalars(
        select(TrackerRun).where(TrackerRun.user_id == user_id)
        .order_by(TrackerRun.started_at.desc()).limit(limit)
    ).all())


def finish_run(session: Session, *, run: TrackerRun, status: str) -> None:
    run.status = status
    run.finished_at = datetime.now(timezone.utc)
    session.commit()


def mark_handled(session: Session, *, run_id: str, job_ids: Iterable[str]) -> None:
    """Record progress so a resumed run never scores the same job twice."""
    rows = [{"run_id": run_id, "job_id": j} for j in job_ids]
    if not rows:
        return
    session.execute(insert(TrackerRunHandled).values(rows).on_conflict_do_nothing())
    session.commit()


def handled_ids(session: Session, *, run_id: str) -> set[str]:
    return set(session.scalars(
        select(TrackerRunHandled.job_id).where(TrackerRunHandled.run_id == run_id)).all())
