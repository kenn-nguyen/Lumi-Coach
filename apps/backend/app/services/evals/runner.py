"""Orchestrates running a single eval step across a batch of cases."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.database import db
from app.services.evals.scorer_structural import score_structural
from app.services.evals.scorer_heuristics import score_heuristics
from app.services.evals.scorer_judge import score_judge

logger = logging.getLogger(__name__)


async def run_step(
    case_ids: list[str], step: str, user_id: str | None = None
) -> list[dict[str, Any]]:
    """
    Run one scoring step across all given case IDs.
    Returns a list of EvalRun dicts (one per case).
    Errors per case are captured — one failure doesn't abort the rest.
    """
    results: list[dict[str, Any]] = []

    for case_id in case_ids:
        case = db.get_eval_case(case_id, user_id=user_id)
        if case is None:
            logger.warning("Eval case not found or access denied: %s — skipping", case_id)
            continue

        master = case["master_resume"]
        tailored = case["tailored_resume"]
        jd_text = case["jd_text"]
        profile_id = case["prompt_profile_id"]

        run_id = "er_" + uuid4().hex[:12]
        passed = False
        scores: dict[str, Any] = {}
        error: str | None = None

        try:
            if step == "structural":
                passed, scores = score_structural(master, tailored)
            elif step == "heuristics":
                passed, scores = score_heuristics(master, tailored, jd_text)
            elif step == "judge":
                passed, scores = await score_judge(master, tailored, jd_text, profile_id)
            else:
                raise ValueError(f"Unknown eval step: {step}")
        except Exception as exc:
            logger.exception("Scorer error for case %s step %s", case_id, step)
            error = str(exc)
            passed = False
            scores = {}

        run = db.create_eval_run({
            "id": run_id,
            "case_id": case_id,
            "created_at": datetime.now(timezone.utc),
            "step": step,
            "passed": passed,
            "scores": scores,
            "error": error,
        })
        results.append(run)

    return results
