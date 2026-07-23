"""Per-user, toggle-gated LLM stage-routing resolution.

These lock the security fix: one user's stage config must never affect another
user, and a stored config must not route anything unless that user has enabled
per-stage routing.
"""

import app.services.llm_stage_config as sc

_YAML_CLAUDE_P1 = "stageProviders:\n  prompt1: claude:api\n"


def _patch_configs(monkeypatch, configs: dict) -> None:
    import app.database

    monkeypatch.setattr(
        app.database.db,
        "get_user_stage_config",
        lambda user_id: configs.get(
            user_id, {"content": "", "enabled": False, "has_config": False}
        ),
    )


def test_routing_off_does_not_apply_even_with_a_stored_config(monkeypatch):
    _patch_configs(
        monkeypatch,
        {"u1": {"content": _YAML_CLAUDE_P1, "enabled": False, "has_config": True}},
    )
    assert sc.get_stage_provider_config("prompt1", "u1") == (None, None, {})


def test_routing_on_resolves_the_stage_provider(monkeypatch):
    _patch_configs(
        monkeypatch,
        {"u1": {"content": _YAML_CLAUDE_P1, "enabled": True, "has_config": True}},
    )
    provider, _model, _kwargs = sc.get_stage_provider_config("prompt1", "u1")
    assert provider == "anthropic"


def test_config_is_isolated_per_user(monkeypatch):
    _patch_configs(
        monkeypatch,
        {
            "u1": {"content": _YAML_CLAUDE_P1, "enabled": True, "has_config": True},
            # u2 has nothing enabled — must be unaffected by u1's routing.
            "u2": {"content": "", "enabled": False, "has_config": False},
        },
    )
    assert sc.get_stage_provider_config("prompt1", "u1")[0] == "anthropic"
    assert sc.get_stage_provider_config("prompt1", "u2")[0] is None


def test_no_user_id_never_routes(monkeypatch):
    _patch_configs(monkeypatch, {})
    assert sc.get_stage_provider_config("prompt1", None) == (None, None, {})


def test_embedded_api_key_only_surfaces_when_enabled(monkeypatch):
    yaml = (
        "stageProviders:\n  prompt1: claude:api\n"
        "profiles:\n  claude:api:\n    apiKey: sk-secret\n"
    )
    _patch_configs(
        monkeypatch,
        {
            "on": {"content": yaml, "enabled": True, "has_config": True},
            "off": {"content": yaml, "enabled": False, "has_config": True},
        },
    )
    assert sc.get_yaml_api_key_for_provider("anthropic", "on") == "sk-secret"
    assert sc.get_yaml_api_key_for_provider("anthropic", "off") is None


def test_validate_stage_config_rejects_non_mapping():
    import pytest

    with pytest.raises(ValueError):
        sc.validate_stage_config("- just\n- a\n- list\n")
    # A mapping is accepted (no raise).
    sc.validate_stage_config(_YAML_CLAUDE_P1)
