"""Execute one tracker run. This is what the scheduler calls.

    python -m scripts.run_pipeline --max-items 3 --max-scored 3

Applies the schedule gate unless --force is given, so the scheduler can simply
fire on a fixed cadence and let the gate decide whether a run is actually due.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.tracker import repo  # noqa: E402
from app.tracker.models import init_tracker_schema  # noqa: E402
from app.tracker.pipeline import run_pipeline  # noqa: E402
from app.tracker.schedule import should_start_run  # noqa: E402
from app.tracker.scorer import build_scorer  # noqa: E402

RUBRIC = Path(__file__).resolve().parent.parent / "app" / "tracker" / "default_rubric.txt"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--user-id", default="owner")
    ap.add_argument("--max-items", type=int, default=None, help="cap on jobs scraped")
    ap.add_argument("--max-scored", type=int, default=None, help="cap on jobs sent to the model")
    ap.add_argument("--force", action="store_true", help="ignore quiet hours and the interval")
    ap.add_argument("--lookback-hours", type=int, default=None,
                    help="override the search window; the cheapest way to keep a test run small")
    ap.add_argument("--dry-run", action="store_true", help="score nothing; prove the wiring only")
    ap.add_argument("--database-url", default=os.environ.get(
        "TRACKER_DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/som_career_coach"))
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    engine = create_engine(args.database_url, future=True)
    init_tracker_schema(engine)

    with Session(engine) as session:
        settings = repo.get_settings(session, user_id=args.user_id, redact=False)
        existing = repo.active_run(session, user_id=args.user_id)

        if not args.force:
            decision = should_start_run(
                now=datetime.now(timezone.utc),
                last_run_at=_last_started(session, args.user_id),
                settings=settings,
                run_in_progress=existing is not None,
            )
            if not decision.should_run:
                print(f"skipped: {decision.reason}")
                return 0

        if existing is not None:
            print(f"a run is already in progress ({existing.run_id})")
            return 0

        run = repo.create_run(session, user_id=args.user_id, mode="import")
        print(f"run {run.run_id} starting")

        scorer = (lambda _prompt: None) if args.dry_run else build_scorer(settings)
        rubric = RUBRIC.read_text() if RUBRIC.exists() else ""

        try:
            counters = run_pipeline(
                session, user_id=args.user_id, run=run, score_job=scorer, rubric=rubric,
                max_items=args.max_items, max_scored=args.max_scored,
                lookback_override=args.lookback_hours,
                progress=lambda phase, c: print(f"  {phase}: {c.as_dict()}"),
            )
            repo.finish_run(session, run=run, status="Completed")
            print(f"done: {counters.as_dict()}")
            for error in counters.errors[:5]:
                print(f"  ! {error}")
        except Exception as error:
            repo.finish_run(session, run=run, status="Failed")
            run.errors = [str(error)]
            session.commit()
            print(f"failed: {error}")
            return 1
    return 0


def _last_started(session: Session, user_id: str):
    runs = repo.list_runs(session, user_id=user_id, limit=1)
    return runs[0].started_at if runs else None


if __name__ == "__main__":
    raise SystemExit(main())
