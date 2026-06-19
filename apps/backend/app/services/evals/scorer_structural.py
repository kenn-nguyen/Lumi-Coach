"""Layer 1 structural scorer — deterministic, zero cost."""

from __future__ import annotations

from typing import Any


REQUIRED_KEYS = {"personal", "experience", "education", "skills"}


def score_structural(
    master: dict[str, Any],
    tailored: dict[str, Any],
) -> tuple[bool, dict[str, Any]]:
    """Run structural checks. Returns (passed, scores_dict)."""
    failed: list[str] = []

    missing_keys = REQUIRED_KEYS - set(tailored.keys())
    valid_structure = len(missing_keys) == 0
    if not valid_structure:
        failed.append("valid_structure")

    no_empty_sections = True
    for key in master:
        master_val = master.get(key)
        tailored_val = tailored.get(key)
        if master_val and not tailored_val:
            no_empty_sections = False
            break
        if isinstance(master_val, list) and len(master_val) > 0:
            if not isinstance(tailored_val, list) or len(tailored_val) == 0:
                no_empty_sections = False
                break
    if not no_empty_sections:
        failed.append("no_empty_sections")

    experience_entries_valid = True
    experience = tailored.get("experience") or []
    if isinstance(experience, list):
        for entry in experience:
            if not isinstance(entry, dict):
                experience_entries_valid = False
                break
            bullets = entry.get("bullets") or entry.get("description") or []
            if not entry.get("company") or not entry.get("title"):
                experience_entries_valid = False
                break
            if not isinstance(bullets, list) or len(bullets) == 0:
                experience_entries_valid = False
                break
    if not experience_entries_valid:
        failed.append("experience_entries_valid")

    master_sections = {k for k, v in master.items() if v}
    tailored_sections = {k for k, v in tailored.items() if v}
    sections_complete = master_sections.issubset(tailored_sections)
    if not sections_complete:
        failed.append("sections_complete")

    scores = {
        "valid_structure": valid_structure,
        "no_empty_sections": no_empty_sections,
        "experience_entries_valid": experience_entries_valid,
        "sections_complete": sections_complete,
        "failed_checks": failed,
    }
    return (len(failed) == 0, scores)
