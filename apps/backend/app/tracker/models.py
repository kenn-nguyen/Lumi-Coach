"""Tracker tables.

Replaces the Google Sheet's tabs:

===================  =========================================================
Sheet tab            Table
===================  =========================================================
Job_Priority         ``tracker_jobs``
Assigned             ``tracker_jobs`` (same rows; ``owner`` says who holds it)
Raw_Data             ``tracker_job_docs``
Settings + Prompt    ``tracker_settings``
Apify_Accounts       ``tracker_apify_accounts``
(run state)          ``tracker_runs`` + ``tracker_run_handled``
===================  =========================================================

Two deliberate differences from the sheet:

* **No ``rank`` column.** The sheet rewrites rank on every row each run, which in
  Postgres would be thousands of writes per run. ``sort_key`` is stored instead and
  rank is the row's position in an ordered page.
* **Job descriptions live in their own table.** ``raw_ref`` runs to ~40k characters
  per row, so keeping it out of ``tracker_jobs`` keeps list queries small.

A separate declarative base keeps this package importable without Lumi's runtime
config; ``init_tracker_schema`` is called alongside the app's own ``init_schema``.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Engine,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TrackerBase(DeclarativeBase):
    pass


class TrackerJob(TrackerBase):
    """One role. The sheet's Job_Priority row, plus the Assigned row's own fields."""

    __tablename__ = "tracker_jobs"

    job_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # --- scoring ---------------------------------------------------------
    priority: Mapped[str | None] = mapped_column(String(8), nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    us_visa: Mapped[str | None] = mapped_column(String(32), nullable=True)
    us_visa_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    why: Mapped[str | None] = mapped_column(Text, nullable=True)
    level_normalized: Mapped[str | None] = mapped_column(String(64), nullable=True)
    requires_people_mgmt: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    required_yoe_pm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    required_yoe_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scoring_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # --- the posting -----------------------------------------------------
    company: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    title_level: Mapped[str | None] = mapped_column(String(64), nullable=True)
    jd_implied_level: Mapped[str | None] = mapped_column(String(64), nullable=True)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    applicants: Mapped[str | None] = mapped_column(String(32), nullable=True)
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- workflow --------------------------------------------------------
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="New")
    owner: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    action: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    referral_contact: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: The Assigned sheet's own columns. They belong to the same role, so they live
    #: on the same row rather than in a mirrored table.
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- identity and de-duplication ------------------------------------
    #: Every job id this role has been posted under, newest first. The assignee
    #: needs all of them because expired links are routine.
    merged_job_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    jd_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    #: Normalised company name. Similar-JD de-duplication only ever compares within
    #: one company, so this keeps that scan to an indexed lookup.
    company_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dead_links: Mapped[dict[str, bool]] = mapped_column(JSONB, nullable=False, default=dict)
    resume_file: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- ordering --------------------------------------------------------
    sort_key: Mapped[str] = mapped_column(String(24), nullable=False, default="")
    assigned_sort_key: Mapped[str] = mapped_column(String(24), nullable=False, default="")
    #: Denormalised so the Assigned view is one indexed predicate, not a computed one.
    in_assigned_queue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    __table_args__ = (
        Index("ix_tracker_jobs_user_sort", "user_id", "sort_key"),
        Index("ix_tracker_jobs_user_status_sort", "user_id", "status", "sort_key"),
        Index("ix_tracker_jobs_assigned", "user_id", "in_assigned_queue", "assigned_sort_key"),
        Index("ix_tracker_jobs_company_key", "user_id", "company_key"),
        Index("ix_tracker_jobs_merged", "merged_job_ids", postgresql_using="gin"),
    )


class TrackerJobDoc(TrackerBase):
    """The scraped payload. Read when scoring or showing a description, never when listing."""

    __tablename__ = "tracker_job_docs"

    job_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tracker_jobs.job_id", ondelete="CASCADE"), primary_key=True
    )
    #: The raw Apify item, capped at ~40k chars as the sheet caps it. Postgres TOAST
    #: compresses this automatically, so no manual compression is needed.
    raw_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Extracted once at write time so scoring never re-parses the payload.
    jd_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: Three dates, deliberately different. ``posted_at`` is when the role was
    #: *first* posted and is what ageing-out reads. ``listed_at`` is when this
    #: particular listing went live. ``imported_at`` is when the scrape ran, and is
    #: the anchor that relative labels ("4 days ago") were resolved against.
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    listed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TrackerSetting(TrackerBase):
    """Settings and Prompt tabs: one editable key/value row each."""

    __tablename__ = "tracker_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class TrackerApifyAccount(TrackerBase):
    """Apify tokens, rotated when one hits its quota. Never returned to the browser."""

    __tablename__ = "tracker_apify_accounts"

    label: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    batch_key: Mapped[str] = mapped_column(Text, nullable=False, default="")
    detail_key: Mapped[str] = mapped_column(Text, nullable=False, default="")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class TrackerRun(TrackerBase):
    """One pipeline run. Replaces the single JSON blob the script kept in Script Properties."""

    __tablename__ = "tracker_runs"

    run_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="import")
    status: Mapped[str] = mapped_column(String(48), nullable=False, default="Starting")
    phase: Mapped[str] = mapped_column(String(32), nullable=False, default="search")
    #: Where the run got to: Apify run/dataset ids, which accounts were used, what is
    #: still pending. Lets a crashed run resume without re-scraping or re-scoring.
    cursor: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    counters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    errors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_tracker_runs_started", "user_id", "started_at"),)


class TrackerRunHandled(TrackerBase):
    """Job ids already dealt with in a run, so a resumed run never double-scores."""

    __tablename__ = "tracker_run_handled"

    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tracker_runs.run_id", ondelete="CASCADE"), primary_key=True
    )
    job_id: Mapped[str] = mapped_column(String(32), primary_key=True)


def init_tracker_schema(engine: Engine) -> None:
    """Create any tracker table that does not exist yet. Safe to call on every boot."""
    TrackerBase.metadata.create_all(engine)
