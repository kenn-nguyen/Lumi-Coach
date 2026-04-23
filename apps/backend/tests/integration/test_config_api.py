"""Integration tests for configuration endpoints."""

from unittest.mock import patch, AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.security import AuthenticatedUser, require_current_user


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestLlmConfig:
    """GET/PUT /api/v1/config/llm-api-key"""

    @patch("app.routers.config._load_config")
    async def test_get_llm_config(self, mock_load, client):
        mock_load.return_value = {
            "provider": "openai",
            "model": "gpt-4",
            "api_key": "sk-1234567890abcdef",
            "api_base": None,
        }
        async with client:
            resp = await client.get("/api/v1/config/llm-api-key")
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "openai"
        # API key should be masked
        assert "****" in data["api_key"] or "*" in data["api_key"]


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

    @patch("app.routers.config._save_config")
    @patch("app.routers.config._load_config")
    async def test_put_llm_config(self, mock_load, mock_save, client):
        mock_load.return_value = {}
        async with client:
            resp = await client.put("/api/v1/config/llm-api-key", json={
                "provider": "anthropic",
                "model": "claude-3-sonnet",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "anthropic"


class TestLlmTest:
    """POST /api/v1/config/llm-test"""

    @patch("app.routers.config.check_llm_health", new_callable=AsyncMock)
    @patch("app.routers.config._load_config")
    async def test_connection_test_success(self, mock_load, mock_health, client):
        mock_load.return_value = {"provider": "openai", "model": "gpt-4", "api_key": "sk-test"}
        mock_health.return_value = {
            "healthy": True,
            "provider": "openai",
            "model": "gpt-4",
            "test_prompt": "Hi",
            "model_output": "Hello!",
        }
        async with client:
            resp = await client.post("/api/v1/config/llm-test")
        assert resp.status_code == 200
        assert resp.json()["healthy"] is True

    @patch("app.routers.config.check_llm_health", new_callable=AsyncMock)
    @patch("app.routers.config._load_config")
    async def test_connection_test_failure(self, mock_load, mock_health, client):
        mock_load.return_value = {}
        mock_health.return_value = {
            "healthy": False,
            "error_code": "api_key_missing",
        }
        async with client:
            resp = await client.post("/api/v1/config/llm-test")
        assert resp.status_code == 200
        assert resp.json()["healthy"] is False


class TestFeatureConfig:
    """GET/PUT /api/v1/config/features"""

    @patch("app.routers.config._load_config")
    async def test_get_features(self, mock_load, client):
        mock_load.return_value = {
            "enable_cover_letter": True,
            "enable_outreach_message": False,
            "preserve_generated_resume_facts": True,
        }
        async with client:
            resp = await client.get("/api/v1/config/features")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enable_cover_letter"] is True
        assert data["enable_outreach_message"] is False
        assert data["preserve_generated_resume_facts"] is True

    @patch("app.routers.config._save_config")
    @patch("app.routers.config._load_config")
    async def test_put_features(self, mock_load, mock_save, client):
        mock_load.return_value = {}
        async with client:
            resp = await client.put("/api/v1/config/features", json={
                "enable_cover_letter": True,
                "preserve_generated_resume_facts": False,
            })
        assert resp.status_code == 200
        assert resp.json()["enable_cover_letter"] is True
        assert resp.json()["preserve_generated_resume_facts"] is False


class TestLanguageConfig:
    """GET/PUT /api/v1/config/language"""

    @patch("app.routers.config._load_config")
    async def test_get_language(self, mock_load, client):
        mock_load.return_value = {"ui_language": "en", "content_language": "es"}
        async with client:
            resp = await client.get("/api/v1/config/language")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ui_language"] == "en"
        assert data["content_language"] == "es"
        assert "en" in data["supported_languages"]

    @patch("app.routers.config._save_config")
    @patch("app.routers.config._load_config")
    async def test_put_invalid_language_returns_400(self, mock_load, mock_save, client):
        mock_load.return_value = {}
        async with client:
            resp = await client.put("/api/v1/config/language", json={
                "ui_language": "invalid_lang",
            })
        assert resp.status_code == 400


class TestResetDatabase:
    """POST /api/v1/config/reset"""

    @patch("app.routers.config.db")
    async def test_reset_with_correct_token(self, mock_db, client):
        async with client:
            resp = await client.post("/api/v1/config/reset", json={
                "confirm": "RESET_ALL_DATA",
            })
        assert resp.status_code == 200
        mock_db.reset_database.assert_called_once()

    async def test_reset_without_token_returns_400(self, client):
        async with client:
            resp = await client.post("/api/v1/config/reset", json={
                "confirm": "wrong_token",
            })
        assert resp.status_code == 400

    async def test_reset_missing_body_returns_422(self, client):
        async with client:
            resp = await client.post("/api/v1/config/reset")
        assert resp.status_code == 422


class TestExtensionPromptSync:
    """POST /api/v1/config/extension-prompts/sync"""

    @patch("app.routers.config._get_extension_prompt_artifacts")
    async def test_returns_only_changed_artifacts(self, mock_artifacts, client):
        mock_artifacts.return_value = {
            "prompt1.template": "PROMPT 1",
            "prompt1.output_contract": "CONTRACT 1",
            "system.guardrails": "SYSTEM",
        }

        async with client:
            resp = await client.post(
                "/api/v1/config/extension-prompts/sync",
                json={
                    "manifest": {
                        "prompt1.template": "stale-hash",
                        "removed.key": "old-hash",
                    },
                },
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["changed"] == {
            "prompt1.template": "PROMPT 1",
            "prompt1.output_contract": "CONTRACT 1",
            "system.guardrails": "SYSTEM",
        }
        assert data["removed"] == ["removed.key"]
        assert set(data["manifest"].keys()) == {
            "prompt1.template",
            "prompt1.output_contract",
            "system.guardrails",
        }

    @patch("app.routers.config._get_extension_prompt_artifacts")
    async def test_returns_empty_changed_when_manifest_matches(
        self, mock_artifacts, client
    ):
        mock_artifacts.return_value = {
            "prompt1.template": "PROMPT 1",
        }

        with patch("app.routers.config._hash_prompt_artifact", return_value="same-hash"):
            async with client:
                resp = await client.post(
                    "/api/v1/config/extension-prompts/sync",
                    json={"manifest": {"prompt1.template": "same-hash"}},
                )

        assert resp.status_code == 200
        data = resp.json()
        assert data["changed"] == {}
        assert data["removed"] == []
        assert data["manifest"] == {"prompt1.template": "same-hash"}
