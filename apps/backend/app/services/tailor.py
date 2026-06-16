"""Tailor pipeline service: runs Prompt 1 → 2 → 3 to generate a tailored resume.

Mirrors the Chrome extension's orchestrator logic on the backend.
LLM calls are awaited (async). DB calls are synchronous SQLAlchemy
(fast; fine for ~dozen concurrent users).
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app import llm
from app.database import db
from app.llm import LLMConfig
from app.services.prompt_loader import build_prompt, load_system_prompt

logger = logging.getLogger(__name__)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_tailor_job(resume_id: str, user_id: str) -> dict | None:
    """Fetch the current tailor_job dict from the DB."""
    resume = db.get_resume(resume_id, user_id)
    if not resume:
        return None
    return resume.get("tailor_job") or {}


def _is_canceled(resume_id: str, user_id: str) -> bool:
    """Return True if the tailor job has been canceled."""
    job = _get_tailor_job(resume_id, user_id)
    if job is None:
        return True
    return job.get("status") == "canceled"


def _update_tailor_job(resume_id: str, user_id: str, updates: dict) -> None:
    """Merge updates into the tailor_job JSONB on the resume row."""
    resume = db.get_resume(resume_id, user_id)
    if not resume:
        return
    current_job = dict(resume.get("tailor_job") or {})
    current_job.update(updates)
    db.update_resume(resume_id, {"tailor_job": current_job}, user_id)


def _update_progress(resume_id: str, user_id: str, stage: str) -> None:
    _update_tailor_job(resume_id, user_id, {"progress_stage": stage})


def _set_failed(resume_id: str, user_id: str, message: str) -> None:
    _update_tailor_job(
        resume_id,
        user_id,
        {"status": "failed", "error_message": message, "completed_at": _utcnow_iso()},
    )


def _set_completed(resume_id: str, user_id: str, tailored_resume_id: str) -> None:
    _update_tailor_job(
        resume_id,
        user_id,
        {
            "status": "completed",
            "tailored_resume_id": tailored_resume_id,
            "completed_at": _utcnow_iso(),
        },
    )


def _extract_json_from_text(raw: str) -> dict:
    """Extract the first valid JSON object from LLM output text."""
    raw = raw.strip()

    # Try fenced code block first
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Find first balanced { } block
    for i, ch in enumerate(raw):
        if ch != "{":
            continue
        depth = 0
        in_string = False
        escaped = False
        for j in range(i, len(raw)):
            c = raw[j]
            if escaped:
                escaped = False
                continue
            if c == "\\" and in_string:
                escaped = True
                continue
            if c == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(raw[i : j + 1])
                    except json.JSONDecodeError:
                        break

    raise ValueError("Could not extract JSON from LLM output.")


def _extract_p3_payload(raw: str) -> tuple[dict, dict | None]:
    """Return (resume_data, generation_feedback) from P3 LLM output."""
    parsed = _extract_json_from_text(raw)
    if isinstance(parsed, dict) and "resume_data" in parsed:
        return parsed["resume_data"], parsed.get("generation_feedback")
    return parsed, None


async def _call_llm_with_repair(
    prompt: str,
    system_prompt: str,
    llm_config: LLMConfig,
    stage_label: str,
    parse_json: bool = True,
) -> tuple[str, dict | None]:
    """
    Call LLM and optionally parse JSON. On parse failure, attempt one repair call.
    Returns (raw_text, parsed_dict_or_None).
    """
    raw = await llm.complete(prompt, system_prompt=system_prompt, config=llm_config)

    if not parse_json:
        return raw, None

    try:
        parsed = _extract_json_from_text(raw)
        return raw, parsed
    except ValueError:
        logger.warning("%s: JSON parse failed, attempting one repair call.", stage_label)

    repair_prompt = (
        "The previous response was not valid JSON. "
        "Return only a valid JSON object with no markdown, explanation, or extra text.\n\n"
        f"Previous response:\n{raw}"
    )
    repaired_raw = await llm.complete(
        repair_prompt, system_prompt=system_prompt, config=llm_config
    )
    try:
        parsed = _extract_json_from_text(repaired_raw)
        return repaired_raw, parsed
    except ValueError as exc:
        raise ValueError(
            f"{stage_label}: JSON extraction failed after repair attempt."
        ) from exc


async def run_tailor_pipeline(
    resume_id: str,
    user_id: str,
    jd_url: str | None,
    jd_text: str | None,
    prompt_profile_id: str,
    llm_config: LLMConfig,
    apify_api_key: str | None,
) -> None:
    """
    Background task: runs the full P1 → P2 → P3 tailor pipeline.

    - Profile4 ("one-shot"): skips P1 and P2, runs only P3.
    - Profile3 ("lean"): P1/P2 return plain text (not JSON).
    - All other profiles: P1/P2/P3 all return JSON.

    Updates tailor_job JSONB on the resume row at each stage.
    Creates a new tailored resume on success.
    """
    is_single_stage = prompt_profile_id == "profile4"
    is_freeform = prompt_profile_id == "profile3"

    try:
        system_prompt = load_system_prompt()

        # ── Stage 0: JD extraction ─────────────────────────────────────────
        if jd_url and not jd_text:
            if _is_canceled(resume_id, user_id):
                return
            _update_progress(resume_id, user_id, "apify")
            from app.services.apify_linkedin import fetch_linkedin_job_detail_via_apify

            try:
                jd_data = await fetch_linkedin_job_detail_via_apify(jd_url)
                jd_text = jd_data.get("raw_text") or ""
            except Exception as exc:
                _set_failed(resume_id, user_id, str(exc))
                return

        if not jd_text:
            _set_failed(resume_id, user_id, "No job description text available.")
            return

        # Load master resume for this user
        master_resume = db.get_master_resume(user_id)
        if not master_resume:
            _set_failed(resume_id, user_id, "Master resume not found.")
            return

        resume_content = master_resume.get("content") or ""

        # Base template variables shared across all stages
        base_vars: dict[str, str] = {
            "JOB_DESCRIPTION": jd_text,
            "JOB_TITLE": "",
            "COMPANY": "",
            "LOCATION": "",
            "SOURCE_URL": jd_url or "",
            "CURRENT_RESUME": resume_content,
            "MASTER_RESUME": resume_content,
            "EXTRACTED_AT": _utcnow_iso(),
            # Story bank is an extension-only concept; always empty on backend
            "STORYBOARD": "",
        }

        p1_raw = ""
        p1_json: dict[str, Any] = {}
        p2_raw = ""
        p2_json: dict[str, Any] = {}

        # ── Stage 1: Prompt 1 — Analyze JD ────────────────────────────────
        if not is_single_stage:
            if _is_canceled(resume_id, user_id):
                return
            _update_progress(resume_id, user_id, "prompt1")

            p1_prompt = build_prompt("prompt1", prompt_profile_id, base_vars)
            p1_raw, p1_parsed = await _call_llm_with_repair(
                p1_prompt,
                system_prompt,
                llm_config,
                "Prompt1",
                parse_json=not is_freeform,
            )
            if p1_parsed:
                p1_json = p1_parsed

        # ── Stage 2: Prompt 2 — Strategize ────────────────────────────────
        if not is_single_stage:
            if _is_canceled(resume_id, user_id):
                return
            _update_progress(resume_id, user_id, "prompt2")

            p2_vars = {
                **base_vars,
                "PROMPT1_JSON": json.dumps(p1_json) if p1_json else "",
                "PROMPT1_RESPONSE": p1_raw,
                "PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES": "",
            }
            p2_prompt = build_prompt("prompt2", prompt_profile_id, p2_vars)
            p2_raw, p2_parsed = await _call_llm_with_repair(
                p2_prompt,
                system_prompt,
                llm_config,
                "Prompt2",
                parse_json=not is_freeform,
            )
            if p2_parsed:
                p2_json = p2_parsed

        # ── Stage 3: Prompt 3 — Write resume ──────────────────────────────
        if _is_canceled(resume_id, user_id):
            return
        _update_progress(resume_id, user_id, "prompt3")

        p3_vars = {
            **base_vars,
            "PROMPT1_JSON": json.dumps(p1_json) if p1_json else "",
            "PROMPT1_RESPONSE": p1_raw,
            "PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES": "",
            "PROMPT2_JSON": json.dumps(p2_json) if p2_json else "",
            "PROMPT2_RESPONSE": p2_raw,
        }
        p3_prompt = build_prompt("prompt3", prompt_profile_id, p3_vars)
        p3_raw, _ = await _call_llm_with_repair(
            p3_prompt, system_prompt, llm_config, "Prompt3", parse_json=True
        )

        # ── Stage 4: Post-processing ───────────────────────────────────────
        _update_progress(resume_id, user_id, "postprocess")

        resume_data, generation_feedback = _extract_p3_payload(p3_raw)

        # Validate against ResumeData schema to catch structural issues early
        from app.schemas import ResumeData

        validated = ResumeData.model_validate(resume_data)
        resume_data = validated.model_dump()

        # ── Stage 5: Persist ───────────────────────────────────────────────
        job_record = db.create_job(content=jd_text, resume_id=resume_id, user_id=user_id)
        job_id = job_record["job_id"]

        generation_artifacts: dict[str, Any] = {"prompt2": p2_json} if p2_json else {}

        tailored = db.create_resume(
            content=resume_content,
            processed_data=resume_data,
            generation_feedback=generation_feedback,
            generation_artifacts=generation_artifacts,
            parent_id=resume_id,
            linked_master_resume_id=resume_id,
            is_master=False,
            processing_status="completed",
            user_id=user_id,
        )
        tailored_resume_id = tailored["resume_id"]

        db.create_improvement(
            original_resume_id=resume_id,
            tailored_resume_id=tailored_resume_id,
            job_id=job_id,
            improvements=[],
            user_id=user_id,
        )

        _set_completed(resume_id, user_id, tailored_resume_id)
        logger.info(
            "Tailor pipeline completed: resume %s → tailored %s",
            resume_id,
            tailored_resume_id,
        )

    except Exception as exc:
        logger.exception("Tailor pipeline failed for resume %s: %s", resume_id, exc)
        _set_failed(resume_id, user_id, str(exc))
