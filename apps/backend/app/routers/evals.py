"""Admin-only evals endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Query
from fastapi.responses import Response
from fastapi.routing import APIRouter

from app.database import db
from app.routers.admin import ALLOWED_ADMIN_EMAILS, _require_admin_user
from app.schemas.evals import (
    CreateEvalCaseRequest,
    EvalCaseListResponse,
    EvalCaseResponse,
    EvalRunResponse,
    RunEvalStepRequest,
    RunEvalStepResponse,
)
from app.security import AuthenticatedUser, require_current_user
from app.services.evals.collector import collect_eval_case
from app.services.evals.exporter import export_jsonl
from app.services.evals.runner import run_step

router = APIRouter(prefix="/admin/evals", tags=["Evals"])


def _enrich_case(case: dict) -> dict:
    runs = db.get_latest_eval_runs_for_cases([case["id"]])
    case["latest_runs"] = runs.get(case["id"], {})
    return case


@router.post("/cases", response_model=EvalCaseResponse)
async def create_eval_case(
    body: CreateEvalCaseRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> EvalCaseResponse:
    _require_admin_user(current_user)
    case = collect_eval_case(
        tailored_resume_id=body.tailored_resume_id,
        tags=body.tags,
        notes=body.notes,
        user_id=current_user.user_id,
    )
    return EvalCaseResponse.model_validate(_enrich_case(case))


@router.get("/cases", response_model=EvalCaseListResponse)
async def list_eval_cases(
    profile: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> EvalCaseListResponse:
    _require_admin_user(current_user)
    cases = db.list_eval_cases(profile=profile, tag=tag)
    case_ids = [c["id"] for c in cases]
    runs_by_case = db.get_latest_eval_runs_for_cases(case_ids)
    items = []
    for case in cases:
        case["latest_runs"] = runs_by_case.get(case["id"], {})
        items.append(EvalCaseResponse.model_validate(case))
    return EvalCaseListResponse(items=items, total=len(items))


@router.delete("/cases/{case_id}", status_code=204)
async def delete_eval_case(
    case_id: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> None:
    _require_admin_user(current_user)
    deleted = db.delete_eval_case(case_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Eval case not found")


@router.post("/runs", response_model=RunEvalStepResponse)
async def run_eval_step(
    body: RunEvalStepRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> RunEvalStepResponse:
    _require_admin_user(current_user)
    results = await run_step(case_ids=body.case_ids, step=body.step)
    return RunEvalStepResponse(
        results=[EvalRunResponse.model_validate(r) for r in results]
    )


@router.get("/export")
async def export_eval_cases(
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> Response:
    _require_admin_user(current_user)
    content = export_jsonl()
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"eval-set-{date_str}.jsonl"
    return Response(
        content=content,
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
