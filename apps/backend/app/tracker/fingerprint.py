"""Job-description identity and similarity.

Two roles post the same job under different ids all the time — LinkedIn reposts,
multi-location listings, agency mirrors. The sheet handles this by fingerprinting
the description rather than trusting the id:

* an exact match on ``jd_content_hash`` means the same posting, so merge and do not
  pay to score it again;
* a near match (word-bigram Jaccard ≥ 0.80, within one company) means the same role
  reworded, which the de-duplication pass folds together.

Ported from pipeline.gs L2379-2461 and sheet.gs L2405+. The normalisation and hash
must stay byte-identical to the script's or every fingerprint already stored in the
sheet becomes meaningless.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Iterable

JD_TEXT_LIMIT = 12_000

#: Where the scrapers put the description. The detail actor nests it under
#: ``job_info``; the search actor keeps it flat.
_DESCRIPTION_KEYS = ("jobDescription", "descriptionText", "description", "job_description", "details")

_SHOW_MORE = re.compile(r"\bShow more Show less\b", re.IGNORECASE)
_BLANK_RUN = re.compile(r"\n{3,}")
_NON_ALNUM = re.compile(r"[^a-z0-9\s]")
_WHITESPACE = re.compile(r"\s+")


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def truncate(value: Any, max_length: int) -> str:
    """Cap length, marking that it was cut — the ellipsis is part of the stored text."""
    text = _text(value)
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."


def clean_job_description(value: Any) -> str:
    """Strip the LinkedIn UI noise that would otherwise differ between two copies."""
    text = _text(value)
    if not text:
        return ""
    text = _SHOW_MORE.sub("", text)
    text = text.replace("\r\n", "\n")
    text = _BLANK_RUN.sub("\n\n", text)
    return text.strip()


def pick_first_value(item: dict[str, Any], keys: Iterable[str]) -> Any:
    for key in keys:
        value = item.get(key)
        if value not in (None, ""):
            return value
    return ""


def _extract_json_string_field(raw: str, key: str) -> str:
    """Recover one field from a payload too truncated to parse.

    Older rows were stored before the size cap was handled properly, so the JSON can
    be cut mid-string. A regex still gets the description out of those.
    """
    match = re.search(rf'"{re.escape(key)}"\s*:\s*"((?:[^"\\]|\\.)*)"', raw)
    if not match:
        return ""
    try:
        return json.loads(f'"{match.group(1)}"')
    except ValueError:
        return match.group(1)


def extract_jd_from_raw_ref(raw_ref: Any) -> str:
    """Pull the description out of a stored payload, however it was stored."""
    raw = _text(raw_ref)
    if not raw.strip():
        return ""

    try:
        parsed = json.loads(raw)
    except ValueError:
        parsed = None

    if isinstance(parsed, dict):
        info = parsed.get("job_info")
        if isinstance(info, dict) and info.get("description"):
            description = truncate(clean_job_description(info["description"]), JD_TEXT_LIMIT)
            if description:
                return description
        description = truncate(
            clean_job_description(pick_first_value(parsed, _DESCRIPTION_KEYS)), JD_TEXT_LIMIT
        )
        if description:
            return description

    for key in _DESCRIPTION_KEYS:
        description = truncate(
            clean_job_description(_extract_json_string_field(raw, key)), JD_TEXT_LIMIT
        )
        if description:
            return description

    return ""


def normalize_jd_text(text: Any) -> str:
    """Lowercase, drop punctuation, collapse whitespace.

    Deliberately crude: formatting and bullet characters vary between copies of the
    same posting, so removing them is what makes the hash stable.
    """
    lowered = _text(text).lower()
    return _WHITESPACE.sub(" ", _NON_ALNUM.sub(" ", lowered)).strip()


def jd_content_hash(text: Any) -> str:
    """SHA-1 of the normalised description. Equal hashes mean the same posting."""
    return hashlib.sha1(normalize_jd_text(text).encode("utf-8")).hexdigest()


# --- near-duplicate detection -------------------------------------------------

def build_word_bigrams(text: Any) -> set[str]:
    words = [w for w in normalize_jd_text(text).split(" ") if len(w) > 1]
    return {f"{a} {b}" for a, b in zip(words, words[1:])}


def can_reach_threshold(count_a: int, count_b: int, threshold: float) -> bool:
    """Cheap upper bound: if the lengths differ too much, Jaccard cannot reach the bar."""
    if not count_a or not count_b:
        return False
    return min(count_a, count_b) / max(count_a, count_b) >= threshold


def build_bigram_sketch(bigrams: set[str]) -> list[str]:
    """A stable 30-bigram sample, used as a fast gate before the full comparison."""
    return sorted(bigrams)[:30]


def sketch_overlap_ratio(sketch_a: list[str], sketch_b: list[str]) -> float:
    if not sketch_a:
        return 0.0
    shared = len(set(sketch_a) & set(sketch_b))
    return shared / len(sketch_a)


def jaccard_bigram_similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = len(a | b)
    return (len(a & b) / union) if union else 0.0


def titles_sanity_check(title_a: Any, title_b: Any) -> bool:
    """Require one shared significant word, so two unrelated roles never merge.

    A company's postings often share boilerplate (benefits, EEO statements), which can
    push the description similarity up on its own.
    """
    words_a = {w for w in normalize_jd_text(title_a).split(" ") if len(w) > 3}
    words_b = {w for w in normalize_jd_text(title_b).split(" ") if len(w) > 3}
    return bool(words_a & words_b)


def are_likely_same_jd(
    hash_a: str, bigrams_a: set[str], hash_b: str, bigrams_b: set[str], threshold: float = 0.80
) -> bool:
    """Four stages, cheapest first, so a full comparison runs only when it might pass."""
    if hash_a and hash_a == hash_b:
        return True
    if not bigrams_a or not bigrams_b:
        return False
    if not can_reach_threshold(len(bigrams_a), len(bigrams_b), threshold):
        return False
    if sketch_overlap_ratio(build_bigram_sketch(bigrams_a), build_bigram_sketch(bigrams_b)) < 0.25:
        return False
    return jaccard_bigram_similarity(bigrams_a, bigrams_b) >= threshold
