"""Who gets each job.

After scoring, every unmanaged job is sorted into a lane: kept for the owner,
delegated to the assignee, or skipped. Ported from `_routeNewJobs` (main.gs
L1824-1915).

Two properties matter more than the ordering of the rules:

* **Manual decisions are sticky.** A row owned by ``Me`` or plainly ``Assignee``
  is never touched, and neither is a manual ``Skip``. Only the rules write
  ``Assignee (auto)`` and ``Skip (auto)``, so a human choice can never be undone
  by a later run.
* **Rules decisions stay reversible.** Every outcome other than a delegation clears
  the owner, so a row that stops qualifying is un-assigned and re-examined next
  run rather than being stranded in the assignee's queue.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .enums import (
    ACTION_FILL_SUBMIT,
    OWNER_ASSIGNEE,
    OWNER_ASSIGNEE_AUTO,
    OWNER_ME,
    STATUS_NEW,
    STATUS_SKIP_AUTO,
    VISA_NO,
)

#: Outcomes, matching the counters the sheet reports after a run.
ASSIGNED = "assigned"
RESERVED = "reserved"
SKIPPED = "skipped"


@dataclass(frozen=True)
class RoutingRules:
    """The Settings tab's delegation section."""

    reserve_priorities: frozenset[str] = frozenset()
    assign_priorities: frozenset[str] = frozenset()
    reserved_companies: frozenset[str] = frozenset()
    exclude_companies: frozenset[str] = frozenset()
    #: Empty means "any sponsorship signal is acceptable".
    assign_visa: frozenset[str] = frozenset()
    min_score: int = 0
    skip_visa_no: bool = True

    @classmethod
    def from_settings(cls, settings: dict[str, str]) -> "RoutingRules":
        def csv(key: str, lower: bool = False) -> frozenset[str]:
            raw = (settings.get(key) or "").split(",")
            parts = (p.strip() for p in raw)
            return frozenset(p.lower() if lower else p for p in parts if p)

        try:
            min_score = int(float(settings.get("AUTO_ASSIGN_MIN_SCORE") or 0))
        except (TypeError, ValueError):
            min_score = 0

        return cls(
            reserve_priorities=csv("AUTO_RESERVE_PRIORITIES"),
            assign_priorities=csv("AUTO_ASSIGN_PRIORITIES"),
            reserved_companies=csv("RESERVED_COMPANIES", lower=True),
            exclude_companies=csv("AUTO_ASSIGN_EXCLUDE_COMPANIES", lower=True),
            assign_visa=csv("AUTO_ASSIGN_VISA"),
            min_score=min_score,
            skip_visa_no=(settings.get("AUTO_SKIP_VISA_NO") or "TRUE").strip().upper() != "FALSE",
        )


@dataclass(frozen=True)
class RouteDecision:
    """What the rules want this row to become."""

    owner: str
    status: str
    action: str | None  # None leaves the existing action alone
    outcome: str
    reason: str
    #: False when a row was already auto-assigned: it is still delegated, but it is
    #: not a *new* delegation, so it must not be counted or notified about twice.
    newly_assigned: bool = False


@dataclass
class RouteCounts:
    assigned: int = 0
    reserved: int = 0
    skipped: int = 0
    untouched: int = 0
    decisions: dict[str, RouteDecision] = field(default_factory=dict)


def is_routable(owner: object, status: object) -> bool:
    """Whether the rules are allowed to touch this row at all.

    Locked: a manual claim (``Me``) or manual delegation (``Assignee``), and any
    status a human moved it to. Re-manageable: unowned or ``Assignee (auto)``, and
    status ``New`` or ``Skip (auto)`` — a rules-set skip may be lifted if the job
    now qualifies, but a skip a human made never is.
    """
    owner_text = (str(owner) if owner is not None else "").strip()
    if owner_text in (OWNER_ME, OWNER_ASSIGNEE):
        return False
    status_text = (str(status) if status is not None else "").strip() or STATUS_NEW
    return status_text in (STATUS_NEW, STATUS_SKIP_AUTO)


def route_job(
    *,
    owner: object,
    status: object,
    priority: object,
    company: object,
    us_visa: object,
    score: object,
    rules: RoutingRules,
) -> RouteDecision | None:
    """Decide one row's lane, or ``None`` when the row is locked."""
    if not is_routable(owner, status):
        return None

    was_auto = (str(owner) if owner is not None else "").strip() == OWNER_ASSIGNEE_AUTO
    priority_text = (str(priority) if priority is not None else "").strip()
    company_key = (str(company) if company is not None else "").strip().lower()
    visa = (str(us_visa) if us_visa is not None else "").strip()

    # The role states it will not sponsor. Networking cannot change a company
    # policy, so this one is worth skipping outright rather than demoting.
    if rules.skip_visa_no and visa == VISA_NO:
        return RouteDecision("", STATUS_SKIP_AUTO, None, SKIPPED, "no sponsorship")

    if company_key and company_key in rules.exclude_companies:
        return RouteDecision("", STATUS_SKIP_AUTO, None, SKIPPED, "excluded company")

    # Reset to New so a job the rules skipped earlier resurfaces for review once it
    # qualifies again — a reserved company should never sit in the skip pile.
    if company_key and company_key in rules.reserved_companies:
        return RouteDecision("", STATUS_NEW, None, RESERVED, "reserved company")
    if priority_text and priority_text in rules.reserve_priorities:
        return RouteDecision("", STATUS_NEW, None, RESERVED, "reserved priority")

    if priority_text and priority_text in rules.assign_priorities:
        visa_ok = not rules.assign_visa or visa in rules.assign_visa
        score_ok = True
        if rules.min_score > 0:
            try:
                score_ok = float(score) >= rules.min_score
            except (TypeError, ValueError):
                score_ok = False  # unscored cannot clear a minimum

        if visa_ok and score_ok:
            return RouteDecision(
                OWNER_ASSIGNEE_AUTO, STATUS_NEW, ACTION_FILL_SUBMIT, ASSIGNED,
                "in assignee band", newly_assigned=not was_auto,
            )
        reason = "visa filtered" if not visa_ok else "below minimum score"
        return RouteDecision("", STATUS_NEW, None, RESERVED, reason)

    return RouteDecision("", STATUS_SKIP_AUTO, None, SKIPPED, "below assignee band")


def route_jobs(jobs: list[dict], rules: RoutingRules) -> RouteCounts:
    """Route a batch, returning the per-row decisions and the counts a run reports."""
    counts = RouteCounts()
    for job in jobs:
        decision = route_job(
            owner=job.get("owner"), status=job.get("status"), priority=job.get("priority"),
            company=job.get("company"), us_visa=job.get("us_visa"), score=job.get("score"),
            rules=rules,
        )
        if decision is None:
            counts.untouched += 1
            continue
        counts.decisions[str(job.get("job_id"))] = decision
        if decision.outcome == ASSIGNED:
            # A re-confirmed auto job is already in the assignee's queue.
            if decision.newly_assigned:
                counts.assigned += 1
        elif decision.outcome == RESERVED:
            counts.reserved += 1
        else:
            counts.skipped += 1
    return counts
