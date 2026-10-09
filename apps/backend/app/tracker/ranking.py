"""Queue ordering.

The sheet sorts by a single fixed-width text key so a native spreadsheet sort can
reproduce the ranking (sheet.gs `_buildJobSortKey`, L1275). The web app keeps the
same key: it lets Postgres do `ORDER BY sort_key` with one index, and it means a
migrated row sorts identically to how it sorted in the sheet.

Key layout, concatenated, each part zero-padded::

    SS PP TTTTTTTTTTTTT NNNN
    |  |  |             +-- 9999 - score        (higher score first)
    |  |  +---------------- MAX_MS - posted_ms  (newer first)
    |  +--------------------- priority rank     (P01 first)
    +------------------------ status rank       (needs-a-human first)
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from .enums import priority_sort_rank, status_sort_rank

#: Larger than any realistic epoch-ms for decades, which keeps the inverted value
#: exactly 13 digits so the fixed-width key stays sortable as text.
MAX_MS = 9_999_999_999_999

#: The sheet's own timezone (appsscript.json). Naive timestamps coming from sheet
#: cells are wall-clock times in this zone, so they are interpreted in it.
SHEET_TZ = ZoneInfo("America/New_York")


def to_comparable_ms(value: object, tz: ZoneInfo = SHEET_TZ) -> int:
    """Epoch milliseconds for a sheet date cell, or 0 when it cannot be read.

    Mirrors `_toComparableTime` (pipeline.gs L2167): anything unparseable is 0,
    which sorts the row to the bottom of its status/priority band rather than
    failing the whole sort.
    """
    if value is None or value == "":
        return 0

    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        if not text:
            return 0
        try:
            # Sheet exports look like "2026-09-30 13:45:00"; ISO with a "T" or a
            # trailing "Z" also appears in payload-derived dates.
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return 0

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    return int(dt.astimezone(timezone.utc).timestamp() * 1000)


def _pad(n: int, width: int) -> str:
    return str(max(0, int(n))).zfill(width)


def build_sort_key(
    status: object,
    priority: object,
    posted: object,
    imported_at: object,
    score: object,
) -> str:
    """The row's position in the queue, as a sortable fixed-width string.

    ``posted`` is preferred over ``imported_at``: a re-posted role should sort by
    when it was posted, not when this tracker happened to find it.
    """
    recency = to_comparable_ms(posted) or to_comparable_ms(imported_at)
    inv_posted = MAX_MS - max(0, min(recency, MAX_MS))

    try:
        numeric = round(float(score or 0))
    except (TypeError, ValueError):
        numeric = 0
    bounded_score = max(0, min(numeric, 9999))

    return (
        _pad(status_sort_rank(status), 2)
        + _pad(priority_sort_rank(priority), 2)
        + _pad(inv_posted, 13)
        + _pad(9999 - bounded_score, 4)
    )
