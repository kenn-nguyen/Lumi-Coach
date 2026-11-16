"""Which providers count as ready to run the tailor pipeline."""

from __future__ import annotations

from unittest.mock import patch

from app.llm import LLMConfig
from app.services.tailor import _provider_has_key


def _ready(config: LLMConfig) -> bool:
    # No user, no saved keys, no environment keys: only the server config decides.
    with patch("app.services.tailor.db.get_user_llm_config", return_value=None), patch(
        "app.config.get_api_keys_from_config", return_value={}
    ), patch.dict("os.environ", {}, clear=True):
        return _provider_has_key(config.provider, None, config)


def test_vertex_is_ready_with_a_project_and_no_key():
    config = LLMConfig(provider="vertex_ai", model="gemini-3.5-flash", api_key="",
                       vertex_project="project-1", vertex_location="global")
    assert _ready(config)


def test_vertex_without_a_project_is_not_ready():
    config = LLMConfig(provider="vertex_ai", model="gemini-3.5-flash", api_key="")
    assert not _ready(config)


def test_key_based_provider_still_needs_its_key():
    assert not _ready(LLMConfig(provider="anthropic", model="claude-sonnet-5-5", api_key=""))
    assert _ready(LLMConfig(provider="anthropic", model="claude-sonnet-5-5", api_key="k"))
