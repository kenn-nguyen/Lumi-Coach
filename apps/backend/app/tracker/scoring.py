"""Turning the model's answer into a row, and deciding what needs scoring at all.

Ported from pipeline.gs L1760-1860.

Everything here is defensive. The model is told to return a fixed shape, but a
malformed answer must never poison a row or stop a run: each field falls back to a
value that is safe to display and to sort on.

The fingerprint is the cost control. It covers the model, the route, the prompt and
the job's own text, so a job is re-scored only when something that could change the
answer has actually changed.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from typing import Any

from .enums import VISA_DEFAULT, VISA_OPTIONS
from .fingerprint import truncate

#: What the scorer is asked for. Mirrors `_getScoreResponseSchema`.
RESPONSE_FIELDS = (
    "score", "priority", "us_visa_sponsorship_potential", "us_visa_reason",
    "summary", "why", "title_level", "jd_implied_level", "level_normalized",
    "requires_people_mgmt", "required_yoe_pm", "required_yoe_total",
)

VALID_LEVELS = (
    "APM", "PM", "Senior-PM", "Staff-PM", "Principal-PM", "Manager", "Senior-Manager",
    "Group-PM", "Director", "Senior-Director", "VP", "Head-of-Product", "Founding-PM", "Unknown",
)
_LEVELS_BY_LOWER = {level.lower(): level for level in VALID_LEVELS}

#: Pre-P-notation labels. Old rows still carry them, and so can a confused model.
LEGACY_PRIORITY = {"A": "P01", "B": "P05", "C": "P07", "SKIP": "P10"}

#: Mid-table rather than optimistic: an unreadable answer should not look like a
#: strong match, and should not be auto-skipped either.
DEFAULT_PRIORITY = "P07"

_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.MULTILINE)


@dataclass(frozen=True)
class ScorePayload:
    score: int | None
    priority: str
    us_visa: str
    us_visa_reason: str
    summary: str
    why: str
    title_level: str
    jd_implied_level: str
    level_normalized: str
    requires_people_mgmt: bool
    required_yoe_pm: int | None
    required_yoe_total: int | None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def normalize_score(value: Any) -> int | None:
    """0-100, or ``None`` when the model did not give a usable number."""
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    if score != score:  # NaN
        return None
    return max(0, min(100, round(score)))


def normalize_priority(value: Any) -> str:
    text = ("" if value is None else str(value)).strip().upper()
    if text in {f"P{n:02d}" for n in range(1, 11)}:
        return text
    return LEGACY_PRIORITY.get(text, DEFAULT_PRIORITY)


def normalize_visa(value: Any) -> str:
    text = ("" if value is None else str(value)).strip()
    return text if text in VISA_OPTIONS else VISA_DEFAULT


def normalize_level(value: Any) -> str:
    text = ("" if value is None else str(value)).strip()
    return _LEVELS_BY_LOWER.get(text.lower(), "Unknown")


def normalize_yoe(value: Any) -> int | None:
    """Years of experience as a whole number; anything negative or unreadable is unknown."""
    try:
        years = int(str(value).strip().split(".")[0])
    except (TypeError, ValueError, IndexError):
        return None
    return years if years >= 0 else None


def parse_json_safely(text: str) -> dict[str, Any] | None:
    """Parse a model answer, tolerating code fences and surrounding prose."""
    if not text:
        return None
    cleaned = _FENCE.sub("", text).strip()
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except ValueError:
        pass
    # Some answers wrap the object in commentary; take the outermost braces.
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        parsed = json.loads(cleaned[start : end + 1])
        return parsed if isinstance(parsed, dict) else None
    except ValueError:
        return None


def normalize_payload(parsed: dict[str, Any] | None) -> ScorePayload:
    """Coerce a model answer into exactly the fields a row needs.

    Text fields are capped at the widths the sheet uses, which are what the columns
    were sized for — a model that ignores the brevity instruction cannot blow up
    the layout.
    """
    content = parsed or {}
    mgmt = content.get("requires_people_mgmt")
    return ScorePayload(
        score=normalize_score(content.get("score")),
        priority=normalize_priority(content.get("priority")),
        us_visa=normalize_visa(content.get("us_visa_sponsorship_potential")),
        us_visa_reason=truncate(content.get("us_visa_reason") or "", 220),
        summary=truncate(content.get("summary") or "", 200),
        why=truncate(content.get("why") or "", 300),
        title_level=normalize_level(content.get("title_level")),
        jd_implied_level=normalize_level(content.get("jd_implied_level")),
        level_normalized=normalize_level(content.get("level_normalized")),
        requires_people_mgmt=(mgmt is True or str(mgmt).strip().lower() == "true"),
        required_yoe_pm=normalize_yoe(content.get("required_yoe_pm")),
        required_yoe_total=normalize_yoe(content.get("required_yoe_total")),
    )


def build_scoring_fingerprint(
    *, provider: str, route: str, model: str, prompt_version: str,
    static_content: str, job_content: str,
) -> str:
    """Identifies the exact conditions a score was produced under.

    If any part changes — a different model, an edited profile or rubric, or new job
    text — the fingerprint changes and the job is re-scored. If none changed, the
    existing score stands and costs nothing.
    """
    parts = [provider or "", route or "", model or "", prompt_version or "",
             static_content or "", job_content or ""]
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


def needs_scoring(*, stored_fingerprint: str | None, current_fingerprint: str,
                  has_score: bool, force: bool = False) -> bool:
    """Whether this job should be sent to the model on this run."""
    if force:
        return True
    if not has_score:
        return True
    return (stored_fingerprint or "") != current_fingerprint
