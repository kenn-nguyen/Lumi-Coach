"""Keep the tracker's write-tests away from a database holding real work.

Several of these tests edit rows — assigning, submitting, flagging — and restore
them afterwards. A restore is not a transaction: a failure part-way through, or a
test that forgets, leaves the database changed. That is tolerable against a scratch
copy and not tolerable against the database someone is actually using.

So the database must name itself as a test one. Unset means a test database that
may not exist, in which case the database-backed tests skip and the pure ones still
run — never a silent fall back to the development database.
"""

from __future__ import annotations

import os

import pytest

DEFAULT_TEST_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/som_career_coach_test"

#: A database whose name says it is disposable.
SAFE_NAME_MARKERS = ("test", "tmp", "scratch", "ci")


def pytest_configure(config: pytest.Config) -> None:
    url = (os.environ.get("TRACKER_DATABASE_URL") or "").strip()
    if not url:
        os.environ["TRACKER_DATABASE_URL"] = DEFAULT_TEST_URL
        return

    name = url.rsplit("/", 1)[-1].split("?")[0].lower()
    if not any(marker in name for marker in SAFE_NAME_MARKERS):
        raise pytest.UsageError(
            f"TRACKER_DATABASE_URL points at '{name}', which is not named as a test "
            f"database. These tests write to it. Use a disposable copy, e.g.\n"
            f"  TRACKER_DATABASE_URL={DEFAULT_TEST_URL}"
        )
