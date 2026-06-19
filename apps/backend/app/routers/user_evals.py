"""User-scoped evals endpoints — any authenticated user can access their own cases."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Query
from fastapi.routing import APIRouter

from app.database import db
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
from app.services.evals.runner import run_step

router = APIRouter(prefix="/evals", tags=["User Evals"])


def _enrich_case(case: dict) -> dict:
    runs = db.get_latest_eval_runs_for_cases([case["id"]])
    case["latest_runs"] = runs.get(case["id"], {})
    return case


@router.post("/cases", response_model=EvalCaseResponse)
async def user_create_eval_case(
    body: CreateEvalCaseRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> EvalCaseResponse:
    case = collect_eval_case(
        tailored_resume_id=body.tailored_resume_id,
        tags=body.tags,
        notes=body.notes,
        user_id=current_user.user_id,
    )
    return EvalCaseResponse.model_validate(_enrich_case(case))


@router.get("/cases", response_model=EvalCaseListResponse)
async def user_list_eval_cases(
    profile: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> EvalCaseListResponse:
    cases = db.list_eval_cases(profile=profile, tag=tag, user_id=current_user.user_id)
    case_ids = [c["id"] for c in cases]
    runs_by_case = db.get_latest_eval_runs_for_cases(case_ids)
    items = []
    for case in cases:
        case["latest_runs"] = runs_by_case.get(case["id"], {})
        items.append(EvalCaseResponse.model_validate(case))
    return EvalCaseListResponse(items=items, total=len(items))


@router.delete("/cases/{case_id}", status_code=204)
async def user_delete_eval_case(
    case_id: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> None:
    deleted = db.delete_eval_case(case_id, user_id=current_user.user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Eval case not found")


@router.post("/runs", response_model=RunEvalStepResponse)
async def user_run_eval_step(
    body: RunEvalStepRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> RunEvalStepResponse:
    results = await run_step(
        case_ids=body.case_ids, step=body.step, user_id=current_user.user_id
    )
    return RunEvalStepResponse(
        results=[EvalRunResponse.model_validate(r) for r in results]
    )
