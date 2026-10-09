"""Turning a scraped item into a job row.

Ported from `_normalizeJob` (pipeline.gs L1155) and its date helpers.

Both scraper actors describe the same thing with different field names, and the
field set drifts as the actors are updated, so every value is read from a list of
candidates rather than one key. A field that cannot be read becomes empty — a
missing location must never lose the whole job.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from .fingerprint import clean_job_description, pick_first_value, truncate

JD_LIMIT = 12_000
RAW_REF_LIMIT = 40_000

COMPANY_KEYS = ("companyName", "company", "organizationName")
TITLE_KEYS = ("jobTitle", "title", "positionName")
LOCATION_KEYS = ("location", "jobLocation", "formattedLocation")
POSTED_LABEL_KEYS = ("postedTime", "postedAt", "posted", "publishedAt", "listedAt")
APPLICANT_KEYS = ("applicantsCount", "applicantCount", "applicationsCount", "applicants")
LINK_KEYS = ("jobUrl", "applyUrl", "url", "link", "postingUrl")
JOB_ID_KEYS = ("linkedinJobId", "jobId", "jobPostingId")
DESCRIPTION_KEYS = ("jobDescription", "descriptionText", "description", "job_description", "details")

_JOB_ID_IN_URL = re.compile(r"/jobs/view/(\d+)")
_DIGITS = re.compile(r"^\d{6,}$")

#: "2 months ago", "3 weeks ago" — longest unit first so "month" is not read as "m".
_RELATIVE = re.compile(
    r"(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago", re.IGNORECASE)
_UNIT_DAYS = {"second": 1 / 86400, "minute": 1 / 1440, "hour": 1 / 24,
              "day": 1, "week": 7, "month": 30, "year": 365}


_FLOATY_ID = re.compile(r"\d+\.0+")


def text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def normalize_job_id(value: Any) -> str:
    """A LinkedIn job id as digits, however the source wrote it.

    Spreadsheet cells hold large ids as numbers, so a cell read through openpyxl
    arrives as ``4454136306.0`` and ``str()`` keeps the ``.0``. That trailing
    fragment turns the posting URL into a 404, which is worse than a missing link
    because the row still looks workable.
    """
    raw = text(value)
    if not raw:
        return ""
    # Only a whole number written as a float: never truncate a genuine fraction.
    if _FLOATY_ID.fullmatch(raw):
        return raw.split(".")[0]
    return raw


def extract_linkedin_job_id(value: Any) -> str:
    """A numeric id, from a bare value or from anywhere in a LinkedIn URL."""
    raw = text(value)
    if not raw:
        return ""
    if _DIGITS.match(raw):
        return raw
    found = _JOB_ID_IN_URL.search(raw)
    return found.group(1) if found else ""


def resolve_job_id(item: dict[str, Any], raw_link: str) -> str:
    """The job's identity, falling back through every place an id might hide."""
    direct = extract_linkedin_job_id(pick_first_value(item, JOB_ID_KEYS))
    if direct:
        return direct
    from_link = extract_linkedin_job_id(raw_link)
    if from_link:
        return from_link
    if raw_link:
        # No id anywhere: derive a stable one from the URL so the job still
        # de-duplicates against itself on later runs.
        import hashlib

        return "url_" + hashlib.sha1(raw_link.encode("utf-8")).hexdigest()
    return ""


def build_job_url(job_id: str) -> str:
    return f"https://www.linkedin.com/jobs/view/{job_id}" if job_id.isdigit() else ""


def parse_relative_posted(label: str, anchor: datetime) -> datetime | None:
    """"4 days ago" resolved against when the scrape ran, not when it was read."""
    match = _RELATIVE.search(label or "")
    if not match:
        return None
    amount, unit = int(match.group(1)), match.group(2).lower()
    return anchor - timedelta(days=amount * _UNIT_DAYS[unit])


