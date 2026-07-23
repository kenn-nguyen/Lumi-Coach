"""Tailor pipeline service: runs Prompt 1 → 2 → 3 to generate a tailored resume.

Mirrors the Chrome extension's orchestrator logic on the backend.
LLM calls are awaited (async). DB calls are synchronous SQLAlchemy
(fast; fine for ~dozen concurrent users).
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app import llm
from app.config import settings
from app.database import db
from app.llm import LLMConfig
from app.services.prompt_loader import (
    build_prompt,
    get_prompt_version,
    get_system_prompt_version,
    load_system_prompt,
)
from app.services.llm_stage_config import (
    get_stage_overrides as _get_stage_overrides_from_file,
    get_stage_provider_config,
)
from app.services.editor_notes import strip_editor_notes

logger = logging.getLogger(__name__)

# Map LiteLLM provider names to config.json key names (same as _PROVIDER_KEY_MAP in llm.py)
_PROVIDER_CONFIG_KEY: dict[str, str] = {
    "anthropic": "anthropic",
    "openai": "openai",
    "gemini": "google",
    "openrouter": "openrouter",
    "deepseek": "deepseek",
}

# Environment variable names that LiteLLM accepts per provider
_PROVIDER_ENV_VARS: dict[str, list[str]] = {
    "anthropic": ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
    "openai": ["OPENAI_API_KEY"],
    "gemini": ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
    "openrouter": ["OPENROUTER_API_KEY"],
    "deepseek": ["DEEPSEEK_API_KEY"],
}

_TAILOR_STAGES = ["prompt1", "prompt2", "prompt3"]


def _provider_has_key(provider: str, user_id: str | None, default_config: LLMConfig) -> bool:
    """Return True if any key source can supply a key for this provider."""
    if default_config.provider == provider and default_config.api_key:
        return True
    if user_id:
        try:
            user_config = db.get_user_llm_config(user_id)
            if user_config and llm.resolve_extra_api_key(user_config, provider):
                return True
        except Exception:
            pass
    try:
        from app.config import get_api_keys_from_config
        config_key = _PROVIDER_CONFIG_KEY.get(provider, provider)
        if get_api_keys_from_config().get(config_key):
            return True
    except Exception:
        pass
    # Check YAML-embedded apiKey (advanced mode: user pasted key directly in the YAML file)
    try:
        from app.services.llm_stage_config import get_yaml_api_key_for_provider
        if get_yaml_api_key_for_provider(provider, user_id):
            return True
    except Exception:
        pass
    return any(os.environ.get(v) for v in _PROVIDER_ENV_VARS.get(provider, []))


def check_stage_readiness(
    user_id: str | None, default_config: LLMConfig
) -> list[dict[str, Any]]:
    """Return [{stage, provider, configured}] for each pipeline stage."""
    result = []
    for stage in _TAILOR_STAGES:
        provider, _, _ = get_stage_provider_config(stage, user_id)
        if provider is None:
            provider = default_config.provider
        result.append({
            "stage": stage,
            "provider": provider,
            "configured": _provider_has_key(provider, user_id, default_config),
        })
    return result


def _preflight_check_stage_keys(user_id: str | None, default_config: LLMConfig) -> None:
    """Raise ValueError listing all stages that are missing API keys."""
    missing = [r for r in check_stage_readiness(user_id, default_config) if not r["configured"]]
    if not missing:
        return
    details = ", ".join(f"{r['stage']} ({r['provider']})" for r in missing)
    raise ValueError(
        f"Missing API key for: {details}. "
        f"Go to Settings → API Keys to add the required key(s)."
    )


def _resolve_stage_llm_config(
    stage: str,
    default_config: LLMConfig,
    user_id: str | None = None,
) -> tuple[LLMConfig, dict]:
    """Return (llm_config, extra_kwargs) for a pipeline stage.

    Extension schema: resolves the stage-specific provider, model, and API key.
    Legacy schema: applies model/kwargs override within the same provider.
    Falls back to default_config on any resolution failure.

    Key resolution order for a different provider:
    0. YAML-embedded apiKey in the uploaded stage config file.
    1. User's extra_api_keys from the DB (per-user, per-provider keys).
    2. Server config.json api_keys dict.
    3. LiteLLM environment variables.
    """
    provider, model, extra_kwargs = get_stage_provider_config(stage, user_id)

    # Pop the internal YAML-embedded key before it reaches LiteLLM
    yaml_api_key = extra_kwargs.pop("_api_key", None)

    if provider is None:
        # Simple/legacy mode — model/kwargs override within the same provider
        model_override, kwargs = _get_stage_overrides_from_file(
            default_config.provider, stage, user_id=user_id
        )
        if model_override:
            return default_config.model_copy(update={"model": model_override}), kwargs
        return default_config, kwargs

    if provider == default_config.provider:
        # Same provider — only model/params differ; apply YAML key if present
        cfg = default_config.model_copy(update={"model": model}) if model else default_config
        if yaml_api_key:
            cfg = cfg.model_copy(update={"api_key": yaml_api_key})
        return cfg, extra_kwargs

    # Different provider — resolve API key
    # Priority 0: YAML-embedded key (user pasted it in the config file)
    api_key = yaml_api_key or ""

    # Priority 1: User's per-provider extra_api_keys from DB
    if not api_key and user_id:
        try:
            user_config = db.get_user_llm_config(user_id)
            if user_config:
                api_key = llm.resolve_extra_api_key(user_config, provider)
        except Exception:
            pass

    # Priority 2: Fall back to config.json
    if not api_key:
        try:
            from app.config import get_api_keys_from_config
            config_keys = get_api_keys_from_config()
            api_key = config_keys.get(_PROVIDER_CONFIG_KEY.get(provider, provider), "")
        except Exception:
            pass

    if not api_key:
        logger.info(
            "Stage %s routes to provider %r — no explicit key found, "
            "LiteLLM will use environment variables.",
            stage,
            provider,
        )

    stage_config = LLMConfig(
        provider=provider,
        model=model or "",
        api_key=api_key,
        api_base=None,
        is_user_config=bool(api_key),
    )
    return stage_config, extra_kwargs


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


def _saved_provider_names(user_id: str | None) -> list[str]:
    """Provider names the user has a saved per-provider key for (for reminders)."""
    if not user_id:
        return []
    try:
        cfg = db.get_user_llm_config(user_id) or {}
        keys = cfg.get("extra_api_keys") or {}
        return sorted(name for name, value in keys.items() if value)
    except Exception:
        return []


def _set_completed(
    resume_id: str,
    user_id: str,
    tailored_resume_id: str,
    warning: str | None = None,
) -> None:
    _update_tailor_job(
        resume_id,
        user_id,
        {
            "status": "completed",
            "tailored_resume_id": tailored_resume_id,
            "completed_at": _utcnow_iso(),
            "warning": warning,
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
    model_override: str | None = None,
    stage_kwargs: dict | None = None,
) -> tuple[str, dict | None]:
    """
    Call LLM and optionally parse JSON. On parse failure, attempt one repair call.
    Returns (raw_text, parsed_dict_or_None).
    """
    raw = await llm.complete(
        prompt,
        system_prompt=system_prompt,
        config=llm_config,
        model_override=model_override,
        stage_kwargs=dict(stage_kwargs) if stage_kwargs else None,
    )

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
    # Repair call uses no special stage params — just need valid JSON output
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

    # Normalise empty strings so the routing condition below is unambiguous
    jd_url = jd_url.strip() if jd_url else None
    jd_text = jd_text.strip() if jd_text else None

    run_started_at = datetime.now(timezone.utc)
    p1_duration_ms: int | None = None
    p2_duration_ms: int | None = None
    p3_duration_ms: int | None = None

    logger.warning(
        "Tailor pipeline start: resume=%s jd_url=%s jd_text_len=%s",
        resume_id,
        repr(jd_url),
        len(jd_text) if jd_text else 0,
    )

    # ── Preflight: validate all stage API keys before doing any work ───────
    try:
        _preflight_check_stage_keys(user_id, llm_config)
    except ValueError as exc:
        _update_tailor_job(resume_id, user_id, {
            "status": "failed",
            "error_message": str(exc),
            "error_code": "missing_api_key",
            "completed_at": _utcnow_iso(),
        })
        return

    try:
        system_prompt = load_system_prompt()
        apify_title: str | None = None  # set when Apify extraction succeeds
        apify_location: str | None = None

        # ── Stage 0: JD extraction ─────────────────────────────────────────
        if jd_url and not jd_text:
            if _is_canceled(resume_id, user_id):
                return
            _update_progress(resume_id, user_id, "apify")
            from app.services.apify_linkedin import fetch_linkedin_job_detail_via_apify

            # Try the user's/config Apify key first, then the server (env) key.
            apify_keys: list[str] = []
            for candidate in (apify_api_key, settings.apify_api_token):
                token = (candidate or "").strip()
                if token and token not in apify_keys:
                    apify_keys.append(token)

            if not apify_keys:
                _set_failed(
                    resume_id,
                    user_id,
                    "To tailor from a LinkedIn URL you need an Apify API key. Add one in "
                    "Settings (get it at https://apify.com/apimaestro/linkedin-job-detail), "
                    "or paste the job description text instead.",
                )
                return

            jd_data = None
            last_error: Exception | None = None
            for token in apify_keys:
                try:
                    jd_data = await fetch_linkedin_job_detail_via_apify(jd_url, api_key=token)
                    break
                except Exception as exc:  # noqa: BLE001 - try the next key, report at the end
                    last_error = exc
                    logger.warning("Apify fetch failed with one key for %s: %s", jd_url, exc)

            if jd_data is None:
                logger.error("Apify LinkedIn fetch failed for %s: %s", jd_url, last_error)
                _set_failed(
                    resume_id,
                    user_id,
                    "Couldn't fetch the LinkedIn job from Apify. Check that your Apify API "
                    "key in Settings is valid (get one at "
                    "https://apify.com/apimaestro/linkedin-job-detail), or paste the job "
                    "description text instead.",
                )
                return

            jd_text = jd_data.get("raw_text") or ""
            job_title = jd_data.get("title", "").strip()
            company = jd_data.get("company", "").strip()
            apify_location = jd_data.get("location", "").strip() or None
            if company and job_title:
                apify_title = f"{company} - {job_title}"
            elif job_title:
                apify_title = job_title
            elif company:
                apify_title = company

        if not jd_text:
            _set_failed(resume_id, user_id, "No job description text available.")
            return

        # Persist JD metadata so eval collector can retrieve it later
        _update_tailor_job(resume_id, user_id, {
            "jd_url": jd_url,
            "jd_text": jd_text,
            "jd_source": "url" if jd_url else "raw_text",
        })

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

        p1_prompt = ""
        p1_raw = ""
        p1_json: dict[str, Any] = {}
        p2_prompt = ""
        p2_raw = ""
        p2_json: dict[str, Any] = {}
        p3_prompt = ""

        # LLM fallback: if the user's key fails a stage (invalid key / quota /
        # unsupported model), finish the run on Lumi's free shared model instead of
        # failing — and remember it so we can tell the user afterwards.
        _fallback = {"used": False}
        _free_config: LLMConfig | None = None

        async def _stage_call(
            prompt: str,
            sys_prompt: str,
            stage_config: LLMConfig,
            label: str,
            *,
            parse_json: bool,
            stage_kwargs: dict | None,
        ) -> tuple[str, dict | None]:
            nonlocal _free_config
            if _fallback["used"] and _free_config is not None:
                return await _call_llm_with_repair(
                    prompt, sys_prompt, _free_config, label, parse_json=parse_json
                )
            try:
                return await _call_llm_with_repair(
                    prompt,
                    sys_prompt,
                    stage_config,
                    label,
                    parse_json=parse_json,
                    stage_kwargs=stage_kwargs,
                )
            except llm.UserLlmRequestError as exc:
                candidate = llm.get_server_llm_config()
                # Only fall back if the free shared model is actually usable.
                if not candidate.api_key and candidate.provider != "vertex_ai":
                    raise
                _free_config = candidate
                _fallback["used"] = True
                _fallback["reason"] = str(exc)
                logger.warning(
                    "User LLM key failed at %s — completing on the free shared model.", label
                )
                return await _call_llm_with_repair(
                    prompt, sys_prompt, _free_config, label, parse_json=parse_json
                )

        # ── Stage 1: Prompt 1 — Analyze JD ────────────────────────────────
        if not is_single_stage:
            if _is_canceled(resume_id, user_id):
                return
            _update_progress(resume_id, user_id, "prompt1")

            p1_config, p1_kwargs = _resolve_stage_llm_config("prompt1", llm_config, user_id)

            p1_prompt = build_prompt("prompt1", prompt_profile_id, base_vars)
            _p1_start = datetime.now(timezone.utc)
            p1_raw, p1_parsed = await _stage_call(
                p1_prompt,
                system_prompt,
                p1_config,
                "Prompt1",
                parse_json=not is_freeform,
                stage_kwargs=p1_kwargs,
            )
            p1_duration_ms = int((datetime.now(timezone.utc) - _p1_start).total_seconds() * 1000)
            if p1_parsed:
                p1_json = p1_parsed

        # ── Stage 2: Prompt 2 — Strategize ────────────────────────────────
        if not is_single_stage:
            if _is_canceled(resume_id, user_id):
                return
            _update_progress(resume_id, user_id, "prompt2")

            p2_config, p2_kwargs = _resolve_stage_llm_config("prompt2", llm_config, user_id)
            p2_vars = {
                **base_vars,
                "PROMPT1_JSON": json.dumps(p1_json) if p1_json else "",
                "PROMPT1_RESPONSE": p1_raw,
                "PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES": "",
            }
            p2_prompt = build_prompt("prompt2", prompt_profile_id, p2_vars)
            _p2_start = datetime.now(timezone.utc)
            p2_raw, p2_parsed = await _stage_call(
                p2_prompt,
                system_prompt,
                p2_config,
                "Prompt2",
                parse_json=not is_freeform,
                stage_kwargs=p2_kwargs,
            )
            p2_duration_ms = int((datetime.now(timezone.utc) - _p2_start).total_seconds() * 1000)
            if p2_parsed:
                p2_json = p2_parsed

        # ── Stage 3: Prompt 3 — Write resume ──────────────────────────────
        if _is_canceled(resume_id, user_id):
            return
        _update_progress(resume_id, user_id, "prompt3")

        p3_config, p3_kwargs = _resolve_stage_llm_config("prompt3", llm_config, user_id)
        # Editor-note firewall: Prompt 2 saw the raw resume so it could interpret
        # author directives; Prompt 3 must never see a `<!-- ... -->` span, or it
        # could surface in the final resume. Strip every source Prompt 3 reads.
        _stripped_resume = strip_editor_notes(resume_content)
        p3_vars = {
            **base_vars,
            "CURRENT_RESUME": _stripped_resume,
            "MASTER_RESUME": _stripped_resume,
            "PROMPT1_JSON": json.dumps(p1_json) if p1_json else "",
            "PROMPT1_RESPONSE": p1_raw,
            "PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES": "",
            "PROMPT2_JSON": strip_editor_notes(json.dumps(p2_json)) if p2_json else "",
            "PROMPT2_RESPONSE": strip_editor_notes(p2_raw),
        }
        p3_prompt = build_prompt("prompt3", prompt_profile_id, p3_vars)
        _p3_start = datetime.now(timezone.utc)
        p3_raw, _ = await _stage_call(
            p3_prompt,
            system_prompt,
            p3_config,
            "Prompt3",
            parse_json=True,
            stage_kwargs=p3_kwargs,
        )
        p3_duration_ms = int((datetime.now(timezone.utc) - _p3_start).total_seconds() * 1000)

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

        # Attach prompt provenance so the viewer can show version info
        prompt_setup: dict[str, Any] = {
            "prompt_profile_id": prompt_profile_id,
            "prompt1_version_id": get_prompt_version("prompt1", prompt_profile_id),
            "prompt2_version_id": get_prompt_version("prompt2", prompt_profile_id),
            "prompt3_version_id": get_prompt_version("prompt3", prompt_profile_id),
            "system_prompt_version_id": get_system_prompt_version(),
        }
        # prompt_setup is passed explicitly to upsert_extension_run — do not embed in feedback

        generation_artifacts: dict[str, Any] = {"prompt2": p2_json} if p2_json else {}

        # Apify path: "Company - Job Title" from parsed JD metadata.
        # Text-paste path: use P1's normalized target_role. company_context is a short
        # framing sentence ("Company is a CRM for…"), not a company name — never put
        # it in the title.
        # Fallback for single-stage profiles (profile4) that skip P1/P2: P2's recommended_title.
        if not apify_title and p1_json:
            apify_title = (p1_json.get("target_role") or "").strip() or None
        resume_title: str | None = apify_title or (
            (p2_json.get("recommended_title") or "").strip() or None
            if p2_json
            else None
        )

        tailored = db.create_resume(
            content=resume_content,
            processed_data=resume_data,
            generation_feedback=generation_feedback,
            generation_artifacts=generation_artifacts,
            parent_id=resume_id,
            linked_master_resume_id=resume_id,
            is_master=False,
            processing_status="completed",
            title=resume_title,
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

        fallback_warning: str | None = None
        if _fallback["used"]:
            reason = _fallback.get("reason") or (
                f"Your {llm_config.provider} configuration couldn't complete this."
            )
            saved = [name for name in _saved_provider_names(user_id) if name != llm_config.provider]
            fallback_warning = f"{reason} We tailored with Lumi's free model instead."
            if saved:
                fallback_warning += (
                    f" You also have keys saved for {', '.join(saved)} — fix "
                    f"{llm_config.provider} or switch provider in Settings for full quality."
                )
            else:
                fallback_warning += (
                    f" Fix your {llm_config.provider} key or model in Settings for full quality."
                )

        _set_completed(resume_id, user_id, tailored_resume_id, warning=fallback_warning)

        # Record the web tailor run in extension_runs (unified log — same table as extension).
        _total_ms = int((datetime.now(timezone.utc) - run_started_at).total_seconds() * 1000)
        p1_company = (p1_json.get("company_context") or "").strip() if p1_json else ""
        try:
            _summary: dict[str, Any] = {}
            if p1_duration_ms is not None:
                _summary["prompt1_duration_ms"] = p1_duration_ms
            if p2_duration_ms is not None:
                _summary["prompt2_duration_ms"] = p2_duration_ms
            if p3_duration_ms is not None:
                _summary["prompt3_duration_ms"] = p3_duration_ms
            db.upsert_extension_run(
                run_id=job_id,
                status="generated",
                user_id=user_id,
                source="web",
                title=resume_title,
                company=p1_company or None,
                location=apify_location,
                source_url=jd_url,
                jd_text=jd_text,
                job_source="web",
                resume_id=tailored_resume_id,
                preview_url=f"/builder/{tailored_resume_id}",
                provider_id=llm_config.provider,
                provider_label=llm_config.model,
                generated_at=datetime.now(timezone.utc),
                total_duration_ms=_total_ms,
                summary=_summary,
                prompt_setup={
                    "prompt_profile_id": prompt_profile_id,
                    "prompt1_version_id": get_prompt_version("prompt1", prompt_profile_id),
                    "prompt2_version_id": get_prompt_version("prompt2", prompt_profile_id),
                    "prompt3_version_id": get_prompt_version("prompt3", prompt_profile_id),
                    "system_prompt_version_id": get_system_prompt_version(),
                },
                prompt_artifacts={
                    "prompt1": {"input": p1_prompt, "parsed": p1_json},
                    "prompt2": {"input": p2_prompt, "parsed": p2_json},
                    "prompt3": {
                        "input": p3_prompt,
                        "parsed": resume_data,
                        "feedback": generation_feedback,
                    },
                },
            )
        except Exception as run_exc:
            logger.warning("Failed to record web tailor run in extension_runs: %s", run_exc)

        logger.info(
            "Tailor pipeline completed: resume %s → tailored %s",
            resume_id,
            tailored_resume_id,
        )

    except Exception as exc:
        logger.exception("Tailor pipeline failed for resume %s: %s", resume_id, exc)
        _set_failed(resume_id, user_id, str(exc))
