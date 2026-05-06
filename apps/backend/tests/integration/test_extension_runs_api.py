"""Integration tests for extension run ingest endpoints."""

from unittest.mock import patch

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


@patch("app.routers.extension.db")
async def test_upsert_extension_run_saves_only_sanitized_summary(mock_db, client):
    mock_db.upsert_extension_run.return_value = {
        "run_id": "run-123",
        "status": "generated",
    }

    async with client:
        resp = await client.post(
            "/api/v1/extension/runs",
            json={
                "run_id": "run-123",
                "status": "generated",
                "title": "Senior PM",
                "company": "Acme",
                "location": "Remote",
                "source_url": "https://www.linkedin.com/jobs/view/123/",
                "job_source": "linkedin",
                "resume_id": "resume-123",
                "preview_url": "http://localhost:3000/resumes/resume-123",
                "provider_id": "chatgpt-api",
                "provider_label": "ChatGPT API",
                "generated_at": "2026-05-06T12:00:00Z",
                "total_duration_ms": 12345,
                "prompt1_raw": "must not be accepted",
                "summary": {
                    "job_key": "https://www.linkedin.com/jobs/view/123/",
                    "manual_job_input_used": False,
                    "prompt1_duration_ms": 111,
                    "prompt1_raw": "must not be saved",
                    "prompt3Parsed": {"must": "not be saved"},
                },
                "prompt_artifacts": {
                    "prompt1": {
                        "input": "Prompt 1 input",
                        "raw": "Prompt 1 output",
                        "result": {"analysis": "parsed"},
                    },
                    "prompt3": {
                        "input": "Prompt 3 input",
                        "raw": "Prompt 3 output",
                        "parsed": {"personalInfo": {"name": "Candidate"}},
                    },
                },
            },
        )

    assert resp.status_code == 200
    assert resp.json()["run_id"] == "run-123"

    mock_db.upsert_extension_run.assert_called_once()
    kwargs = mock_db.upsert_extension_run.call_args.kwargs
    assert kwargs["user_id"] == "user-123"
    assert kwargs["run_id"] == "run-123"
    assert kwargs["title"] == "Senior PM"
    assert kwargs["summary"] == {
        "job_key": "https://www.linkedin.com/jobs/view/123/",
        "manual_job_input_used": False,
        "prompt1_duration_ms": 111,
    }
    assert kwargs["prompt_artifacts"] == {
        "prompt1": {
            "input": "Prompt 1 input",
            "raw": "Prompt 1 output",
            "result": {"analysis": "parsed"},
        },
        "prompt3": {
            "input": "Prompt 3 input",
            "raw": "Prompt 3 output",
            "parsed": {"personalInfo": {"name": "Candidate"}},
        },
    }


@patch("app.routers.extension.db")
async def test_upsert_extension_run_rejects_missing_run_id(mock_db, client):
    async with client:
        resp = await client.post(
            "/api/v1/extension/runs",
            json={
                "status": "generated",
            },
        )

    assert resp.status_code == 422
    mock_db.upsert_extension_run.assert_not_called()
