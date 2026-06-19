"""Extension-owned backend endpoints."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import db
from app.schemas import ExtensionRunUpsertRequest, ExtensionRunUpsertResponse
from app.security import AuthenticatedUser, require_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/extension", tags=["Extension"])

SAFE_EXTENSION_RUN_SUMMARY_KEYS = {
    "cancel_phase",
    "cancel_reason",
    "custom_context_length",
    "custom_context_provided",
    "description_length",
    "description_provenance",
    "job_readiness",
    "manual_job_input_used",
    "patch_duration_ms",
    "prompt1_duration_ms",
    "prompt2_duration_ms",
    "prompt3_duration_ms",
    "prompt3_validation_error_count",
    "provider_mode",
    "provider_vendor",
    "scrape_confidence",
    "storyboard_present",
}


def _is_json_primitive(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def _filter_extension_run_summary(summary: dict[str, Any]) -> dict[str, Any]:
    """Keep only small operational metadata; never persist prompt/resume payloads here."""
    filtered: dict[str, Any] = {}
    for key, value in summary.items():
        if key not in SAFE_EXTENSION_RUN_SUMMARY_KEYS:
            continue
        if _is_json_primitive(value):
            filtered[key] = value
    return filtered


def _filter_prompt_artifact_entry(artifact: Any) -> dict[str, Any]:
    """Keep only essential display fields from a single artifact metadata entry."""
    if not isinstance(artifact, dict):
        return {}
    return {k: v for k, v in artifact.items() if k in {"promptLabel", "promptVersion"}}


def _filter_prompt_artifacts(artifacts: dict[str, Any]) -> dict[str, Any]:
    """Normalize extension prompt_artifacts before storage.

    - Removes 'raw' from prompt1/2/3 (raw LLM text is large and unneeded with 'input'+'parsed').
    - Renames 'result' → 'parsed' in prompt1/2 for naming consistency with prompt3.
    - Slims the 'metadata' block: removes per-artifact noise fields, duplicate version IDs,
      and redundant provider fields that already appear at the top-level run.
    """
    out: dict[str, Any] = {}

    for stage in ("prompt1", "prompt2", "prompt3"):
        entry = artifacts.get(stage)
        if not isinstance(entry, dict):
            continue
        cleaned: dict[str, Any] = {}
        if "input" in entry:
            cleaned["input"] = entry["input"]
        if stage in ("prompt1", "prompt2"):
            parsed = entry.get("parsed") or entry.get("result")
            if parsed is not None:
                cleaned["parsed"] = parsed
        else:
            if "parsed" in entry:
                cleaned["parsed"] = entry["parsed"]
            if "feedback" in entry:
                cleaned["feedback"] = entry["feedback"]
        out[stage] = cleaned

    metadata = artifacts.get("metadata")
    if isinstance(metadata, dict):
        meta_out: dict[str, Any] = {}
        for top_key in ("capturedAt", "schemaVersion", "promptSetId"):
            if top_key in metadata:
                meta_out[top_key] = metadata[top_key]

        prompts = metadata.get("prompts")
        if isinstance(prompts, dict):
            prompts_out: dict[str, Any] = {}
            for name, prompt_meta in prompts.items():
                if not isinstance(prompt_meta, dict):
                    continue
                pm: dict[str, Any] = {}
                for field in ("renderedAt", "renderedHash", "templateName"):
                    if field in prompt_meta:
                        pm[field] = prompt_meta[field]
                raw_artifacts = prompt_meta.get("artifacts")
                if isinstance(raw_artifacts, list):
                    pm["artifacts"] = [_filter_prompt_artifact_entry(a) for a in raw_artifacts]
                prompts_out[name] = pm
            meta_out["prompts"] = prompts_out

        system_prompt = metadata.get("systemPrompt")
        if isinstance(system_prompt, dict):
            sp: dict[str, Any] = {}
            for field in ("renderedAt", "renderedHash", "templateName"):
                if field in system_prompt:
                    sp[field] = system_prompt[field]
            raw_artifacts = system_prompt.get("artifacts")
            if isinstance(raw_artifacts, list):
                sp["artifacts"] = [_filter_prompt_artifact_entry(a) for a in raw_artifacts]
            meta_out["systemPrompt"] = sp

        provider = metadata.get("provider")
        if isinstance(provider, dict):
            provider_out: dict[str, Any] = {}
            for field in ("targetUrl", "apiBaseUrl"):
                if field in provider:
                    provider_out[field] = provider[field]
            if provider_out:
                meta_out["provider"] = provider_out

        out["metadata"] = meta_out

    return out


@router.post("/runs", response_model=ExtensionRunUpsertResponse)
async def upsert_extension_run(
    request: ExtensionRunUpsertRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ExtensionRunUpsertResponse:
    """Save or update a sanitized extension run summary for the current user."""
    try:
        saved = db.upsert_extension_run(
            run_id=request.run_id,
            status=request.status,
            user_id=current_user.user_id,
            title=request.title,
            company=request.company,
            location=request.location,
            source_url=request.source_url,
            job_source=request.job_source,
            resume_id=request.resume_id,
            preview_url=request.preview_url,
            provider_id=request.provider_id,
            provider_label=request.provider_label,
            generated_at=request.generated_at,
            total_duration_ms=request.total_duration_ms,
            jd_text=request.jd_text,
            source=request.source,
            summary=_filter_extension_run_summary(request.summary),
            prompt_artifacts=_filter_prompt_artifacts(request.prompt_artifacts or {}),
        )
    except Exception as exc:
        logger.exception("Failed to save extension run summary: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save extension run summary. Please try again.",
        ) from exc

    return ExtensionRunUpsertResponse(
        request_id=str(uuid4()),
        run_id=saved["run_id"],
        status=saved["status"],
    )


@router.get("/runs")
async def list_user_extension_runs(
    status: str | None = Query(None),
    run_source: str | None = Query(None),
    search: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> dict:
    """Return the current user's extension runs, newest first, with optional filters."""

    def _parse_start(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    def _parse_end(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
        except ValueError:
            return None

    return db.list_extension_runs_for_admin(
        user_id=current_user.user_id,
        status=status,
        run_source=run_source,
        search=search,
        date_from=_parse_start(date_from),
        date_to=_parse_end(date_to),
        limit=limit,
        offset=offset,
    )


@router.get("/runs/{run_id}")
async def get_user_extension_run(
    run_id: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> dict:
    """Return a single run (with full prompt artifacts) belonging to the current user."""
    run = db.get_extension_run_for_admin(
        user_id=current_user.user_id,
        run_id=run_id,
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    return run
