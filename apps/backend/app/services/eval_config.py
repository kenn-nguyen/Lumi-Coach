"""Helpers for reading and validating the eval pipeline configuration YAML."""

from __future__ import annotations

from pathlib import Path

import yaml

_DEFAULT_CONFIG_PATH = (
    Path(__file__).parent.parent / "prompts" / "extension_defaults" / "eval-config.yaml"
)


def read_default_eval_config() -> str:
    """Return the bundled default eval config YAML as a string."""
    if _DEFAULT_CONFIG_PATH.exists():
        return _DEFAULT_CONFIG_PATH.read_text(encoding="utf-8")
    return ""


def validate_eval_config_yaml(content: str) -> dict:
    """Parse and validate that content is a valid YAML mapping.

    Raises ValueError with a human-readable message on failure.
    Returns the parsed dict on success.
    """
    try:
        parsed = yaml.safe_load(content)
    except yaml.YAMLError as exc:
        raise ValueError(f"Invalid YAML: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ValueError("Eval config must be a YAML mapping (key: value pairs at the top level).")
    return parsed
