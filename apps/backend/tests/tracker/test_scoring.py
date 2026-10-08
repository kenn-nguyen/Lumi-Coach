"""A bad model answer must degrade into a usable row, never break the run."""

from __future__ import annotations

import pytest

from app.tracker.scoring import (
    build_scoring_fingerprint,
    needs_scoring,
    normalize_level,
    normalize_payload,
    normalize_priority,
    normalize_score,
    normalize_visa,
    normalize_yoe,
    parse_json_safely,
)

GOOD = {
    "score": 91, "priority": "P01", "us_visa_sponsorship_potential": "Yes (100%)",
    "us_visa_reason": "Careers page lists sponsorship.", "summary": "Owns the decision engine.",
    "why": "Exact domain match.", "title_level": "Principal-PM", "jd_implied_level": "principal-pm",
    "level_normalized": "Principal-PM", "requires_people_mgmt": False,
    "required_yoe_pm": 8, "required_yoe_total": 11,
}


@pytest.mark.unit
@pytest.mark.parametrize("raw,expected", [
    (91, 91), ("91", 91), (91.4, 91), (91.6, 92),
    (-5, 0), (150, 100), (None, None), ("", None), ("abc", None),
])
def test_score_is_clamped_or_absent(raw: object, expected: object) -> None:
    assert normalize_score(raw) == expected


@pytest.mark.unit
@pytest.mark.parametrize("raw,expected", [
    ("P01", "P01"), ("p03", "P03"), ("A", "P01"), ("B", "P05"), ("SKIP", "P10"),
    ("nonsense", "P07"), ("", "P07"), (None, "P07"),
])
def test_priority_falls_back_mid_table(raw: object, expected: str) -> None:
    """An unreadable answer must not look like a strong match or an auto-skip."""
    assert normalize_priority(raw) == expected


@pytest.mark.unit
def test_visa_falls_back_to_unclear() -> None:
    assert normalize_visa("Yes (100%)") == "Yes (100%)"
    assert normalize_visa("yes") == "Unclear (50%)", "exact label or nothing"
    assert normalize_visa(None) == "Unclear (50%)"


@pytest.mark.unit
def test_level_matching_ignores_case_but_not_invention() -> None:
    assert normalize_level("senior-pm") == "Senior-PM"
    assert normalize_level("Staff-PM") == "Staff-PM"
    assert normalize_level("Chief Vibes Officer") == "Unknown"


@pytest.mark.unit
@pytest.mark.parametrize("raw,expected", [(8, 8), ("8", 8), ("8.5", 8), (-1, None),
                                          ("", None), (None, None), ("many", None)])
def test_years_of_experience(raw: object, expected: object) -> None:
    assert normalize_yoe(raw) == expected


@pytest.mark.unit
def test_text_fields_are_capped_to_the_column_widths() -> None:
    p = normalize_payload({**GOOD, "summary": "x" * 500, "why": "y" * 500,
                           "us_visa_reason": "z" * 500})
    assert len(p.summary) == 200 and len(p.why) == 300 and len(p.us_visa_reason) == 220


@pytest.mark.unit
def test_a_good_answer_round_trips() -> None:
    p = normalize_payload(GOOD)
    assert (p.score, p.priority, p.us_visa) == (91, "P01", "Yes (100%)")
    assert p.jd_implied_level == "Principal-PM", "case-insensitive"
    assert p.requires_people_mgmt is False
    assert (p.required_yoe_pm, p.required_yoe_total) == (8, 11)


@pytest.mark.unit
def test_an_empty_or_junk_answer_still_produces_a_row() -> None:
    for parsed in (None, {}, {"score": "???"}):
        p = normalize_payload(parsed)
        assert p.priority == "P07" and p.us_visa == "Unclear (50%)"
        assert p.score is None and p.level_normalized == "Unknown"


@pytest.mark.unit
def test_people_management_accepts_strings_and_booleans() -> None:
    assert normalize_payload({"requires_people_mgmt": True}).requires_people_mgmt
    assert normalize_payload({"requires_people_mgmt": "true"}).requires_people_mgmt
    assert normalize_payload({"requires_people_mgmt": "TRUE"}).requires_people_mgmt
    assert not normalize_payload({"requires_people_mgmt": "no"}).requires_people_mgmt


@pytest.mark.unit
def test_json_survives_fences_and_commentary() -> None:
    assert parse_json_safely('```json\n{"score": 90}\n```') == {"score": 90}
    assert parse_json_safely('Here is the result:\n{"score": 90}\nHope that helps!') == {"score": 90}
    assert parse_json_safely('{"score": 90}') == {"score": 90}
    assert parse_json_safely("not json at all") is None
    assert parse_json_safely("") is None
    assert parse_json_safely("[1,2,3]") is None, "an array is not a score payload"


# --- the cost control ---------------------------------------------------------

def fp(**kw) -> str:
    base = dict(provider="gemini", route="vertex", model="gemini-3.5-flash",
                prompt_version="v13", static_content="profile+rubric", job_content="the jd")
    base.update(kw)
    return build_scoring_fingerprint(**base)


@pytest.mark.unit
def test_fingerprint_is_stable_for_identical_conditions() -> None:
    assert fp() == fp()


@pytest.mark.unit
@pytest.mark.parametrize("field", ["model", "route", "prompt_version", "static_content", "job_content"])
def test_any_change_that_could_alter_the_answer_forces_a_rescore(field: str) -> None:
    assert fp(**{field: "something else"}) != fp()


@pytest.mark.unit
def test_rescoring_rules() -> None:
    current = fp()
    assert not needs_scoring(stored_fingerprint=current, current_fingerprint=current, has_score=True)
    assert needs_scoring(stored_fingerprint=current, current_fingerprint=current, has_score=False)
    assert needs_scoring(stored_fingerprint="old", current_fingerprint=current, has_score=True)
    assert needs_scoring(stored_fingerprint=current, current_fingerprint=current,
                         has_score=True, force=True), "Reevaluate overrides the saving"
    assert needs_scoring(stored_fingerprint=None, current_fingerprint=current, has_score=True)
