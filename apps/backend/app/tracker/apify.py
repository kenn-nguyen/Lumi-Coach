"""Apify scraping, with account rotation.

Ported from pipeline.gs L1001-1101 and the rotation in L761-836.

Free Apify accounts run out of credit, so the sheet keeps several and moves to the
next when one fails. That is kept: a quota error on one account is not a failed
run, it is a reason to try the next one.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)

SEARCH_ACTOR = "cheap_scraper~linkedin-job-scraper"
DETAIL_ACTOR = "apimaestro~linkedin-job-detail"

API = "https://api.apify.com/v2"
POLL_SECONDS = 5
DEFAULT_TIMEOUT = 60

SUCCEEDED = "SUCCEEDED"
FAILED_STATES = {"FAILED", "ABORTED", "TIMED-OUT", "TIMED_OUT"}


class ApifyError(RuntimeError):
    """A failure attributable to one account, so the caller may try the next."""


@dataclass
class ApifyAccount:
    label: str
    batch_key: str
    detail_key: str


def _request(method: str, url: str, token: str, **kwargs: Any) -> Any:
    response = requests.request(
        method, url, params={"token": token}, timeout=DEFAULT_TIMEOUT, **kwargs)
    if response.status_code >= 400:
        raise ApifyError(f"{method} {url.split('?')[0]} returned {response.status_code}: "
                         f"{response.text[:200]}")
    if not response.content:
        return None
    return response.json()


def start_actor(actor: str, token: str, run_input: dict[str, Any]) -> str:
    body = _request("POST", f"{API}/acts/{actor}/runs", token, json=run_input)
    run_id = (body or {}).get("data", {}).get("id")
    if not run_id:
        raise ApifyError("Apify accepted the run but returned no id")
    return run_id


def wait_for_run(run_id: str, token: str, *, max_seconds: int = 1800) -> str:
    """Poll until the run finishes, returning its dataset id.

    Generous by design: the port is not bound by a 6-minute execution limit, so a
    slow scrape is waited out rather than abandoned and resumed.
    """
    deadline = time.monotonic() + max_seconds
    while time.monotonic() < deadline:
        body = _request("GET", f"{API}/actor-runs/{run_id}", token) or {}
        data = body.get("data", {})
        state = data.get("status")
        if state == SUCCEEDED:
            dataset_id = data.get("defaultDatasetId")
            if not dataset_id:
                raise ApifyError("Run succeeded but produced no dataset")
            return dataset_id
        if state in FAILED_STATES:
            raise ApifyError(f"Apify run finished as {state}")
        time.sleep(POLL_SECONDS)
    raise ApifyError(f"Apify run did not finish within {max_seconds}s")


def fetch_items(dataset_id: str, token: str, *, limit: int | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"clean": "true", "format": "json"}
    if limit:
        params["limit"] = limit
    response = requests.get(f"{API}/datasets/{dataset_id}/items",
                            params={"token": token, **params}, timeout=DEFAULT_TIMEOUT)
    if response.status_code >= 400:
        raise ApifyError(f"Fetching the dataset returned {response.status_code}")
    items = response.json()
    return items if isinstance(items, list) else []


def lookback_hours(last_success: datetime | None, *, configured: int = 0, maximum: int = 168) -> int:
    """How far back to search.

    Measured from the last successful run so nothing is missed between runs, and
    capped so a long outage does not trigger an enormous (and expensive) scrape.
    """
    if configured and configured > 0:
        return min(configured, maximum)
    if last_success is None:
        return min(24, maximum)
    if last_success.tzinfo is None:
        last_success = last_success.replace(tzinfo=timezone.utc)
    elapsed = datetime.now(timezone.utc) - last_success
    return max(1, min(int(elapsed / timedelta(hours=1)) + 1, maximum))


def time_filter(hours: int) -> str:
    """LinkedIn's `f_TPR` parameter, in seconds."""
    return f"r{int(hours) * 3600}"


#: The search actor rejects anything smaller, so a run cannot be made arbitrarily
#: cheap by asking for fewer results. Narrowing the time window is what actually
#: reduces how many jobs come back.
ACTOR_MIN_ITEMS = 150


def build_search_input(
    template: dict[str, Any], *, hours: int, max_items: int
) -> dict[str, Any]:
    """Fill the owner's saved search, substituting the recency window.

    ``max_items`` is applied here rather than trusted from the template, because it
    is the only thing standing between a misconfigured run and a large bill. It is
    raised to the actor's floor when necessary — the actor rejects less — so the
    real cost control for a small run is a short lookback.
    """
    run_input = dict(template)
    run_input["maxItems"] = max(max_items, ACTOR_MIN_ITEMS)

    start_urls = run_input.get("startUrls")
    if isinstance(start_urls, list):
        filled = []
        for entry in start_urls:
            if isinstance(entry, dict) and isinstance(entry.get("url"), str):
                filled.append({**entry, "url": entry["url"].replace("{f_tpr}", time_filter(hours))})
            else:
                filled.append(entry)
        run_input["startUrls"] = filled
    return run_input


def run_with_rotation(
    accounts: list[ApifyAccount],
    *,
    actor: str,
    run_input: dict[str, Any],
    use_detail_key: bool = False,
    max_items: int | None = None,
    on_attempt=None,
) -> tuple[list[dict[str, Any]], str]:
    """Scrape, moving to the next account when one fails.

    Returns the items and the label of the account that worked, so the run record
    can show which account paid for it.
    """
    if not accounts:
        raise ApifyError("No active Apify account is configured")

    problems: list[str] = []
    for account in accounts:
        token = account.detail_key if use_detail_key else account.batch_key
        if not token:
            continue
        if on_attempt:
            on_attempt(account.label)
        try:
            run_id = start_actor(actor, token, run_input)
            dataset_id = wait_for_run(run_id, token)
            return fetch_items(dataset_id, token, limit=max_items), account.label
        except ApifyError as error:
            logger.warning("Apify account %s failed: %s", account.label, error)
            problems.append(f"{account.label}: {error}")

    raise ApifyError("Every Apify account failed — " + "; ".join(problems))
