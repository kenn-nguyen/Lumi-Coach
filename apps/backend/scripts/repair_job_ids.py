"""Strip the spreadsheet's float formatting from stored posting ids.

The sheet held job ids as numbers, so ids that came through the migration's
merged-postings column arrived as ``4454136306.0``. The page builds the posting
URL straight from that list, so those rows link to
``linkedin.com/jobs/view/4454136306.0``, which is a 404 — and because the merged
list is used in preference to the row's own id, the working link is never
offered at all.

Idempotent: a second run changes nothing. Prints what it would do with --dry-run.

    python scripts/repair_job_ids.py --dry-run
    python scripts/repair_job_ids.py
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.tracker.models import TrackerJob  # noqa: E402
from app.tracker.normalize import normalize_job_id  # noqa: E402


def repair(session: Session, *, dry_run: bool) -> tuple[int, int, list[str]]:
    """Normalise every merged id, and make sure the row's own id is among them."""
    changed_ids = 0
    changed_rows = 0
    samples: list[str] = []

    for job in session.scalars(select(TrackerJob)):
        merged = list(job.merged_job_ids or [])
        if not merged:
            continue

        cleaned: list[str] = []
        for value in merged:
            fixed = normalize_job_id(value)
            if fixed != value:
                changed_ids += 1
            if fixed and fixed not in cleaned:
                cleaned.append(fixed)

        # A row whose own posting is missing from the list cannot offer the one
        # link that is certain to be real.
        if job.job_id not in cleaned:
            cleaned.append(job.job_id)

        if cleaned != merged:
            changed_rows += 1
            if len(samples) < 5:
                samples.append(f"{job.company}: {merged} -> {cleaned}")
            if not dry_run:
                job.merged_job_ids = cleaned

    if not dry_run:
        session.commit()
    return changed_rows, changed_ids, samples


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="report without writing")
    args = ap.parse_args()

    url = (os.environ.get("TRACKER_DATABASE_URL") or "").strip()
    if not url:
        from app.tracker.api import _database_url
        url = _database_url()

    engine = create_engine(url, future=True)
    with Session(engine) as session:
        rows, ids, samples = repair(session, dry_run=args.dry_run)

    verb = "would fix" if args.dry_run else "fixed"
    print(f"  {verb} {rows} row(s); {ids} malformed id(s) normalised")
    for s in samples:
        print(f"    {s}")


if __name__ == "__main__":
    main()
