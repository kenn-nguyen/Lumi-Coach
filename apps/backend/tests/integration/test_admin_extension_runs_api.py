"""Integration tests for admin extension run endpoints."""

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
            user_id="admin-user",
            email="kenn.nguyen@aya.yale.edu",
            name="Admin User",
        )

    app.dependency_overrides[require_current_user] = _fake_user
    yield
    app.dependency_overrides.pop(require_current_user, None)


@patch("app.routers.admin.db")
async def test_list_extension_runs_requires_admin_email(mock_db, client):
    async def _non_admin_user():
        return AuthenticatedUser(
            user_id="user-123",
            email="tester@example.com",
            name="Test User",
        )

    app.dependency_overrides[require_current_user] = _non_admin_user

    async with client:
        response = await client.get("/api/v1/admin/extension-runs")

    assert response.status_code == 403
    mock_db.list_extension_runs_for_admin.assert_not_called()


@patch("app.routers.admin.db")
async def test_list_extension_runs_returns_normalized_items(mock_db, client):
    mock_db.list_extension_runs_for_admin.return_value = {
        "items": [
            {
                "user_id": "user-123",
                "user_email": "kenn.nguyen@aya.yale.edu",
                "run_id": "run-123",
                "status": "generated",
                "company": "GBG Plc",
                "title": "Senior Product Manager",
                "prompt_setup": {
                    "prompt_profile_id": "profile2",
                    "prompt1_version_id": "aaaa1111",
                    "prompt2_version_id": "bbbb2222",
                    "prompt3_version_id": "cccc3333",
                    "system_prompt_version_id": "dddd4444",
                },
                "created_at": "2026-05-13T12:00:00Z",
                "updated_at": "2026-05-13T12:00:00Z",
            }
        ],
        "total": 1,
    }

    async with client:
        response = await client.get(
            "/api/v1/admin/extension-runs",
            params={"status": "generated", "prompt_profile_id": "profile2"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["run_id"] == "run-123"
    assert payload["items"][0]["prompt_setup"]["prompt_profile_id"] == "profile2"
    assert payload["items"][0]["summary"] == {}
    assert payload["items"][0]["prompt_artifacts"] is None
    mock_db.list_extension_runs_for_admin.assert_called_once_with(
        status="generated",
        prompt_profile_id="profile2",
        search=None,
        date_from=None,
        date_to=None,
        limit=5,
        offset=0,
        include_prompt_artifacts=False,
        scan_limit=100,
    )


@patch("app.routers.admin.db")
async def test_export_and_item_routes_return_json(mock_db, client):
    item = {
        "user_id": "user-123",
        "user_email": "kenn.nguyen@aya.yale.edu",
        "run_id": "run-123",
        "status": "generated",
        "summary": {"prompt_profile_id": "profile1"},
        "prompt_setup": {"prompt_profile_id": "profile1"},
        "prompt_artifacts": {"prompt1": {"input": "Prompt 1 input"}},
        "created_at": "2026-05-13T12:00:00Z",
        "updated_at": "2026-05-13T12:00:00Z",
    }
    mock_db.get_extension_run_for_admin.return_value = item
    mock_db.list_extension_runs_for_admin.return_value = {
        "items": [item],
        "total": 1,
    }

    async with client:
        item_response = await client.get(
            "/api/v1/admin/extension-runs/item",
            params={"user_id": "user-123", "run_id": "run-123"},
        )
        export_response = await client.get("/api/v1/admin/extension-runs/export")

    assert item_response.status_code == 200
    assert item_response.json()["prompt_artifacts"]["prompt1"]["input"] == "Prompt 1 input"
    assert export_response.status_code == 200
    assert export_response.headers["content-type"].startswith("application/json")
    assert "attachment; filename=\"extension-runs-export.json\"" in export_response.headers[
        "content-disposition"
    ]
