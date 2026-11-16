"""Tailor stage calls get an output budget large enough for Claude's longer answers."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.llm import LLMConfig
from app.services.tailor import _call_llm_with_repair, stage_max_tokens


@pytest.mark.parametrize("provider", ["anthropic", "gemini", "vertex_ai"])
def test_providers_with_large_output_limits_get_16k(provider):
    assert stage_max_tokens(provider) == 16384


@pytest.mark.parametrize("provider", ["deepseek", "openai", "openrouter"])
def test_other_providers_stay_within_8k(provider):
    assert stage_max_tokens(provider) == 8192


@pytest.mark.asyncio
async def test_stage_and_repair_calls_use_the_provider_budget():
    config = LLMConfig(provider="anthropic", model="claude-sonnet-5-5", api_key="k")
    with patch("app.services.tailor.llm.complete", new_callable=AsyncMock,
               side_effect=["not json", '{"ok": true}']) as complete:
        _, parsed = await _call_llm_with_repair("p", "s", config, "prompt1")
    assert parsed == {"ok": True}
    assert [c.kwargs["max_tokens"] for c in complete.call_args_list] == [16384, 16384]
