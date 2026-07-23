"""Layer 3 LLM-as-judge scorer — uses litellm.acompletion with a recruiter rubric."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import litellm

logger = logging.getLogger(__name__)

EVAL_JUDGE_MODEL = os.environ.get("EVAL_JUDGE_MODEL", "gemini/gemini-2.5-flash-lite")

_PROFILE_META: dict[str, dict[str, str]] = {
    "profile1": {"name": "Safe", "adjective": "conservative, accurate, understated"},
    "profile2": {"name": "Competitive", "adjective": "bold, differentiated, achievement-focused"},
    "profile3": {"name": "Lean", "adjective": "concise, minimal, high signal-to-noise"},
    "profile4": {"name": "Direct", "adjective": "direct, concrete, no fluff"},
}

JUDGE_PROMPT_TEMPLATE = """\
You are a senior technical recruiter reviewing a tailored resume application.

Job Description:
{jd_text}

Master Resume (original, unmodified):
{master_resume_json}

Tailored Resume (AI-generated for this role):
{tailored_resume_json}

Score on each dimension from 1 to 5. Be strict — a 5 means you would
confidently shortlist this candidate for an interview.

1. Positioning (1-5): Does this candidate's experience read as a strong match
   for THIS specific role? Not generic quality — fit to this JD.

2. Credibility (1-5): Do the bullets feel trustworthy and grounded in real
   work, or do they feel exaggerated / generic / AI-written?

3. Keyword alignment (1-5): Without keyword-stuffing, does this resume speak
   the natural language of this job posting?

4. Profile character (1-5): This resume was generated in "{profile_name}" style,
   intended to feel {profile_adjective}. Does it succeed?

5. Verdict: Would you shortlist this candidate based on this resume alone?

Return valid JSON only, no other text:
{{
  "positioning": <1-5>,
  "credibility": <1-5>,
  "keyword_alignment": <1-5>,
  "profile_character": <1-5>,
  "verdict": "shortlist" | "maybe" | "reject",
  "reason": "<one sentence>"
}}"""


def _build_prompt(
    jd_text: str,
    master: dict[str, Any],
    tailored: dict[str, Any],
    profile_id: str,
) -> str:
    meta = _PROFILE_META.get(profile_id, _PROFILE_META["profile2"])
    return JUDGE_PROMPT_TEMPLATE.format(
        jd_text=jd_text[:4000],
        master_resume_json=json.dumps(master, ensure_ascii=False)[:6000],
        tailored_resume_json=json.dumps(tailored, ensure_ascii=False)[:6000],
        profile_name=meta["name"],
        profile_adjective=meta["adjective"],
    )


def _extract_json(raw: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise ValueError(f"No JSON found in judge response: {raw[:200]}")
    return json.loads(match.group())


async def score_judge(
    master: dict[str, Any],
    tailored: dict[str, Any],
    jd_text: str,
    profile_id: str,
) -> tuple[bool, dict[str, Any]]:
    """Call the LLM judge. Returns (passed, scores_dict)."""
    prompt = _build_prompt(jd_text, master, tailored, profile_id)

    # Authenticate with the server's configured key. Without this litellm falls
    # back to a GEMINI_API_KEY/GOOGLE_API_KEY env var, which the app doesn't set
    # (it stores the key as LLM_API_KEY) — producing "key=None" 400 errors.
    # Assumes EVAL_JUDGE_MODEL's provider matches the server config's provider.
    from app.llm import get_server_llm_config

    server_config = get_server_llm_config()

    response = await litellm.acompletion(
        model=EVAL_JUDGE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=512,
        api_key=server_config.api_key or None,
    )
    raw = response.choices[0].message.content or ""

    try:
        result = _extract_json(raw)
    except (ValueError, json.JSONDecodeError) as e:
        raise RuntimeError(f"Judge returned unparseable output: {e}") from e

    verdict = result.get("verdict", "reject")
    passed = verdict in ("shortlist", "maybe")

    scores = {
        "positioning": result.get("positioning"),
        "credibility": result.get("credibility"),
        "keyword_alignment": result.get("keyword_alignment"),
        "profile_character": result.get("profile_character"),
        "verdict": verdict,
        "reason": result.get("reason", ""),
        "judge_model": EVAL_JUDGE_MODEL,
    }
    return (passed, scores)


def get_judge_instructions() -> str:
    return JUDGE_PROMPT_TEMPLATE
