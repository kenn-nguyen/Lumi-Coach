"""Job description management endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.schemas import (
    JobUploadRequest,
    JobUploadResponse,
    LinkedInApifyFallbackRequest,
    LinkedInApifyFallbackResponse,
)
from app.security import require_current_user
from app.services.apify_linkedin import fetch_linkedin_job_detail_via_apify

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/jobs",
    tags=["Jobs"],
    dependencies=[Depends(require_current_user)],
)


@router.post("/upload", response_model=JobUploadResponse)
async def upload_job_descriptions(request: JobUploadRequest) -> JobUploadResponse:
    """Upload one or more job descriptions.

    Stores the raw text for later use in resume tailoring.
    Returns an array of job_ids corresponding to the input array.
    """
    if not request.job_descriptions:
        raise HTTPException(status_code=400, detail="No job descriptions provided")

    job_ids = []
    for jd in request.job_descriptions:
        if not jd.strip():
            raise HTTPException(status_code=400, detail="Empty job description")

        job = db.create_job(
            content=jd.strip(),
            resume_id=request.resume_id,
        )
        job_ids.append(job["job_id"])

    return JobUploadResponse(
        message="data successfully processed",
        job_id=job_ids,
        request={
            "job_descriptions": request.job_descriptions,
            "resume_id": request.resume_id,
        },
    )


@router.get("/{job_id}")
async def get_job(job_id: str) -> dict:
    """Get job description by ID."""
    job = db.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.post(
    "/linkedin-apify-fallback",
    response_model=LinkedInApifyFallbackResponse,
)
async def linkedin_apify_fallback(
    request: LinkedInApifyFallbackRequest,
) -> LinkedInApifyFallbackResponse:
    """Fetch one LinkedIn job detail via the server-side Apify fallback."""

    try:
        payload = await fetch_linkedin_job_detail_via_apify(request.source_url)
        return LinkedInApifyFallbackResponse(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.error("Server-side LinkedIn Apify fallback failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Job extraction fallback is unavailable. Paste the job description manually.",
        ) from exc
    except Exception as exc:
        logger.error("Unexpected LinkedIn Apify fallback failure: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Job extraction fallback failed. Paste the job description manually.",
        ) from exc
