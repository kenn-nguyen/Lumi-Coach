"""The run: scrape, score, route, write.

Replaces the Apps Script orchestration, minus the save-and-resume machinery that
existed only to survive a 6-minute execution limit. A run here is one pass that
records its progress as it goes, so a crashed run can be re-run without
re-scraping or re-paying for anything it already handled.

Order matters, and each step exists to avoid paying for the next one:

    search → normalise → skip what we already know → score only the remainder
           → write → route

The expensive step is scoring, so everything before it is about sending the model
as few jobs as possible.
"""

from __future__ import annotations

import concurrent.futures
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from . import apify, repo
from .enums import is_assignee, is_dead_status
from .fingerprint import extract_jd_from_raw_ref, jd_content_hash
from .models import TrackerJob, TrackerJobDoc, TrackerRun
from .normalize import dedupe_by_job_id, normalize_job
from .ranking import build_sort_key
from .routing import RoutingRules, route_jobs
from .scoring import build_scoring_fingerprint, needs_scoring, normalize_payload

logger = logging.getLogger(__name__)

#: Hard ceilings. Settings can lower these; nothing can raise them.
ABSOLUTE_MAX_ITEMS = 1000
ABSOLUTE_MAX_SCORED = 500


@dataclass
class RunCounters:
    scraped: int = 0
    unique: int = 0
    already_known: int = 0
    to_score: int = 0
    scored: int = 0
    failed: int = 0
    new_jobs: int = 0
    reopened: int = 0
    assigned: int = 0
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if k != "errors"}


def _int_setting(settings: dict[str, str], key: str, default: int) -> int:
    try:
        return int(float(settings.get(key) or default))
    except (TypeError, ValueError):
        return default


def _static_prompt(settings: dict[str, str], rubric: str) -> str:
    return "\n".join([
        "You score product management jobs for a single power user. Return strict JSON only.",
        "", "Target profile:", settings.get("TARGET_PROFILE", ""),
        "", "Scoring instructions:", settings.get("SCORING_INSTRUCTIONS") or rubric,
    ])


def _job_content(job: dict[str, Any]) -> str:
    return "\n".join([
        "Job:",
        f"Company: {job.get('company', '')}",
        f"Title: {job.get('title', '')}",
        f"Location: {job.get('location', '')}",
        f"Posted: {job.get('posted', '')}",
        "Description:", job.get("jd_text") or "",
    ])


