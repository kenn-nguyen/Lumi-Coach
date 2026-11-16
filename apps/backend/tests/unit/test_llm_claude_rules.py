"""Requests are shaped to what each Claude model accepts."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app import llm
from app.llm import LLMConfig, _apply_claude_request_rules, claude_model_version


@pytest.mark.parametrize(
    "model, version",
    [
        ("anthropic/claude-opus-5-5", (5, 5)),
        ("claude-sonnet-5", (5, 0)),
        ("claude-fable-5-2", (5, 2)),
        ("claude-opus-4-7", (4, 7)),
        ("claude-sonnet-4-5-20250929", (4, 5)),
        ("claude-opus-4-20250514", (4, 0)),
        ("claude-3-5-sonnet-20241022", None),
        ("gemini-3.5-flash", None),
    ],
)
def test_claude_model_version(model, version):
    assert claude_model_version(model) == version


def test_claude_5_drops_sampling_and_defaults_to_low_effort():
    kwargs = {"temperature": 0.7}
    _apply_claude_request_rules(kwargs, "anthropic", "anthropic/claude-opus-5-5")
    assert kwargs == {"output_config": {"effort": "low"}}


def test_an_explicit_effort_is_kept():
    kwargs = {"thinking": {"type": "adaptive"}, "output_config": {"effort": "high"}, "temperature": 0.7}
    _apply_claude_request_rules(kwargs, "anthropic", "anthropic/claude-opus-5-5")
    assert kwargs == {"thinking": {"type": "adaptive"}, "output_config": {"effort": "high"}}


def test_claude_4_7_drops_sampling_but_sets_no_effort():
    kwargs = {"temperature": 0.7}
    _apply_claude_request_rules(kwargs, "anthropic", "claude-opus-4-7")
    assert kwargs == {}


def test_older_claude_keeps_temperature_unless_thinking():
    plain = {"temperature": 0.7}
    _apply_claude_request_rules(plain, "anthropic", "claude-sonnet-4-6")
    assert plain == {"temperature": 0.7}

    thinking = {"temperature": 0.7, "thinking": {"type": "enabled", "budget_tokens": 2048}}
    _apply_claude_request_rules(thinking, "anthropic", "claude-sonnet-4-6")
    assert "temperature" not in thinking


@pytest.mark.parametrize("provider", ["gemini", "vertex_ai", "openai", "openrouter", "deepseek"])
def test_other_providers_are_untouched(provider):
    kwargs = {"temperature": 0.7}
    _apply_claude_request_rules(kwargs, provider, "claude-opus-5-5")
    assert kwargs == {"temperature": 0.7}


def test_disabled_thinking_is_never_sent():
    """Opus 5.5 and Sonnet 5.5 reject thinking: disabled with a 400."""
    kwargs: dict = {}
    _apply_claude_request_rules(kwargs, "anthropic", "claude-sonnet-5-5")
    assert kwargs.get("thinking") is None


def _response(text: str = "hello") -> SimpleNamespace:
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


@pytest.mark.asyncio
async def test_router_call_to_opus_5_5_is_valid():
    config = LLMConfig(provider="anthropic", model="claude-opus-5-5", api_key="k")
    router = MagicMock()
    router.acompletion = AsyncMock(return_value=_response())
    with patch("app.llm.get_router", return_value=(router, config)):
        assert await llm.complete("hi", config=config) == "hello"
    sent = router.acompletion.call_args.kwargs
    assert "temperature" not in sent and "thinking" not in sent
    assert sent["output_config"] == {"effort": "low"}


@pytest.mark.asyncio
async def test_stage_call_keeps_its_thinking_and_timeout():
    config = LLMConfig(provider="anthropic", model="claude-opus-5-5", api_key="k")
    stage = {"thinking": {"type": "adaptive"}, "output_config": {"effort": "high"},
             "max_tokens": 32000, "timeout": 600}
    with patch("app.llm.litellm.acompletion", new_callable=AsyncMock, return_value=_response()) as call:
        await llm.complete("hi", config=config, stage_kwargs=stage)
    sent = call.call_args.kwargs
    assert sent["output_config"] == {"effort": "high"}
    assert sent["thinking"] == {"type": "adaptive"}
    assert sent["max_tokens"] == 32000 and sent["timeout"] == 600
    assert "temperature" not in sent
