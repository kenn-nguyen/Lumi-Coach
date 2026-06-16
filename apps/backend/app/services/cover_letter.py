"""Cover letter, outreach message, title, and targeted rewrite generation service."""

import json
import re
from typing import Any

from app.llm import LLMConfig, complete, complete_json
from app.prompts.templates import (
    BULLET_REWRITE_PROMPT,
    COVER_LETTER_PROMPT,
    GENERATE_TITLE_PROMPT,
    OUTREACH_MESSAGE_PROMPT,
    SUMMARY_REWRITE_PROMPT,
)
from app.prompts import get_language_name


def _normalize_strategy_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())


def _normalize_strategy_items(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [_normalize_strategy_text(item) for item in value if _normalize_strategy_text(item)]


def _normalize_structured_bullet_instruction(value: Any) -> str:
    if not isinstance(value, dict):
        return ""

    parts: list[str] = []
    for field, label in [
        ("action", "action"),
        ("bullet_anchor", "anchor"),
        ("placement_hint", "placement"),
        ("guardrail", "guardrail"),
    ]:
        text = _normalize_strategy_text(value.get(field))
        if text:
            parts.append(f"{label}: {text}")

    merge_with = _normalize_strategy_items(value.get("merge_with"))
    if merge_with:
        parts.append(f"merge: {', '.join(merge_with[:4])}")

    return " | ".join(parts)


def _role_matches_strategy_entry(
    entry_role: str,
    role_title: str,
    role_company: str,
) -> bool:
    normalized_entry = entry_role.lower().strip()
    if not normalized_entry:
        return False

    haystack = " ".join(
        part.lower().strip() for part in [role_title, role_company] if part
    ).strip()
    if not haystack:
        return False

    if normalized_entry in haystack or haystack in normalized_entry:
        return True

    entry_tokens = {
        token for token in re.split(r"[^a-z0-9]+", normalized_entry) if len(token) >= 3
    }
    haystack_tokens = {
        token for token in re.split(r"[^a-z0-9]+", haystack) if len(token) >= 3
    }
    if not entry_tokens or not haystack_tokens:
        return False

    overlap = entry_tokens & haystack_tokens
    return len(overlap) >= min(2, len(entry_tokens))


def build_prompt2_strategy_context(
    prompt2_artifact: dict[str, Any] | None,
    *,
    role_title: str = "",
    role_company: str = "",
) -> str:
    """Create a compact strategy brief from Prompt 2 output."""
    if not isinstance(prompt2_artifact, dict):
        return ""

    lines: list[str] = []

    positioning_thesis = _normalize_strategy_text(
        prompt2_artifact.get("positioning_thesis")
    )
    if positioning_thesis:
        lines.append(f"Positioning thesis: {positioning_thesis}")

    top_resume_goals = _normalize_strategy_items(
        prompt2_artifact.get("top_resume_goals")
    )
    if top_resume_goals:
        lines.append(f"Top resume goals: {'; '.join(top_resume_goals[:3])}")

    excitement_anchor = prompt2_artifact.get("excitement_anchor")
    if isinstance(excitement_anchor, dict):
        anchor_claim = _normalize_strategy_text(excitement_anchor.get("claim"))
        anchor_evidence = _normalize_strategy_text(excitement_anchor.get("evidence"))
        anchor_placement = _normalize_strategy_text(excitement_anchor.get("placement"))
        anchor_distinction = _normalize_strategy_text(
            excitement_anchor.get("why_distinctive")
        )
        anchor_parts = []
        if anchor_claim:
            anchor_parts.append(anchor_claim)
        if anchor_evidence:
            anchor_parts.append(f"evidence: {anchor_evidence}")
        if anchor_placement:
            anchor_parts.append(f"placement: {anchor_placement}")
        if anchor_distinction:
            anchor_parts.append(f"distinctive: {anchor_distinction}")
        if anchor_parts:
            lines.append(f"Excitement anchor: {' | '.join(anchor_parts)}")

    phrases_to_mirror = _normalize_strategy_items(prompt2_artifact.get("phrases_to_mirror"))
    if phrases_to_mirror:
        lines.append(f"Phrases to mirror: {', '.join(phrases_to_mirror[:8])}")

    final_skills_list = _normalize_strategy_items(prompt2_artifact.get("final_skills_list"))
    if final_skills_list:
        lines.append(f"Priority skills: {', '.join(final_skills_list[:10])}")

    selected_storylines = prompt2_artifact.get("selected_storylines")
    if isinstance(selected_storylines, list):
        storyline_lines: list[str] = []
        for storyline in selected_storylines[:3]:
            if not isinstance(storyline, dict):
                continue
            label = _normalize_strategy_text(storyline.get("label"))
            if not label:
                continue
            angles = _normalize_strategy_items(storyline.get("angles"))
            proof_points = _normalize_strategy_items(storyline.get("proof_points"))
            parts = [label]
            if angles:
                parts.append(f"angles: {', '.join(angles[:3])}")
            if proof_points:
                parts.append(f"proof: {', '.join(proof_points[:3])}")
            storyline_lines.append(" | ".join(parts))
        if storyline_lines:
            lines.append(f"Selected storylines: {'; '.join(storyline_lines)}")

    experience_emphasis = prompt2_artifact.get("experience_emphasis")
    if isinstance(experience_emphasis, list):
        matched_entries: list[str] = []
        for entry in experience_emphasis:
            if not isinstance(entry, dict):
                continue
            entry_role = _normalize_strategy_text(entry.get("role"))
            if entry_role and not _role_matches_strategy_entry(
                entry_role,
                role_title,
                role_company,
            ):
                continue

            themes = _normalize_strategy_items(entry.get("themes_to_emphasize"))
            proof_points = _normalize_strategy_items(entry.get("proof_points"))
            deemphasize = _normalize_strategy_items(entry.get("deemphasize"))
            default_action = _normalize_strategy_text(entry.get("default_action"))
            parts = []
            if entry_role:
                parts.append(entry_role)
            if default_action:
                parts.append(f"action: {default_action}")
            if themes:
                parts.append(f"emphasize: {', '.join(themes[:4])}")
            if proof_points:
                parts.append(f"proof: {', '.join(proof_points[:3])}")
            if deemphasize:
                parts.append(f"deemphasize: {', '.join(deemphasize[:3])}")
            if parts:
                matched_entries.append(" | ".join(parts))
        if matched_entries:
            lines.append(f"Role emphasis: {'; '.join(matched_entries[:2])}")

    bullet_rewrite_instructions = prompt2_artifact.get("bullet_rewrite_instructions")
    if isinstance(bullet_rewrite_instructions, list):
        matched_instructions: list[str] = []
        for entry in bullet_rewrite_instructions:
            if not isinstance(entry, dict):
                continue
            entry_role = _normalize_strategy_text(entry.get("role"))
            if entry_role and not _role_matches_strategy_entry(
                entry_role,
                role_title,
                role_company,
            ):
                continue
            instruction = _normalize_structured_bullet_instruction(entry)
            if instruction:
                matched_instructions.append(instruction)
        if matched_instructions:
            lines.append(f"Relevant rewrite instructions: {'; '.join(matched_instructions[:3])}")

    return "\n".join(lines).strip()


async def generate_cover_letter(
    resume_data: dict[str, Any],
    job_description: str,
    language: str = "en",
    config: LLMConfig | None = None,
) -> str:
    """Generate a cover letter based on resume and job description.

    Args:
        resume_data: Structured resume data (ResumeData format)
        job_description: Target job description text
        language: Output language code (en, es, zh, ja)

    Returns:
        Generated cover letter as plain text
    """
    output_language = get_language_name(language)

    prompt = COVER_LETTER_PROMPT.format(
        job_description=job_description,
        resume_data=json.dumps(resume_data),
        output_language=output_language,
    )

    result = await complete(
        prompt=prompt,
        system_prompt="You are a professional career coach and resume writer. Write compelling, personalized cover letters.",
        config=config,
        max_tokens=2048,
    )

    return result.strip()


async def generate_outreach_message(
    resume_data: dict[str, Any],
    job_description: str,
    language: str = "en",
    config: LLMConfig | None = None,
) -> str:
    """Generate a cold outreach message for networking.

    Args:
        resume_data: Structured resume data (ResumeData format)
        job_description: Target job description text
        language: Output language code (en, es, zh, ja)

    Returns:
        Generated outreach message as plain text
    """
    output_language = get_language_name(language)

    prompt = OUTREACH_MESSAGE_PROMPT.format(
        job_description=job_description,
        resume_data=json.dumps(resume_data),
        output_language=output_language,
    )

    result = await complete(
        prompt=prompt,
        system_prompt="You are a professional networking coach. Write genuine, engaging cold outreach messages.",
        config=config,
        max_tokens=1024,
    )

    return result.strip()


async def generate_resume_title(
    job_description: str,
    language: str = "en",
    config: LLMConfig | None = None,
) -> str:
    """Generate a short descriptive title from a job description.

    Args:
        job_description: Target job description text
        language: Output language code (en, es, zh, ja)

    Returns:
        Generated title like "Senior Frontend Engineer @ Stripe"
    """
    output_language = get_language_name(language)

    prompt = GENERATE_TITLE_PROMPT.format(
        job_description=job_description,
        output_language=output_language,
    )

    result = await complete(
        prompt=prompt,
        system_prompt="You extract job titles and company names from job descriptions.",
        config=config,
        max_tokens=60,
        temperature=0.3,
    )

    # Strip quotes and whitespace, truncate to 80 chars
    title = result.strip().strip("\"'")
    return title[:80]


async def rewrite_resume_bullet(
    current_bullet: str,
    original_bullet: str | None = None,
    role_title: str = "",
    role_company: str = "",
    role_years: str = "",
    strategy_context: str | None = None,
    user_instruction: str | None = None,
    language: str = "en",
    config: LLMConfig | None = None,
) -> str:
    """Rewrite a single resume bullet using the configured LLM."""
    output_language = get_language_name(language)

    prompt = BULLET_REWRITE_PROMPT.format(
        output_language=output_language,
        current_bullet=current_bullet.strip(),
        original_bullet=(original_bullet or "").strip() or "Not available.",
        role_title=role_title.strip() or "Not provided",
        role_company=role_company.strip() or "Not provided",
        role_years=role_years.strip() or "Not provided",
        strategy_context=(strategy_context or "").strip() or "Not available.",
        user_instruction=(user_instruction or "").strip() or "No additional instruction.",
    )

    result = await complete_json(
        prompt=prompt,
        system_prompt=(
            "You are a senior resume editor for high-performing candidates. "
            "Improve one bullet while preserving facts exactly."
        ),
        config=config,
        max_tokens=256,
    )

    rewritten_bullet = result.get("rewritten_bullet")
    if not isinstance(rewritten_bullet, str):
        raise ValueError("rewritten_bullet must be a string")

    cleaned = " ".join(rewritten_bullet.strip().split())
    if not cleaned:
        raise ValueError("rewritten_bullet is empty")
    if "\n" in rewritten_bullet or "\r" in rewritten_bullet:
        raise ValueError("rewritten_bullet must be a single line")
    if len(cleaned) > max(400, len(current_bullet) * 4):
        raise ValueError("rewritten_bullet is implausibly long")

    return cleaned


async def rewrite_resume_summary(
    current_summary: str,
    original_summary: str | None = None,
    strategy_context: str | None = None,
    user_instruction: str | None = None,
    language: str = "en",
    config: LLMConfig | None = None,
) -> str:
    """Rewrite a resume summary using the configured LLM."""
    output_language = get_language_name(language)

    prompt = SUMMARY_REWRITE_PROMPT.format(
        output_language=output_language,
        current_summary=current_summary.strip(),
        original_summary=(original_summary or "").strip() or "Not available.",
        strategy_context=(strategy_context or "").strip() or "Not available.",
        user_instruction=(user_instruction or "").strip() or "No additional instruction.",
    )

    result = await complete_json(
        prompt=prompt,
        system_prompt=(
            "You are a senior resume editor for high-performing candidates. "
            "Improve one summary while preserving facts exactly."
        ),
        config=config,
        max_tokens=384,
    )

    rewritten_summary = result.get("rewritten_summary")
    if not isinstance(rewritten_summary, str):
        raise ValueError("rewritten_summary must be a string")

    cleaned = rewritten_summary.strip()
    if not cleaned:
        raise ValueError("rewritten_summary is empty")
    if len(cleaned) > max(1200, len(current_summary) * 4):
        raise ValueError("rewritten_summary is implausibly long")

    return cleaned