def run_pipeline(
    session: Session,
    *,
    user_id: str,
    run: TrackerRun,
    score_job: Callable[[str], dict[str, Any] | None],
    rubric: str,
    max_items: int | None = None,
    max_scored: int | None = None,
    lookback_override: int | None = None,
    progress: Callable[[str, RunCounters], None] | None = None,
) -> RunCounters:
    """Execute one run. ``score_job`` takes a prompt and returns the parsed answer.

    Injecting the scorer keeps this function testable without a model and without
    spending anything.
    """
    counters = RunCounters()
    settings = repo.get_settings(session, user_id=user_id, redact=False)
    started = run.started_at or datetime.now(timezone.utc)

    def step(phase: str) -> None:
        run.phase = phase
        run.counters = counters.as_dict()
        run.errors = counters.errors[:50]
        session.commit()
        if progress:
            progress(phase, counters)

    cap_items = min(max_items or _int_setting(settings, "TRACKER_MAX_ITEMS_PER_RUN", 200),
                    ABSOLUTE_MAX_ITEMS)
    cap_scored = min(max_scored or _int_setting(settings, "SCORING_MAX_JOBS_PER_EXECUTION", 50)
                     or ABSOLUTE_MAX_SCORED, ABSOLUTE_MAX_SCORED)

    # --- scrape ---------------------------------------------------------------
    step("search")
    accounts = [apify.ApifyAccount(label, batch, detail)
                for label, batch, detail in repo.active_apify_tokens(session, user_id=user_id)]

    import json as _json
    try:
        template = _json.loads(settings.get("APIFY_RUN_INPUT") or "{}")
    except ValueError:
        template = {}

    hours = lookback_override or apify.lookback_hours(
        _last_success(session, user_id=user_id),
        configured=_int_setting(settings, "APIFY_LOOKBACK_HOURS", 0),
        maximum=_int_setting(settings, "APIFY_MAX_LOOKBACK_HOURS", 168),
    )
    run_input = apify.build_search_input(template, hours=hours, max_items=cap_items)

    items, account_label = apify.run_with_rotation(
        accounts, actor=apify.SEARCH_ACTOR, run_input=run_input, max_items=cap_items,
        on_attempt=lambda label: logger.info("Trying Apify account %s", label),
    )
    run.cursor = {**(run.cursor or {}), "apify_account": account_label, "lookback_hours": hours}
    counters.scraped = len(items)
    step("normalise")

    # --- normalise and de-duplicate ------------------------------------------
    normalized = dedupe_by_job_id([normalize_job(item, started) for item in items])
    counters.unique = len(normalized)
    step("compare")

    # --- skip what we already know -------------------------------------------
    existing = _existing_by_id(session, user_id=user_id,
                               job_ids=[j["job_id"] for j in normalized])
    by_fingerprint = _existing_by_fingerprint(
        session, user_id=user_id,
        fingerprints=[jd_content_hash(j["jd_text"]) for j in normalized if j.get("jd_text")])

    static_prompt = _static_prompt(settings, rubric)
    model = settings.get("SCORING_MODEL", "")
    route = settings.get("GEMINI_API_ROUTE", "")

    to_score: list[dict[str, Any]] = []
    for job in normalized:
        job["jd_fingerprint"] = jd_content_hash(job["jd_text"]) if job.get("jd_text") else None
        prior = existing.get(job["job_id"])

        # The same role re-posted under a new id: it has been scored already, so
        # carry the score across instead of paying for it twice.
        if prior is None and job["jd_fingerprint"]:
            twin = by_fingerprint.get(job["jd_fingerprint"])
            if twin is not None:
                job["_merge_into"] = twin.job_id
                counters.already_known += 1
                continue

        job["_scoring_fingerprint"] = build_scoring_fingerprint(
            provider="gemini", route=route, model=model, prompt_version="v13",
            static_content=static_prompt, job_content=_job_content(job))

        if prior is not None and not needs_scoring(
            stored_fingerprint=prior.scoring_fingerprint,
            current_fingerprint=job["_scoring_fingerprint"],
            has_score=prior.score is not None,
        ):
            counters.already_known += 1
            continue
        to_score.append(job)

    counters.to_score = len(to_score)
    to_score = to_score[:cap_scored]
    step("score")

    # --- score ----------------------------------------------------------------
    parallel = max(1, min(_int_setting(settings, "SCORING_PARALLEL_REQUESTS", 3), 16))
    rpm = _int_setting(settings, "SCORING_RPM_LIMIT", 0)

    def score_one(job: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None]:
        prompt = f"{static_prompt}\n\n{_job_content(job)}"
        try:
            return job, score_job(prompt)
        except Exception as error:  # a model failure must not end the run
            logger.warning("Scoring %s failed: %s", job["job_id"], error)
            counters.errors.append(f"{job.get('company')}: {error}")
            return job, None

    if to_score:
        with concurrent.futures.ThreadPoolExecutor(max_workers=parallel) as pool:
            for index, (job, answer) in enumerate(pool.map(score_one, to_score)):
                session.refresh(run)
                if run.cancel_requested:
                    counters.errors.append("Cancelled by the owner")
                    break
                if answer is None:
                    counters.failed += 1
                else:
                    job["_payload"] = normalize_payload(answer)
                    counters.scored += 1
                if rpm and index % parallel == 0:
                    time.sleep(60 / rpm)

    step("write")

    # --- write ----------------------------------------------------------------
    for job in normalized:
        if job.get("_merge_into"):
            _merge_repost(session, into=job["_merge_into"], job=job)
            continue
        if "_payload" not in job and job["job_id"] in existing:
            continue  # unchanged and already scored
        created = _upsert_job(session, user_id=user_id, job=job)
        counters.new_jobs += int(created)
    session.commit()
    repo.mark_handled(session, run_id=run.run_id, job_ids=[j["job_id"] for j in normalized])
    step("route")

    # --- route ----------------------------------------------------------------
    rules = RoutingRules.from_settings(settings)
    rows, _ = repo.list_jobs(session, user_id=user_id,
                             filters=repo.JobFilters(view="all", status="New"),
                             limit=repo.MAX_PAGE_SIZE)
    decisions = route_jobs(rows, rules)
    for job_id, decision in decisions.decisions.items():
        changes: dict[str, Any] = {"owner": decision.owner, "status": decision.status}
        if decision.action is not None:
            changes["action"] = decision.action
        repo.update_job(session, user_id=user_id, job_id=job_id, changes=changes)
    counters.assigned = decisions.assigned
    step("done")
    return counters


def _last_success(session: Session, *, user_id: str) -> datetime | None:
    return session.scalar(
        select(TrackerRun.finished_at)
        .where(TrackerRun.user_id == user_id, TrackerRun.status == "Completed")
        .order_by(TrackerRun.finished_at.desc()).limit(1))


