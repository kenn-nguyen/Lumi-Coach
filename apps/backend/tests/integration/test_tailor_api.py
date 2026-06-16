"""Integration tests for tailor pipeline endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.security import AuthenticatedUser, require_current_user

MOCK_RESUME = {
    "resume_id": "resume-1",
    "content": "# John Doe",
    "is_master": True,
    "tailor_job": None,
    "processed_data": {},
}


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture(autouse=True)
def override_auth():
    async def _fake_user():
        return AuthenticatedUser(
            user_id="user-123",
            email="tester@example.com",
            name="Test User",
        )

    app.dependency_overrides[require_current_user] = _fake_user
    yield
    app.dependency_overrides.pop(require_current_user, None)


class TestStartTailor:
    """POST /api/v1/resumes/{resume_id}/tailor"""

    @patch("app.routers.tailor.db")
    @patch("app.routers.tailor.get_llm_config")
    async def test_start_returns_running(self, mock_llm_cfg, mock_db, client):
        mock_db.get_resume.return_value = MOCK_RESUME
        mock_db.list_resumes.return_value = [MOCK_RESUME]
        mock_db.update_resume.return_value = None
        mock_llm_cfg.return_value = MagicMock()

        with patch("app.services.tailor.run_tailor_pipeline", new_callable=AsyncMock):
            async with client:
                resp = await client.post(
                    "/api/v1/resumes/resume-1/tailor",
                    json={"prompt_profile_id": "profile2", "jd_text": "We need a Python engineer"},
                )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "running"
        assert "job_id" in data

    @patch("app.routers.tailor.db")
    async def test_start_404_when_resume_missing(self, mock_db, client):
        mock_db.get_resume.return_value = None

        async with client:
            resp = await client.post(
                "/api/v1/resumes/bad-id/tailor",
                json={"prompt_profile_id": "profile2", "jd_text": "JD text"},
            )

        assert resp.status_code == 404

    @patch("app.routers.tailor.db")
    async def test_start_409_when_job_already_running(self, mock_db, client):
        running_resume = {
            **MOCK_RESUME,
            "resume_id": "other-resume",
            "tailor_job": {"status": "running", "job_id": "tj_existing"},
        }
        mock_db.get_resume.return_value = MOCK_RESUME
        mock_db.list_resumes.return_value = [MOCK_RESUME, running_resume]

        async with client:
            resp = await client.post(
                "/api/v1/resumes/resume-1/tailor",
                json={"prompt_profile_id": "profile2", "jd_text": "JD text"},
            )

        assert resp.status_code == 409

    @patch("app.routers.tailor.db")
    async def test_start_rejects_invalid_profile(self, mock_db, client):
        mock_db.get_resume.return_value = MOCK_RESUME

        async with client:
            resp = await client.post(
                "/api/v1/resumes/resume-1/tailor",
                json={"prompt_profile_id": "profile99", "jd_text": "JD text"},
            )

        assert resp.status_code == 422


class TestTailorStatus:
    """GET /api/v1/resumes/{resume_id}/tailor/status"""

    @patch("app.routers.tailor.db")
    async def test_status_returns_running(self, mock_db, client):
        mock_db.get_resume.return_value = {
            **MOCK_RESUME,
            "tailor_job": {
                "job_id": "tj_1",
                "status": "running",
                "progress_stage": "prompt1",
                "prompt_profile_id": "profile2",
                "started_at": "2026-06-15T10:00:00Z",
                "completed_at": None,
                "tailored_resume_id": None,
                "error_message": None,
            },
        }

        async with client:
            resp = await client.get("/api/v1/resumes/resume-1/tailor/status")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "running"
        assert data["progress_stage"] == "prompt1"

    @patch("app.routers.tailor.db")
    async def test_status_404_when_no_job(self, mock_db, client):
        mock_db.get_resume.return_value = MOCK_RESUME  # tailor_job is None

        async with client:
            resp = await client.get("/api/v1/resumes/resume-1/tailor/status")

        assert resp.status_code == 404


class TestCancelTailor:
    """POST /api/v1/resumes/{resume_id}/tailor/cancel"""

    @patch("app.routers.tailor.db")
    async def test_cancel_running_job(self, mock_db, client):
        mock_db.get_resume.return_value = {
            **MOCK_RESUME,
            "tailor_job": {"status": "running", "job_id": "tj_1"},
        }
        mock_db.update_resume.return_value = None

        async with client:
            resp = await client.post("/api/v1/resumes/resume-1/tailor/cancel")

        assert resp.status_code == 200
        assert resp.json()["message"] == "Job canceled."

    @patch("app.routers.tailor.db")
    async def test_cancel_409_when_not_running(self, mock_db, client):
        mock_db.get_resume.return_value = {
            **MOCK_RESUME,
            "tailor_job": {"status": "completed", "job_id": "tj_1"},
        }

        async with client:
            resp = await client.post("/api/v1/resumes/resume-1/tailor/cancel")

        assert resp.status_code == 409
