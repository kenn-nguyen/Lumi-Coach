"""Tests for tailor_job column on ResumeModel."""
from unittest.mock import MagicMock, patch


def test_resume_model_has_tailor_job_attribute():
    from app.database import ResumeModel

    model = ResumeModel.__table__
    assert "tailor_job" in [c.name for c in model.columns]


def test_serialize_resume_includes_tailor_job():
    """_serialize_resume must include the tailor_job field."""
    from app.database import Database

    mock_resume = MagicMock()
    mock_resume.resume_id = "r1"
    mock_resume.user_id = "u1"
    mock_resume.content = ""
    mock_resume.content_type = "md"
    mock_resume.filename = None
    mock_resume.is_master = False
    mock_resume.parent_id = None
    mock_resume.linked_master_resume_id = None
    mock_resume.import_context = None
    mock_resume.processed_data = None
    mock_resume.processing_status = "pending"
    mock_resume.cover_letter = None
    mock_resume.outreach_message = None
    mock_resume.generation_feedback = None
    mock_resume.generation_artifacts = None
    mock_resume.template_settings = None
    mock_resume.title = None
    mock_resume.original_markdown = None
    mock_resume.created_at = None
    mock_resume.updated_at = None
    mock_resume.tailor_job = {"status": "running", "job_id": "tj_1"}

    with patch("app.database.decrypt_text", side_effect=lambda x: x), patch(
        "app.database.decrypt_json", side_effect=lambda x: x
    ):
        db = Database.__new__(Database)
        result = db._serialize_resume(mock_resume)

    assert "tailor_job" in result
    assert result["tailor_job"]["status"] == "running"


def test_serialize_resume_tailor_job_none_when_missing():
    """tailor_job should be None when the attribute is missing (legacy rows)."""
    from app.database import Database

    mock_resume = MagicMock(spec=[])  # no attributes by default
    # Add required attributes manually
    mock_resume.resume_id = "r2"
    mock_resume.user_id = "u1"
    mock_resume.content = ""
    mock_resume.content_type = "md"
    mock_resume.filename = None
    mock_resume.is_master = False
    mock_resume.parent_id = None
    mock_resume.linked_master_resume_id = None
    mock_resume.import_context = None
    mock_resume.processed_data = None
    mock_resume.processing_status = "pending"
    mock_resume.cover_letter = None
    mock_resume.outreach_message = None
    mock_resume.generation_feedback = None
    mock_resume.generation_artifacts = None
    mock_resume.template_settings = None
    mock_resume.title = None
    mock_resume.original_markdown = None
    mock_resume.created_at = None
    mock_resume.updated_at = None
    # tailor_job not set — getattr should return None

    with patch("app.database.decrypt_text", side_effect=lambda x: x), patch(
        "app.database.decrypt_json", side_effect=lambda x: x
    ):
        db = Database.__new__(Database)
        result = db._serialize_resume(mock_resume)

    assert result["tailor_job"] is None
