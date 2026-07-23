"""Tests for shared Gemini fallback error classification."""

from unittest.mock import patch

import pytest

from app.llm import (
    LLMConfig,
    SharedGeminiFallbackLimitError,
    UserLlmRequestError,
    get_server_llm_config,
    get_llm_config,
    is_llm_config_configured,
    raise_if_shared_gemini_fallback_limit,
    raise_if_user_llm_request_error,
)


def test_user_model_error_names_the_model() -> None:
    config = LLMConfig(
        provider="deepseek", model="deepseek-wrong", api_key="k", is_user_config=True
    )
    with pytest.raises(UserLlmRequestError) as exc:
        raise_if_user_llm_request_error(
            config, RuntimeError("BadRequestError: The model `deepseek-wrong` does not exist")
        )
    assert "deepseek-wrong" in str(exc.value)
    assert "model" in str(exc.value).lower()


def test_user_key_error_is_generic() -> None:
    config = LLMConfig(provider="openai", model="gpt-4o", api_key="k", is_user_config=True)
    with pytest.raises(UserLlmRequestError) as exc:
        raise_if_user_llm_request_error(config, RuntimeError("401 invalid api key"))
    assert "API key" in str(exc.value)


def test_server_config_does_not_raise_user_error() -> None:
    config = LLMConfig(provider="openai", model="gpt-4o", api_key="k", is_user_config=False)
    # No raise for non-user config.
    raise_if_user_llm_request_error(config, RuntimeError("The model `x` does not exist"))


def test_shared_gemini_quota_error_is_rewritten() -> None:
    config = LLMConfig(
        provider="gemini",
        model="gemini-2.5-flash-lite",
        api_key="server-key",
        is_user_config=False,
    )

    with pytest.raises(SharedGeminiFallbackLimitError) as exc_info:
        raise_if_shared_gemini_fallback_limit(
            config,
            RuntimeError("429 Resource exhausted: quota exceeded"),
        )

    assert "Free website mode is busy right now" in str(exc_info.value)


def test_user_gemini_quota_error_is_not_rewritten() -> None:
    config = LLMConfig(
        provider="gemini",
        model="gemini-2.5-flash-lite",
        api_key="user-key",
        is_user_config=True,
    )

    raise_if_shared_gemini_fallback_limit(
        config,
        RuntimeError("429 Resource exhausted: quota exceeded"),
    )


def test_non_gemini_quota_error_is_not_rewritten() -> None:
    config = LLMConfig(
        provider="openai",
        model="gpt-5-nano-2025-08-07",
        api_key="server-key",
        is_user_config=False,
    )

    raise_if_shared_gemini_fallback_limit(config, RuntimeError("429 rate limit"))


def test_empty_user_config_falls_back_to_shared_server_config() -> None:
    user_config = {
        "user_id": "user-123",
        "provider": "openai",
        "model": "gpt-4",
        "api_base": None,
        "encrypted_api_key": None,
    }
    server_config = LLMConfig(
        provider="gemini",
        model="gemini-2.5-flash-lite",
        api_key="server-key",
        is_user_config=False,
    )

    with (
        patch("app.database.db") as mock_db,
        patch("app.llm.get_server_llm_config", return_value=server_config),
    ):
        mock_db.get_user_llm_config.return_value = user_config
        config = get_llm_config("user-123")

    assert config.provider == "gemini"
    assert config.model == "gemini-2.5-flash-lite"
    assert config.api_key == "server-key"
    assert config.is_user_config is False


def test_server_env_key_overrides_legacy_config_file() -> None:
    with (
        patch("app.llm._load_stored_config", return_value={"provider": "ollama"}),
        patch("app.llm.settings.llm_provider", "gemini"),
        patch("app.llm.settings.llm_model", "gemini-2.5-flash-lite"),
        patch("app.llm.settings.llm_api_key", "server-key"),
        patch("app.llm.settings.llm_api_base", None),
    ):
        config = get_server_llm_config()

    assert config.provider == "gemini"
    assert config.model == "gemini-2.5-flash-lite"
    assert config.api_key == "server-key"
    assert config.is_user_config is False


def test_vertex_server_env_overrides_legacy_config_without_api_key() -> None:
    with (
        patch("app.llm._load_stored_config", return_value={"provider": "openai", "api_key": "legacy"}),
        patch("app.llm.settings.llm_provider", "vertex_ai"),
        patch("app.llm.settings.llm_model", "gemini-2.5-flash-lite"),
        patch("app.llm.settings.llm_api_key", ""),
        patch("app.llm.settings.llm_api_base", None),
        patch("app.llm.settings.vertexai_project", "vertex-project-123"),
        patch("app.llm.settings.vertexai_location", "us-central1"),
        patch("app.llm.settings.vertexai_credentials", '{"type":"service_account"}'),
    ):
        config = get_server_llm_config()

    assert config.provider == "vertex_ai"
    assert config.model == "gemini-2.5-flash-lite"
    assert config.api_key == ""
    assert config.vertex_project == "vertex-project-123"
    assert config.vertex_location == "us-central1"
    assert config.vertex_credentials == '{"type":"service_account"}'
    assert config.is_user_config is False


def test_vertex_config_is_considered_configured_without_api_key() -> None:
    config = LLMConfig(
        provider="vertex_ai",
        model="gemini-2.5-flash-lite",
        api_key="",
        vertex_project="vertex-project-123",
        vertex_location="us-central1",
        is_user_config=False,
    )

    assert is_llm_config_configured(config) is True
