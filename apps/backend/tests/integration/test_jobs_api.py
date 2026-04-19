"""Integration tests for job description endpoints."""

from unittest.mock import patch, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.security import AuthenticatedUser, require_current_user


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


class TestJobUpload:
    """POST /api/v1/jobs/upload"""

    @patch("app.routers.jobs.db")
    async def test_upload_single_job(self, mock_db, client):
        mock_db.create_job.return_value = {
            "job_id": "job-123",
            "content": "Senior Engineer at TechCorp",
            "created_at": "2026-01-01T00:00:00Z",
        }
        async with client:
            resp = await client.post("/api/v1/jobs/upload", json={
                "job_descriptions": ["Senior Engineer at TechCorp"],
                "resume_id": None,
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "data successfully processed"
        assert len(data["job_id"]) == 1

    @patch("app.routers.jobs.db")
    async def test_upload_multiple_jobs(self, mock_db, client):
        mock_db.create_job.side_effect = [
            {"job_id": f"job-{i}", "content": f"JD {i}", "created_at": "2026-01-01T00:00:00Z"}
            for i in range(3)
        ]
        async with client:
            resp = await client.post("/api/v1/jobs/upload", json={
                "job_descriptions": ["JD 1", "JD 2", "JD 3"],
            })
        assert resp.status_code == 200
        assert len(resp.json()["job_id"]) == 3

    async def test_upload_empty_list_returns_400(self, client):
        async with client:
            resp = await client.post("/api/v1/jobs/upload", json={
                "job_descriptions": [],
            })
        assert resp.status_code == 400

    async def test_upload_empty_string_returns_400(self, client):
        async with client:
            resp = await client.post("/api/v1/jobs/upload", json={
                "job_descriptions": ["  "],
            })
        assert resp.status_code == 400


class TestGetJob:
    """GET /api/v1/jobs/{job_id}"""

    @patch("app.routers.jobs.db")
    async def test_get_existing_job(self, mock_db, client):
        mock_db.get_job.return_value = {
            "job_id": "job-123",
            "content": "Engineer role",
            "created_at": "2026-01-01T00:00:00Z",
        }
        async with client:
            resp = await client.get("/api/v1/jobs/job-123")
        assert resp.status_code == 200
        assert resp.json()["job_id"] == "job-123"

    @patch("app.routers.jobs.db")
    async def test_get_nonexistent_job_returns_404(self, mock_db, client):
        mock_db.get_job.return_value = None
        async with client:
            resp = await client.get("/api/v1/jobs/nonexistent")
        assert resp.status_code == 404


class TestLinkedInApifyFallback:
    """POST /api/v1/jobs/linkedin-apify-fallback"""

    @patch("app.routers.jobs.fetch_linkedin_job_detail_via_apify")
    async def test_backend_apify_fallback_success(self, mock_fetch, client):
        mock_fetch.return_value = {
            "source": "apify_backend",
            "source_url": "https://www.linkedin.com/jobs/view/4370473767/",
            "title": "Forward Deployed Product Manager",
            "company": "Glean",
            "location": "San Francisco Bay Area",
            "date_posted": "2026-04-15T17:51:38",
            "raw_text": "Job Title: Forward Deployed Product Manager\n\nJob Description:\nAbout Glean",
            "diagnostics": {
                "actor_id": "apimaestro/linkedin-job-detail",
                "item_count": 1,
            },
        }

        async with client:
            resp = await client.post(
                "/api/v1/jobs/linkedin-apify-fallback",
                json={"source_url": "https://www.linkedin.com/jobs/view/4370473767/"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "apify_backend"
        assert data["title"] == "Forward Deployed Product Manager"
        assert data["company"] == "Glean"
        assert "Job Description:" in data["raw_text"]

    @patch("app.routers.jobs.fetch_linkedin_job_detail_via_apify")
    async def test_backend_apify_fallback_unavailable(self, mock_fetch, client):
        mock_fetch.side_effect = RuntimeError("Apify fallback failed with status 403.")

        async with client:
            resp = await client.post(
                "/api/v1/jobs/linkedin-apify-fallback",
                json={"source_url": "https://www.linkedin.com/jobs/view/4370473767/"},
            )

        assert resp.status_code == 503
        assert "fallback" in resp.json()["detail"].lower()
