"""Each tailor stage gets its Claude effort unless the user's stage config sets its own."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.llm import LLMConfig
from app.services.tailor import _resolve_stage_llm_config, _with_claude_stage_defaults

OPUS = LLMConfig(provider="anthropic", model="claude-opus-5-5", api_key="k")


@pytest.mark.parametrize(
    "stage, effort, max_tokens, timeout",
    [("prompt1", "low", 32000, 600), ("prompt2", "medium", 64000, 900), ("prompt3", "low", 32000, 600)],
)
def test_claude_stage_settings(stage, effort, max_tokens, timeout):
    kwargs = _with_claude_stage_defaults(stage, OPUS, {})
    assert kwargs == {
        "thinking": {"type": "adaptive"},
        "output_config": {"effort": effort},
        "max_tokens": max_tokens,
        "timeout": timeout,
    }


def test_a_stage_config_with_its_own_thinking_wins():
    own = {"thinking": {"type": "adaptive"}, "output_config": {"effort": "max"}}
    assert _with_claude_stage_defaults("prompt2", OPUS, dict(own)) == own


def test_a_stage_config_max_tokens_is_kept():
    kwargs = _with_claude_stage_defaults("prompt2", OPUS, {"max_tokens": 50000})
    assert kwargs["max_tokens"] == 50000 and kwargs["output_config"] == {"effort": "medium"}


@pytest.mark.parametrize(
    "config",
    [
        LLMConfig(provider="anthropic", model="claude-sonnet-4-5-20250929", api_key="k"),
        LLMConfig(provider="gemini", model="gemini-3.5-flash", api_key="k"),
        LLMConfig(provider="vertex_ai", model="gemini-3.5-flash", api_key="", vertex_project="p"),
    ],
)
def test_older_claude_and_other_providers_get_nothing(config):
    assert _with_claude_stage_defaults("prompt2", config, {}) == {}


def test_resolver_applies_the_defaults_when_no_stage_config():
    with patch("app.services.tailor.get_stage_provider_config", return_value=(None, None, {})), patch(
        "app.services.tailor._get_stage_overrides_from_file", return_value=(None, {})
    ):
        config, kwargs = _resolve_stage_llm_config("prompt2", OPUS, "user-1")
    assert config is OPUS
    assert kwargs["output_config"] == {"effort": "medium"}
