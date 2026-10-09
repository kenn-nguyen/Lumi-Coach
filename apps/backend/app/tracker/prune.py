"""What ages out of the tracker.

Ported from `pruneExpiredJobRows` (sheet.gs L902), `pruneRawData` (L2953) and
`pruneAssignedRows` (L2994).

Three separate decisions, deliberately:

* **A job row** ages out on whichever dates the owner picked. Work that represents
  real effort — ``Submitted`` and ``Networking`` — is never pruned at any age.
* **A job description** is dropped as soon as nothing will re-read it, which is far
  sooner than the row itself goes. These are the bulk of the storage.
* **A missing date never prunes.** Absent evidence is not evidence of age.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .enums import STATUS_CLOSED, STATUS_NETWORKING, STATUS_SKIP, STATUS_SKIP_AUTO, STATUS_SUBMITTED

#: Statuses that represent effort already spent. Pruning these would lose the record
#: of having applied, so they stay regardless of age.
NEVER_PRUNED = frozenset({STATUS_SUBMITTED, STATUS_NETWORKING})

#: Once a job reaches one of these, nothing re-reads its description: it will not be
#: re-scored, and the posting is gone or rejected. ``Skip (auto)`` is absent on
#: purpose — the routing rules may lift it, and then it needs its description back.
PAYLOAD_EXPENDABLE = frozenset({STATUS_SUBMITTED, STATUS_CLOSED, STATUS_SKIP})

DEFAULT_PRUNE_DAYS = 90

#: Which date each flag refers to, in the order the sheet's prompt lists them.
DATE_FIELDS = ("posted_at", "listed_at", "imported_at")


@dataclass(frozen=True)
class PruneDates:
    """Which dates to measure age against. More selected means more rows prune."""

    posted_at: bool = False
    listed_at: bool = True
    imported_at: bool = True

    @classmethod
    def from_flags(cls, flags: str) -> "PruneDates":
        """Parse the sheet's three-digit prompt answer, e.g. ``"011"``."""
        digits = (flags or "").strip()
        if len(digits) != 3 or any(c not in "01" for c in digits):
            return cls()
        return cls(digits[0] == "1", digits[1] == "1", digits[2] == "1")

    def selected(self) -> tuple[str, ...]:
        return tuple(f for f in DATE_FIELDS if getattr(self, f))


def _aged_out(value: datetime | None, cutoff: datetime) -> bool:
    if value is None:
        return False  # no date is not the same as an old date
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value < cutoff


def cutoff_for(now: datetime, days: int = DEFAULT_PRUNE_DAYS) -> datetime:
    return now - timedelta(days=max(1, days))


def should_prune_job(
    *,
    status: object,
    posted_at: datetime | None,
    listed_at: datetime | None,
    imported_at: datetime | None,
    cutoff: datetime,
    dates: PruneDates | None = None,
) -> bool:
    """Whether a job row is old enough to delete.

    Any one selected date being older than the cutoff is enough, which is why
    selecting more dates prunes more rather than less.
    """
    if (str(status) if status is not None else "").strip() in NEVER_PRUNED:
        return False

    dates = dates or PruneDates()
    available = {"posted_at": posted_at, "listed_at": listed_at, "imported_at": imported_at}
    return any(_aged_out(available[field], cutoff) for field in dates.selected())


def should_drop_payload(*, status: object, job_exists: bool = True) -> bool:
    """Whether the stored description can go while the job row stays.

    Age is irrelevant here: what matters is whether anything will read it again.
    """
    if not job_exists:
        return True  # orphaned payload: the job is already gone
    return (str(status) if status is not None else "").strip() in PAYLOAD_EXPENDABLE


def should_prune_assigned_row(
    *, status: object, job_exists: bool, updated_at: datetime | None, cutoff: datetime
) -> bool:
    """Whether a row can leave the assignee's queue.

    Live work (``New``, ``Filled``, ``Flagged``) is kept whatever its age; only
    finished rows age out, and orphans go immediately.
    """
    if not job_exists:
        return True
    text = (str(status) if status is not None else "").strip()
    if text in ("New", "Filled", "Flagged"):
        return False
    return _aged_out(updated_at, cutoff)
