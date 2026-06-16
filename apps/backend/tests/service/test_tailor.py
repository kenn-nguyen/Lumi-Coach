"""Tests for the tailor pipeline service."""

from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call


MOCK_MASTER_RESUME = {
    "resume_id": "master-1",
    "content": "# John Doe\nSenior Engineer",
    "processed_data": {
        "personalInfo": {
            "name": "John Doe",
            "title": "Engineer",
            "email": "john@example.com",
            "phone": "",
            "location": "",
        },
        "workExperience": [],
        "education": [],
        "personalProjects": [],
        "summary": "",
        "sectionMeta": [],
        "customSections": {},
        "additional": {
            "technicalSkills": [],
            "languages": [],
            "certificationsTraining": [],
            "awards": [],
        },
    },
    "is_master": True,
}

MOCK_P1_OUTPUT = json.dumps({"skills": ["Python"], "requirements": ["5+ years"]})
MOCK_P2_OUTPUT = json.dumps({"strategy": "Emphasize Python expertise"})

# Minimal valid ResumeData JSON that passes schema validation
MINIMAL_RESUME_DATA = {
    "personalInfo": {
        "name": "John Doe",
        "title": "Senior Engineer",
        "email": "john@example.com",
        "phone": "",
        "location": "",
    },
    "workExperience": [],
    "education": [],
    "personalProjects": [],
    "summary": "",
    "sectionMeta": [],
    "customSections": {},
    "additional": {
        "technicalSkills": [],
        "languages": [],
        "certificationsTraining": [],
        "awards": [],
    },
}

MOCK_P3_OUTPUT = json.dumps({"resume_data": MINIMAL_RESUME_DATA})


@pytest.mark.asyncio
async def test_run_tailor_pipeline_happy_path():
    """Full pipeline completes and creates a tailored resume."""
    from app.services.tailor import run_tailor_pipeline

    mock_db = MagicMock()
    mock_db.get_resume.return_value = {
        **MOCK_MASTER_RESUME,
        "tailor_job": {"status": "running", "job_id": "tj_1"},
    }
    mock_db.get_master_resume.return_value = MOCK_MASTER_RESUME
    mock_db.update_resume.return_value = None
    mock_db.create_job.return_value = {"job_id": "job-1"}
    mock_db.create_resume.return_value = {"resume_id": "tailored-1"}
    mock_db.create_improvement.return_value = {}

    mock_llm_config = MagicMock()

    with patch("app.services.tailor.db", mock_db), patch(
        "app.services.tailor.llm.complete",
        new_callable=AsyncMock,
        side_effect=[MOCK_P1_OUTPUT, MOCK_P2_OUTPUT, MOCK_P3_OUTPUT],
    ):
        await run_tailor_pipeline(
            resume_id="master-1",
            user_id="user-1",
            jd_url=None,
            jd_text="We need a Python engineer with 5+ years.",
            prompt_profile_id="profile2",
            llm_config=mock_llm_config,
            apify_api_key=None,
        )

    # Tailored resume should be created
    mock_db.create_resume.assert_called_once()
    create_kwargs = mock_db.create_resume.call_args.kwargs
    assert create_kwargs.get("parent_id") == "master-1"
    assert create_kwargs.get("is_master") is False

    # Improvement record linked
    mock_db.create_improvement.assert_called_once()

    # Final tailor_job status must be "completed"
    update_calls = mock_db.update_resume.call_args_list
    final_tailor_job = None
    for c in reversed(update_calls):
        updates = c.kwargs.get("updates") or (c.args[1] if len(c.args) > 1 else {})
        if "tailor_job" in updates:
            final_tailor_job = updates["tailor_job"]
            break
    assert final_tailor_job is not None
    assert final_tailor_job["status"] == "completed"
    assert final_tailor_job["tailored_resume_id"] == "tailored-1"


@pytest.mark.asyncio
async def test_run_tailor_pipeline_sets_failed_on_llm_error():
    """Pipeline marks job as failed when LLM raises."""
    from app.services.tailor import run_tailor_pipeline

    mock_db = MagicMock()
    mock_db.get_resume.return_value = {
        **MOCK_MASTER_RESUME,
        "tailor_job": {"status": "running", "job_id": "tj_1"},
    }
    mock_db.get_master_resume.return_value = MOCK_MASTER_RESUME
    mock_db.update_resume.return_value = None

    with patch("app.services.tailor.db", mock_db), patch(
        "app.services.tailor.llm.complete",
        new_callable=AsyncMock,
        side_effect=ValueError("LLM unavailable"),
    ):
        await run_tailor_pipeline(
            resume_id="master-1",
            user_id="user-1",
            jd_url=None,
            jd_text="Some JD",
            prompt_profile_id="profile1",
            llm_config=MagicMock(),
            apify_api_key=None,
        )

    update_calls = mock_db.update_resume.call_args_list
    last_tailor_job = None
    for c in reversed(update_calls):
        updates = c.kwargs.get("updates") or (c.args[1] if len(c.args) > 1 else {})
        if "tailor_job" in updates:
            last_tailor_job = updates["tailor_job"]
            break
    assert last_tailor_job is not None
    assert last_tailor_job["status"] == "failed"
    assert last_tailor_job["error_message"]


