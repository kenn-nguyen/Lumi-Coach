"""The tailor pipeline links its result back to the tracker job it was started from."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.service.test_tailor import (
    MOCK_MASTER_RESUME,
    MOCK_P1_OUTPUT,
    MOCK_P2_OUTPUT,
    MOCK_P3_OUTPUT,
)


def _mock_db() -> MagicMock:
    mock_db = MagicMock()
    mock_db.get_resume.return_value = {
        **MOCK_MASTER_RESUME,
        "tailor_job": {"status": "running", "job_id": "tj_1"},
    }
    mock_db.get_master_resume.return_value = MOCK_MASTER_RESUME
    mock_db.create_job.return_value = {"job_id": "job-1"}
    mock_db.create_resume.return_value = {"resume_id": "tailored-1"}
    return mock_db


async def _run(mock_db: MagicMock, link: MagicMock, **kwargs) -> None:
    from app.services.tailor import run_tailor_pipeline

    with patch("app.services.tailor.db", mock_db), patch(
        "app.services.tailor.llm.complete",
        new_callable=AsyncMock,
        side_effect=[MOCK_P1_OUTPUT, MOCK_P2_OUTPUT, MOCK_P3_OUTPUT],
    ), patch("app.tracker.tailor_link.link_tailored_resume", link):
        await run_tailor_pipeline(
            resume_id="master-1",
            user_id="user-1",
            jd_url=None,
            jd_text="We need a Python engineer with 5+ years.",
            prompt_profile_id="profile2",
            llm_config=MagicMock(),
            apify_api_key=None,
            **kwargs,
        )


def _final_status(mock_db: MagicMock) -> str:
    for call in reversed(mock_db.update_resume.call_args_list):
        updates = call.kwargs.get("updates") or (call.args[1] if len(call.args) > 1 else {})
        if "tailor_job" in updates:
            return updates["tailor_job"]["status"]
    raise AssertionError("tailor_job was never written")


@pytest.mark.asyncio
async def test_finished_run_links_the_resume_to_its_tracker_job():
    mock_db, link = _mock_db(), MagicMock(return_value=True)

    await _run(mock_db, link, tracker_link=("owner", "4445865183"))

    link.assert_called_once_with("owner", "4445865183", "tailored-1")
    assert _final_status(mock_db) == "completed"


@pytest.mark.asyncio
async def test_run_without_a_tracker_job_links_nothing():
    mock_db, link = _mock_db(), MagicMock()

    await _run(mock_db, link)

    link.assert_not_called()


@pytest.mark.asyncio
async def test_a_failed_link_does_not_fail_the_run():
    mock_db, link = _mock_db(), MagicMock(side_effect=RuntimeError("tracker db down"))

    await _run(mock_db, link, tracker_link=("owner", "4445865183"))

    assert _final_status(mock_db) == "completed"
