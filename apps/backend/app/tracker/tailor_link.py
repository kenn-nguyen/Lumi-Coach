"""Linking a tailored resume back to the tracker job it was made for.

The tailor pipeline runs in the background for minutes, and the user is free to
close the dialog or the tab meanwhile. So the link is written by the pipeline when
it finishes, not by the page that started it.

The tracker belongs to one account (see ``auth``), so a run may only name a
tracker job when the signed-in user is that account.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy.orm import Session

from . import repo
from .api import get_session
from .auth import classify

logger = logging.getLogger(__name__)


@contextmanager
def _tracker_session() -> Iterator[Session]:
    """A tracker DB session outside a request (``get_session`` is a FastAPI dependency)."""
    sessions = get_session()
    session = next(sessions)
    try:
        yield session
    finally:
        sessions.close()


def tracker_user_id_for(email: str) -> str | None:
    """The tracker user id for a signed-in email, or None if it has no tracker access."""
    user = classify(email)
    return user.user_id if user else None


def tracker_job_exists(tracker_user_id: str, job_id: str) -> bool:
    with _tracker_session() as session:
        return repo.get_job(session, user_id=tracker_user_id, job_id=job_id) is not None


def link_tailored_resume(tracker_user_id: str, job_id: str, resume_id: str) -> bool:
    """Record ``resume_id`` on the job, replacing any earlier link. False if the job is gone."""
    with _tracker_session() as session:
        updated = repo.update_job(
            session, user_id=tracker_user_id, job_id=job_id, changes={"resume_file": resume_id}
        )
    if updated is None:
        logger.warning("Tracker job %s no longer exists; resume %s not linked", job_id, resume_id)
        return False
    return True
