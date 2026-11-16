"""The job detail says when the stored description was cut at the storage cap."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.tracker import repo
from app.tracker.fingerprint import truncate
from app.tracker.models import TrackerJob
from app.tracker.normalize import JD_LIMIT


def _detail(jd_text: str | None) -> dict:
    job = MagicMock(user_id="owner")
    doc = None if jd_text is None else SimpleNamespace(jd_text=jd_text, listed_at=None)
    session = MagicMock()
    session.get.side_effect = lambda model, _id: job if model is TrackerJob else doc
    return repo.get_job(session, user_id="owner", job_id="j1")


def test_a_description_cut_at_the_cap_is_flagged():
    stored = truncate("x" * (JD_LIMIT + 5_000), JD_LIMIT)
    assert len(stored) == JD_LIMIT
    assert _detail(stored)["jd_truncated"] is True


@pytest.mark.parametrize("jd_text", ["A short posting.", "", None])
def test_a_complete_or_missing_description_is_not(jd_text):
    assert _detail(jd_text)["jd_truncated"] is False
