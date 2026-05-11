"""Database serialization tests for encrypted and legacy PII values."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import pytest

from app.config import settings
from app.database import Database
from app.pii_crypto import encrypt_json, encrypt_text


@pytest.fixture(autouse=True)
def pii_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "pii_encryption_key", "test-pii-secret")
    monkeypatch.setattr(settings, "pii_hash_key", "test-pii-hash-secret")


def _database_without_engine() -> Database:
    return object.__new__(Database)


def _now() -> datetime:
    return datetime(2026, 5, 10, tzinfo=timezone.utc)


def test_serialize_user_decrypts_new_values_and_reads_legacy_values() -> None:
    db = _database_without_engine()
    encrypted_user = SimpleNamespace(
        user_id="user-1",
        email=encrypt_text("jane@example.com"),
        name=encrypt_text("Jane Doe"),
        picture=encrypt_text("https://example.com/jane.png"),
        created_at=_now(),
        updated_at=_now(),
    )
    legacy_user = SimpleNamespace(
        user_id="user-2",
        email="legacy@example.com",
        name="Legacy User",
        picture=None,
        created_at=None,
        updated_at=None,
    )

    assert db._serialize_user(encrypted_user)["email"] == "jane@example.com"
    assert db._serialize_user(encrypted_user)["name"] == "Jane Doe"
    assert db._serialize_user(legacy_user)["email"] == "legacy@example.com"
    assert db._serialize_user(legacy_user)["name"] == "Legacy User"


def test_serialize_resume_decrypts_sensitive_resume_fields() -> None:
    db = _database_without_engine()
    processed_data: dict[str, Any] = {
        "personalInfo": {"name": "Jane Doe", "email": "jane@example.com"},
        "summary": "Backend engineer",
    }
    resume = SimpleNamespace(
        resume_id="resume-1",
        user_id="user-1",
        content=encrypt_text("# Jane Doe\njane@example.com"),
        content_type="md",
        filename=encrypt_text("Jane_Doe_resume.pdf"),
        is_master=True,
        parent_id=None,
        processed_data=encrypt_json(processed_data),
        processing_status="ready",
        cover_letter=encrypt_text("Dear hiring team"),
        outreach_message=encrypt_text("Hi, I applied."),
        generation_feedback=encrypt_json({"score": 92}),
        generation_artifacts=encrypt_json({"prompt": "private prompt"}),
        template_settings={"pageSize": "A4"},
        title=encrypt_text("Jane master resume"),
        original_markdown=encrypt_text("# Original Jane"),
        created_at=_now(),
        updated_at=_now(),
    )

    raw_blob = str(
        [
            resume.content,
            resume.filename,
            resume.processed_data,
            resume.generation_artifacts,
        ]
    )
    assert "Jane Doe" not in raw_blob
    assert "jane@example.com" not in raw_blob

    serialized = db._serialize_resume(resume)

    assert serialized["content"] == "# Jane Doe\njane@example.com"
    assert serialized["filename"] == "Jane_Doe_resume.pdf"
    assert serialized["processed_data"] == processed_data
    assert serialized["generation_artifacts"] == {"prompt": "private prompt"}
    assert serialized["template_settings"] == {"pageSize": "A4"}


def test_serialize_job_and_extension_run_decrypt_sensitive_fields() -> None:
    db = _database_without_engine()
    job = SimpleNamespace(
        job_id="job-1",
        user_id="user-1",
        content=encrypt_text("Senior PM at Acme"),
        resume_id="resume-1",
        created_at=None,
        updated_at=None,
    )
    run = SimpleNamespace(
        user_id="user-1",
        run_id="run-1",
        status="patched",
        title=encrypt_text("Senior PM"),
        company=encrypt_text("Acme"),
        location=encrypt_text("New York"),
        source_url=encrypt_text("https://www.linkedin.com/jobs/view/123/"),
        job_source="linkedin",
        resume_id="resume-1",
        preview_url=encrypt_text("https://lumi.ceo/resumes/resume-1"),
        provider_id="chatgpt_api",
        provider_label="ChatGPT API",
        generated_at=None,
        total_duration_ms=1200,
        summary=encrypt_json({"jd": "private jd"}),
        prompt_artifacts=encrypt_json({"prompt1Input": "private input"}),
        created_at=None,
        updated_at=None,
    )

    assert db._serialize_job(job)["content"] == "Senior PM at Acme"
    serialized_run = db._serialize_extension_run(run)
    assert serialized_run["title"] == "Senior PM"
    assert serialized_run["company"] == "Acme"
    assert serialized_run["summary"] == {"jd": "private jd"}
    assert serialized_run["prompt_artifacts"] == {"prompt1Input": "private input"}