def _existing_by_id(session: Session, *, user_id: str, job_ids: list[str]) -> dict[str, TrackerJob]:
    if not job_ids:
        return {}
    rows = session.scalars(select(TrackerJob).where(
        TrackerJob.user_id == user_id, TrackerJob.job_id.in_(job_ids))).all()
    return {row.job_id: row for row in rows}


def _existing_by_fingerprint(
    session: Session, *, user_id: str, fingerprints: list[str]
) -> dict[str, TrackerJob]:
    if not fingerprints:
        return {}
    rows = session.scalars(select(TrackerJob).where(
        TrackerJob.user_id == user_id, TrackerJob.jd_fingerprint.in_(fingerprints))).all()
    return {row.jd_fingerprint: row for row in rows if row.jd_fingerprint}


def _merge_repost(session: Session, *, into: str, job: dict[str, Any]) -> None:
    """Record a re-post against the row that already holds this role.

    The new id is kept because the old posting may be the dead one, and a closed
    role that is posted again re-opens rather than arriving as a second row.
    """
    existing = session.get(TrackerJob, into)
    if existing is None:
        return
    ids = list(existing.merged_job_ids or [])
    if job["job_id"] not in ids:
        existing.merged_job_ids = [job["job_id"], *ids]
    if existing.status == "Closed":
        existing.status = "New"
    if job.get("posted") and (existing.posted is None or job["posted"] > existing.posted):
        existing.posted = job["posted"]
    existing.sort_key = build_sort_key(existing.status, existing.priority,
                                       existing.posted, existing.imported_at, existing.score)
    existing.assigned_sort_key = existing.sort_key
    session.commit()


def _upsert_job(session: Session, *, user_id: str, job: dict[str, Any]) -> bool:
    """Write a job and its payload. Returns whether the row is new."""
    payload = job.get("_payload")
    existing = session.get(TrackerJob, job["job_id"])
    is_new = existing is None

    values: dict[str, Any] = {
        "job_id": job["job_id"], "user_id": user_id,
        "company": job.get("company"), "title": job.get("title"),
        "location": job.get("location"), "posted": job.get("posted"),
        "applicants": job.get("applicants"), "imported_at": job.get("imported_at"),
        "jd_fingerprint": job.get("jd_fingerprint"),
        "company_key": (job.get("company") or "").lower().strip() or None,
        "merged_job_ids": [job["job_id"]],
    }
    if payload is not None:
        values.update({
            "priority": payload.priority, "score": payload.score, "us_visa": payload.us_visa,
            "us_visa_reason": payload.us_visa_reason, "summary": payload.summary,
            "why": payload.why, "title_level": payload.title_level,
            "jd_implied_level": payload.jd_implied_level,
            "level_normalized": payload.level_normalized,
            "requires_people_mgmt": payload.requires_people_mgmt,
            "required_yoe_pm": payload.required_yoe_pm,
            "required_yoe_total": payload.required_yoe_total,
            "scored_at": datetime.now(timezone.utc),
            "scoring_fingerprint": job.get("_scoring_fingerprint"),
        })

    if is_new:
        values.setdefault("status", "New")
        values.setdefault("owner", "")
        values.setdefault("action", "")
        values["sort_key"] = build_sort_key(values.get("status"), values.get("priority"),
                                            values.get("posted"), values.get("imported_at"),
                                            values.get("score"))
        values["assigned_sort_key"] = values["sort_key"]
        values["in_assigned_queue"] = False
        session.add(TrackerJob(**values))
    else:
        for key, value in values.items():
            if key not in ("job_id", "user_id", "merged_job_ids") and value is not None:
                setattr(existing, key, value)
        existing.sort_key = build_sort_key(existing.status, existing.priority, existing.posted,
                                           existing.imported_at, existing.score)
        existing.assigned_sort_key = existing.sort_key
        existing.in_assigned_queue = (
            is_assignee(existing.owner) and not is_dead_status(existing.status))

    session.execute(
        insert(TrackerJobDoc)
        .values(job_id=job["job_id"], raw_ref=job.get("raw_ref"), jd_text=job.get("jd_text"),
                posted_at=job.get("posted_at"), listed_at=job.get("listed_at"),
                imported_at=job.get("imported_at"))
        .on_conflict_do_update(
            index_elements=["job_id"],
            set_={"raw_ref": job.get("raw_ref"), "jd_text": job.get("jd_text"),
                  "posted_at": job.get("posted_at"), "listed_at": job.get("listed_at"),
                  "imported_at": job.get("imported_at")})
    )
    return is_new