def coerce_date(value: Any) -> datetime | None:
    """Epoch milliseconds, epoch seconds or an ISO string — rejecting the implausible."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if isinstance(value, (int, float)) or str(value).strip().isdigit():
        number = float(value)
        if number <= 0:
            return None
        seconds = number / 1000 if number > 1e11 else number
        try:
            parsed = datetime.fromtimestamp(seconds, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    else:
        try:
            parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

    # A posting dated before LinkedIn existed, or in the future, is bad data.
    now = datetime.now(timezone.utc)
    if parsed.year < 2000 or parsed > now + timedelta(days=1):
        return None
    return parsed


def derive_posted(item: dict[str, Any], label: str, run_started: datetime) -> datetime | None:
    """Prefer an absolute date; fall back to resolving the relative label."""
    for key in ("originalListedAt", "listedAt", "publishedAt", "postedAt", "createdAt",
                "original_listed_at", "listed_at"):
        parsed = coerce_date(item.get(key))
        if parsed:
            return parsed
    return parse_relative_posted(label, run_started)


def normalize_applicants(value: Any) -> str:
    """Kept as text: the scrapers report '25', 'Over 200' and '200+' alike."""
    raw = text(value)
    if not raw:
        return ""
    digits = re.findall(r"\d+", raw)
    if not digits:
        return ""
    suffix = "+" if ("over" in raw.lower() or "+" in raw) else ""
    return f"{digits[0]}{suffix}"


def format_salary_banner(salary: dict[str, Any] | None) -> str:
    """A one-line pay summary, prepended so the scorer sees compensation."""
    if not isinstance(salary, dict):
        return ""

    def number(value: Any) -> str:
        try:
            amount = float(value)
        except (TypeError, ValueError):
            return ""
        return str(round(amount)) if amount > 0 else ""

    low, high = number(salary.get("min_salary")), number(salary.get("max_salary"))
    if not low and not high:
        return ""
    amount = f"{low}–{high}" if (low and high) else (low or high)
    currency, period = text(salary.get("currency_code")), text(salary.get("pay_period"))
    return f"Salary: {amount}{f' {currency}' if currency else ''}{f' / {period}' if period else ''}".strip()


def serialize_raw_ref(item: dict[str, Any]) -> str:
    """Store the payload, dropping the description first if it will not fit.

    The description is recoverable from ``jd_text``; the rest of the payload is not
    recoverable from anywhere, so it is what gets kept when something has to give.
    """
    full = json.dumps(item, ensure_ascii=False, default=str)
    if len(full) <= RAW_REF_LIMIT:
        return full
    trimmed = {k: v for k, v in item.items() if k not in DESCRIPTION_KEYS}
    compact = json.dumps(trimmed, ensure_ascii=False, default=str)
    return compact[:RAW_REF_LIMIT]


def normalize_job(item: dict[str, Any], run_started: datetime) -> dict[str, Any] | None:
    """A scraped item as a job row, or ``None`` when it has no usable identity."""
    raw_link = text(pick_first_value(item, LINK_KEYS))
    job_id = resolve_job_id(item, raw_link)
    if not job_id:
        return None

    # The detail actor nests its fields; the search actor keeps them flat.
    info = item.get("job_info") if isinstance(item.get("job_info"), dict) else {}
    source = {**item, **info} if info else item

    description = truncate(
        clean_job_description(pick_first_value(source, DESCRIPTION_KEYS)), JD_LIMIT)
    banner = format_salary_banner(item.get("salary_info"))
    if banner and description:
        description = truncate(f"{banner}\n\n{description}", JD_LIMIT)

    label = text(pick_first_value(source, POSTED_LABEL_KEYS))
    posted = derive_posted(source, label, run_started)

    return {
        "job_id": job_id,
        "company": text(pick_first_value(source, COMPANY_KEYS)),
        "title": text(pick_first_value(source, TITLE_KEYS)),
        "location": text(pick_first_value(source, LOCATION_KEYS)),
        "posted": posted,
        "applicants": normalize_applicants(pick_first_value(source, APPLICANT_KEYS)),
        "job_url": build_job_url(job_id) or raw_link,
        "jd_text": description,
        "raw_ref": serialize_raw_ref(item),
        "imported_at": run_started,
        "listed_at": coerce_date(source.get("listedAt") or source.get("listed_at")),
        "posted_at": coerce_date(source.get("originalListedAt")
                                 or source.get("original_listed_at")) or posted,
        "status": "New",
    }


def dedupe_by_job_id(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Last copy wins: a later item in the same dataset is the fresher scrape."""
    by_id: dict[str, dict[str, Any]] = {}
    for job in jobs:
        if job and job.get("job_id"):
            by_id[job["job_id"]] = job
    return list(by_id.values())
