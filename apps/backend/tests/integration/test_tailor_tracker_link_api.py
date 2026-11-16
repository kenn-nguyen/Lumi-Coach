"""Starting a tailor run for a tracker job: who may, and for which jobs."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from tests.integration.test_tailor_api import MOCK_RESUME, client, override_auth  # noqa: F401

URL = "/api/v1/resumes/resume-1/tailor"
BODY = {"prompt_profile_id": "profile5", "jd_text": "We need a PM", "tracker_job_id": "job-9"}


def _db() -> MagicMock:
    mock_db = MagicMock()
    mock_db.get_resume.return_value = MOCK_RESUME
    return mock_db


@patch("app.routers.tailor.get_llm_config", MagicMock())
async def test_non_owner_cannot_name_a_tracker_job(client):  # noqa: F811
    mock_db = _db()
    with patch("app.routers.tailor.db", mock_db), patch(
        "app.tracker.tailor_link.tracker_user_id_for", return_value=None
    ), patch("app.services.tailor.run_tailor_pipeline", new_callable=AsyncMock) as pipeline:
        async with client:
            resp = await client.post(URL, json=BODY)

    assert resp.status_code == 403
    pipeline.assert_not_called()
    mock_db.update_resume.assert_not_called()


@patch("app.routers.tailor.get_llm_config", MagicMock())
async def test_unknown_tracker_job_is_refused_before_the_run_starts(client):  # noqa: F811
    mock_db = _db()
    with patch("app.routers.tailor.db", mock_db), patch(
        "app.tracker.tailor_link.tracker_user_id_for", return_value="owner"
    ), patch("app.tracker.tailor_link.tracker_job_exists", return_value=False), patch(
        "app.services.tailor.run_tailor_pipeline", new_callable=AsyncMock
    ) as pipeline:
        async with client:
            resp = await client.post(URL, json=BODY)

    assert resp.status_code == 404
    pipeline.assert_not_called()


@patch("app.routers.tailor.get_llm_config", MagicMock())
async def test_owner_run_carries_the_tracker_job_to_the_pipeline(client):  # noqa: F811
    mock_db = _db()
    with patch("app.routers.tailor.db", mock_db), patch(
        "app.tracker.tailor_link.tracker_user_id_for", return_value="owner"
    ), patch("app.tracker.tailor_link.tracker_job_exists", return_value=True), patch(
        "app.services.tailor.run_tailor_pipeline", new_callable=AsyncMock
    ) as pipeline:
        async with client:
            resp = await client.post(URL, json=BODY)

    assert resp.status_code == 200
    assert pipeline.call_args.kwargs["tracker_link"] == ("owner", "job-9")
    seeded = mock_db.update_resume.call_args.args[1]["tailor_job"]
    assert seeded["tracker_job_id"] == "job-9"
