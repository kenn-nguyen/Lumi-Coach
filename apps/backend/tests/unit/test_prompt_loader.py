"""Tests for prompt_loader service."""

import pytest
from pathlib import Path


def test_render_prompt_replaces_placeholders():
    from app.services.prompt_loader import render_prompt

    template = "Hello {{NAME}}, your job is {{JOB}}."
    result = render_prompt(template, {"NAME": "Alice", "JOB": "Engineer"})
    assert result == "Hello Alice, your job is Engineer."


def test_render_prompt_raises_on_unresolved_placeholder():
    from app.services.prompt_loader import render_prompt

    with pytest.raises(ValueError, match="Unresolved"):
        render_prompt("Hello {{MISSING}}.", {"NAME": "Alice"})


def test_strip_yaml_frontmatter():
    from app.services.prompt_loader import strip_yaml_frontmatter

    text = "---\nkey: value\n---\nActual content here."
    assert strip_yaml_frontmatter(text) == "Actual content here."


def test_strip_yaml_frontmatter_no_header():
    from app.services.prompt_loader import strip_yaml_frontmatter

    text = "No frontmatter here."
    assert strip_yaml_frontmatter(text) == "No frontmatter here."


def test_get_template_path_profile1_uses_root():
    from app.services.prompt_loader import get_template_path, PROMPTS_DIR

    path = get_template_path("prompt1", "profile1")
    assert path == PROMPTS_DIR / "prompt1.txt"


def test_get_template_path_profile2_overrides_prompt1():
    from app.services.prompt_loader import get_template_path, PROMPTS_DIR

    path = get_template_path("prompt1", "profile2")
    assert path == PROMPTS_DIR / "profiles" / "profile2" / "prompt1.txt"


def test_get_template_path_profile4_only_overrides_prompt3():
    from app.services.prompt_loader import get_template_path, PROMPTS_DIR

    # profile4 only has prompt3 — prompt1 falls back to root
    path = get_template_path("prompt1", "profile4")
    assert path == PROMPTS_DIR / "prompt1.txt"

    path3 = get_template_path("prompt3", "profile4")
    assert path3 == PROMPTS_DIR / "profiles" / "profile4" / "prompt3.txt"


def test_has_output_contract_profile3_prompt1_false():
    from app.services.prompt_loader import has_output_contract

    assert has_output_contract("prompt1", "profile3") is False
    assert has_output_contract("prompt2", "profile3") is False


def test_has_output_contract_profile3_prompt3_true():
    from app.services.prompt_loader import has_output_contract

    assert has_output_contract("prompt3", "profile3") is True


def test_has_output_contract_all_profiles_prompt3_true():
    from app.services.prompt_loader import has_output_contract

    for profile in ("profile1", "profile2", "profile4"):
        assert has_output_contract("prompt3", profile) is True


def test_load_template_text_profile1_prompt1_loads_file():
    """Smoke test: profile1/prompt1 loads without error and has content."""
    from app.services.prompt_loader import load_template_text

    text = load_template_text("prompt1", "profile1")
    assert isinstance(text, str)
    assert len(text) > 50  # non-trivial content


def test_load_system_prompt_returns_combined_text():
    """System prompt should include both guardrails and system text."""
    from app.services.prompt_loader import load_system_prompt

    system = load_system_prompt()
    assert isinstance(system, str)
    assert len(system) > 50


def test_tailor_schemas_valid_request():
    from app.schemas.tailor import TailorRequest

    req = TailorRequest(prompt_profile_id="profile2", jd_text="Looking for engineer")
    assert req.prompt_profile_id == "profile2"


def test_tailor_schemas_invalid_profile():
    from app.schemas.tailor import TailorRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="Invalid prompt profile"):
        TailorRequest(prompt_profile_id="profile99", jd_text="text")


def test_tailor_schemas_default_profile():
    from app.schemas.tailor import TailorRequest

    req = TailorRequest(jd_text="text")
    assert req.prompt_profile_id == "profile2"


def test_tailor_status_response_serializes():
    from app.schemas.tailor import TailorStatusResponse

    r = TailorStatusResponse(
        job_id="tj_1",
        status="running",
        progress_stage="prompt1",
        prompt_profile_id="profile2",
        started_at="2026-06-15T10:00:00Z",
    )
    data = r.model_dump()
    assert data["job_id"] == "tj_1"
    assert data["tailored_resume_id"] is None
