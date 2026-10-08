"""Score a few real jobs through Vertex, end to end.

Deliberately capped: this exists to prove the credential, the prompt and the
response parsing all work together, not to score a backlog. It reads jobs that are
already in the database and never calls Apify.

    python -m scripts.smoke_score --limit 3
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import google.auth.transport.requests
import requests
from google.oauth2 import service_account
from sqlalchemy import create_engine, text as sql

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.tracker.scoring import (  # noqa: E402
    RESPONSE_FIELDS,
    normalize_payload,
    parse_json_safely,
)

SCOPE = "https://www.googleapis.com/auth/cloud-platform"
RUBRIC = Path(__file__).resolve().parent.parent / "app" / "tracker" / "default_rubric.txt"

LEVELS = ["APM", "PM", "Senior-PM", "Staff-PM", "Principal-PM", "Manager", "Senior-Manager",
          "Group-PM", "Director", "Senior-Director", "VP", "Head-of-Product", "Founding-PM", "Unknown"]
VISAS = ["Yes (100%)", "Likely (90%)", "Possible (70%)", "Unclear (50%)",
         "US required (40%)", "Unlikely (20%)", "No (0%)"]


def response_schema() -> dict:
    """Force the shape, so parsing never has to guess."""
    return {
        "type": "OBJECT",
        "properties": {
            "score": {"type": "INTEGER"},
            "priority": {"type": "STRING", "enum": [f"P{n:02d}" for n in range(1, 11)]},
            "us_visa_sponsorship_potential": {"type": "STRING", "enum": VISAS},
            "us_visa_reason": {"type": "STRING"},
            "summary": {"type": "STRING"},
            "why": {"type": "STRING"},
            "title_level": {"type": "STRING", "enum": LEVELS},
            "jd_implied_level": {"type": "STRING", "enum": LEVELS},
            "level_normalized": {"type": "STRING", "enum": LEVELS},
            "requires_people_mgmt": {"type": "BOOLEAN"},
            "required_yoe_pm": {"type": "INTEGER"},
            "required_yoe_total": {"type": "INTEGER"},
        },
        "required": list(RESPONSE_FIELDS),
    }


def build_prompt(profile: str, rubric: str, job: dict) -> str:
    return "\n".join([
        "You score product management jobs for a single power user. Return strict JSON only.",
        "", "Target profile:", profile, "", "Scoring instructions:", rubric, "",
        "Job:",
        f"Company: {job['company']}",
        f"Title: {job['title']}",
        f"Location: {job['location']}",
        f"Posted: {job['posted']}",
        "Description:", job["jd_text"] or "",
    ])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=3, help="hard cap on jobs scored")
    ap.add_argument("--database-url", default=os.environ.get(
        "TRACKER_DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/som_career_coach"))
    ap.add_argument("--key", default=os.environ.get(
        "TRACKER_VERTEX_KEY", "/Users/kennng/Documents/Lumi/.secrets/vertex-key.json"))
    ap.add_argument("--location", default="global")
    ap.add_argument("--model", default="gemini-3.5-flash")
    args = ap.parse_args()
    limit = max(1, min(args.limit, 5))  # never let a typo spend real money

    creds = service_account.Credentials.from_service_account_file(args.key, scopes=[SCOPE])
    creds.refresh(google.auth.transport.requests.Request())
    project = creds.project_id
    print(f"authenticated as {creds.service_account_email}\nproject {project}\n")

    engine = create_engine(args.database_url, future=True)
    with engine.connect() as conn:
        profile = conn.scalar(sql("select value from tracker_settings where key='TARGET_PROFILE'")) or ""
        jobs = [dict(r._mapping) for r in conn.execute(sql("""
            select j.job_id, j.company, j.title, j.location, j.posted,
                   j.score as sheet_score, j.priority as sheet_priority, d.jd_text
            from tracker_jobs j join tracker_job_docs d on d.job_id = j.job_id
            where d.jd_text is not null and length(d.jd_text) > 1200
            order by j.sort_key limit :n"""), {"n": limit})]

    rubric = RUBRIC.read_text() if RUBRIC.exists() else ""
    print(f"profile {len(profile)} chars · rubric {len(rubric)} chars · {len(jobs)} jobs\n")

    url = (f"https://aiplatform.googleapis.com/v1/projects/{project}/locations/{args.location}"
           f"/publishers/google/models/{args.model}:generateContent")
    headers = {"Authorization": f"Bearer {creds.token}", "Content-Type": "application/json"}

    failures = 0
    for job in jobs:
        body = {
            "contents": [{"role": "user", "parts": [{"text": build_prompt(profile, rubric, job)}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
                "responseSchema": response_schema(),
                "thinkingConfig": {"thinkingLevel": "low"},
            },
        }
        started = time.time()
        resp = requests.post(url, headers=headers, json=body, timeout=180)
        took = time.time() - started

        if resp.status_code != 200:
            print(f"✗ {job['company']}: HTTP {resp.status_code} {resp.text[:200]}")
            failures += 1
            continue

        data = resp.json()
        text = "".join(p.get("text", "")
                       for p in data["candidates"][0]["content"].get("parts", []))
        payload = normalize_payload(parse_json_safely(text))
        usage = data.get("usageMetadata", {})

        print(f"✓ {job['company']} — {job['title'][:52]}")
        print(f"   ours  : {payload.priority} score {payload.score} · {payload.us_visa}")
        print(f"   sheet : {job['sheet_priority']} score {job['sheet_score']}")
        print(f"   why   : {payload.why[:96]}")
        print(f"   {usage.get('totalTokenCount', '?')} tokens, {took:.1f}s\n")

    print(f"{len(jobs) - failures}/{len(jobs)} scored")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
