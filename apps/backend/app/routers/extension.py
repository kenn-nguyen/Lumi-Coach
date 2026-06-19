"""Extension-owned backend endpoints."""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

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
    "date_posted",
    "description_length",
    "description_provenance",
    "job_key",
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
            summary=_filter_extension_run_summary(request.summary),
            prompt_artifacts=request.prompt_artifacts,
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
    limit: int = 50,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> dict:
    """Return the current user's extension runs, newest first."""
    runs = db.list_extension_runs_for_user(user_id=current_user.user_id, limit=limit)
    return {"items": runs, "total": len(runs)}
