"""Integration tests for health and status endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.llm import LLMConfig
from app.main import app
from app.security import AuthenticatedUser, require_current_user


@pytest.fixture
def client():
    """Async HTTP client for testing FastAPI endpoints."""
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


class TestHealthEndpoint:
    """GET /api/v1/health"""

    @patch("app.routers.health.check_llm_health", new_callable=AsyncMock)
    async def test_health_returns_healthy(self, mock_health, client):
        mock_health.return_value = {
            "healthy": True,
            "provider": "openai",
            "model": "gpt-4",
        }
        async with client:
            resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"

    @patch("app.routers.health.check_llm_health", new_callable=AsyncMock)
    async def test_health_returns_degraded(self, mock_health, client):
        mock_health.return_value = {
            "healthy": False,
            "provider": "openai",
            "model": "gpt-4",
            "error_code": "api_key_missing",
        }
        async with client:
            resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "degraded"


class TestStatusEndpoint:
    """GET /api/v1/status"""

    @patch("app.routers.health.db")
    @patch("app.routers.health.check_llm_health", new_callable=AsyncMock)
    @patch("app.routers.health.get_server_llm_config")
    @patch("app.routers.health.get_llm_config")
    async def test_status_ready(self, mock_config, mock_server_config, mock_health, mock_db, client):
        mock_config.return_value = LLMConfig(
            provider="openai",
            model="gpt-4",
            api_key="sk-test",
            api_base=None,
            is_user_config=True,
        )
        mock_server_config.return_value = LLMConfig(
            provider="gemini",
            model="gemini-2.5-flash-lite",
            api_key="server-key",
            api_base=None,
            is_user_config=False,
        )
        mock_health.return_value = {"healthy": True}
        mock_db.get_user_llm_config.return_value = {
            "user_id": "user-123",
            "provider": "openai",
            "model": "gpt-4",
            "api_base": None,
            "encrypted_api_key": "fernet:encrypted",
        }
        mock_db.get_stats.return_value = {
            "total_resumes": 1,
            "total_jobs": 0,
            "total_improvements": 0,
            "has_master_resume": True,
        }
        async with client:
            resp = await client.get("/api/v1/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ready"
        assert data["llm_healthy"] is True
        assert data["has_user_api_key"] is True
        assert data["free_llm_available"] is True
        assert data["using_free_llm"] is False
        assert data["has_master_resume"] is True

    @patch("app.routers.health.db")
    @patch("app.routers.health.check_llm_health", new_callable=AsyncMock)
    @patch("app.routers.health.get_server_llm_config")
    @patch("app.routers.health.get_llm_config")
    async def test_status_setup_required(
        self,
        mock_config,
        mock_server_config,
        mock_health,
        mock_db,
        client,
    ):
        mock_config.return_value = LLMConfig(
            provider="openai",
            model="gpt-4",
            api_key="",
            api_base=None,
        )
        mock_server_config.return_value = LLMConfig(
            provider="gemini",
            model="gemini-2.5-flash-lite",
            api_key="",
            api_base=None,
            is_user_config=False,
        )
        mock_health.return_value = {"healthy": False}
        mock_db.get_user_llm_config.return_value = None
        mock_db.get_stats.return_value = {
            "total_resumes": 0,
            "total_jobs": 0,
            "total_improvements": 0,
            "has_master_resume": False,
        }
        async with client:
            resp = await client.get("/api/v1/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "setup_required"
        assert data["llm_configured"] is False
        assert data["free_llm_available"] is False
        assert data["using_free_llm"] is False

    @patch("app.routers.health.db")
    @patch("app.routers.health.check_llm_health", new_callable=AsyncMock)
    @patch("app.routers.health.get_server_llm_config")
    @patch("app.routers.health.get_llm_config")
    async def test_status_uses_free_llm_when_user_key_missing(
        self,
        mock_config,
        mock_server_config,
        mock_health,
        mock_db,
        client,
    ):
        free_config = LLMConfig(
            provider="gemini",
            model="gemini-2.5-flash-lite",
            api_key="server-key",
            api_base=None,
            is_user_config=False,
        )
        mock_config.return_value = free_config
        mock_server_config.return_value = free_config
        mock_health.return_value = {"healthy": True}
        mock_db.get_user_llm_config.return_value = {
            "user_id": "user-123",
            "provider": "openai",
            "model": "gpt-4",
            "api_base": None,
            "encrypted_api_key": None,
        }
        mock_db.get_stats.return_value = {
            "total_resumes": 1,
            "total_jobs": 0,
            "total_improvements": 0,
            "has_master_resume": True,
        }

        async with client:
            resp = await client.get("/api/v1/status")

        assert resp.status_code == 200
        data = resp.json()
        assert data["llm_configured"] is True
        assert data["has_user_api_key"] is False
        assert data["free_llm_available"] is True
        assert data["using_free_llm"] is True
        assert data["free_llm_provider"] == "gemini"
        assert data["free_llm_model"] == "gemini-2.5-flash-lite"
