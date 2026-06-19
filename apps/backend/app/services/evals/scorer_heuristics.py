"""Layer 2 heuristic scorer — relevance delta, ATS keywords, hallucination, quantification."""

from __future__ import annotations

import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

_SKILLS_FILE = Path(__file__).parent.parent.parent.parent / "evals" / "data" / "skills.txt"


def _load_skills() -> set[str]:
    if not _SKILLS_FILE.exists():
        return set()
    lines = _SKILLS_FILE.read_text(encoding="utf-8").splitlines()
    return {ln.strip().lower() for ln in lines if ln.strip() and not ln.startswith("#")}


_SKILL_TERMS: set[str] = _load_skills()

_ACRONYM_RE = re.compile(r"\b[A-Z]{2,}(?:[/\-][A-Z]+)*\b")

_QUANT_RE = re.compile(
    r"\b\d[\d,\.]*\s*(%|x|X|\$|k|K|M|B|million|billion|percent|people|users|teams?)\b"
    r"|\b\d{2,}\b",
    re.IGNORECASE,
)


def _resume_to_text(resume: dict[str, Any]) -> str:
    parts: list[str] = []

    def _walk(obj: Any) -> None:
        if isinstance(obj, str):
            parts.append(obj)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item)
        elif isinstance(obj, dict):
            for v in obj.values():
                _walk(v)

    _walk(resume)
    return " ".join(parts)


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z]{2,}", text.lower())


def _cosine_sim(text_a: str, text_b: str) -> float:
    toks_a = _tokenize(text_a)
    toks_b = _tokenize(text_b)
    if not toks_a or not toks_b:
        return 0.0
    freq_a: Counter[str] = Counter(toks_a)
    freq_b: Counter[str] = Counter(toks_b)
    vocab = set(freq_a) | set(freq_b)
    dot = sum(freq_a.get(t, 0) * freq_b.get(t, 0) for t in vocab)
    mag_a = math.sqrt(sum(v * v for v in freq_a.values()))
    mag_b = math.sqrt(sum(v * v for v in freq_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return round(dot / (mag_a * mag_b), 4)


def _extract_ats_keywords(text: str) -> set[str]:
    lower = text.lower()
    found: set[str] = set()
    for skill in sorted(_SKILL_TERMS, key=len, reverse=True):
        if skill in lower:
            found.add(skill)
    for match in _ACRONYM_RE.findall(text):
        found.add(match.lower())
    return found


def _ats_hit_rate(resume_text: str, jd_text: str) -> float:
    jd_keywords = _extract_ats_keywords(jd_text)
    if not jd_keywords:
        return 1.0
    resume_keywords = _extract_ats_keywords(resume_text)
    hits = jd_keywords & resume_keywords
    return round(len(hits) / len(jd_keywords), 4)


def _extract_employer_names(resume: dict[str, Any]) -> set[str]:
    names: set[str] = set()
    for entry in resume.get("experience") or []:
        if isinstance(entry, dict) and entry.get("company"):
            names.add(entry["company"].strip().lower())
    for entry in resume.get("education") or []:
        if isinstance(entry, dict):
            school = entry.get("school") or entry.get("institution") or ""
            if school:
                names.add(school.strip().lower())
    return names


def _extract_bullets(resume: dict[str, Any]) -> list[str]:
    bullets: list[str] = []
    for entry in resume.get("experience") or []:
        if isinstance(entry, dict):
            raw = entry.get("bullets") or entry.get("description") or []
            if isinstance(raw, list):
                bullets.extend(str(b) for b in raw)
            elif isinstance(raw, str):
                bullets.append(raw)
    return bullets


def _quantification_rate(resume: dict[str, Any]) -> float:
    bullets = _extract_bullets(resume)
    if not bullets:
        return 0.0
    quantified = sum(1 for b in bullets if _QUANT_RE.search(b))
    return round(quantified / len(bullets), 4)


def score_heuristics(
    master: dict[str, Any],
    tailored: dict[str, Any],
    jd_text: str,
) -> tuple[bool, dict[str, Any]]:
    """Run heuristic metrics. Returns (passed, scores_dict)."""
    master_text = _resume_to_text(master)
    tailored_text = _resume_to_text(tailored)

    sim_master = _cosine_sim(master_text, jd_text)
    sim_tailored = _cosine_sim(tailored_text, jd_text)
    relevance_delta = round(sim_tailored - sim_master, 4)
    relevance_ok = relevance_delta > 0.0

    ats_master = _ats_hit_rate(master_text, jd_text)
    ats_tailored = _ats_hit_rate(tailored_text, jd_text)
    ats_delta = round(ats_tailored - ats_master, 4)
    ats_ok = ats_delta >= 0.0

    master_entities = _extract_employer_names(master)
    tailored_entities = _extract_employer_names(tailored)
    phantoms = tailored_entities - master_entities
    hallucination_free = len(phantoms) == 0

    quant_master = _quantification_rate(master)
    quant_tailored = _quantification_rate(tailored)
    QUANT_FLOOR = 0.20
    quant_ok = quant_tailored >= quant_master and quant_tailored >= QUANT_FLOOR

    passed = relevance_ok and ats_ok and hallucination_free and quant_ok

    scores = {
        "relevance_delta": relevance_delta,
        "embed_sim_master": sim_master,
        "embed_sim_tailored": sim_tailored,
        "relevance_ok": relevance_ok,
        "ats_keyword_delta": ats_delta,
        "ats_hit_rate_master": ats_master,
        "ats_hit_rate_tailored": ats_tailored,
        "ats_ok": ats_ok,
        "hallucination_free": hallucination_free,
        "hallucinated_entities": sorted(phantoms),
        "quantification_rate_master": quant_master,
        "quantification_rate_tailored": quant_tailored,
        "quantification_rate_ok": quant_ok,
    }
    return (passed, scores)
