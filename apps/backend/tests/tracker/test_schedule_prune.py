"""The gates that decide when a run happens and what ages out."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.tracker.prune import (
    PruneDates,
    cutoff_for,
    should_drop_payload,
    should_prune_assigned_row,
    should_prune_job,
)
from app.tracker.schedule import (
    QUIET_TZ,
    is_in_quiet_hours,
    normalize_interval_hours,
    should_start_run,
)

NOW = datetime(2026, 10, 8, 20, 0, tzinfo=timezone.utc)  # 13:00 Pacific


def pacific(hour: int) -> datetime:
    return datetime(2026, 10, 8, hour, 0, tzinfo=QUIET_TZ)


# --- quiet hours --------------------------------------------------------------

@pytest.mark.unit
@pytest.mark.parametrize("hour,quiet", [(19, True), (23, True), (2, True), (4, True),
                                        (5, False), (11, False), (18, False)])
def test_window_that_wraps_midnight(hour: int, quiet: bool) -> None:
    assert is_in_quiet_hours(pacific(hour), 19, 5) is quiet


@pytest.mark.unit
@pytest.mark.parametrize("hour,quiet", [(0, False), (9, True), (10, True), (12, False)])
def test_window_inside_one_day(hour: int, quiet: bool) -> None:
    assert is_in_quiet_hours(pacific(hour), 9, 12) is quiet


@pytest.mark.unit
def test_equal_hours_disables_quiet_time() -> None:
    assert is_in_quiet_hours(pacific(3), 0, 0) is False


@pytest.mark.unit
def test_the_owners_real_window_is_sixteen_hours() -> None:
    """Their setting is 19 → 11, so runs only happen in a narrow midday window."""
    quiet = [h for h in range(24) if is_in_quiet_hours(pacific(h), 19, 11)]
    assert len(quiet) == 16
    assert 12 not in quiet and 19 in quiet


# --- interval -----------------------------------------------------------------

@pytest.mark.unit
@pytest.mark.parametrize("raw,expected", [(6, 6), ("6", 6), (0, 4), (-1, 4), (99, 12),
                                          (None, 4), ("abc", 4), (2.7, 2)])
def test_interval_is_clamped(raw: object, expected: int) -> None:
    assert normalize_interval_hours(raw) == expected


@pytest.mark.unit
def test_run_is_skipped_until_the_interval_has_nearly_elapsed() -> None:
    settings = {"RUN_INTERVAL_HOURS": "6", "QUIET_START_HOUR": "0", "QUIET_END_HOUR": "0"}
    assert not should_start_run(now=NOW, last_run_at=NOW - timedelta(hours=1),
                                settings=settings).should_run
    # half an hour of slack, so 5h30m counts as due
    assert should_start_run(now=NOW, last_run_at=NOW - timedelta(hours=5, minutes=31),
                            settings=settings).should_run


@pytest.mark.unit
def test_first_ever_run_is_allowed() -> None:
    assert should_start_run(now=NOW, last_run_at=None, settings={}).should_run


@pytest.mark.unit
def test_quiet_hours_beat_the_interval() -> None:
    settings = {"RUN_INTERVAL_HOURS": "1", "QUIET_START_HOUR": "0", "QUIET_END_HOUR": "23"}
    d = should_start_run(now=NOW, last_run_at=None, settings=settings)
    assert not d.should_run and "quiet" in d.reason


@pytest.mark.unit
def test_a_run_in_progress_ignores_both_gates() -> None:
    settings = {"QUIET_START_HOUR": "0", "QUIET_END_HOUR": "23"}
    assert should_start_run(now=NOW, last_run_at=NOW, settings=settings,
                            run_in_progress=True).should_run


# --- pruning ------------------------------------------------------------------

OLD = NOW - timedelta(days=200)
RECENT = NOW - timedelta(days=3)
CUTOFF = cutoff_for(NOW, 90)


@pytest.mark.unit
@pytest.mark.parametrize("status", ["Submitted", "Networking"])
def test_effort_already_spent_is_never_pruned(status: str) -> None:
    assert not should_prune_job(status=status, posted_at=OLD, listed_at=OLD,
                                imported_at=OLD, cutoff=CUTOFF)


@pytest.mark.unit
@pytest.mark.parametrize("status", ["New", "Filled", "Flagged", "Skip", "Skip (auto)", "Closed"])
def test_everything_else_ages_out(status: str) -> None:
    assert should_prune_job(status=status, posted_at=OLD, listed_at=OLD,
                            imported_at=OLD, cutoff=CUTOFF)


@pytest.mark.unit
def test_a_missing_date_never_prunes() -> None:
    assert not should_prune_job(status="New", posted_at=None, listed_at=None,
                                imported_at=None, cutoff=CUTOFF)


@pytest.mark.unit
def test_any_selected_date_being_old_is_enough() -> None:
    """A job can look recent and still prune — that is intended, not a bug."""
    assert should_prune_job(status="New", posted_at=OLD, listed_at=RECENT, imported_at=RECENT,
                            cutoff=CUTOFF, dates=PruneDates(posted_at=True))
    assert not should_prune_job(status="New", posted_at=OLD, listed_at=RECENT, imported_at=RECENT,
                                cutoff=CUTOFF, dates=PruneDates(posted_at=False))


@pytest.mark.unit
@pytest.mark.parametrize("flags,expected", [
    ("011", ("listed_at", "imported_at")),
    ("111", ("posted_at", "listed_at", "imported_at")),
    ("100", ("posted_at",)),
    ("", ("listed_at", "imported_at")),       # malformed falls back to the default
    ("12", ("listed_at", "imported_at")),
])
def test_date_flags_parse_as_the_prompt_documents(flags: str, expected: tuple) -> None:
    assert PruneDates.from_flags(flags).selected() == expected


@pytest.mark.unit
def test_payloads_go_when_nothing_will_read_them_again() -> None:
    for status in ("Submitted", "Closed", "Skip"):
        assert should_drop_payload(status=status)
    # a rules-set skip may be lifted later, and then the description is needed again
    assert not should_drop_payload(status="Skip (auto)")
    assert not should_drop_payload(status="New")
    assert should_drop_payload(status="New", job_exists=False), "orphan"


@pytest.mark.unit
def test_assignee_keeps_live_work_but_not_finished_work() -> None:
    for status in ("New", "Filled", "Flagged"):
        assert not should_prune_assigned_row(status=status, job_exists=True,
                                             updated_at=OLD, cutoff=CUTOFF)
    assert should_prune_assigned_row(status="Submitted", job_exists=True,
                                     updated_at=OLD, cutoff=CUTOFF)
    assert not should_prune_assigned_row(status="Submitted", job_exists=True,
                                         updated_at=RECENT, cutoff=CUTOFF)
    assert should_prune_assigned_row(status="New", job_exists=False,
                                     updated_at=RECENT, cutoff=CUTOFF)
