"""Generate JSONL export of all eval cases with embedded judge instructions."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.database import db
from app.services.evals.scorer_judge import get_judge_instructions


def export_jsonl() -> str:
    """Return a JSONL string — one JSON object per line."""
    cases = db.list_eval_cases()
    case_ids = [c["id"] for c in cases]
    runs_by_case = db.get_latest_eval_runs_for_cases(case_ids)

    judge_instructions = get_judge_instructions()
    exported_at = datetime.now(timezone.utc).isoformat()
    lines: list[str] = []

    for case in cases:
        case_runs = runs_by_case.get(case["id"], {})
        latest_scores: dict[str, Any] = {}
        for step, run in case_runs.items():
            latest_scores[step] = {
                "passed": run["passed"],
                "scores": run["scores"],
                "error": run.get("error"),
                "created_at": run["created_at"],
            }

        record = {
            "case_id": case["id"],
            "exported_at": exported_at,
            "created_at": case["created_at"],
            "tags": case["tags"],
            "notes": case["notes"],
            "prompt_profile_id": case["prompt_profile_id"],
            "jd_source": case["jd_source"],
            "jd_url": case["jd_url"],
            "jd_text": case["jd_text"],
            "master_resume": case["master_resume"],
            "tailored_resume": case["tailored_resume"],
            "latest_scores": latest_scores,
            "judge_instructions": judge_instructions,
        }
        lines.append(json.dumps(record, ensure_ascii=False))

    return "\n".join(lines)
