"""The run, driven with a stub scorer so nothing is scraped or spent."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.tracker.apify import (
    ACTOR_MIN_ITEMS,
    build_search_input,
    lookback_hours,
    time_filter,
)
from app.tracker.normalize import (
    coerce_date,
    dedupe_by_job_id,
    derive_posted,
    extract_linkedin_job_id,
    format_salary_banner,
    normalize_applicants,
    normalize_job,
    parse_relative_posted,
    resolve_job_id,
    serialize_raw_ref,
)

NOW = datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc)

SEARCH_ITEM = {
    "jobId": "4071200001", "jobTitle": "Product Manager, Fraud",
    "companyName": "Acme", "location": "New York, NY",
    "jobDescription": "Own the fraud decision engine. Show more Show less",
    "postedTime": "3 days ago", "applicationsCount": "Over 200",
    "jobUrl": "https://www.linkedin.com/jobs/view/4071200001",
}


# --- identity -----------------------------------------------------------------

@pytest.mark.unit
@pytest.mark.parametrize("value,expected", [
    ("4071200001", "4071200001"),
    ("https://www.linkedin.com/jobs/view/4071200001", "4071200001"),
    ("https://www.linkedin.com/jobs/view/4071200001?refId=abc", "4071200001"),
    ("not-an-id", ""),
    ("", ""),
])
def test_job_ids_are_found_wherever_they_hide(value: str, expected: str) -> None:
    assert extract_linkedin_job_id(value) == expected


@pytest.mark.unit
def test_an_item_with_no_id_still_gets_a_stable_one() -> None:
    """Without this the same job would be re-scraped and re-scored every run."""
    link = "https://example.com/careers/123"
    first = resolve_job_id({}, link)
    assert first.startswith("url_") and first == resolve_job_id({}, link)


@pytest.mark.unit
def test_an_item_with_nothing_to_identify_it_is_dropped() -> None:
    assert normalize_job({"jobTitle": "Ghost"}, NOW) is None


# --- dates --------------------------------------------------------------------

@pytest.mark.unit
@pytest.mark.parametrize("label,days", [("3 days ago", 3), ("2 weeks ago", 14),
                                        ("1 month ago", 30), ("5 hours ago", 0)])
def test_relative_dates_resolve_against_the_run(label: str, days: int) -> None:
    parsed = parse_relative_posted(label, NOW)
    assert parsed is not None and (NOW - parsed).days == days


@pytest.mark.unit
def test_month_is_not_read_as_minute() -> None:
    """Longest unit first, or '1 month ago' silently becomes a minute."""
    assert (NOW - parse_relative_posted("1 month ago", NOW)).days == 30


@pytest.mark.unit
def test_implausible_dates_are_rejected() -> None:
    assert coerce_date(0) is None
    assert coerce_date("1969-01-01") is None
    assert coerce_date("2099-01-01") is None, "a posting cannot be from the future"
    assert coerce_date("garbage") is None
    assert coerce_date(1760000000000) is not None, "epoch milliseconds"
    assert coerce_date(1760000000) is not None, "epoch seconds"


@pytest.mark.unit
def test_an_absolute_date_beats_the_relative_label() -> None:
    item = {"originalListedAt": 1757000000000}
    assert derive_posted(item, "3 days ago", NOW) == coerce_date(1757000000000)


# --- fields -------------------------------------------------------------------

@pytest.mark.unit
def test_a_search_item_becomes_a_row() -> None:
    job = normalize_job(SEARCH_ITEM, NOW)
    assert job is not None
    assert job["job_id"] == "4071200001"
    assert job["company"] == "Acme"
    assert "Show more" not in job["jd_text"], "LinkedIn chrome is stripped"
    assert job["applicants"] == "200+"
    assert (NOW - job["posted"]).days == 3


@pytest.mark.unit
def test_the_detail_actors_nested_shape_works_too() -> None:
    job = normalize_job({
        "jobId": "4071200002",
        "job_info": {"title": "PM, Risk", "companyName": "Globex",
                     "description": "Own risk decisioning."},
        "salary_info": {"min_salary": 200000, "max_salary": 240000,
                        "currency_code": "USD", "pay_period": "YEARLY"},
    }, NOW)
    assert job is not None and job["title"] == "PM, Risk"
    assert job["jd_text"].startswith("Salary: 200000–240000 USD / YEARLY")


@pytest.mark.unit
@pytest.mark.parametrize("raw,expected", [("25", "25"), ("Over 200", "200+"),
                                          ("200+", "200+"), ("", ""), ("none", "")])
def test_applicant_counts(raw: str, expected: str) -> None:
    assert normalize_applicants(raw) == expected


@pytest.mark.unit
def test_salary_banner_needs_a_real_number() -> None:
    assert format_salary_banner(None) == ""
    assert format_salary_banner({"min_salary": 0, "max_salary": 0}) == ""
    assert format_salary_banner({"min_salary": 150000}) == "Salary: 150000"


@pytest.mark.unit
def test_an_oversized_payload_drops_the_description_not_the_record() -> None:
    """The description is recoverable from jd_text; the rest of the payload is not."""
    item = {**SEARCH_ITEM, "jobDescription": "x" * 60_000}
    stored = serialize_raw_ref(item)
    assert len(stored) <= 40_000
    assert "companyName" in stored, "the metadata survives"


@pytest.mark.unit
def test_the_last_copy_of_a_job_wins() -> None:
    jobs = [{"job_id": "1", "title": "old"}, {"job_id": "1", "title": "new"},
            {"job_id": "2", "title": "other"}, None]
    deduped = dedupe_by_job_id(jobs)
    assert len(deduped) == 2
    assert next(j for j in deduped if j["job_id"] == "1")["title"] == "new"


# --- the search window --------------------------------------------------------

@pytest.mark.unit
def test_lookback_covers_the_gap_since_the_last_run() -> None:
    from datetime import timedelta
    assert lookback_hours(None) == 24, "a first run looks back a day"
    recent = datetime.now(timezone.utc) - timedelta(hours=6)
    assert 6 <= lookback_hours(recent) <= 8
    stale = datetime.now(timezone.utc) - timedelta(days=90)
    assert lookback_hours(stale) == 168, "a long outage is capped, not catastrophic"
    assert lookback_hours(None, configured=48) == 48


@pytest.mark.unit
def test_the_saved_search_cannot_raise_the_item_cap() -> None:
    """The template is user input, so the cap is applied here rather than trusted."""
    template = {"maxItems": 1000, "startUrls": [{"url": "https://x/?f_TPR={f_tpr}"}]}
    built = build_search_input(template, hours=24, max_items=200)
    assert built["maxItems"] == 200, "the template's 1000 does not win"
    assert built["startUrls"][0]["url"] == f"https://x/?f_TPR={time_filter(24)}"
    assert "{f_tpr}" not in built["startUrls"][0]["url"]


@pytest.mark.unit
def test_a_tiny_cap_is_raised_to_the_actors_floor() -> None:
    """The search actor rejects maxItems below 150, so a run cannot be made
    arbitrarily small that way. Narrowing the time window is the real lever."""
    built = build_search_input({}, hours=1, max_items=3)
    assert built["maxItems"] == ACTOR_MIN_ITEMS


@pytest.mark.unit
def test_a_short_window_is_what_keeps_a_test_run_cheap() -> None:
    assert time_filter(1) == "r3600"
    assert time_filter(24) == "r86400"


# --- routing reaches the jobs a run produced ---------------------------------

@pytest.mark.unit
def test_routing_targets_the_runs_own_jobs_not_a_page_of_the_backlog() -> None:
    """A newly scraped job is usually low-ranked, so a page of the backlog ordered
    by rank would never reach it. Regression guard for exactly that."""
    import inspect

    from app.tracker import pipeline

    source = inspect.getsource(pipeline.run_pipeline)
    route_section = source[source.index("# --- route"):]
    assert "_rows_for_routing" in route_section
    assert "JobFilters(view=\"all\", status=\"New\")" not in route_section, (
        "routing must not re-page the backlog by rank")
