"""Collector: snapshot a completed tailor run as an eval case."""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.database import db

logger = logging.getLogger(__name__)


def collect_eval_case(
    tailored_resume_id: str,
    tags: list[str],
    notes: str | None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Load a completed tailor run by its tailored_resume_id and snapshot it
    as an eval case. Works for both web pipeline runs (tailor_job present) and
    Chrome extension runs (tailor_job absent, extension_run record present).
    Raises HTTPException on bad input.
    """
    if user_id is not None:
        tailored = db.get_resume(tailored_resume_id, user_id=user_id)
    else:
        tailored = db.get_resume_admin(tailored_resume_id)

    if tailored is None:
        raise HTTPException(status_code=404, detail="Tailored resume not found")

    master_id = tailored.get("linked_master_resume_id")
    if not master_id:
        raise HTTPException(
            status_code=400,
            detail="Resume has no linked master resume (not a tailor pipeline output)",
        )

    master = db.get_resume_admin(master_id)
    if master is None:
        raise HTTPException(status_code=404, detail="Master resume not found")

    tailor_job = tailored.get("tailor_job")
    if tailor_job and tailor_job.get("status") == "completed":
        # Web pipeline run — use tailor_job metadata
        prompt_profile_id = tailor_job.get("prompt_profile_id", "profile2")
        jd_source = tailor_job.get("jd_source", "raw_text")
        jd_url = tailor_job.get("jd_url")
        jd_text = tailor_job.get("jd_text", "")
        tailor_job_id = tailor_job.get("job_id", "")
    else:
        # Extension run — look up by resume_id for metadata
        meta_by_id = db.get_extension_run_metadata_by_resume_ids(
            [tailored_resume_id], user_id=user_id
        )
        ext_meta = meta_by_id.get(tailored_resume_id)
        if not ext_meta:
            raise HTTPException(
                status_code=400,
                detail="Resume was not produced by a completed tailor or extension run",
            )
        prompt_profile_id = ext_meta.get("prompt_profile_id") or "profile2"
        jd_source = "raw_text"
        jd_url = ext_meta.get("source_url")
        jd_text = ""
        tailor_job_id = ext_meta.get("run_id", "")

    case_id = "ec_" + uuid4().hex[:12]

    case = {
        "id": case_id,
        "user_id": user_id,
        "tags": tags or [],
        "notes": notes,
        "prompt_profile_id": prompt_profile_id,
        "jd_source": jd_source,
        "jd_url": jd_url,
        "jd_text": jd_text,
        "master_resume": master.get("processed_data") or {},
        "tailored_resume": tailored.get("processed_data") or {},
        "source_resume_id": master_id,
        "tailored_resume_id": tailored_resume_id,
        "tailor_job_id": tailor_job_id,
    }

    return db.create_eval_case(case)
