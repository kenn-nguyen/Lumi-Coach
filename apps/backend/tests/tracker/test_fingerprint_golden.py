"""JD fingerprints must match the ones the sheet already stored.

If these drift, every previously-scored job looks new and gets paid for again, so
this is the highest-value check in the port.
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine, text as sql

from app.tracker.fingerprint import (
    are_likely_same_jd,
    build_word_bigrams,
    clean_job_description,
    extract_jd_from_raw_ref,
    jaccard_bigram_similarity,
    jd_content_hash,
    normalize_jd_text,
    titles_sanity_check,
    truncate,
)

DB_URL = os.environ.get(
    "TRACKER_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/som_career_coach",
)


@pytest.mark.unit
def test_normalisation_ignores_formatting_differences() -> None:
    a = "Senior PM — Fraud & Risk\n\n• Own the roadmap!"
    b = "senior pm   fraud  risk   own the roadmap"
    assert normalize_jd_text(a) == normalize_jd_text(b)


@pytest.mark.unit
def test_clean_strips_linkedin_chrome() -> None:
    assert "Show more" not in clean_job_description("Role detail Show more Show less")
    assert clean_job_description("a\r\nb") == "a\nb"
    assert clean_job_description("a\n\n\n\n\nb") == "a\n\nb"


@pytest.mark.unit
def test_truncate_marks_the_cut() -> None:
    assert truncate("abcdef", 10) == "abcdef"
    assert truncate("abcdefghij", 6) == "abc..."
    assert len(truncate("x" * 50_000, 12_000)) == 12_000


@pytest.mark.unit
def test_extracts_description_from_both_payload_shapes() -> None:
    nested = '{"job_info": {"description": "Owns the fraud decision engine."}}'
    flat = '{"descriptionText": "Owns the fraud decision engine."}'
    assert extract_jd_from_raw_ref(nested) == "Owns the fraud decision engine."
    assert extract_jd_from_raw_ref(flat) == "Owns the fraud decision engine."
    assert extract_jd_from_raw_ref("") == ""
    assert extract_jd_from_raw_ref("{not json") == ""


@pytest.mark.unit
def test_recovers_description_from_truncated_json() -> None:
    """Older rows were stored cut mid-JSON; the regex path still finds the text."""
    broken = '{"company":"Acme","description":"Fraud PM role at Acme","loca'
    assert extract_jd_from_raw_ref(broken) == "Fraud PM role at Acme"


@pytest.mark.unit
def test_same_role_reworded_is_detected_but_different_roles_are_not() -> None:
    base = " ".join(f"word{i}" for i in range(200))
    reworded = base + " plus a short extra clause about benefits"
    unrelated = " ".join(f"other{i}" for i in range(200))

    h = jd_content_hash
    assert are_likely_same_jd(h(base), build_word_bigrams(base), h(reworded), build_word_bigrams(reworded))
    assert not are_likely_same_jd(h(base), build_word_bigrams(base), h(unrelated), build_word_bigrams(unrelated))


@pytest.mark.unit
def test_identical_text_short_circuits_on_hash() -> None:
    t = "Product Manager, Identity"
    assert are_likely_same_jd(jd_content_hash(t), set(), jd_content_hash(t), set())


@pytest.mark.unit
def test_titles_must_share_a_significant_word() -> None:
    assert titles_sanity_check("Senior Product Manager, Fraud", "Product Manager - Fraud Risk")
    assert not titles_sanity_check("Product Manager", "Warehouse Associate")
    assert not titles_sanity_check("PM", "QA"), "short words do not count"


@pytest.mark.unit
def test_jaccard_bounds() -> None:
    a = build_word_bigrams("one two three four")
    assert jaccard_bigram_similarity(a, a) == 1.0
    assert jaccard_bigram_similarity(a, set()) == 0.0


def _engine():
    try:
        eng = create_engine(DB_URL, future=True)
        with eng.connect() as c:
            c.execute(sql("select 1"))
        return eng
    except Exception:
        return None


@pytest.mark.skipif(_engine() is None, reason="no migrated database available")
def test_matches_the_fingerprints_the_sheet_stored() -> None:
    eng = _engine()
    with eng.connect() as conn:
        rows = conn.execute(sql("""
            select j.job_id, j.jd_fingerprint, d.raw_ref
            from tracker_jobs j
            join tracker_job_docs d on d.job_id = j.job_id
            where j.jd_fingerprint is not null and d.raw_ref is not null
        """)).all()

    # This is a golden check against the corpus the sheet migrated, so it is only
    # meaningful where that corpus exists. A synthetic or empty database has
    # nothing to compare against — skip rather than report a failure that says
    # nothing about the code.
    if len(rows) <= 100:
        pytest.skip(f"no migrated corpus to compare against ({len(rows)} rows)")

    mismatches: list[str] = []
    for job_id, stored, raw_ref in rows:
        jd = extract_jd_from_raw_ref(raw_ref)
        if not jd:
            mismatches.append(f"{job_id}: no description recovered from payload")
            continue
        ours = jd_content_hash(jd)
        if ours != stored:
            mismatches.append(f"{job_id}: sheet={stored[:12]}… ours={ours[:12]}… jd_len={len(jd)}")

    rate = len(mismatches) / len(rows)

    # A handful legitimately differ: the fingerprint records the description as it
    # read when the job was scored, and employers edit live postings, so a later
    # scrape can replace the payload without the fingerprint being recomputed. Those
    # rows re-score once after cutover, which at flash-tier prices is pennies.
    #
    # The threshold is a regression guard, not an accuracy target. An error in the
    # normalisation or the hash fails *every* row, not a few — so anything below
    # ~97% means the port broke, not that the data drifted.
    assert rate <= 0.03, (
        f"{len(mismatches)}/{len(rows)} fingerprints differ ({rate:.1%}), "
        f"well above the drift seen in the sheet:\n" + "\n".join(mismatches[:10])
    )
