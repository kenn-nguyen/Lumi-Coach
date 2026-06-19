"""Server-side Apify fallback for LinkedIn job detail extraction."""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import quote

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_JOB_URL_RE = re.compile(r"/jobs/view/(\d+)")
APIFY_LINKEDIN_ACTOR = "apimaestro/linkedin-job-detail"


def _normalize_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _normalize_url(value: Any) -> str:
    normalized = _normalize_text(value)
    if not normalized:
        return ""
    return normalized


def _to_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _build_description(record: dict[str, Any]) -> str:
    job_info = record.get("job_info") or record.get("jobInfo") or {}
    nested_candidates = [
        job_info.get("description"),
        job_info.get("description_text"),
        job_info.get("descriptionText"),
    ]
    for candidate in nested_candidates:
        normalized = _normalize_text(candidate)
        if normalized:
            return normalized

    direct_candidates = [
        record.get("description"),
        record.get("jobDescription"),
        record.get("job_description"),
        record.get("descriptionText"),
        record.get("fullDescription"),
        record.get("text"),
        record.get("jobText"),
    ]
    for candidate in direct_candidates:
        normalized = _normalize_text(candidate)
        if normalized:
            return normalized

    section_candidates = [
        record.get("descriptionSections"),
        record.get("description_sections"),
        record.get("sections"),
    ]
    for candidate in section_candidates:
        if not isinstance(candidate, list):
            continue
        sections: list[str] = []
        for item in candidate:
            if isinstance(item, str):
                text = item.strip()
                if text:
                    sections.append(text)
                continue
            if isinstance(item, dict):
                section_text = "\n".join(
                    filter(
                        None,
                        [
                            _normalize_text(item.get("heading")),
                            _normalize_text(item.get("title")),
                            _normalize_text(item.get("text")),
                            _normalize_text(item.get("content")),
                        ],
                    )
                ).strip()
                if section_text:
                    sections.append(section_text)
        if sections:
            return "\n\n".join(sections).strip()

    responsibility_lists = [
        *_to_string_list(record.get("responsibilities")),
        *_to_string_list(record.get("requirements")),
        *_to_string_list(record.get("qualifications")),
        *_to_string_list(record.get("skills")),
    ]
    return "\n".join(f"- {item}" for item in responsibility_lists).strip()


def _build_labeled_job_text(record: dict[str, Any]) -> str:
    job_info = record.get("job_info") or record.get("jobInfo") or {}
    company_info = record.get("company_info") or record.get("companyInfo") or {}

    title = _normalize_text(record.get("title") or record.get("jobTitle") or job_info.get("title"))
    company = _normalize_text(
        record.get("company")
        or record.get("companyName")
        or record.get("company_name")
        or company_info.get("name")
    )
    location = _normalize_text(
        record.get("location") or record.get("jobLocation") or record.get("place") or job_info.get("location")
    )
    date_posted = _normalize_text(
        record.get("datePosted")
        or record.get("postedAt")
        or record.get("date_posted")
        or job_info.get("listed_at")
        or job_info.get("original_listed_at")
    )
    employment_status = _normalize_text(job_info.get("employment_status"))
    experience_level = _normalize_text(job_info.get("experience_level"))
    workplace_types = _to_string_list(job_info.get("workplace_types"))
    description = _build_description(record)

    header_lines = [
        f"Job Title: {title}" if title else "",
        f"Company: {company}" if company else "",
        f"Location: {location}" if location else "",
        f"Employment Type: {employment_status}" if employment_status else "",
        f"Workplace Type: {', '.join(workplace_types)}" if workplace_types else "",
        f"Experience Level: {experience_level}" if experience_level else "",
        f"Date Posted: {date_posted}" if date_posted else "",
    ]
    sections = ["\n".join(line for line in header_lines if line)]
    if description:
        sections.append(f"Job Description:\n{description}")
    return "\n\n".join(section for section in sections if section).strip()


def _extract_job_id_from_url(source_url: str) -> str:
    match = _JOB_URL_RE.search(source_url)
    return match.group(1) if match else ""


def _score_record_match(record: dict[str, Any], source_url: str, source_job_id: str) -> int:
    job_info = record.get("job_info") or record.get("jobInfo") or {}
    record_url = _normalize_url(
        record.get("url")
        or record.get("link")
        or record.get("jobUrl")
        or record.get("job_url")
        or job_info.get("job_url")
    )
    record_job_id = _normalize_text(
        record.get("jobId") or record.get("job_id") or record.get("id") or job_info.get("job_posting_id")
    ) or _extract_job_id_from_url(record_url)
    description = _build_description(record)

    score = len(description)
    if source_job_id and record_job_id and source_job_id == record_job_id:
        score += 5000
    if source_url and record_url and source_url == record_url:
        score += 2500
    if _normalize_text(record.get("title") or job_info.get("title")):
        score += 100
    if _normalize_text(record.get("company") or record.get("companyName") or (record.get("company_info") or {}).get("name")):
        score += 100
    return score


