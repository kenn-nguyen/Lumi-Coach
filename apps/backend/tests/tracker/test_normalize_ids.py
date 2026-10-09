"""A posting id must survive the spreadsheet's number formatting."""

from __future__ import annotations

import pytest

from app.tracker.normalize import normalize_job_id


@pytest.mark.parametrize("raw, expected", [
    ("4454136306.0", "4454136306"),   # how openpyxl hands back a numeric cell
    ("4454136306.00", "4454136306"),
    (4454136306.0, "4454136306"),     # the float itself, not yet stringified
    ("4454136306", "4454136306"),     # already clean
    ("  4454136306.0  ", "4454136306"),
    ("", ""),
    (None, ""),
])
def test_float_formatting_is_stripped(raw, expected):
    assert normalize_job_id(raw) == expected


@pytest.mark.parametrize("raw", ["4454136306.5", "abc", "4454136306.0abc", "12.01"])
def test_anything_that_is_not_a_whole_number_is_left_alone(raw):
    """Truncating a real fraction would invent an id rather than repair one."""
    assert normalize_job_id(raw) == str(raw).strip()
