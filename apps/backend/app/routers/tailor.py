"""Tailor pipeline endpoints.

Three endpoints:
  POST /resumes/{resume_id}/tailor        — start pipeline as a background task
  GET  /resumes/{resume_id}/tailor/status — poll for progress / completion
  POST /resumes/{resume_id}/tailor/cancel — cancel a running job
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.config_cache import load_config
from app.database import db
from app.llm import get_llm_config
from app.schemas.tailor import TailorRequest, TailorStartResponse, TailorStatusResponse
from app.security import AuthenticatedUser, require_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tailor"])


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/resumes/{resume_id}/tailor", response_model=TailorStartResponse)
async def start_tailor(
    resume_id: str,
    request: TailorRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> TailorStartResponse:
    """Start the tailor pipeline for a resume.

    Validates that the resume belongs to the user, checks for an already-running
    job, seeds the tailor_job JSONB field, then fires the pipeline as a
    background task.
    """
    user_id = current_user.user_id

    # ── Validate resume ownership ──────────────────────────────────────────
    resume = db.get_resume(resume_id, user_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    # ── Guard: one active tailor job at a time ─────────────────────────────
    # `resume` (fetched above) carries this resume's tailor_job. Block a second
    # run while one is in flight — a new run would clobber the shared tailor_job
    # state and spawn a duplicate tailored resume.
    existing_job = resume.get("tailor_job") or {}
    if existing_job.get("status") == "running":
        raise HTTPException(
            status_code=409,
            detail="A tailor job is already running. Wait for it to finish.",
        )

    # ── Seed tailor_job state ──────────────────────────────────────────────
    job_id = str(uuid4())
    tailor_job = {
        "job_id": job_id,
        "status": "running",
        "progress_stage": "starting",
        "prompt_profile_id": request.prompt_profile_id,
        "started_at": _utcnow_iso(),
        "completed_at": None,
        "tailored_resume_id": None,
        "error_message": None,
    }
    db.update_resume(resume_id, {"tailor_job": tailor_job}, user_id)

    # ── Resolve LLM config (user key → server fallback) ───────────────────
    llm_config = get_llm_config(user_id)

    # ── Queue background pipeline ──────────────────────────────────────────
    from app.services.tailor import run_tailor_pipeline

    background_tasks.add_task(
        run_tailor_pipeline,
        resume_id=resume_id,
        user_id=user_id,
        jd_url=request.jd_url,
        jd_text=request.jd_text,
        prompt_profile_id=request.prompt_profile_id,
        llm_config=llm_config,
        apify_api_key=load_config().get("apify_api_token") or None,
    )

    logger.info("Tailor job %s queued for resume %s (user %s)", job_id, resume_id, user_id)

    return TailorStartResponse(
        job_id=job_id,
        status="running",
        message="Tailor pipeline started.",
    )


@router.get("/resumes/{resume_id}/tailor/status", response_model=TailorStatusResponse)
async def get_tailor_status(
    resume_id: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> TailorStatusResponse:
    """Return the current tailor_job status for a resume."""
    user_id = current_user.user_id

    resume = db.get_resume(resume_id, user_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    job = resume.get("tailor_job")
    if not job:
        raise HTTPException(status_code=404, detail="No tailor job found for this resume.")

    return TailorStatusResponse(
        job_id=job.get("job_id", ""),
        status=job.get("status", "unknown"),
        progress_stage=job.get("progress_stage"),
        prompt_profile_id=job.get("prompt_profile_id", ""),
        started_at=job.get("started_at", ""),
        completed_at=job.get("completed_at"),
        tailored_resume_id=job.get("tailored_resume_id"),
        error_message=job.get("error_message"),
        warning=job.get("warning"),
    )


@router.post("/resumes/{resume_id}/tailor/cancel")
async def cancel_tailor(
    resume_id: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> dict:
    """Cancel a running tailor job.

    Sets tailor_job.status = 'canceled'. The pipeline checks this flag
    before each LLM stage and exits early when it sees 'canceled'.
    """
    user_id = current_user.user_id

    resume = db.get_resume(resume_id, user_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    job = resume.get("tailor_job") or {}
    if job.get("status") not in ("running",):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel a job in '{job.get('status')}' state.",
        )

    current_job = dict(job)
    current_job.update({"status": "canceled", "completed_at": _utcnow_iso()})
    db.update_resume(resume_id, {"tailor_job": current_job}, user_id)

    logger.info("Tailor job %s canceled (resume %s, user %s)", job.get("job_id"), resume_id, user_id)

    return {"message": "Job canceled.", "job_id": job.get("job_id")}
