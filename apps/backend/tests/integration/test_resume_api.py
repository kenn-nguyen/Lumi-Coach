"""Integration tests for resume CRUD endpoints."""

import json
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas import ResumeData
from app.security import AuthenticatedUser, require_current_user


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture(autouse=True)
def override_auth():
    async def _fake_user():
        return AuthenticatedUser(
            user_id="user-123",
            email="tester@example.com",
            name="Test User",
        )

    app.dependency_overrides[require_current_user] = _fake_user
    yield
    app.dependency_overrides.pop(require_current_user, None)


@pytest.fixture
def mock_resume_record(sample_resume):
    """A resume DB record with all fields."""
    return {
        "resume_id": "res-123",
        "content": "# Jane Doe\nSenior Backend Engineer",
        "content_type": "md",
        "filename": "resume.pdf",
        "is_master": True,
        "parent_id": None,
        "processed_data": sample_resume,
        "processing_status": "ready",
        "generation_feedback": None,
        "generation_artifacts": None,
        "template_settings": None,
        "cover_letter": None,
        "outreach_message": None,
        "title": None,
        "original_markdown": "# Jane Doe\nSenior Backend Engineer",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }


class TestGetResume:
    """GET /api/v1/resumes?resume_id=..."""

    @patch("app.routers.resumes.db")
    async def test_fetch_existing_resume(self, mock_db, client, mock_resume_record):
        mock_db.get_resume.return_value = mock_resume_record
        async with client:
            resp = await client.get("/api/v1/resumes", params={"resume_id": "res-123"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["resume_id"] == "res-123"
        assert data["processed_resume"] is not None
        assert data["processed_resume"]["summary"] != ""
        assert data["template_settings"] is None

    @patch("app.routers.resumes.db")
    async def test_fetch_existing_resume_includes_template_settings(
        self, mock_db, client, mock_resume_record
    ):
        mock_db.get_resume.return_value = {
            **mock_resume_record,
            "template_settings": {"dateDisplay": "month-year"},
        }
        async with client:
            resp = await client.get("/api/v1/resumes", params={"resume_id": "res-123"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["template_settings"] == {"dateDisplay": "month-year"}

    @patch("app.routers.resumes.db")
    async def test_fetch_nonexistent_returns_404(self, mock_db, client):
        mock_db.get_resume.return_value = None
        async with client:
            resp = await client.get("/api/v1/resumes", params={"resume_id": "nonexistent"})
        assert resp.status_code == 404


class TestListResumes:
    """GET /api/v1/resumes/list"""

    @patch("app.routers.resumes.db")
    async def test_list_excludes_master_by_default(self, mock_db, client):
        mock_db.list_resumes.return_value = [
            {"resume_id": "tailored-1", "is_master": False, "created_at": "2026-01-02", "updated_at": "2026-01-02"},
        ]
        mock_db.get_extension_run_source_urls_by_resume_ids.return_value = {
            "tailored-1": "https://www.linkedin.com/jobs/view/123/"
        }
        async with client:
            resp = await client.get("/api/v1/resumes/list")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["resume_id"] == "tailored-1"
        assert data[0]["job_source_url"] == "https://www.linkedin.com/jobs/view/123/"
        mock_db.list_resumes.assert_called_once_with(
            user_id="user-123",
            limit=None,
            include_master=False,
            search=None,
        )

    @patch("app.routers.resumes.db")
    async def test_list_includes_master_when_requested(self, mock_db, client):
        mock_db.list_resumes.return_value = [
            {"resume_id": "master", "is_master": True, "created_at": "2026-01-01", "updated_at": "2026-01-01"},
            {"resume_id": "tailored-1", "is_master": False, "created_at": "2026-01-02", "updated_at": "2026-01-02"},
        ]
        mock_db.get_extension_run_source_urls_by_resume_ids.return_value = {
            "tailored-1": "https://www.linkedin.com/jobs/view/123/"
        }
        async with client:
            resp = await client.get("/api/v1/resumes/list", params={"include_master": True})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 2
        assert data[0]["job_source_url"] == "https://www.linkedin.com/jobs/view/123/"
        assert data[1]["job_source_url"] is None

    @patch("app.routers.resumes.db")
    async def test_list_forwards_limit_to_database(self, mock_db, client):
        mock_db.list_resumes.return_value = []
        mock_db.get_extension_run_source_urls_by_resume_ids.return_value = {}

        async with client:
            resp = await client.get("/api/v1/resumes/list", params={"include_master": True, "limit": 10})

        assert resp.status_code == 200
        mock_db.list_resumes.assert_called_once_with(
            user_id="user-123",
            limit=10,
            include_master=True,
            search=None,
        )

    @patch("app.routers.resumes.db")
    async def test_list_forwards_search_to_database(self, mock_db, client):
        mock_db.list_resumes.return_value = []
        mock_db.get_extension_run_source_urls_by_resume_ids.return_value = {}

        async with client:
            resp = await client.get(
                "/api/v1/resumes/list",
                params={"limit": 10, "search": "product manager"},
            )

        assert resp.status_code == 200
        mock_db.list_resumes.assert_called_once_with(
            user_id="user-123",
            limit=10,
            include_master=False,
            search="product manager",
        )


class TestDownloadResumePdf:
    """GET /api/v1/resumes/{resume_id}/pdf"""

    @patch("app.routers.resumes.render_resume_pdf", new_callable=AsyncMock)
    @patch("app.routers.resumes.db")
    async def test_forwards_date_display_to_print_route(
        self, mock_db, mock_render_resume_pdf, client, mock_resume_record
    ):
        mock_db.get_resume.return_value = mock_resume_record
        mock_render_resume_pdf.return_value = b"%PDF-1.4"

        async with client:
            resp = await client.get(
                "/api/v1/resumes/res-123/pdf",
                params={
                    "dateDisplay": "year-only",
                    "experienceHeaderOrder": "role-first",
                    "fitOnePage": "false",
                },
            )

        assert resp.status_code == 200
        print_url = mock_render_resume_pdf.call_args.args[0]
        assert "dateDisplay=year-only" in print_url
        assert "experienceHeaderOrder=role-first" in print_url
        assert "fitOnePage=false" in print_url
        assert mock_render_resume_pdf.call_args.kwargs["fit_one_page"] is False
        assert mock_render_resume_pdf.call_args.kwargs["calibrate_fit_one_page"] is False

    @patch("app.routers.resumes.render_resume_pdf", new_callable=AsyncMock)
    @patch("app.routers.resumes.db")
    async def test_forwards_resolved_fit_layout_with_backend_calibration(
        self, mock_db, mock_render_resume_pdf, client, mock_resume_record
    ):
        mock_db.get_resume.return_value = mock_resume_record
        mock_render_resume_pdf.return_value = b"%PDF-1.4"

        async with client:
            resp = await client.get(
                "/api/v1/resumes/res-123/pdf",
                params={
                    "fitOnePage": "true",
                    "fitMode": "balanced",
                    "fitOnePageVerticalScale": "1.08",
                },
            )

        assert resp.status_code == 200
        print_url = mock_render_resume_pdf.call_args.args[0]
        assert "fitOnePage=true" in print_url
        assert "fitMode=balanced" in print_url
        assert "fitOnePageVerticalScale=1.08" in print_url
        assert mock_render_resume_pdf.call_args.kwargs["fit_one_page"] is False
        assert mock_render_resume_pdf.call_args.kwargs["calibrate_fit_one_page"] is True


class TestDeleteResume:
    """DELETE /api/v1/resumes/{resume_id}"""

    @patch("app.routers.resumes.db")
    async def test_delete_existing_resume(self, mock_db, client):
        mock_db.delete_resume.return_value = True
        async with client:
            resp = await client.delete("/api/v1/resumes/res-123")
        assert resp.status_code == 200

    @patch("app.routers.resumes.db")
    async def test_delete_nonexistent_returns_404(self, mock_db, client):
        mock_db.delete_resume.return_value = False
        async with client:
            resp = await client.delete("/api/v1/resumes/nonexistent")
        assert resp.status_code == 404


class TestUploadResume:
    """POST /api/v1/resumes/upload"""

    @patch("app.routers.resumes.db")
    @patch("app.routers.resumes.parse_document", new_callable=AsyncMock)
    async def test_upload_schema_valid_json_resume_skips_document_parsing(
        self, mock_parse_document, mock_db, client, sample_resume
    ):
        mock_db.create_resume_atomic_master = AsyncMock(
            return_value={
                "resume_id": "res-json-123",
                "is_master": True,
            }
        )

        async with client:
            resp = await client.post(
                "/api/v1/resumes/upload",
                files={
                    "file": (
                        "resume.json",
                        json.dumps(sample_resume),
                        "application/json",
                    )
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["resume_id"] == "res-json-123"
        assert body["processing_status"] == "ready"
        mock_parse_document.assert_not_called()
        mock_db.create_resume_atomic_master.assert_awaited_once()
        kwargs = mock_db.create_resume_atomic_master.await_args.kwargs
        assert kwargs["content_type"] == "json"
        assert kwargs["processed_data"] == ResumeData.model_validate(sample_resume).model_dump()

    @patch("app.routers.resumes.db")
    @patch("app.routers.resumes.parse_document", new_callable=AsyncMock)
    async def test_upload_wrapped_json_resume_preserves_generation_feedback(
        self, mock_parse_document, mock_db, client, sample_resume
    ):
        feedback = {
            "summary": "CLAUDE API: Strong product fit.",
            "pros": ["Good leadership scope"],
            "cons": ["Could use tighter metrics"],
            "caveats": ["Verify claims before applying"],
            "prompt_setup": {
                "prompt_profile_id": "profile2",
                "prompt3_version_id": "prompt3-v2",
                "system_prompt_version_id": "system-v1",
            },
        }
        mock_db.create_resume_atomic_master = AsyncMock(
            return_value={
                "resume_id": "res-json-wrapper-123",
                "is_master": True,
            }
        )

        async with client:
            resp = await client.post(
                "/api/v1/resumes/upload",
                files={
                    "file": (
                        "resume.json",
                        json.dumps(
                            {
                                "resume_data": sample_resume,
                                "generation_feedback": feedback,
                            }
                        ),
                        "application/json",
                    )
                },
            )

        assert resp.status_code == 200
        mock_parse_document.assert_not_called()
        kwargs = mock_db.create_resume_atomic_master.await_args.kwargs
        assert kwargs["content_type"] == "json"
        assert kwargs["processed_data"] == ResumeData.model_validate(sample_resume).model_dump()
        assert kwargs["generation_feedback"] == feedback

    @patch("app.routers.resumes.db")
    async def test_upload_invalid_json_resume_returns_422(self, mock_db, client):
        async with client:
            resp = await client.post(
                "/api/v1/resumes/upload",
                files={
                    "file": (
                        "resume.json",
                        '{"not_resume_data": true}',
                        "application/json",
                    )
                },
            )

        assert resp.status_code == 422


class TestUpdateResume:
    """PATCH /api/v1/resumes/{resume_id}"""

    @patch("app.routers.resumes.db")
    async def test_update_resume_accepts_legacy_resume_payload(
        self, mock_db, client, mock_resume_record, sample_resume
    ):
        updated_record = {
            **mock_resume_record,
            "content": '{"summary": "updated"}',
            "content_type": "json",
            "processed_data": sample_resume,
            "generation_feedback": {
                "summary": "Keep this existing summary.",
                "pros": ["Strong scope"],
                "cons": [],
                "caveats": [],
            },
        }
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.update_resume.return_value = updated_record

        async with client:
            resp = await client.patch("/api/v1/resumes/res-123", json=sample_resume)

        assert resp.status_code == 200
        mock_db.update_resume.assert_called_once()
        updates = mock_db.update_resume.call_args.args[1]
        expected_data = ResumeData.model_validate(sample_resume).model_dump()
        expected_data["sectionMeta"] = updates["processed_data"]["sectionMeta"]
        assert updates["processed_data"] == expected_data
        assert updates["generation_feedback"] is None

    @patch("app.routers.resumes.db")
    async def test_update_resume_accepts_generation_feedback_wrapper(
        self, mock_db, client, mock_resume_record, sample_resume
    ):
        feedback = {
            "summary": "Strong fit for product leadership roles.",
            "pros": ["Clear ownership", "Good cross-functional scope"],
            "cons": ["Metrics could be tighter"],
            "caveats": ["Verify claims before applying"],
            "prompt_setup": {
                "prompt_profile_id": "profile1",
                "prompt3_version_id": "prompt3-v1",
                "system_prompt_version_id": "system-v1",
            },
        }
        updated_record = {
            **mock_resume_record,
            "content": '{"summary": "updated"}',
            "content_type": "json",
            "processed_data": sample_resume,
            "generation_feedback": feedback,
        }
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.update_resume.return_value = updated_record

        async with client:
            resp = await client.patch(
                "/api/v1/resumes/res-123",
                json={"resume_data": sample_resume, "generation_feedback": feedback},
            )

        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["generation_feedback"] == feedback
        updates = mock_db.update_resume.call_args.args[1]
        assert updates["generation_feedback"] == feedback


class TestCloneResume:
    """POST /api/v1/resumes/{resume_id}/clone"""

    @patch("app.routers.resumes.db")
    async def test_clone_existing_resume(self, mock_db, client, mock_resume_record):
        cloned_record = {
            **mock_resume_record,
            "resume_id": "res-clone-456",
            "parent_id": "res-123",
            "is_master": False,
            "created_at": "2026-01-02T00:00:00Z",
            "updated_at": "2026-01-02T00:00:00Z",
        }
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.create_resume.return_value = cloned_record

        async with client:
            resp = await client.post("/api/v1/resumes/res-123/clone")

        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["resume_id"] == "res-clone-456"
        assert body["parent_id"] == "res-123"
        assert body["processed_resume"] is not None

        mock_db.create_resume.assert_called_once()
        kwargs = mock_db.create_resume.call_args.kwargs
        assert kwargs["content"] == mock_resume_record["content"]
        assert kwargs["parent_id"] == "res-123"
        assert kwargs["is_master"] is False
        assert kwargs["template_settings"] is None

    @patch("app.routers.resumes.db")
    async def test_clone_nonexistent_resume_returns_404(self, mock_db, client):
        mock_db.get_resume.return_value = None

        async with client:
            resp = await client.post("/api/v1/resumes/nonexistent/clone")

        assert resp.status_code == 404


class TestUpdateResumeTemplateSettings:
    """PATCH /api/v1/resumes/{resume_id}/template-settings"""

    @patch("app.routers.resumes.db")
    async def test_updates_resume_template_settings(self, mock_db, client, mock_resume_record):
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.update_resume.return_value = {
            **mock_resume_record,
            "template_settings": {
                "dateDisplay": "month-year",
                "fitOnePage": False,
                "fontSize": {"bodyFont": "serif"},
            },
        }

        async with client:
            resp = await client.patch(
                "/api/v1/resumes/res-123/template-settings",
                json={
                    "dateDisplay": "month-year",
                    "fitOnePage": False,
                    "fontSize": {"bodyFont": "serif"},
                },
            )

        assert resp.status_code == 200
        assert resp.json()["data"] == {
            "dateDisplay": "month-year",
            "fitOnePage": False,
            "fontSize": {"bodyFont": "serif"},
        }
        mock_db.update_resume.assert_called_once_with(
            "res-123",
            {
                "template_settings": {
                    "dateDisplay": "month-year",
                    "fitOnePage": False,
                    "fontSize": {"bodyFont": "serif"},
                }
            },
        )

    @patch("app.routers.resumes.db")
    async def test_update_resume_template_settings_returns_404(self, mock_db, client):
        mock_db.get_resume.return_value = None

        async with client:
            resp = await client.patch(
                "/api/v1/resumes/missing/template-settings",
                json={"dateDisplay": "year-only"},
            )

        assert resp.status_code == 404


class TestLinkJobContext:
    """POST /api/v1/resumes/link-job-context"""

    @patch("app.routers.resumes.db")
    async def test_link_job_context_creates_improvement_record(
        self, mock_db, client, mock_resume_record
    ):
        tailored_record = {
            **mock_resume_record,
            "resume_id": "tailored-456",
            "parent_id": "res-123",
            "is_master": False,
        }
        mock_db.get_resume.side_effect = [mock_resume_record, tailored_record]
        mock_db.get_job.return_value = {"job_id": "job-789", "content": "JD"}
        mock_db.get_improvement_by_tailored_resume.return_value = None
        mock_db.create_improvement.return_value = {
            "request_id": "req-1",
            "original_resume_id": "res-123",
            "tailored_resume_id": "tailored-456",
            "job_id": "job-789",
            "improvements": [],
        }

        async with client:
            resp = await client.post(
                "/api/v1/resumes/link-job-context",
                json={
                    "original_resume_id": "res-123",
                    "tailored_resume_id": "tailored-456",
                    "job_id": "job-789",
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["job_id"] == "job-789"
        assert body["data"]["improvements"] == []
        mock_db.create_improvement.assert_called_once_with(
            original_resume_id="res-123",
            tailored_resume_id="tailored-456",
            job_id="job-789",
            improvements=[],
        )

    @patch("app.routers.resumes.db")
    async def test_link_job_context_rejects_duplicate_link(
        self, mock_db, client, mock_resume_record
    ):
        tailored_record = {
            **mock_resume_record,
            "resume_id": "tailored-456",
            "parent_id": "res-123",
            "is_master": False,
        }
        mock_db.get_resume.side_effect = [mock_resume_record, tailored_record]
        mock_db.get_job.return_value = {"job_id": "job-789", "content": "JD"}
        mock_db.get_improvement_by_tailored_resume.return_value = {
            "request_id": "existing-req",
            "tailored_resume_id": "tailored-456",
            "job_id": "job-789",
        }

        async with client:
            resp = await client.post(
                "/api/v1/resumes/link-job-context",
                json={
                    "original_resume_id": "res-123",
                    "tailored_resume_id": "tailored-456",
                    "job_id": "job-789",
                },
            )

        assert resp.status_code == 409


class TestUpdateJobDescription:
    """PATCH /api/v1/resumes/{resume_id}/job-description"""

    @patch("app.routers.resumes.db")
    async def test_update_job_description_for_linked_tailored_resume(
        self, mock_db, client, mock_resume_record
    ):
        tailored_record = {
            **mock_resume_record,
            "resume_id": "tailored-456",
            "parent_id": "res-123",
            "is_master": False,
        }
        mock_db.get_resume.return_value = tailored_record
        mock_db.get_improvement_by_tailored_resume.return_value = {
            "job_id": "job-789",
            "tailored_resume_id": "tailored-456",
        }
        mock_db.get_job.return_value = {"job_id": "job-789", "content": "Old JD"}
        mock_db.update_job.return_value = {"job_id": "job-789", "content": "New JD"}

        async with client:
            resp = await client.patch(
                "/api/v1/resumes/tailored-456/job-description",
                json={"content": "New JD"},
            )

        assert resp.status_code == 200
        assert resp.json()["content"] == "New JD"
        mock_db.update_job.assert_called_once_with(
            "job-789",
            {
                "content": "New JD",
                "job_keywords": None,
                "job_keywords_hash": None,
            },
        )

    @patch("app.routers.resumes.db")
    async def test_update_job_description_rejects_non_tailored_resume(
        self, mock_db, client, mock_resume_record
    ):
        mock_db.get_resume.return_value = mock_resume_record

        async with client:
            resp = await client.patch(
                "/api/v1/resumes/res-123/job-description",
                json={"content": "New JD"},
            )

        assert resp.status_code == 400


class TestUpdateTitle:
    """PATCH /api/v1/resumes/{resume_id}/title"""

    @patch("app.routers.resumes.db")
    async def test_update_title(self, mock_db, client, mock_resume_record):
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.update_resume.return_value = {**mock_resume_record, "title": "New Title"}
        async with client:
            resp = await client.patch("/api/v1/resumes/res-123/title", json={"title": "New Title"})
        assert resp.status_code == 200

    @patch("app.routers.resumes.db")
    async def test_update_title_nonexistent_returns_404(self, mock_db, client):
        mock_db.get_resume.return_value = None
        async with client:
            resp = await client.patch("/api/v1/resumes/nonexistent/title", json={"title": "X"})
        assert resp.status_code == 404


class TestUpdateCoverLetter:
    """PATCH /api/v1/resumes/{resume_id}/cover-letter"""

    @patch("app.routers.resumes.db")
    async def test_update_cover_letter(self, mock_db, client, mock_resume_record):
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.update_resume.return_value = {**mock_resume_record, "cover_letter": "Dear hiring manager..."}
        async with client:
            resp = await client.patch("/api/v1/resumes/res-123/cover-letter", json={"content": "Dear hiring manager..."})
        assert resp.status_code == 200


class TestUpdateOutreachMessage:
    """PATCH /api/v1/resumes/{resume_id}/outreach-message"""

    @patch("app.routers.resumes.db")
    async def test_update_outreach(self, mock_db, client, mock_resume_record):
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.update_resume.return_value = {**mock_resume_record, "outreach_message": "Hi, I saw your posting..."}
        async with client:
            resp = await client.patch("/api/v1/resumes/res-123/outreach-message", json={"content": "Hi, I saw your posting..."})
        assert resp.status_code == 200


class TestRetryProcessing:
    """POST /api/v1/resumes/{resume_id}/retry-processing"""

    @patch("app.routers.resumes.parse_resume_to_json", new_callable=AsyncMock)
    @patch("app.routers.resumes.db")
    async def test_retry_successful(self, mock_db, mock_parse, client, mock_resume_record, sample_resume):
        failed_record = {**mock_resume_record, "processing_status": "failed"}
        mock_db.get_resume.return_value = failed_record
        mock_parse.return_value = sample_resume
        mock_db.update_resume.return_value = {**failed_record, "processing_status": "ready", "processed_data": sample_resume}
        async with client:
            resp = await client.post("/api/v1/resumes/res-123/retry-processing")
        assert resp.status_code == 200
        data = resp.json()
        assert data["processing_status"] == "ready"

    @patch("app.routers.resumes.db")
    async def test_retry_not_failed_returns_400(self, mock_db, client, mock_resume_record):
        # processing_status is "ready", not "failed"
        mock_db.get_resume.return_value = mock_resume_record
        async with client:
            resp = await client.post("/api/v1/resumes/res-123/retry-processing")
        assert resp.status_code == 400