@pytest.mark.asyncio
async def test_run_tailor_pipeline_checks_cancellation():
    """Pipeline aborts before first LLM call when job is canceled."""
    from app.services.tailor import run_tailor_pipeline

    canceled_resume = {
        **MOCK_MASTER_RESUME,
        "tailor_job": {"status": "canceled", "job_id": "tj_1"},
    }

    mock_db = MagicMock()
    # First call (startup check) returns canceled status
    mock_db.get_resume.return_value = canceled_resume
    mock_db.get_master_resume.return_value = MOCK_MASTER_RESUME
    mock_db.update_resume.return_value = None

    with patch("app.services.tailor.db", mock_db), patch(
        "app.services.tailor.llm.complete", new_callable=AsyncMock
    ) as mock_llm:
        await run_tailor_pipeline(
            resume_id="master-1",
            user_id="user-1",
            jd_url=None,
            jd_text="JD text",
            prompt_profile_id="profile1",
            llm_config=MagicMock(),
            apify_api_key=None,
        )

    # LLM should NOT be called after cancellation detected
    mock_llm.assert_not_called()


@pytest.mark.asyncio
async def test_profile4_skips_p1_and_p2():
    """Profile4 (one-shot) calls LLM exactly once — for Prompt 3 only."""
    from app.services.tailor import run_tailor_pipeline

    mock_db = MagicMock()
    mock_db.get_resume.return_value = {
        **MOCK_MASTER_RESUME,
        "tailor_job": {"status": "running", "job_id": "tj_1"},
    }
    mock_db.get_master_resume.return_value = MOCK_MASTER_RESUME
    mock_db.update_resume.return_value = None
    mock_db.create_job.return_value = {"job_id": "job-1"}
    mock_db.create_resume.return_value = {"resume_id": "tailored-1"}
    mock_db.create_improvement.return_value = {}

    with patch("app.services.tailor.db", mock_db), patch(
        "app.services.tailor.llm.complete",
        new_callable=AsyncMock,
        return_value=MOCK_P3_OUTPUT,
    ) as mock_llm:
        await run_tailor_pipeline(
            resume_id="master-1",
            user_id="user-1",
            jd_url=None,
            jd_text="JD text",
            prompt_profile_id="profile4",
            llm_config=MagicMock(),
            apify_api_key=None,
        )

    # Only 1 LLM call (prompt3 only)
    assert mock_llm.call_count == 1


@pytest.mark.asyncio
async def test_missing_master_resume_sets_failed():
    """Pipeline sets failed when the user has no master resume."""
    from app.services.tailor import run_tailor_pipeline

    mock_db = MagicMock()
    mock_db.get_resume.return_value = {
        **MOCK_MASTER_RESUME,
        "tailor_job": {"status": "running", "job_id": "tj_1"},
    }
    mock_db.get_master_resume.return_value = None  # no master resume
    mock_db.update_resume.return_value = None

    with patch("app.services.tailor.db", mock_db), patch(
        "app.services.tailor.llm.complete", new_callable=AsyncMock
    ) as mock_llm:
        await run_tailor_pipeline(
            resume_id="master-1",
            user_id="user-1",
            jd_url=None,
            jd_text="JD text",
            prompt_profile_id="profile2",
            llm_config=MagicMock(),
            apify_api_key=None,
        )

    mock_llm.assert_not_called()
    update_calls = mock_db.update_resume.call_args_list
    last_job = None
    for c in reversed(update_calls):
        updates = c.kwargs.get("updates") or (c.args[1] if len(c.args) > 1 else {})
        if "tailor_job" in updates:
            last_job = updates["tailor_job"]
            break
    assert last_job["status"] == "failed"
    assert "master resume" in last_job["error_message"].lower()


def test_extract_json_from_text_direct():
    """_extract_json_from_text handles plain JSON."""
    from app.services.tailor import _extract_json_from_text

    result = _extract_json_from_text('{"key": "value"}')
    assert result == {"key": "value"}


def test_extract_json_from_text_fenced():
    """_extract_json_from_text handles ```json fenced blocks."""
    from app.services.tailor import _extract_json_from_text

    raw = '```json\n{"key": "value"}\n```'
    result = _extract_json_from_text(raw)
    assert result == {"key": "value"}


def test_extract_json_from_text_embedded():
    """_extract_json_from_text finds JSON embedded in prose."""
    from app.services.tailor import _extract_json_from_text

    raw = 'Here is your result: {"key": "value"} done.'
    result = _extract_json_from_text(raw)
    assert result == {"key": "value"}


def test_extract_p3_payload_unwraps_resume_data():
    from app.services.tailor import _extract_p3_payload

    raw = json.dumps({"resume_data": {"name": "Alice"}, "generation_feedback": {"summary": "Good"}})
    resume_data, feedback = _extract_p3_payload(raw)
    assert resume_data == {"name": "Alice"}
    assert feedback == {"summary": "Good"}


def test_extract_p3_payload_flat_fallback():
    from app.services.tailor import _extract_p3_payload

    raw = json.dumps({"name": "Alice"})
    resume_data, feedback = _extract_p3_payload(raw)
    assert resume_data == {"name": "Alice"}
    assert feedback is None
