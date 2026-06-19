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

The active file is chosen via override-over-default resolution:
  data/llm-stage-config.yaml  (user upload)  wins over
  prompts/extension_defaults/llm-stage-config.yaml  (bundled default)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts" / "extension_defaults"
_DEFAULT_CONFIG_PATH = _PROMPTS_DIR / "llm-stage-config.yaml"
_OVERRIDE_CONFIG_PATH = Path(__file__).parent.parent.parent / "data" / "llm-stage-config.yaml"

_PROFILE_KEYS = {"profile1", "profile2", "profile3", "profile4"}

# Extension profile IDs → LiteLLM provider names
_PROFILE_ID_TO_PROVIDER: dict[str, str] = {
    "claude:api": "anthropic",
    "deepseek:api": "deepseek",
    "openai:api": "openai",
    "chatgpt:api": "openai",
    "gemini:api": "gemini",
}


def _load_raw() -> dict[str, Any]:
    for path in (_OVERRIDE_CONFIG_PATH, _DEFAULT_CONFIG_PATH):
        if path.exists():
            try:
                raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
                if isinstance(raw, dict):
                    logger.debug("Loaded LLM stage config from %s", path)
                    return raw
            except Exception as e:
                logger.warning("Failed to load LLM stage config from %s: %s", path, e)
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
    provider: str, stage: str, profile_id: str | None = None
) -> tuple[str | None, dict[str, Any]]:
    """Legacy schema: return (model_override, extra_kwargs) within the same provider.

    Returns (None, {}) for extension-schema configs — callers should use
    get_stage_provider_config instead.
    """
    config = _load_raw()
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
    stage: str,
) -> tuple[str | None, str | None, dict[str, Any]]:
    """Extension schema: return (lm_provider, model, extra_kwargs) for this stage.

    lm_provider is a LiteLLM provider name (e.g. "anthropic", "deepseek").
    Returns (None, None, {}) when using the legacy schema or no override exists.

    When a custom YAML is active and a profile has an `apiKey` field, the key
    is injected into extra_kwargs as "_api_key" (stripped before any LiteLLM call).
    """
    # Simple mode: no custom YAML uploaded → all stages use the user's primary provider
    if not is_using_override():
        return None, None, {}

    config = _load_raw()
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


def get_yaml_api_key_for_provider(provider: str) -> str | None:
    """Return the first embedded apiKey for profiles that map to this provider, or None.

    Only active when a custom YAML override is uploaded.
    """
    if not is_using_override():
        return None
    config = _load_raw()
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


def save_override(content: str) -> None:
    """Validate and save an uploaded YAML config."""
    parsed = yaml.safe_load(content)
    if not isinstance(parsed, dict):
        raise ValueError("Config must be a YAML mapping")
    _OVERRIDE_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _OVERRIDE_CONFIG_PATH.write_text(content, encoding="utf-8")
    logger.info("LLM stage config override saved to %s", _OVERRIDE_CONFIG_PATH)


def read_active_config() -> str:
    """Return the raw YAML text of the currently active config."""
    for path in (_OVERRIDE_CONFIG_PATH, _DEFAULT_CONFIG_PATH):
        if path.exists():
            return path.read_text(encoding="utf-8")
    return ""


def read_default_config() -> str:
    """Return the raw YAML text of the bundled default config (ignores any override)."""
    if _DEFAULT_CONFIG_PATH.exists():
        return _DEFAULT_CONFIG_PATH.read_text(encoding="utf-8")
    return ""


def is_using_override() -> bool:
    return _OVERRIDE_CONFIG_PATH.exists()


def delete_override() -> bool:
    if _OVERRIDE_CONFIG_PATH.exists():
        _OVERRIDE_CONFIG_PATH.unlink()
        return True
    return False
