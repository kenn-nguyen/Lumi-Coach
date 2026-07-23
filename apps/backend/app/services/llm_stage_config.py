"""LLM stage config loader — supports both legacy and extension-schema YAML.

Legacy schema (provider-keyed, single provider):
    anthropic:
      prompt1:
        model: claude-sonnet-4-6

Extension schema (stageProviders + profiles, multi-provider routing):
    stageProviders:
      prompt1: deepseek:api
      prompt2: claude:api
    profiles:
      claude:api:
        stageModels:
          prompt1:
            model: claude-sonnet-4-6
            thinking: {type: enabled, budget_tokens: 8192}

Config is stored PER USER in the DB (encrypted, since it can embed apiKeys) and
only applied when that user has explicitly enabled per-stage routing. When a user
has it off (the default) or has no config, every stage falls back to the user's
active provider. The bundled prompts/extension_defaults/llm-stage-config.yaml is
kept only as a read-only template users can download to see the schema.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts" / "extension_defaults"
_DEFAULT_CONFIG_PATH = _PROMPTS_DIR / "llm-stage-config.yaml"

_PROFILE_KEYS = {"profile1", "profile2", "profile3", "profile4"}

# Extension profile IDs → LiteLLM provider names
_PROFILE_ID_TO_PROVIDER: dict[str, str] = {
    "claude:api": "anthropic",
    "deepseek:api": "deepseek",
    "openai:api": "openai",
    "chatgpt:api": "openai",
    "gemini:api": "gemini",
}


def _load_user_raw(user_id: str | None) -> dict[str, Any]:
    """Return the user's parsed stage config, or {} when off/absent/invalid.

    Gated on the per-user enabled flag so a stored-but-disabled config never
    routes anything. Never raises — resolution must fall back cleanly.
    """
    if not user_id:
        return {}
    try:
        from app.database import db

        stage_config = db.get_user_stage_config(user_id)
        if not stage_config.get("enabled") or not stage_config.get("content"):
            return {}
        raw = yaml.safe_load(stage_config["content"]) or {}
        return raw if isinstance(raw, dict) else {}
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("Failed to load stage config for user %s: %s", user_id, e)
        return {}


def _is_extension_schema(config: dict[str, Any]) -> bool:
    return "stageProviders" in config


def _extract_stage_settings(cfg: dict[str, Any]) -> tuple[str | None, dict[str, Any]]:
    """Return (model, extra_kwargs) from a stage settings dict.

    Normalises the extension's camelCase keys to the backend's snake_case
    equivalents where needed (maxTokens → max_tokens).
    """
    model = cfg.get("model") or None
    extra: dict[str, Any] = {}
    for k, v in cfg.items():
        if k == "model":
            continue
        extra["max_tokens" if k == "maxTokens" else k] = v
    return model, extra


# ── Public API ─────────────────────────────────────────────────────────────


def get_stage_overrides(
    provider: str, stage: str, profile_id: str | None = None, user_id: str | None = None
) -> tuple[str | None, dict[str, Any]]:
    """Legacy schema: return (model_override, extra_kwargs) within the same provider.

    Returns (None, {}) for extension-schema configs — callers should use
    get_stage_provider_config instead.
    """
    config = _load_user_raw(user_id)
    if _is_extension_schema(config):
        return None, {}

    provider_config = config.get(provider, {})
    if not isinstance(provider_config, dict):
        return None, {}

    # Profile-level override takes precedence over stage-level
    if profile_id and profile_id in _PROFILE_KEYS:
        profile_cfg = provider_config.get(profile_id)
        if isinstance(profile_cfg, dict):
            return _extract_stage_settings(profile_cfg)

    stage_cfg = provider_config.get(stage)
    if isinstance(stage_cfg, dict):
        return _extract_stage_settings(stage_cfg)

    return None, {}


def get_stage_provider_config(
    stage: str, user_id: str | None = None
) -> tuple[str | None, str | None, dict[str, Any]]:
    """Extension schema: return (lm_provider, model, extra_kwargs) for this stage.

    lm_provider is a LiteLLM provider name (e.g. "anthropic", "deepseek").
    Returns (None, None, {}) when the user has per-stage routing off, has no
    config, or is using the legacy schema.

    When routing is active and a profile has an `apiKey` field, the key is
    injected into extra_kwargs as "_api_key" (stripped before any LiteLLM call).
    """
    # _load_user_raw already gates on the per-user enabled flag → {} when off.
    config = _load_user_raw(user_id)
    if not _is_extension_schema(config):
        return None, None, {}

    stage_providers = config.get("stageProviders", {})
    if not isinstance(stage_providers, dict):
        return None, None, {}

    profile_id = stage_providers.get(stage)
    if not profile_id:
        return None, None, {}

    provider = _PROFILE_ID_TO_PROVIDER.get(str(profile_id))
    if not provider:
        logger.warning("Unknown profile ID %r for stage %s — skipping override.", profile_id, stage)
        return None, None, {}

    profiles = config.get("profiles", {})
    if not isinstance(profiles, dict):
        return provider, None, {}

    profile_cfg = profiles.get(profile_id, {})
    if not isinstance(profile_cfg, dict):
        return provider, None, {}

    # Extract profile-level API key (user can paste it directly in the YAML)
    yaml_api_key = profile_cfg.get("apiKey") or None

    stage_models = profile_cfg.get("stageModels", {})
    if not isinstance(stage_models, dict):
        return provider, None, {}

    stage_cfg = stage_models.get(stage, {})
    if not isinstance(stage_cfg, dict):
        return provider, None, {}

    model, extra_kwargs = _extract_stage_settings(stage_cfg)
    if yaml_api_key:
        extra_kwargs["_api_key"] = yaml_api_key
    return provider, model, extra_kwargs


def get_yaml_api_key_for_provider(provider: str, user_id: str | None = None) -> str | None:
    """Return the first embedded apiKey for profiles that map to this provider, or None.

    Only active when the user has per-stage routing enabled with a config.
    """
    config = _load_user_raw(user_id)
    if not _is_extension_schema(config):
        return None
    profiles = config.get("profiles", {}) or {}
    for profile_id, profile_cfg in profiles.items():
        if not isinstance(profile_cfg, dict):
            continue
        if _PROFILE_ID_TO_PROVIDER.get(str(profile_id)) == provider:
            key = profile_cfg.get("apiKey") or None
            if key:
                return key
    return None


def validate_stage_config(content: str) -> None:
    """Validate an uploaded YAML config before it is stored for a user."""
    parsed = yaml.safe_load(content)
    if not isinstance(parsed, dict):
        raise ValueError("Config must be a YAML mapping")


def read_default_config() -> str:
    """Return the raw YAML text of the bundled default config (download template)."""
    if _DEFAULT_CONFIG_PATH.exists():
        return _DEFAULT_CONFIG_PATH.read_text(encoding="utf-8")
    return ""
