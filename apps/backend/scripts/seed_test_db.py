"""Fill a disposable database with enough shape for the API tests to be real.

The API tests are gated on ``tracker_jobs`` having rows, so against an empty
database they do not fail — they *skip*, and the suite reports green while
testing nothing. CI needs a database that looks like the sheet in the ways the
tests read it: more jobs than assigned ones, several statuses and priorities, a
role posted more than once, a scored row with a stored description, settings
that describe a runnable setup, and one finished run.

The rows are synthetic. Nothing here is taken from real data, and the companies
and titles are invented.

Usage::

    TRACKER_DATABASE_URL=postgresql+psycopg://...@localhost:5432/..._test \\
        python scripts/seed_test_db.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.tracker.models import (  # noqa: E402
    TrackerApifyAccount,
    TrackerJob,
    TrackerJobDoc,
    TrackerRun,
    TrackerRunHandled,
    TrackerSetting,
    init_tracker_schema,
)
from app.tracker.ranking import build_sort_key  # noqa: E402

#: The same rule the test fixtures use: a database must name itself disposable.
#: This script deletes every tracker row before it writes, so the guard is the
#: only thing standing between a mistyped URL and someone's real queue.
SAFE_NAME_MARKERS = ("test", "tmp", "scratch", "ci")

USER = "owner"
NOW = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)

#: Enough rows that paging (limit=10, offset=10) and a 50-row page are real.
JOB_COUNT = 40


def _guard(url: str) -> None:
    name = url.rsplit("/", 1)[-1].split("?")[0].lower()
    if not any(marker in name for marker in SAFE_NAME_MARKERS):
        raise SystemExit(
            f"refusing to seed '{name}': this script deletes every tracker row "
            f"first, so the database must name itself a test one"
        )


def _jobs() -> list[TrackerJob]:
    """A spread wide enough to exercise every filter the page offers."""
    # Cycled rather than random so a failure is reproducible from the job id alone.
    statuses = ["New"] * 24 + ["Flagged"] * 4 + ["Submitted"] * 4 + ["Skip (auto)"] * 8
    priorities = ["P01", "P02", "P03", "P04"]
    visas = ["Yes (100%)", "Likely (90%)", "Possible (70%)", "Unclear (50%)", "No"]

    rows: list[TrackerJob] = []
    for i in range(JOB_COUNT):
        status = statuses[i]
        # Assignee-owned rows must stay a minority: several tests assert that the
        # full list is strictly larger than the assigned queue.
        owner = "Assignee" if (i % 5 == 0 and status == "New") else ""
        posted = NOW - timedelta(days=i)
        score = 95 - i
        job = TrackerJob(
            job_id=f"90000000{i:02d}",
            user_id=USER,
            priority=priorities[i % len(priorities)],
            score=score,
            us_visa=visas[i % len(visas)],
            us_visa_reason="Synthetic row for tests.",
            summary=f"Synthetic summary {i}.",
            why=f"Synthetic reasoning {i}.",
            scored_at=NOW,
            # One row carries a company name the search tests look for by name;
            # the rest are invented.
            company=("Stripe" if i == 11 else f"Example Corp {i}"),
            # Every title carries "Product" so the search tests have a term that
            # matches broadly, and one row is upper-cased for the case test.
            title=("PRODUCT MANAGER, PLATFORM" if i == 7 else f"Product Manager {i}"),
            title_level="Senior-PM",
            jd_implied_level="Senior-PM",
            location="New York, NY",
            posted=posted,
            applicants="25",
            imported_at=posted,
            status=status,
            owner=owner,
            action="Fill & Submit" if owner else "",
            notes="Blocked on the application form." if status == "Flagged" else None,
            applied_at=NOW if status == "Submitted" else None,
            # One role posted three times, so the link menu and the detail test
            # have a row with more than one posting.
            merged_job_ids=(
                [f"90000000{i:02d}", "9000000090", "9000000091"]
                if i == 3
                else [f"90000000{i:02d}"]
            ),
            dead_links={},
            company_key=("stripe" if i == 11 else f"example corp {i}"),
        )
        job.sort_key = build_sort_key(
            job.status, job.priority, job.posted, job.imported_at, job.score
        )
        job.assigned_sort_key = job.sort_key
        job.in_assigned_queue = bool(owner) and status not in ("Skip", "Skip (auto)", "Closed")
        rows.append(job)
    return rows


def _settings() -> list[TrackerSetting]:
    """A setup that validates as runnable. The key values are obvious fakes."""
    values = {
        "TARGET_PROFILE": "Senior PM with fraud and identity experience.",
        "GEMINI_API_ROUTE": "vertex",
        "VERTEX_PROJECT_ID": "example-project",
        "VERTEX_LOCATION": "us-central1",
        "SCORING_MODEL": "gemini-3.5-flash",
        "RUN_INTERVAL_HOURS": "6",
        # Present so the redaction test has something that must not come back.
        "GEMINI_API_KEY": "not-a-real-key",
        "AUTO_ASSIGN_PRIORITIES": "P01,P02",
        "AUTO_RESERVE_PRIORITIES": "",
        "AUTO_ASSIGN_MIN_SCORE": "70",
        "AUTO_SKIP_VISA_NO": "TRUE",
    }
    return [
        TrackerSetting(key=k, user_id=USER, value=v, updated_at=NOW) for k, v in values.items()
    ]


def main() -> None:
    url = (os.environ.get("TRACKER_DATABASE_URL") or "").strip()
    if not url:
        raise SystemExit("TRACKER_DATABASE_URL is not set")
    _guard(url)

    engine = create_engine(url, future=True)
    init_tracker_schema(engine)

    with Session(engine) as session:
        # Start from empty so a re-run is identical to a first run.
        for model in (TrackerRunHandled, TrackerRun, TrackerJobDoc,
                      TrackerApifyAccount, TrackerSetting, TrackerJob):
            session.execute(delete(model))

        jobs = _jobs()
        session.add_all(jobs)
        session.add_all(_settings())
        session.add(
            TrackerApifyAccount(
                label="example-account", user_id=USER, batch_key="not-a-real-key",
                detail_key="not-a-real-key", active=True, position=0,
            )
        )
        # Descriptions for a handful only: the tests check that the list endpoint
        # never ships them, which is only meaningful if some rows have one.
        session.add_all([
            TrackerJobDoc(
                job_id=job.job_id,
                raw_ref=None,
                jd_text=f"Synthetic job description for {job.company}. " * 20,
                posted_at=job.posted,
                listed_at=job.posted,
                imported_at=job.imported_at,
            )
            for job in jobs[:5]
        ])

        run = TrackerRun(
            run_id="00000000-0000-4000-8000-000000000001", user_id=USER,
            mode="scheduled", status="Done", phase="done", cursor="",
            counters={"scraped": len(jobs), "scored": len(jobs), "assigned": 8},
            errors=[], cancel_requested=False,
            started_at=NOW - timedelta(minutes=20), finished_at=NOW,
        )
        session.add(run)
        session.add_all([
            TrackerRunHandled(run_id=run.run_id, job_id=job.job_id) for job in jobs[:10]
        ])
        session.commit()

        print(f"seeded {len(jobs)} jobs, {len(_settings())} settings, 1 apify account, 1 run")


if __name__ == "__main__":
    main()
