"""When a scheduled run is allowed to start.

Ported from `_isInQuietHours` (pipeline.gs L1879) and the interval gate in
`runJobImportAndScoring` (main.gs L303-329).

The scheduler fires more often than the run should actually happen, and this gate
decides. Keeping it here rather than in the cron schedule means the cadence stays
editable in Settings without redeploying anything.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

#: Quiet hours are expressed in the owner's local time, not the server's.
QUIET_TZ = ZoneInfo("America/Los_Angeles")

DEFAULT_INTERVAL_HOURS = 4
MAX_INTERVAL_HOURS = 12

#: A run started slightly early is better than one skipped for 6 more hours, so the
#: interval check allows half an hour of slack.
INTERVAL_SLACK = timedelta(minutes=30)


@dataclass(frozen=True)
class RunDecision:
    should_run: bool
    reason: str


def normalize_interval_hours(value: object) -> int:
    """Interval in hours, clamped to something sane. Anything odd falls back to the default."""
    try:
        parsed = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return DEFAULT_INTERVAL_HOURS
    if parsed < 1:
        return DEFAULT_INTERVAL_HOURS
    return min(int(parsed), MAX_INTERVAL_HOURS)


def parse_hour(value: object, default: int) -> int:
    try:
        hour = int(float(value))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    return hour if 0 <= hour <= 23 else default


def is_in_quiet_hours(now: datetime, start_hour: int, end_hour: int) -> bool:
    """Whether the clock is inside the do-not-run window.

    Equal start and end disables quiet hours entirely. A window that wraps midnight
    (the common case, e.g. 19 → 05) is handled explicitly.
    """
    if start_hour == end_hour:
        return False
    hour = now.astimezone(QUIET_TZ).hour
    if start_hour > end_hour:
        return hour >= start_hour or hour < end_hour
    return start_hour <= hour < end_hour


def should_start_run(
    *,
    now: datetime,
    last_run_at: datetime | None,
    settings: dict[str, str],
    run_in_progress: bool = False,
) -> RunDecision:
    """Decide whether a scheduled tick should actually start a run.

    A run already in progress bypasses both gates: it is resuming work, not starting
    new work, and stopping it half-finished would waste what it has already paid for.
    """
    if run_in_progress:
        return RunDecision(True, "a run is already in progress")

    start = parse_hour(settings.get("QUIET_START_HOUR"), 19)
    end = parse_hour(settings.get("QUIET_END_HOUR"), 5)
    if is_in_quiet_hours(now, start, end):
        return RunDecision(False, f"quiet hours ({start:02d}:00–{end:02d}:00 Pacific)")

    interval = normalize_interval_hours(settings.get("RUN_INTERVAL_HOURS"))
    if last_run_at is not None:
        if last_run_at.tzinfo is None:
            last_run_at = last_run_at.replace(tzinfo=timezone.utc)
        elapsed = now - last_run_at
        required = timedelta(hours=interval) - INTERVAL_SLACK
        if elapsed < required:
            remaining = required - elapsed
            minutes = int(remaining.total_seconds() // 60)
            return RunDecision(False, f"only {int(elapsed.total_seconds() // 60)} min since the "
                                      f"last run; {minutes} min to go")

    return RunDecision(True, f"due (every {interval}h)")
