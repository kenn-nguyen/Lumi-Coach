"""Status, owner, action and priority vocabulary.

Ported verbatim from the Apps Script tracker (sheet.gs L23-60). The labels are the
product's vocabulary and are deliberately unchanged by the port: users already know
them and the Help tab documents them.
"""

from __future__ import annotations

# --- statuses -----------------------------------------------------------------
STATUS_NEW = "New"
STATUS_NETWORKING = "Networking"
STATUS_FILLED = "Filled"
STATUS_SUBMITTED = "Submitted"
STATUS_SKIP = "Skip"
STATUS_SKIP_AUTO = "Skip (auto)"
STATUS_CLOSED = "Closed"
STATUS_FLAGGED = "Flagged"

STATUS_OPTIONS: tuple[str, ...] = (
    STATUS_NEW,
    STATUS_NETWORKING,
    STATUS_FILLED,
    STATUS_SUBMITTED,
    STATUS_SKIP,
    STATUS_SKIP_AUTO,
    STATUS_CLOSED,
    STATUS_FLAGGED,
)

# Display order in the queue: what needs a human first, dead rows last.
STATUS_SORT_ORDER: dict[str, int] = {
    STATUS_NETWORKING: 0,
    STATUS_FILLED: 1,
    STATUS_FLAGGED: 2,
    STATUS_NEW: 3,
    STATUS_SUBMITTED: 4,
    STATUS_SKIP: 5,
    STATUS_SKIP_AUTO: 5,
    STATUS_CLOSED: 6,
}

# Statuses the assignee may set on their own rows (the Assigned sheet's dropdown).
ASSIGNEE_STATUS_OPTIONS: tuple[str, ...] = (
    STATUS_NEW,
    STATUS_FILLED,
    STATUS_SUBMITTED,
    STATUS_FLAGGED,
)

#: Statuses that mean the application has not gone out yet. Moving a row to one of
#: these takes back a submission, so the submitted-on stamp must go with it — but
#: only for these: ``Closed`` and ``Flagged`` can legitimately follow a submission,
#: and there the date is the record of having applied.
PRE_SUBMISSION_STATUSES: frozenset[str] = frozenset(
    {STATUS_NEW, STATUS_NETWORKING, STATUS_FILLED}
)


# --- owners -------------------------------------------------------------------
OWNER_ME = "Me"
OWNER_ASSIGNEE = "Assignee"
OWNER_ASSIGNEE_AUTO = "Assignee (auto)"

#: ``Assignee`` is a manual delegation and the routing rules never touch it.
#: ``Assignee (auto)`` was set by the rules, so the rules may re-evaluate it later.
#: Only the rules ever write the ``(auto)`` value.
OWNER_OPTIONS: tuple[str, ...] = (OWNER_ME, OWNER_ASSIGNEE, OWNER_ASSIGNEE_AUTO)

ACTION_FILL_SUBMIT = "Fill & Submit"
ACTION_FILL_ONLY = "Fill Only"
ACTION_OPTIONS: tuple[str, ...] = (ACTION_FILL_SUBMIT, ACTION_FILL_ONLY)

# --- priority -----------------------------------------------------------------
PRIORITY_OPTIONS: tuple[str, ...] = tuple(f"P{n:02d}" for n in range(1, 11))

#: P01-P10 plus the pre-0.4 A/B/C/SKIP labels, which still appear on old rows.
PRIORITY_SORT_ORDER: dict[str, int] = {
    **{f"P{n:02d}": n - 1 for n in range(1, 11)},
    "A": 0,
    "B": 4,
    "C": 6,
    "SKIP": 9,
}

# --- US visa sponsorship signal ----------------------------------------------
VISA_OPTIONS: tuple[str, ...] = (
    "Yes (100%)",
    "Likely (90%)",
    "Possible (70%)",
    "Unclear (50%)",
    "US required (40%)",
    "Unlikely (20%)",
    "No (0%)",
)
VISA_DEFAULT = "Unclear (50%)"
VISA_NO = "No (0%)"


def _text(value: object) -> str:
    """Sheet cells arrive as str, number, None or datetime; normalise to stripped text."""
    if value is None:
        return ""
    return str(value).strip()


def is_assignee(owner: object) -> bool:
    """True for both the manual and the rules-set assignee values."""
    return _text(owner) in (OWNER_ASSIGNEE, OWNER_ASSIGNEE_AUTO)


def is_skip(status: object) -> bool:
    """True for a manual ``Skip`` and a rules-set ``Skip (auto)``.

    The difference between them matters only to the routing rules, which may lift
    ``Skip (auto)`` but never a skip a human set.
    """
    return _text(status) in (STATUS_SKIP, STATUS_SKIP_AUTO)


def is_dead_status(status: object) -> bool:
    """Out of the active queue: either skip, or closed.

    ``Closed`` differs from ``Skip`` only in that a fresh re-post reopens it, which
    is handled when merging rather than here.
    """
    return is_skip(status) or _text(status) == STATUS_CLOSED


def status_sort_rank(status: object) -> int:
    """Blank counts as ``New``; anything unrecognised sorts after every known status."""
    normalized = _text(status) or STATUS_NEW
    if normalized in STATUS_SORT_ORDER:
        return STATUS_SORT_ORDER[normalized]
    return len(STATUS_OPTIONS) + 1


def priority_sort_rank(priority: object) -> int:
    """P01 sorts first. Unknown labels sort after P10."""
    return PRIORITY_SORT_ORDER.get(_text(priority).upper(), 10)
