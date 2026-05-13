"""Admin-only backend endpoints."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.database import db
from app.schemas.models import ExtensionRunAdminItem, ExtensionRunAdminListResponse
from app.security import AuthenticatedUser, require_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])

ALLOWED_ADMIN_EMAILS = {"kenn.nguyen@aya.yale.edu"}


def _require_admin_user(current_user: AuthenticatedUser) -> None:
    if current_user.email.strip().lower() not in ALLOWED_ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access required")


def _parse_date_start(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid date_from format") from exc
    return parsed.replace(tzinfo=timezone.utc)


def _parse_date_end(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid date_to format") from exc
    return parsed.replace(tzinfo=timezone.utc) + timedelta(days=1)


def _json_download_response(filename: str, payload: Any) -> Response:
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/extension-runs", response_model=ExtensionRunAdminListResponse)
async def list_extension_runs(
    status: str | None = Query(default=None),
    prompt_profile_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ExtensionRunAdminListResponse:
    _require_admin_user(current_user)
    result = db.list_extension_runs_for_admin(
        status=status,
        prompt_profile_id=prompt_profile_id,
        search=search,
        date_from=_parse_date_start(date_from),
        date_to=_parse_date_end(date_to),
        limit=limit,
        offset=offset,
        include_prompt_artifacts=False,
        scan_limit=max(1000, limit + offset),
    )
    return ExtensionRunAdminListResponse(
        items=[ExtensionRunAdminItem.model_validate(item) for item in result["items"]],
        total=result["total"],
    )


@router.get("/extension-runs/item", response_model=ExtensionRunAdminItem)
async def get_extension_run_item(
    user_id: str = Query(min_length=1),
    run_id: str = Query(min_length=1),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ExtensionRunAdminItem:
    _require_admin_user(current_user)
    item = db.get_extension_run_for_admin(user_id=user_id, run_id=run_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Extension run not found")
    return ExtensionRunAdminItem.model_validate(item)


@router.get("/extension-runs/export")
async def export_extension_runs(
    status: str | None = Query(default=None),
    prompt_profile_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> Response:
    _require_admin_user(current_user)
    result = db.list_extension_runs_for_admin(
        status=status,
        prompt_profile_id=prompt_profile_id,
        search=search,
        date_from=_parse_date_start(date_from),
        date_to=_parse_date_end(date_to),
        limit=1000,
        offset=0,
        include_prompt_artifacts=True,
        scan_limit=2000,
    )
    return _json_download_response(
        "extension-runs-export.json",
        result["items"],
    )
