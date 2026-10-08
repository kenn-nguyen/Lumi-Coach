"""Routing must never undo a human decision, and must stay reversible otherwise."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from app.tracker.routing import (
    ASSIGNED,
    RESERVED,
    SKIPPED,
    RoutingRules,
    is_routable,
    route_job,
    route_jobs,
)

RULES = RoutingRules(
    reserve_priorities=frozenset({"P01"}),
    assign_priorities=frozenset({"P02", "P03", "P04", "P05"}),
    reserved_companies=frozenset({"stripe", "google"}),
    exclude_companies=frozenset({"hackajob"}),
    assign_visa=frozenset({"Yes (100%)", "Likely (90%)", "Unclear (50%)"}),
    min_score=60,
    skip_visa_no=True,
)


def decide(**kw):
    base = dict(owner="", status="New", priority="P03", company="Acme",
                us_visa="Yes (100%)", score=80, rules=RULES)
    base.update(kw)
    return route_job(**base)


@pytest.mark.unit
@pytest.mark.parametrize("owner", ["Me", "Assignee"])
def test_manual_ownership_is_never_touched(owner: str) -> None:
    assert route_job(owner=owner, status="New", priority="P03", company="Acme",
                     us_visa="Yes (100%)", score=90, rules=RULES) is None


@pytest.mark.unit
def test_manual_skip_is_never_lifted_but_auto_skip_is() -> None:
    assert not is_routable("", "Skip"), "a skip a human made stays"
    assert is_routable("", "Skip (auto)"), "a rules skip can be reconsidered"
    assert not is_routable("", "Submitted")
    assert not is_routable("", "Flagged")
    assert is_routable("", ""), "blank status means New"


@pytest.mark.unit
def test_no_sponsorship_is_skipped_before_anything_else() -> None:
    d = decide(us_visa="No (0%)", priority="P01", company="stripe")
    assert d.outcome == SKIPPED and d.status == "Skip (auto)"


@pytest.mark.unit
def test_excluded_company_is_skipped_even_at_top_priority() -> None:
    assert decide(company="HackaJob", priority="P02").outcome == SKIPPED


@pytest.mark.unit
def test_reserved_company_or_priority_is_kept_for_the_owner() -> None:
    for d in (decide(company="Stripe"), decide(priority="P01")):
        assert d.outcome == RESERVED
        assert d.owner == "", "reserved means unowned, waiting for review"
        assert d.status == "New", "resurfaces even if previously auto-skipped"


@pytest.mark.unit
def test_in_band_job_is_delegated_with_an_action() -> None:
    d = decide(priority="P03", score=80)
    assert d.outcome == ASSIGNED
    assert d.owner == "Assignee (auto)" and d.action == "Fill & Submit"
    assert d.newly_assigned is True


@pytest.mark.unit
def test_already_auto_assigned_job_is_not_counted_twice() -> None:
    d = decide(owner="Assignee (auto)")
    assert d.outcome == ASSIGNED and d.newly_assigned is False


@pytest.mark.unit
def test_in_band_but_filtered_is_unassigned_rather_than_skipped() -> None:
    """It may qualify later, so it must stay re-examinable."""
    low = decide(score=10)
    assert low.outcome == RESERVED and low.owner == "" and low.status == "New"
    bad_visa = decide(us_visa="Unlikely (20%)")
    assert bad_visa.outcome == RESERVED


@pytest.mark.unit
def test_unscored_job_cannot_clear_a_minimum_score() -> None:
    assert decide(score=None).outcome == RESERVED
    assert decide(score="").outcome == RESERVED


@pytest.mark.unit
def test_below_the_band_is_skipped() -> None:
    """A real low priority is a judgement and gets skipped. A missing one is not a
    judgement at all — see test_an_unscored_job_is_left_alone_rather_than_skipped."""
    assert decide(priority="P07").outcome == SKIPPED
    assert decide(priority="P10").outcome == SKIPPED


@pytest.mark.unit
def test_auto_assignment_is_withdrawn_when_a_job_stops_qualifying() -> None:
    """The lane a job sits in must follow the current rules, not the old ones."""
    d = route_job(owner="Assignee (auto)", status="New", priority="P07", company="Acme",
                  us_visa="Yes (100%)", score=80, rules=RULES)
    assert d.outcome == SKIPPED and d.owner == ""


@pytest.mark.unit
def test_empty_visa_allowlist_accepts_any_signal() -> None:
    rules = RoutingRules(assign_priorities=frozenset({"P03"}), assign_visa=frozenset())
    d = route_job(owner="", status="New", priority="P03", company="Acme",
                  us_visa="Unlikely (20%)", score=1, rules=rules)
    assert d.outcome == ASSIGNED


@pytest.mark.unit
def test_counts_match_the_decisions() -> None:
    jobs = [
        {"job_id": "1", "owner": "", "status": "New", "priority": "P03", "company": "Acme",
         "us_visa": "Yes (100%)", "score": 90},
        {"job_id": "2", "owner": "Me", "status": "New", "priority": "P03", "company": "Acme",
         "us_visa": "Yes (100%)", "score": 90},
        {"job_id": "3", "owner": "", "status": "New", "priority": "P07", "company": "Acme",
         "us_visa": "Yes (100%)", "score": 20},
        {"job_id": "4", "owner": "", "status": "New", "priority": "P01", "company": "Acme",
         "us_visa": "Yes (100%)", "score": 95},
    ]
    counts = route_jobs(jobs, RULES)
    assert (counts.assigned, counts.reserved, counts.skipped, counts.untouched) == (1, 1, 1, 1)
    assert "2" not in counts.decisions, "locked rows produce no decision"


FIXTURES = Path(os.environ.get("TRACKER_FIXTURES", "/Users/kennng/Documents/jd update/fixtures"))


@pytest.mark.skipif(not (FIXTURES / "settings.json").exists(), reason="no settings export")
def test_rules_load_from_the_real_settings() -> None:
    settings = json.loads((FIXTURES / "settings.json").read_text())
    rules = RoutingRules.from_settings(settings)
    assert rules.reserve_priorities == {"P01"}
    assert rules.assign_priorities == {"P02", "P03", "P04", "P05"}
    assert "hackajob" in rules.exclude_companies
    assert "google" in rules.reserved_companies, "company lists are matched lowercased"
    assert rules.skip_visa_no is True
    assert "Yes (100%)" in rules.assign_visa


@pytest.mark.unit
def test_an_unscored_job_is_left_alone_rather_than_skipped() -> None:
    """Scoring is capped per run, so jobs routinely wait their turn. Routing reads
    the priority and visa signal, which only exist after scoring — judging a job
    before then silently skips it on no evidence."""
    assert route_job(owner="", status="New", priority=None, company="Acme",
                     us_visa=None, score=None, rules=RULES) is None
    assert route_job(owner="", status="New", priority="", company="Acme",
                     us_visa="", score="", rules=RULES) is None


@pytest.mark.unit
def test_the_same_job_routes_normally_once_it_has_a_score() -> None:
    decided = route_job(owner="", status="New", priority="P03", company="Acme",
                        us_visa="Yes (100%)", score=80, rules=RULES)
    assert decided is not None and decided.outcome == ASSIGNED
