"""Pydantic schemas for the evals system."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CreateEvalCaseRequest(BaseModel):
    tailored_resume_id: str
    tags: list[str] = Field(default_factory=list)
    notes: str | None = None


class EvalCaseResponse(BaseModel):
    id: str
    created_at: str
    user_id: str | None = None
    tags: list[str]
    notes: str | None
    prompt_profile_id: str
    jd_source: str
    jd_url: str | None
    jd_text: str
    source_resume_id: str
    tailored_resume_id: str
    tailor_job_id: str
    latest_runs: dict[str, dict[str, Any]] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class EvalCaseListResponse(BaseModel):
    items: list[EvalCaseResponse]
    total: int


class RunEvalStepRequest(BaseModel):
    case_ids: list[str] = Field(min_length=1)
    step: Literal["structural", "heuristics", "judge"]


class EvalRunResponse(BaseModel):
    id: str
    case_id: str
    created_at: str
    step: str
    passed: bool
    scores: dict[str, Any]
    error: str | None

    model_config = {"from_attributes": True}


class RunEvalStepResponse(BaseModel):
    results: list[EvalRunResponse]
