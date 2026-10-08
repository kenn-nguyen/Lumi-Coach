"""The sort key must reproduce what the sheet already computed.

Runs against a real Job_Priority export when one is present; the unit cases below
run regardless, so the suite is meaningful on a clean checkout.
"""

from __future__ import annotations

import csv
import os
import sys
from pathlib import Path

import pytest

from app.tracker.enums import priority_sort_rank, status_sort_rank
from app.tracker.ranking import build_sort_key, to_comparable_ms

FIXTURE = Path(os.environ.get(
    "TRACKER_FIXTURES", "/Users/kennng/Documents/jd update/fixtures")) / "job_priority.csv"


@pytest.mark.unit
def test_status_rank_orders_work_before_dead_rows() -> None:
    assert status_sort_rank("Networking") < status_sort_rank("New")
    assert status_sort_rank("New") < status_sort_rank("Submitted")
    assert status_sort_rank("Submitted") < status_sort_rank("Skip")
    assert status_sort_rank("Skip") == status_sort_rank("Skip (auto)")
    assert status_sort_rank("") == status_sort_rank("New"), "blank means New"
    assert status_sort_rank("Nonsense") > status_sort_rank("Closed")


@pytest.mark.unit
def test_priority_rank_handles_legacy_labels() -> None:
    assert priority_sort_rank("P01") == 0
    assert priority_sort_rank("p01") == 0, "case-insensitive"
    assert priority_sort_rank("A") == 0, "legacy A behaves like P01"
    assert priority_sort_rank("B") == 4
    assert priority_sort_rank("SKIP") == 9
    assert priority_sort_rank("") == 10


@pytest.mark.unit
def test_sort_key_is_fixed_width_and_orders_correctly() -> None:
    best = build_sort_key("New", "P01", "2026-10-07 09:00:00", "", 95)
    worse_priority = build_sort_key("New", "P05", "2026-10-07 09:00:00", "", 95)
    older = build_sort_key("New", "P01", "2026-09-01 09:00:00", "", 95)
    lower_score = build_sort_key("New", "P01", "2026-10-07 09:00:00", "", 60)

    assert len(best) == 21
    assert best < worse_priority, "better priority sorts first"
    assert best < older, "newer posting sorts first"
    assert best < lower_score, "higher score sorts first"


@pytest.mark.unit
def test_sort_key_falls_back_to_imported_at() -> None:
    posted = build_sort_key("New", "P03", "2026-10-01 00:00:00", "2020-01-01 00:00:00", 70)
    fallback = build_sort_key("New", "P03", "", "2026-10-01 00:00:00", 70)
    assert posted == fallback, "imported_at is used only when posted is missing"


@pytest.mark.unit
def test_unparseable_dates_do_not_raise() -> None:
    assert to_comparable_ms("not a date") == 0
    assert to_comparable_ms(None) == 0
    assert to_comparable_ms("") == 0
    build_sort_key("New", "P01", "garbage", "garbage", "garbage")


@pytest.mark.skipif(not FIXTURE.exists(), reason="no Job_Priority export available")
def test_matches_every_sort_key_the_sheet_computed() -> None:
    csv.field_size_limit(sys.maxsize)
    checked = mismatches = 0
    examples: list[str] = []

    with FIXTURE.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            stored = (row.get("sort_key") or "").strip()
            if not stored:
                continue
            checked += 1
            ours = build_sort_key(
                row.get("status"), row.get("priority"),
                row.get("posted"), row.get("imported_at"), row.get("score"),
            )
            if ours != stored:
                mismatches += 1
                if len(examples) < 5:
                    examples.append(
                        f"{row.get('company')!r} {row.get('job_id')}: "
                        f"sheet={stored} ours={ours} "
                        f"(status={row.get('status')!r} pri={row.get('priority')!r} "
                        f"posted={row.get('posted')!r} imported={row.get('imported_at')!r} "
                        f"score={row.get('score')!r})"
                    )

    assert checked > 100, f"fixture looks empty ({checked} rows with a sort key)"
    rate = mismatches / checked
    assert rate == 0, (
        f"{mismatches}/{checked} sort keys differ ({rate:.2%}).\n" + "\n".join(examples)
    )