def normalize_apify_job_record(record: dict[str, Any], source_url: str) -> dict[str, Any]:
    job_info = record.get("job_info") or record.get("jobInfo") or {}
    company_info = record.get("company_info") or record.get("companyInfo") or {}
    description = _build_description(record)
    labeled_text = _build_labeled_job_text(record)
    normalized_source_url = _normalize_url(
        record.get("url")
        or record.get("link")
        or record.get("jobUrl")
        or record.get("job_url")
        or job_info.get("job_url")
    ) or _normalize_url(source_url)

    return {
        "source": "apify_backend",
        "source_url": normalized_source_url,
        "title": _normalize_text(record.get("title") or record.get("jobTitle") or job_info.get("title")),
        "company": _normalize_text(
            record.get("company")
            or record.get("companyName")
            or record.get("company_name")
            or company_info.get("name")
        ),
        "location": _normalize_text(
            record.get("location") or record.get("jobLocation") or record.get("place") or job_info.get("location")
        ),
        "date_posted": _normalize_text(
            record.get("datePosted")
            or record.get("postedAt")
            or record.get("date_posted")
            or job_info.get("listed_at")
            or job_info.get("original_listed_at")
            or job_info.get("date_posted")
        )
        or None,
        "raw_text": labeled_text or description,
        "diagnostics": {
            "source": "apify_backend",
            "actor_record_url": _normalize_url(
                record.get("url") or record.get("link") or record.get("jobUrl") or record.get("job_url")
            ),
            "raw_text_length": len(description),
            "labeled_text_length": len(labeled_text),
        },
    }


_APIFY_CRAWL_ERROR_PATTERNS = (
    "dns_hostname_resolved_private",
    "the page could not be found",
    "access denied",
    "blocked by",
    "robot check",
    "page not found",
    "404 not found",
)


def _looks_like_crawl_error(text: str) -> bool:
    lower = text.lower()
    return any(pat in lower for pat in _APIFY_CRAWL_ERROR_PATTERNS)


async def fetch_linkedin_job_detail_via_apify(
    source_url: str, api_key: str | None = None
) -> dict[str, Any]:
    normalized_source_url = _normalize_url(source_url)
    if not normalized_source_url:
        raise ValueError("LinkedIn job URL is required.")

    api_token = _normalize_text(api_key or settings.apify_api_token)
    if not api_token:
        raise RuntimeError("Apify API token is not configured. Add your key in Settings.")

    source_job_id = _extract_job_id_from_url(normalized_source_url)
    if not source_job_id:
        raise ValueError("LinkedIn job URL must include a job id.")

    actor_path = quote(APIFY_LINKEDIN_ACTOR.replace("/", "~"), safe="")
    endpoint = f"https://api.apify.com/v2/acts/{actor_path}/run-sync-get-dataset-items"
    payload = {"job_id": [source_job_id]}

    logger.info(
        "Running backend Apify LinkedIn fallback actor=%s source_url=%s",
        APIFY_LINKEDIN_ACTOR,
        normalized_source_url,
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        logger.error(
            "Backend Apify fallback failed actor=%s status=%s body=%s",
            APIFY_LINKEDIN_ACTOR,
            response.status_code,
            response.text,
        )
        raise RuntimeError(f"Apify fallback failed with status {response.status_code}.")

    items = response.json()
    if not isinstance(items, list) or not items:
        logger.warning(
            "Backend Apify fallback returned no items actor=%s source_url=%s",
            APIFY_LINKEDIN_ACTOR,
            normalized_source_url,
        )
        raise RuntimeError("Apify fallback returned no job records.")

    best_record = sorted(
        items,
        key=lambda item: _score_record_match(item, normalized_source_url, source_job_id),
        reverse=True,
    )[0]
    normalized = normalize_apify_job_record(best_record, normalized_source_url)
    raw_text = _normalize_text(normalized.get("raw_text"))
    if not raw_text:
        raise RuntimeError("Apify could not extract job details. Try pasting the job description text directly.")
    if _looks_like_crawl_error(raw_text):
        raise RuntimeError(
            f"Apify could not reach the LinkedIn page ({raw_text[:120]}). "
            "Try again or paste the job description text directly."
        )

    normalized["diagnostics"] = {
        **normalized.get("diagnostics", {}),
        "actor_id": APIFY_LINKEDIN_ACTOR,
        "item_count": len(items),
        "requested_job_id": source_job_id,
    }
    return normalized
