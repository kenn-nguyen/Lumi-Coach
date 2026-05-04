"""Integration tests for configuration endpoints."""

from unittest.mock import patch, AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.llm import LLMConfig
from app.llm_config_crypto import LLMConfigEncryptionError
from app.main import app
from app.security import AuthenticatedUser, require_current_user


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestLlmConfig:
    """GET/PUT /api/v1/config/llm-api-key"""

    @patch("app.routers.config.decrypt_api_key")
    @patch("app.routers.config.get_llm_config")
    @patch("app.routers.config.db")
    async def test_get_llm_config(self, mock_db, mock_get_config, mock_decrypt, client):
        mock_db.get_user_llm_config.return_value = {
            "user_id": "user-123",
            "provider": "openai",
            "model": "gpt-4",
            "api_base": None,
            "encrypted_api_key": "fernet:encrypted",
        }
        mock_get_config.return_value = LLMConfig(
            provider="openai",
            model="gpt-4",
            api_key="sk-1234567890abcdef",
            api_base=None,
        )
        mock_decrypt.return_value = "sk-1234567890abcdef"
        async with client:
            resp = await client.get("/api/v1/config/llm-api-key")
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "openai"
        assert data["is_user_config"] is True
        # API key should be masked
        assert "****" in data["api_key"] or "*" in data["api_key"]

    @patch("app.routers.config.get_llm_config")
    @patch("app.routers.config.db")
    async def test_get_llm_config_empty_user_key_reports_server_fallback(
        self,
        mock_db,
        mock_get_config,
        client,
    ):
        mock_db.get_user_llm_config.return_value = {
            "user_id": "user-123",
            "provider": "openai",
            "model": "gpt-4",
            "api_base": None,
            "encrypted_api_key": None,
        }
        mock_get_config.return_value = LLMConfig(
            provider="gemini",
            model="gemini-2.5-flash-lite",
            api_key="server-key",
            api_base=None,
            is_user_config=False,
        )

        async with client:
            resp = await client.get("/api/v1/config/llm-api-key")

        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "gemini"
        assert data["model"] == "gemini-2.5-flash-lite"
        assert data["api_key"] == ""
        assert data["is_user_config"] is False

    @patch("app.routers.config.check_llm_health", new_callable=AsyncMock)
    @patch("app.routers.config.encrypt_api_key")
    @patch("app.routers.config.get_llm_config")
    @patch("app.routers.config.db")
    async def test_put_llm_config_encrypts_per_user_key(
        self,
        mock_db,
        mock_get_config,
        mock_encrypt,
        mock_health,
        client,
    ):
        mock_db.get_user_llm_config.return_value = None
        mock_get_config.return_value = LLMConfig(
            provider="openai",
            model="gpt-5-nano-2025-08-07",
            api_key="",
            api_base=None,
        )
        mock_encrypt.return_value = "fernet:encrypted"
        mock_health.return_value = {"healthy": False}
        mock_db.upsert_user_llm_config.return_value = {
            "user_id": "user-123",
            "provider": "anthropic",
            "model": "claude-3-sonnet",
            "api_base": None,
            "encrypted_api_key": "fernet:encrypted",
        }

        async with client:
            resp = await client.put(
                "/api/v1/config/llm-api-key",
                json={
                    "provider": "anthropic",
                    "model": "claude-3-sonnet",
                    "api_key": "sk-user-secret",
                },
            )

        assert resp.status_code == 200
        assert resp.json()["provider"] == "anthropic"
        mock_encrypt.assert_called_once_with("sk-user-secret")
        mock_db.upsert_user_llm_config.assert_called_once()
        assert (
            mock_db.upsert_user_llm_config.call_args.kwargs["encrypted_api_key"]
            == "fernet:encrypted"
        )

    @patch("app.routers.config.db")
    async def test_clear_api_keys_without_existing_user_config_is_noop(
        self,
        mock_db,
        client,
    ):
        mock_db.get_user_llm_config.return_value = None

        async with client:
            resp = await client.delete(
                "/api/v1/config/api-keys",
                params={"confirm": "CLEAR_ALL_KEYS"},
            )

        assert resp.status_code == 200
        mock_db.clear_user_llm_api_key.assert_not_called()
        mock_db.upsert_user_llm_config.assert_not_called()

    @patch("app.routers.config.decrypt_api_key")
    @patch("app.routers.config.db")
    async def test_legacy_api_key_status_is_user_scoped(
        self,
        mock_db,
        mock_decrypt,
        client,
    ):
        mock_db.get_user_llm_config.return_value = {
            "user_id": "user-123",
            "provider": "gemini",
            "model": "gemini-3-flash-preview",
            "api_base": None,
            "encrypted_api_key": "fernet:encrypted",
        }
        mock_decrypt.return_value = "AIza-test-secret"

        async with client:
            resp = await client.get("/api/v1/config/api-keys")

        assert resp.status_code == 200
        providers = {item["provider"]: item for item in resp.json()["providers"]}
        assert providers["google"]["configured"] is True
        assert providers["openai"]["configured"] is False

    async def test_legacy_api_key_update_is_rejected(self, client):
        async with client:
            resp = await client.post(
                "/api/v1/config/api-keys",
                json={"openai": "sk-shared-mutation"},
            )

        assert resp.status_code == 410

    @patch("app.routers.config.encrypt_api_key")
    @patch("app.routers.config.get_llm_config")
    @patch("app.routers.config.db")
    async def test_put_llm_config_rejects_missing_encryption_key(
        self,
        mock_db,
        mock_get_config,
        mock_encrypt,
        client,
    ):
        mock_db.get_user_llm_config.return_value = None
        mock_get_config.return_value = LLMConfig(
            provider="openai",
            model="gpt-5-nano-2025-08-07",
            api_key="",
            api_base=None,
        )
        mock_encrypt.side_effect = LLMConfigEncryptionError("missing key")

        async with client:
            resp = await client.put(
                "/api/v1/config/llm-api-key",
                json={"provider": "openai", "model": "gpt-4", "api_key": "sk-test"},
            )

        assert resp.status_code == 500
        mock_db.upsert_user_llm_config.assert_not_called()


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


