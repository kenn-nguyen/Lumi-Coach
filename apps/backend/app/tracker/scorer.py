"""Calling the model.

Vertex is the primary route and authenticates with the service account already on
the server; the Gemini-key route exists as the fallback for when Vertex credit
runs out, which is a settings change rather than a redeploy.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Callable

import requests

from .scoring import RESPONSE_FIELDS, parse_json_safely

logger = logging.getLogger(__name__)

SCOPE = "https://www.googleapis.com/auth/cloud-platform"

#: The prompt carries the profile and the full rubric (~42k characters), and a
#: thinking-enabled model can sit on that for minutes. Measured runs cluster around
#: 3-8s, but the tail is long, so the timeout is generous and a timeout is retried
#: once rather than counted as a failed job.
REQUEST_TIMEOUT = 420
RETRY_ON_TIMEOUT = 1
LEVELS = ["APM", "PM", "Senior-PM", "Staff-PM", "Principal-PM", "Manager", "Senior-Manager",
          "Group-PM", "Director", "Senior-Director", "VP", "Head-of-Product", "Founding-PM",
          "Unknown"]
VISAS = ["Yes (100%)", "Likely (90%)", "Possible (70%)", "Unclear (50%)",
         "US required (40%)", "Unlikely (20%)", "No (0%)"]


def response_schema() -> dict[str, Any]:
    """Constrain the answer's shape so parsing never has to guess."""
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


def _generation_config(settings: dict[str, str]) -> dict[str, Any]:
    config: dict[str, Any] = {
        "temperature": 0.2,
        "responseMimeType": "application/json",
        "responseSchema": response_schema(),
    }
    model = settings.get("SCORING_MODEL", "")
    thinking = (settings.get("SCORING_THINKING_LEVEL") or "low").strip()
    # Only the 3.x models accept a thinking budget; sending it to others is an error.
    if model.startswith("gemini-3") and thinking:
        config["thinkingConfig"] = {"thinkingLevel": thinking}
    return config


def build_scorer(settings: dict[str, str]) -> Callable[[str], dict[str, Any] | None]:
    """Return a function that scores one prompt, for whichever route is configured."""
    route = (settings.get("GEMINI_API_ROUTE") or "vertex").strip().lower()
    model = settings.get("SCORING_MODEL") or "gemini-3.5-flash"
    config = _generation_config(settings)

    if route == "developer":
        api_key = settings.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise RuntimeError("The Gemini route needs an API key")
        url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
               f"{model}:generateContent")

        def score_developer(prompt: str) -> dict[str, Any] | None:
            return _post_with_retry(
                url, headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                body={"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                      "generationConfig": config})

        return score_developer

    # Vertex: the service account on the server, no key to manage.
    import google.auth.transport.requests
    from google.oauth2 import service_account

    key_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if key_file and os.path.exists(key_file):
        credentials = service_account.Credentials.from_service_account_file(key_file, scopes=[SCOPE])
        project = credentials.project_id
    else:
        import google.auth

        credentials, project = google.auth.default(scopes=[SCOPE])
    project = settings.get("VERTEX_PROJECT_ID") or project
    location = settings.get("VERTEX_LOCATION") or "global"
    url = (f"https://aiplatform.googleapis.com/v1/projects/{project}/locations/{location}"
           f"/publishers/google/models/{model}:generateContent")

    def score_vertex(prompt: str) -> dict[str, Any] | None:
        if not credentials.valid:
            credentials.refresh(google.auth.transport.requests.Request())
        return _post_with_retry(
            url,
            headers={"Authorization": f"Bearer {credentials.token}",
                     "Content-Type": "application/json"},
            body={"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                  "generationConfig": config})

    return score_vertex


def _post_with_retry(
    url: str, *, headers: dict[str, str], body: dict[str, Any]
) -> dict[str, Any] | None:
    """One retry on a timeout or a rate limit; other failures are reported as-is.

    A job that times out has cost nothing, so retrying it is cheaper than losing it
    and re-scoring it on the next run.
    """
    for attempt in range(RETRY_ON_TIMEOUT + 1):
        try:
            response = requests.post(url, headers=headers, json=body, timeout=REQUEST_TIMEOUT)
        except requests.Timeout:
            if attempt < RETRY_ON_TIMEOUT:
                logger.warning("Scoring timed out after %ss; retrying once", REQUEST_TIMEOUT)
                continue
            raise
        if response.status_code == 429 and attempt < RETRY_ON_TIMEOUT:
            logger.warning("Rate limited; backing off before one retry")
            time.sleep(10)
            continue
        return _parse(response)
    return None


def _parse(response: requests.Response) -> dict[str, Any] | None:
    if response.status_code != 200:
        raise RuntimeError(f"Model returned {response.status_code}: {response.text[:180]}")
    body = response.json()
    candidates = body.get("candidates") or []
    if not candidates:
        return None
    parts = candidates[0].get("content", {}).get("parts", [])
    return parse_json_safely("".join(p.get("text", "") for p in parts))
