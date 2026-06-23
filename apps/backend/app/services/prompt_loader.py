"""Prompt template loader for extension-style 3-stage tailor pipeline.

Reads templates from app/prompts/extension_defaults/ with the same
profile cascade as the Chrome extension's prompt-defaults.js.
"""

from __future__ import annotations

import re
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent.parent / "prompts" / "extension_defaults"

PLACEHOLDER_PATTERN = re.compile(r"\{\{([A-Z0-9_]+)\}\}")

# Profile cascade: maps (profile_id, template_name) -> relative path.
# If not listed, falls back to root template.
_PROFILE_OVERRIDES: dict[str, dict[str, str]] = {
    "profile2": {
        "prompt1": "profiles/profile2/prompt1.txt",
        "prompt2": "profiles/profile2/prompt2.txt",
        "prompt3": "profiles/profile2/prompt3.txt",
    },
    "profile3": {
        "prompt1": "profiles/profile3/prompt1.txt",
        "prompt2": "profiles/profile3/prompt2.txt",
        "prompt3": "profiles/profile3/prompt3.txt",
    },
    "profile4": {
        "prompt3": "profiles/profile4/prompt3.txt",
    },
    "profile5": {
        "prompt1": "profiles/profile5/prompt1.txt",
        "prompt2": "profiles/profile5/prompt2.txt",
        "prompt3": "profiles/profile5/prompt3.txt",
    },
}

# profile3 prompt1/prompt2 return plain text — no output contract appended.
# profile5 prompt2/prompt3 bake the previous-method (instruction-shape) contract
# directly into the prompt body, so the shared contract must not be appended.
_NO_CONTRACT_COMBOS: set[tuple[str, str]] = {
    ("prompt1", "profile3"),
    ("prompt2", "profile3"),
    ("prompt2", "profile5"),
    ("prompt3", "profile5"),
}


def strip_yaml_frontmatter(text: str) -> str:
    """Remove YAML frontmatter (--- block) from prompt template text."""
    text = text.strip()
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            return text[end + 3 :].strip()
    return text


def get_template_path(template_name: str, profile_id: str) -> Path:
    """Resolve the file path for a prompt template using profile cascade."""
    override = _PROFILE_OVERRIDES.get(profile_id, {}).get(template_name)
    if override:
        return PROMPTS_DIR / override
    return PROMPTS_DIR / f"{template_name}.txt"


def has_output_contract(template_name: str, profile_id: str) -> bool:
    """Return True if an output contract should be appended to this template."""
    return (template_name, profile_id) not in _NO_CONTRACT_COMBOS


def load_template_text(template_name: str, profile_id: str) -> str:
    """Load and return template text (YAML frontmatter stripped)."""
    path = get_template_path(template_name, profile_id)
    raw = path.read_text(encoding="utf-8")
    return strip_yaml_frontmatter(raw)


def load_output_contract(template_name: str) -> str:
    """Load the output contract for a given template name."""
    path = PROMPTS_DIR / "patches" / f"{template_name}.output-contract.txt"
    raw = path.read_text(encoding="utf-8")
    return strip_yaml_frontmatter(raw)


def load_system_prompt() -> str:
    """Load system guardrails + system-prompt.txt concatenated."""
    guardrails_path = PROMPTS_DIR / "patches" / "system.guardrails.txt"
    system_path = PROMPTS_DIR / "system-prompt.txt"
    guardrails = strip_yaml_frontmatter(guardrails_path.read_text(encoding="utf-8"))
    system = strip_yaml_frontmatter(system_path.read_text(encoding="utf-8"))
    return f"{guardrails}\n\n{system}"


def get_prompt_version(template_name: str, profile_id: str) -> str | None:
    """Extract prompt_version from the YAML frontmatter of a prompt template."""
    path = get_template_path(template_name, profile_id)
    try:
        raw = path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    if not raw.startswith("---"):
        return None
    end = raw.find("---", 3)
    if end == -1:
        return None
    for line in raw[3:end].splitlines():
        if line.startswith("prompt_version:"):
            return line.split(":", 1)[1].strip()
    return None


def get_system_prompt_version() -> str | None:
    """Extract prompt_version from the system-prompt.txt frontmatter."""
    path = PROMPTS_DIR / "system-prompt.txt"
    try:
        raw = path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    if not raw.startswith("---"):
        return None
    end = raw.find("---", 3)
    if end == -1:
        return None
    for line in raw[3:end].splitlines():
        if line.startswith("prompt_version:"):
            return line.split(":", 1)[1].strip()
    return None


def build_prompt(template_name: str, profile_id: str, variables: dict[str, str]) -> str:
    """Load template (+ output contract if applicable) and render with variables."""
    template = load_template_text(template_name, profile_id)
    if has_output_contract(template_name, profile_id):
        contract = load_output_contract(template_name)
        template = f"{template}\n\n{contract}"
    return render_prompt(template, variables)


def render_prompt(template: str, variables: dict[str, str]) -> str:
    """Replace {{PLACEHOLDER}} tokens. Raises ValueError if any remain unresolved."""
    result = template
    for key, value in variables.items():
        result = result.replace(f"{{{{{key}}}}}", value)
    unresolved = PLACEHOLDER_PATTERN.findall(result)
    if unresolved:
        raise ValueError(f"Unresolved placeholders in prompt: {unresolved}")
    return result