class TestLlmTest:
    """POST /api/v1/config/llm-test"""

    @patch("app.routers.config.check_llm_health", new_callable=AsyncMock)
    @patch("app.routers.config.get_llm_config")
    async def test_connection_test_success(self, mock_get_config, mock_health, client):
        mock_get_config.return_value = LLMConfig(
            provider="openai",
            model="gpt-4",
            api_key="sk-test",
            api_base=None,
        )
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
    @patch("app.routers.config.get_llm_config")
    async def test_connection_test_failure(self, mock_get_config, mock_health, client):
        mock_get_config.return_value = LLMConfig(
            provider="openai",
            model="gpt-4",
            api_key="",
            api_base=None,
        )
        mock_health.return_value = {
            "healthy": False,
            "error_code": "api_key_missing",
        }
        async with client:
            resp = await client.post("/api/v1/config/llm-test")
        assert resp.status_code == 200
        assert resp.json()["healthy"] is False

    @patch("app.routers.config.check_llm_health", new_callable=AsyncMock)
    @patch("app.routers.config.get_llm_config")
    async def test_connection_test_does_not_reuse_key_for_different_provider(
        self,
        mock_get_config,
        mock_health,
        client,
    ):
        mock_get_config.return_value = LLMConfig(
            provider="openai",
            model="gpt-4",
            api_key="sk-openai",
            api_base=None,
        )
        mock_health.return_value = {"healthy": False}

        async with client:
            resp = await client.post(
                "/api/v1/config/llm-test",
                json={"provider": "anthropic", "model": "claude-3-sonnet"},
            )

        assert resp.status_code == 200
        tested_config = mock_health.call_args.args[0]
        assert tested_config.provider == "anthropic"
        assert tested_config.api_key == ""


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

    @patch("app.routers.config._load_config")
    async def test_get_features_defaults_generation_outputs_off(self, mock_load, client):
        mock_load.return_value = {}
        async with client:
            resp = await client.get("/api/v1/config/features")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enable_cover_letter"] is False
        assert data["enable_outreach_message"] is False

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
        assert resp.json()["enable_outreach_message"] is False
        assert resp.json()["preserve_generated_resume_facts"] is False


class TestOutputConfig:
    """GET/PUT /api/v1/config/output"""

    @patch("app.routers.config._load_config")
    async def test_get_output_defaults_month_year(self, mock_load, client):
        mock_load.return_value = {}
        async with client:
            resp = await client.get("/api/v1/config/output")
        assert resp.status_code == 200
        data = resp.json()
        assert data["default_date_display"] == "month-year"
        assert data["default_fit_one_page"] is True
        assert data["default_template_settings"] == {
            "template": "swiss-single",
            "pageSize": "A4",
            "margins": {"top": 10, "bottom": 10, "left": 10, "right": 10},
            "spacing": {"section": 2, "item": 2, "lineHeight": 2},
            "fontSize": {
                "base": 2,
                "headerScale": 2,
                "headerFont": "serif",
                "bodyFont": "sans-serif",
            },
            "compactMode": False,
            "showContactIcons": False,
            "accentColor": "blue",
            "dateDisplay": "month-year",
            "fitOnePage": True,
        }

    @patch("app.routers.config._load_config")
    async def test_get_output_accepts_month_year(self, mock_load, client):
        mock_load.return_value = {
            "default_date_display": "month-year",
            "default_fit_one_page": False,
        }
        async with client:
            resp = await client.get("/api/v1/config/output")
        assert resp.status_code == 200
        data = resp.json()
        assert data["default_date_display"] == "month-year"
        assert data["default_fit_one_page"] is False
        assert data["default_template_settings"]["fitOnePage"] is False

    @patch("app.routers.config._save_config")
    @patch("app.routers.config._load_config")
    async def test_put_output(self, mock_load, mock_save, client):
        mock_load.return_value = {}
        async with client:
            resp = await client.put(
                "/api/v1/config/output",
                json={
                    "default_date_display": "month-year",
                    "default_fit_one_page": False,
                    "default_template_settings": {
                        "pageSize": "LETTER",
                        "margins": {"top": 12},
                        "fontSize": {"bodyFont": "serif"},
                    },
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["default_date_display"] == "month-year"
        assert data["default_fit_one_page"] is False
        assert data["default_template_settings"]["pageSize"] == "LETTER"
        assert data["default_template_settings"]["margins"] == {
            "top": 12,
            "bottom": 10,
            "left": 10,
            "right": 10,
        }
        assert data["default_template_settings"]["fontSize"]["bodyFont"] == "serif"
        mock_save.assert_called_once_with(
            {
                "default_date_display": "month-year",
                "default_fit_one_page": False,
                "default_template_settings": data["default_template_settings"],
            }
        )

    async def test_put_output_rejects_invalid_template_settings(self, client):
        invalid_payloads = [
            {"default_template_settings": {"pageSize": "LEGAL"}},
            {"default_template_settings": {"margins": {"top": 99}}},
        ]
        async with client:
            for payload in invalid_payloads:
                resp = await client.put("/api/v1/config/output", json=payload)
                assert resp.status_code == 422


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
        assert data["content_language"] == "en"
        assert data["supported_languages"] == ["en"]

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
