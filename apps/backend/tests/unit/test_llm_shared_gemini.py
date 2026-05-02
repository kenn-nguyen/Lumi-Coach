"""Tests for shared Gemini fallback error classification."""

from unittest.mock import patch

import pytest

from app.llm import (
    LLMConfig,
    SharedGeminiFallbackLimitError,
    get_server_llm_config,
    get_llm_config,
    raise_if_shared_gemini_fallback_limit,
)


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
