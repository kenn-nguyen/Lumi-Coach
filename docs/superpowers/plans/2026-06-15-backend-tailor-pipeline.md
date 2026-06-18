# Backend Tailor Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-side Prompt 1→2→3 tailor pipeline to the web app that replicates the Chrome extension's resume tailoring workflow.

**Architecture:** User submits a LinkedIn URL or raw JD text via a dialog; the backend runs three LLM prompts sequentially in a FastAPI background task; status is polled every 3 seconds; on completion a new tailored resume is created in the existing database.

**Tech Stack:** FastAPI BackgroundTasks, LiteLLM (via existing `llm.complete()`), PostgreSQL JSONB (SQLAlchemy), httpx (Apify calls), React + TypeScript (dialog)

**Spec:** `docs/superpowers/specs/2026-06-15-backend-tailor-pipeline-design.md`

---

## Chunk 1: Database — add `tailor_job` column

**Files:**
- Modify: `apps/backend/app/database.py` (ResumeModel, `_ensure_resume_schema`, `_serialize_resume`)

---

### Task 1: Add `tailor_job` JSONB column to ResumeModel

- [ ] **Step 1: Write the failing test**

  File: `apps/backend/tests/unit/test_tailor_db_column.py`

  ```python
  """Tests for tailor_job column on ResumeModel."""
  from unittest.mock import MagicMock, patch
  import pytest

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

      with patch("app.database.decrypt_text", side_effect=lambda x: x), \
           patch("app.database.decrypt_json", side_effect=lambda x: x):
          db = Database.__new__(Database)
          result = db._serialize_resume(mock_resume)

      assert "tailor_job" in result
      assert result["tailor_job"]["status"] == "running"
  ```

- [ ] **Step 2: Run to verify it fails**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_tailor_db_column.py -v
  ```

  Expected: FAIL — `tailor_job` not in columns

- [ ] **Step 3: Add column to ResumeModel and _ensure_resume_schema**

  In `apps/backend/app/database.py`, after the `updated_at` line in `ResumeModel` (line ~123), add:

  ```python
  tailor_job: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
  ```

  In `_ensure_resume_schema` (after line ~265, inside the `with self._engine.begin()` block), add:

  ```python
  if "tailor_job" not in columns:
      connection.execute(text("ALTER TABLE resumes ADD COLUMN tailor_job JSONB"))
      logger.info("Added resumes.tailor_job column")
  ```

  In `_serialize_resume` (after the `template_settings` line, ~line 426), add:

  ```python
  "tailor_job": getattr(resume, "tailor_job", None),
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_tailor_db_column.py -v
  ```

  Expected: PASS

- [ ] **Step 5: Run full test suite to check no regressions**

  ```bash
  cd apps/backend && uv run pytest -x -q
  ```

  Expected: All pass

- [ ] **Step 6: Commit**

  ```bash
  git add apps/backend/app/database.py apps/backend/tests/unit/test_tailor_db_column.py
  git commit -m "feat: add tailor_job JSONB column to resumes table"
  ```

---

## Chunk 2: Prompt loader

**Files:**
- Create: `apps/backend/app/services/prompt_loader.py`
- Test: `apps/backend/tests/unit/test_prompt_loader.py`

The prompt loader reads templates from `app/prompts/extension_defaults/`, resolves `{{PLACEHOLDER}}` variables, and handles the profile cascade (profile2/3/4 override root templates).

---

### Task 2: Prompt template loading and rendering

- [ ] **Step 1: Write the failing tests**

  File: `apps/backend/tests/unit/test_prompt_loader.py`

  ```python
  """Tests for prompt_loader service."""
  import pytest
  from pathlib import Path
  from unittest.mock import patch, mock_open


  FAKE_PROFILE1_PROMPT1 = "---\nprompt_version: v1.0.0\n---\nAnalyze {{JOB_DESCRIPTION}} for {{COMPANY}}."
  FAKE_PROFILE2_PROMPT1 = "---\nprompt_version: v2.0.0\n---\nEnhanced: {{JOB_DESCRIPTION}} at {{COMPANY}}."
  FAKE_CONTRACT = "Return JSON with keys: skills, requirements."
  FAKE_GUARDRAILS = "Never invent data."
  FAKE_SYSTEM = "You are a resume expert."


  def test_render_prompt_replaces_placeholders():
      from app.services.prompt_loader import render_prompt
      template = "Hello {{NAME}}, your job is {{JOB}}."
      result = render_prompt(template, {"NAME": "Alice", "JOB": "Engineer"})
      assert result == "Hello Alice, your job is Engineer."


  def test_render_prompt_raises_on_unresolved_placeholder():
      from app.services.prompt_loader import render_prompt
      with pytest.raises(ValueError, match="Unresolved"):
          render_prompt("Hello {{MISSING}}.", {"NAME": "Alice"})


  def test_strip_yaml_frontmatter():
      from app.services.prompt_loader import strip_yaml_frontmatter
      text = "---\nkey: value\n---\nActual content here."
      assert strip_yaml_frontmatter(text) == "Actual content here."


  def test_strip_yaml_frontmatter_no_header():
      from app.services.prompt_loader import strip_yaml_frontmatter
      text = "No frontmatter here."
      assert strip_yaml_frontmatter(text) == "No frontmatter here."


  def test_get_template_path_profile1_uses_root():
      from app.services.prompt_loader import get_template_path, PROMPTS_DIR
      path = get_template_path("prompt1", "profile1")
      assert path == PROMPTS_DIR / "prompt1.txt"


  def test_get_template_path_profile2_overrides_prompt1():
      from app.services.prompt_loader import get_template_path, PROMPTS_DIR
      path = get_template_path("prompt1", "profile2")
      assert path == PROMPTS_DIR / "profiles" / "profile2" / "prompt1.txt"


  def test_get_template_path_profile4_only_overrides_prompt3():
      from app.services.prompt_loader import get_template_path, PROMPTS_DIR
      # profile4 only has prompt3 — prompt1 falls back to root
      path = get_template_path("prompt1", "profile4")
      assert path == PROMPTS_DIR / "prompt1.txt"
      path3 = get_template_path("prompt3", "profile4")
      assert path3 == PROMPTS_DIR / "profiles" / "profile4" / "prompt3.txt"


  def test_has_output_contract_profile3_prompt1_false():
      from app.services.prompt_loader import has_output_contract
      # profile3 prompt1/2 are plain text, no contract
      assert has_output_contract("prompt1", "profile3") is False
      assert has_output_contract("prompt2", "profile3") is False


  def test_has_output_contract_profile3_prompt3_true():
      from app.services.prompt_loader import has_output_contract
      assert has_output_contract("prompt3", "profile3") is True


  def test_has_output_contract_all_profiles_prompt3_true():
      from app.services.prompt_loader import has_output_contract
      for profile in ("profile1", "profile2", "profile4"):
          assert has_output_contract("prompt3", profile) is True
  ```

- [ ] **Step 2: Run to verify they fail**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_prompt_loader.py -v
  ```

  Expected: FAIL — module not found

- [ ] **Step 3: Implement prompt_loader.py**

  File: `apps/backend/app/services/prompt_loader.py`

  ```python
  """Prompt template loader for extension-style 3-stage pipeline."""

  import re
  from pathlib import Path

  PROMPTS_DIR = Path(__file__).parent.parent / "prompts" / "extension_defaults"

  PLACEHOLDER_PATTERN = re.compile(r"\{\{([A-Z0-9_]+)\}\}")

  # Profile cascade: maps (profile_id, template_name) -> relative path override.
  # If not listed, falls back to root template.
  _PROFILE_OVERRIDES: dict[str, dict[str, str]] = {
      "profile2": {
          "prompt1": "profiles/profile2/prompt1.txt",
          "prompt2": "profiles/profile2/prompt2.txt",
          "prompt3": "profiles/profile2/prompt3.txt",
      },
      "profile3": {
          "prompt1": "profiles/profile3/prompt1.txt",
          "prompt2": "profiles/profile3/prompt2.txt",
          "prompt3": "profiles/profile3/prompt3.txt",
      },
      "profile4": {
          "prompt3": "profiles/profile4/prompt3.txt",
      },
  }

  # profile3 prompt1/prompt2 are plain text (no output contract appended)
  _NO_CONTRACT_COMBOS: set[tuple[str, str]] = {
      ("prompt1", "profile3"),
      ("prompt2", "profile3"),
  }


  def strip_yaml_frontmatter(text: str) -> str:
      """Remove YAML frontmatter (--- block) from prompt template text."""
      text = text.strip()
      if text.startswith("---"):
          end = text.find("---", 3)
          if end != -1:
              return text[end + 3:].strip()
      return text


  def get_template_path(template_name: str, profile_id: str) -> Path:
      """Resolve the file path for a prompt template using profile cascade."""
      override = _PROFILE_OVERRIDES.get(profile_id, {}).get(template_name)
      if override:
          return PROMPTS_DIR / override
      return PROMPTS_DIR / f"{template_name}.txt"


  def has_output_contract(template_name: str, profile_id: str) -> bool:
      """Return True if an output contract should be appended to this template."""
      return (template_name, profile_id) not in _NO_CONTRACT_COMBOS


  def load_template_text(template_name: str, profile_id: str) -> str:
      """Load and return template text (frontmatter stripped)."""
      path = get_template_path(template_name, profile_id)
      raw = path.read_text(encoding="utf-8")
      return strip_yaml_frontmatter(raw)


  def load_output_contract(template_name: str) -> str:
      """Load the output contract for a given template name."""
      path = PROMPTS_DIR / "patches" / f"{template_name}.output-contract.txt"
      raw = path.read_text(encoding="utf-8")
      return strip_yaml_frontmatter(raw)


  def load_system_prompt() -> str:
      """Load system guardrails + system-prompt.txt concatenated."""
      guardrails_path = PROMPTS_DIR / "patches" / "system.guardrails.txt"
      system_path = PROMPTS_DIR / "system-prompt.txt"
      guardrails = strip_yaml_frontmatter(guardrails_path.read_text(encoding="utf-8"))
      system = strip_yaml_frontmatter(system_path.read_text(encoding="utf-8"))
      return f"{guardrails}\n\n{system}"


  def build_prompt(template_name: str, profile_id: str, variables: dict[str, str]) -> str:
      """Load template (+ output contract if applicable) and render with variables."""
      template = load_template_text(template_name, profile_id)
      if has_output_contract(template_name, profile_id):
          contract = load_output_contract(template_name)
          template = f"{template}\n\n{contract}"
      return render_prompt(template, variables)


  def render_prompt(template: str, variables: dict[str, str]) -> str:
      """Replace {{PLACEHOLDER}} tokens. Raises ValueError if any remain unresolved."""
      result = template
      for key, value in variables.items():
          result = result.replace(f"{{{{{key}}}}}", value)
      unresolved = PLACEHOLDER_PATTERN.findall(result)
      if unresolved:
          raise ValueError(f"Unresolved placeholders in prompt: {unresolved}")
      return result
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_prompt_loader.py -v
  ```

  Expected: All PASS

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/app/services/prompt_loader.py apps/backend/tests/unit/test_prompt_loader.py
  git commit -m "feat: add prompt_loader for extension-style template cascade"
  ```

---

## Chunk 3: Apify service

**Files:**
- Create: `apps/backend/app/services/apify.py`
- Test: `apps/backend/tests/unit/test_apify.py`

Extracts JD text from LinkedIn URLs via Apify HTTP API. Synchronous (httpx). Direct port of the extension's `apify.js` normalization logic.

---

### Task 3: Apify JD extraction

- [ ] **Step 1: Write the failing tests**

  File: `apps/backend/tests/unit/test_apify.py`

  ```python
  """Tests for Apify JD extraction service."""
  import pytest
  from unittest.mock import patch, MagicMock


  def test_normalize_record_extracts_description_from_job_info():
      from app.services.apify import normalize_apify_job_record
      record = {
          "job_info": {"description": "We are looking for a senior engineer."},
          "title": "Senior Engineer",
          "companyName": "Acme Corp",
          "location": "San Francisco, CA",
      }
      result = normalize_apify_job_record(record, "https://linkedin.com/jobs/view/123")
      assert "Senior Engineer" in result["labeled_text"]
      assert "Acme Corp" in result["labeled_text"]
      assert "We are looking for a senior engineer." in result["labeled_text"]
      assert result["title"] == "Senior Engineer"
      assert result["company"] == "Acme Corp"


  def test_normalize_record_falls_back_to_description_field():
      from app.services.apify import normalize_apify_job_record
      record = {"description": "Backend role.", "title": "Backend Dev"}
      result = normalize_apify_job_record(record, "https://linkedin.com/jobs/view/456")
      assert "Backend role." in result["labeled_text"]


  def test_normalize_record_joins_sections_array():
      from app.services.apify import normalize_apify_job_record
      record = {"descriptionSections": ["Section A", "Section B"]}
      result = normalize_apify_job_record(record, "https://linkedin.com/jobs/view/789")
      assert "Section A" in result["labeled_text"]
      assert "Section B" in result["labeled_text"]


  def test_extract_jd_makes_post_request():
      from app.services.apify import extract_jd_from_linkedin
      mock_response = MagicMock()
      mock_response.status_code = 200
      mock_response.json.return_value = [
          {"title": "SWE", "description": "Great role.", "companyName": "BigCo"}
      ]

      with patch("app.services.apify.httpx.post", return_value=mock_response) as mock_post:
          result = extract_jd_from_linkedin(
              "https://linkedin.com/jobs/view/123",
              apify_api_key="test-key",
          )

      mock_post.assert_called_once()
      call_kwargs = mock_post.call_args
      assert "Bearer test-key" in call_kwargs.kwargs.get("headers", {}).get("Authorization", "")
      assert "Great role." in result["labeled_text"]


  def test_extract_jd_tries_fallback_actors_on_empty_result():
      from app.services.apify import extract_jd_from_linkedin
      empty_response = MagicMock()
      empty_response.status_code = 200
      empty_response.json.return_value = []

      good_response = MagicMock()
      good_response.status_code = 200
      good_response.json.return_value = [{"title": "Dev", "description": "Fun job."}]

      with patch("app.services.apify.httpx.post", side_effect=[empty_response, good_response]):
          result = extract_jd_from_linkedin(
              "https://linkedin.com/jobs/view/999",
              apify_api_key="key",
              actor_ids=["actor/default", "actor/fallback"],
          )

      assert "Fun job." in result["labeled_text"]


  def test_extract_jd_raises_when_all_actors_fail():
      from app.services.apify import extract_jd_from_linkedin, ApifyExtractionError
      empty = MagicMock()
      empty.status_code = 200
      empty.json.return_value = []

      with patch("app.services.apify.httpx.post", return_value=empty):
          with pytest.raises(ApifyExtractionError):
              extract_jd_from_linkedin(
                  "https://linkedin.com/jobs/view/0",
                  apify_api_key="key",
                  actor_ids=["a/1", "a/2"],
              )
  ```

- [ ] **Step 2: Run to verify they fail**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_apify.py -v
  ```

  Expected: FAIL — module not found

- [ ] **Step 3: Implement apify.py**

  File: `apps/backend/app/services/apify.py`

  ```python
  """Apify LinkedIn JD extraction service.

  Port of apps/chrome-extension/src/runtime/apify.js normalization logic.
  """

  import logging
  from urllib.parse import quote

  import httpx

  logger = logging.getLogger(__name__)

  DEFAULT_ACTOR_IDS = [
      "curious_coder/linkedin-jobs-scraper",
      "apimaestro/linkedin-profile-scraper",
  ]

  APIFY_BASE_URL = "https://api.apify.com/v2/acts"
  APIFY_TIMEOUT_SECONDS = 60


  class ApifyExtractionError(Exception):
      """Raised when all Apify actors fail to return usable JD data."""


  def _to_actor_path(actor_id: str) -> str:
      """Encode actor ID for Apify URL (replace / with ~)."""
      return quote(actor_id.replace("/", "~"), safe="~")


  def _extract_description(record: dict) -> str:
      """Extract description text from Apify record using fallback chain."""
      # Nested fields
      job_info = record.get("job_info") or record.get("jobInfo") or {}
      if isinstance(job_info, dict):
          desc = job_info.get("description") or job_info.get("descriptionText")
          if desc:
              return str(desc)

      # Direct fields
      for field in ("description", "text", "jobText"):
          value = record.get(field)
          if value:
              return str(value)

      # Section arrays
      for field in ("descriptionSections", "sections"):
          value = record.get(field)
          if isinstance(value, list) and value:
              return "\n\n".join(str(s) for s in value if s)

      # Bullet list fallbacks
      bullets: list[str] = []
      for field in ("responsibilities", "requirements", "qualifications", "skills"):
          items = record.get(field)
          if isinstance(items, list):
              bullets.extend(f"- {item}" for item in items if item)
      if bullets:
          return "\n".join(bullets)

      return ""


  def _extract_field(record: dict, *keys: str) -> str:
      """Try multiple keys and return the first non-empty string value."""
      for key in keys:
          val = record.get(key)
          if val and isinstance(val, str):
              return val.strip()
      return ""


  def normalize_apify_job_record(record: dict, source_url: str) -> dict:
      """Normalize an Apify job record into structured JD data."""
      title = _extract_field(record, "title", "jobTitle", "position")
      company = _extract_field(record, "companyName", "company", "employer")
      location = _extract_field(record, "location", "jobLocation")
      description = _extract_description(record)

      lines = []
      if title:
          lines.append(f"Job Title: {title}")
      if company:
          lines.append(f"Company: {company}")
      if location:
          lines.append(f"Location: {location}")
      if source_url:
          lines.append(f"Source URL: {source_url}")
      if description:
          lines.append(f"\nJob Description:\n{description}")

      return {
          "title": title,
          "company": company,
          "location": location,
          "description": description,
          "labeled_text": "\n".join(lines),
      }


  def _call_actor(actor_id: str, job_url: str, api_key: str) -> list[dict]:
      """Call a single Apify actor. Returns list of dataset items."""
      actor_path = _to_actor_path(actor_id)
      url = f"{APIFY_BASE_URL}/{actor_path}/run-sync-get-dataset-items"
      response = httpx.post(
          url,
          json={"job_id": [job_url]},
          headers={
              "Authorization": f"Bearer {api_key}",
              "Content-Type": "application/json",
          },
          timeout=APIFY_TIMEOUT_SECONDS,
      )
      response.raise_for_status()
      data = response.json()
      return data if isinstance(data, list) else []


  def _score_record(record: dict) -> int:
      """Score how complete an Apify record is (higher = better)."""
      score = 0
      if _extract_description(record):
          score += 10
      if record.get("title") or record.get("jobTitle"):
          score += 3
      if record.get("companyName") or record.get("company"):
          score += 2
      if record.get("location"):
          score += 1
      return score


  def extract_jd_from_linkedin(
      url: str,
      apify_api_key: str,
      actor_ids: list[str] | None = None,
  ) -> dict:
      """
      Extract JD from LinkedIn URL via Apify with actor fallback chain.

      Returns normalized dict with: title, company, location, description, labeled_text.
      Raises ApifyExtractionError if all actors return empty results.
      """
      actors = actor_ids or DEFAULT_ACTOR_IDS

      for actor_id in actors:
          try:
              items = _call_actor(actor_id, url, apify_api_key)
          except Exception as exc:
              logger.warning("Apify actor %s failed: %s", actor_id, exc)
              continue

          if not items:
              logger.info("Apify actor %s returned empty results, trying next.", actor_id)
              continue

          best = max(items, key=_score_record)
          result = normalize_apify_job_record(best, url)
          if result["description"]:
              logger.info("Apify actor %s succeeded.", actor_id)
              return result

          logger.info("Apify actor %s returned record with no description, trying next.", actor_id)

      raise ApifyExtractionError(
          f"All Apify actors ({', '.join(actors)}) failed to extract a job description from {url}."
      )
  ```

- [ ] **Step 4: Run tests**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_apify.py -v
  ```

  Expected: All PASS

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/app/services/apify.py apps/backend/tests/unit/test_apify.py
  git commit -m "feat: add Apify LinkedIn JD extraction service"
  ```

---

## Chunk 4: Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/tailor.py`

---

### Task 4: Tailor request/response schemas

- [ ] **Step 1: Write the failing tests**

  File: `apps/backend/tests/unit/test_tailor_schemas.py`

  ```python
  """Tests for tailor pipeline Pydantic schemas."""
  import pytest
  from pydantic import ValidationError


  def test_tailor_request_valid():
      from app.schemas.tailor import TailorRequest
      req = TailorRequest(prompt_profile_id="profile2", jd_text="Looking for engineer")
      assert req.prompt_profile_id == "profile2"


  def test_tailor_request_invalid_profile():
      from app.schemas.tailor import TailorRequest
      with pytest.raises(ValidationError, match="Invalid prompt profile"):
          TailorRequest(prompt_profile_id="profile99", jd_text="text")


  def test_tailor_request_default_profile():
      from app.schemas.tailor import TailorRequest
      req = TailorRequest(jd_text="text")
      assert req.prompt_profile_id == "profile2"


  def test_tailor_status_response_serializes():
      from app.schemas.tailor import TailorStatusResponse
      r = TailorStatusResponse(
          job_id="tj_1",
          status="running",
          progress_stage="prompt1",
          prompt_profile_id="profile2",
          started_at="2026-06-15T10:00:00Z",
      )
      data = r.model_dump()
      assert data["job_id"] == "tj_1"
      assert data["tailored_resume_id"] is None
  ```

- [ ] **Step 2: Run to verify they fail**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_tailor_schemas.py -v
  ```

  Expected: FAIL

- [ ] **Step 3: Create the schema file**

  First check where existing schemas live:

  ```bash
  ls apps/backend/app/schemas/
  ```

  If there's a `schemas/` directory, create `apps/backend/app/schemas/tailor.py`.
  If schemas are in `app/schemas.py`, add the classes there instead.

  File: `apps/backend/app/schemas/tailor.py` (or append to `app/schemas.py`):

  ```python
  """Pydantic schemas for tailor pipeline endpoints."""

  from pydantic import BaseModel, field_validator

  VALID_PROMPT_PROFILES = {"profile1", "profile2", "profile3", "profile4"}


  class TailorRequest(BaseModel):
      prompt_profile_id: str = "profile2"
      jd_url: str | None = None
      jd_text: str | None = None

      @field_validator("prompt_profile_id")
      @classmethod
      def validate_profile(cls, v: str) -> str:
          if v not in VALID_PROMPT_PROFILES:
              raise ValueError(f"Invalid prompt profile: {v!r}. Must be one of {sorted(VALID_PROMPT_PROFILES)}")
          return v


  class TailorStartResponse(BaseModel):
      job_id: str
      status: str
      message: str


  class TailorStatusResponse(BaseModel):
      job_id: str
      status: str  # "running" | "completed" | "failed" | "canceled"
      progress_stage: str | None = None
      prompt_profile_id: str
      started_at: str
      completed_at: str | None = None
      tailored_resume_id: str | None = None
      error_message: str | None = None
  ```

- [ ] **Step 4: Run tests**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_tailor_schemas.py -v
  ```

  Expected: All PASS

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/app/schemas/tailor.py apps/backend/tests/unit/test_tailor_schemas.py
  git commit -m "feat: add Pydantic schemas for tailor pipeline"
  ```

---

## Chunk 5: Tailor pipeline service

**Files:**
- Create: `apps/backend/app/services/tailor.py`
- Test: `apps/backend/tests/service/test_tailor.py`

Core pipeline: runs P1→P2→P3 in sequence, updates `tailor_job` on the resume row at each stage, creates the tailored resume on success.

---

### Task 5: Tailor pipeline service

- [ ] **Step 1: Write the failing tests**

  File: `apps/backend/tests/service/test_tailor.py`

  ```python
  """Tests for the tailor pipeline service."""
  import json
  import pytest
  from unittest.mock import AsyncMock, MagicMock, patch, call


  MOCK_MASTER_RESUME = {
      "resume_id": "master-1",
      "content": "# John Doe\nSenior Engineer",
      "processed_data": {
          "personalInfo": {"name": "John Doe", "title": "Engineer"},
          "workExperience": [],
          "education": [],
          "skills": [],
      },
      "is_master": True,
  }

  MOCK_P1_OUTPUT = json.dumps({"skills": ["Python"], "requirements": ["5+ years"]})
  MOCK_P2_OUTPUT = json.dumps({"strategy": "Emphasize Python expertise"})
  MOCK_P3_OUTPUT = json.dumps({
      "resume_data": {
          "personalInfo": {"name": "John Doe", "title": "Senior Engineer"},
          "workExperience": [],
          "education": [],
          "skills": ["Python"],
          "sectionMeta": [],
          "customSections": {},
          "additional": {"technicalSkills": [], "languages": [], "certificationsTraining": [], "awards": []},
          "summary": "",
      }
  })


  @pytest.mark.asyncio
  async def test_run_tailor_pipeline_happy_path():
      """Full pipeline completes and creates a tailored resume."""
      from app.services.tailor import run_tailor_pipeline

      mock_db = MagicMock()
      mock_db.get_resume.return_value = {**MOCK_MASTER_RESUME, "tailor_job": {"status": "running", "job_id": "tj_1"}}
      mock_db.get_master_resume.return_value = MOCK_MASTER_RESUME
      mock_db.update_resume.return_value = None
      mock_db.create_job.return_value = {"job_id": "job-1"}
      mock_db.create_resume.return_value = {"resume_id": "tailored-1"}
      mock_db.create_improvement.return_value = {}

      mock_llm_config = MagicMock()

      with patch("app.services.tailor.db", mock_db), \
           patch("app.services.tailor.llm.complete", new_callable=AsyncMock,
                 side_effect=[MOCK_P1_OUTPUT, MOCK_P2_OUTPUT, MOCK_P3_OUTPUT]):
          await run_tailor_pipeline(
              resume_id="master-1",
              user_id="user-1",
              jd_url=None,
              jd_text="We need a Python engineer with 5+ years.",
              prompt_profile_id="profile2",
              llm_config=mock_llm_config,
              apify_api_key=None,
          )

      # Verify tailored resume was created
      mock_db.create_resume.assert_called_once()
      create_call = mock_db.create_resume.call_args
      assert create_call.kwargs.get("parent_id") == "master-1"

      # Verify final status is "completed"
      update_calls = mock_db.update_resume.call_args_list
      final_call = update_calls[-1]
      updates = final_call.kwargs.get("updates") or final_call.args[1]
      assert updates["tailor_job"]["status"] == "completed"
      assert updates["tailor_job"]["tailored_resume_id"] == "tailored-1"


  @pytest.mark.asyncio
  async def test_run_tailor_pipeline_sets_failed_on_llm_error():
      """Pipeline marks job as failed when LLM raises."""
      from app.services.tailor import run_tailor_pipeline

      mock_db = MagicMock()
      mock_db.get_resume.return_value = {**MOCK_MASTER_RESUME, "tailor_job": {"status": "running", "job_id": "tj_1"}}
      mock_db.get_master_resume.return_value = MOCK_MASTER_RESUME
      mock_db.update_resume.return_value = None

      with patch("app.services.tailor.db", mock_db), \
           patch("app.services.tailor.llm.complete", new_callable=AsyncMock,
                 side_effect=ValueError("LLM error")):
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
      last_call = update_calls[-1]
      updates = last_call.kwargs.get("updates") or last_call.args[1]
      assert updates["tailor_job"]["status"] == "failed"
      assert updates["tailor_job"]["error_message"]


  @pytest.mark.asyncio
  async def test_run_tailor_pipeline_checks_cancellation():
      """Pipeline aborts if tailor_job.status == canceled before a stage."""
      from app.services.tailor import run_tailor_pipeline

      # Second db.get_resume call returns canceled status
      mock_db = MagicMock()
      mock_db.get_resume.side_effect = [
          {**MOCK_MASTER_RESUME, "tailor_job": {"status": "running", "job_id": "tj_1"}},
          {**MOCK_MASTER_RESUME, "tailor_job": {"status": "canceled", "job_id": "tj_1"}},
      ]
      mock_db.get_master_resume.return_value = MOCK_MASTER_RESUME
      mock_db.update_resume.return_value = None

      with patch("app.services.tailor.db", mock_db), \
           patch("app.services.tailor.llm.complete", new_callable=AsyncMock) as mock_llm:
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
      """Profile4 (one-shot) runs only Prompt 3."""
      from app.services.tailor import run_tailor_pipeline

      mock_db = MagicMock()
      mock_db.get_resume.return_value = {**MOCK_MASTER_RESUME, "tailor_job": {"status": "running", "job_id": "tj_1"}}
      mock_db.get_master_resume.return_value = MOCK_MASTER_RESUME
      mock_db.update_resume.return_value = None
      mock_db.create_job.return_value = {"job_id": "job-1"}
      mock_db.create_resume.return_value = {"resume_id": "tailored-1"}
      mock_db.create_improvement.return_value = {}

      with patch("app.services.tailor.db", mock_db), \
           patch("app.services.tailor.llm.complete", new_callable=AsyncMock,
                 return_value=MOCK_P3_OUTPUT) as mock_llm:
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
  ```

- [ ] **Step 2: Run to verify they fail**

  ```bash
  cd apps/backend && uv run pytest tests/service/test_tailor.py -v
  ```

  Expected: FAIL

- [ ] **Step 3: Implement tailor.py service**

  File: `apps/backend/app/services/tailor.py`

  ```python
  """Tailor pipeline service: runs Prompt 1 → 2 → 3 to generate a tailored resume.

  Mirrors the Chrome extension's orchestrator logic on the backend.
  Each LLM stage is awaited. DB calls are sync SQLAlchemy (fast; fine for ~dozen concurrent users).
  """

  import json
  import logging
  import re
  from datetime import datetime, timezone
  from typing import Any
  from uuid import uuid4

  from app import llm
  from app.database import db
  from app.llm import LLMConfig
  from app.services.prompt_loader import build_prompt, load_system_prompt

  logger = logging.getLogger(__name__)

  _EM_DASH_PATTERN = re.compile(r"—")
  _TRAILING_PERIOD_PATTERN = re.compile(r"\.\s*$", re.MULTILINE)


  def _utcnow_iso() -> str:
      return datetime.now(timezone.utc).isoformat()


  def _is_canceled(resume_id: str, user_id: str) -> bool:
      """Check if the tailor job has been canceled by reading the DB."""
      resume = db.get_resume(resume_id, user_id)
      if not resume:
          return True
      tailor_job = resume.get("tailor_job") or {}
      return tailor_job.get("status") == "canceled"


  def _update_progress(resume_id: str, user_id: str, stage: str) -> None:
      """Write the current pipeline stage to tailor_job.progress_stage."""
      resume = db.get_resume(resume_id, user_id)
      if not resume:
          return
      tailor_job = dict(resume.get("tailor_job") or {})
      tailor_job["progress_stage"] = stage
      db.update_resume(resume_id, {"tailor_job": tailor_job}, user_id)


  def _set_failed(resume_id: str, user_id: str, message: str) -> None:
      resume = db.get_resume(resume_id, user_id)
      if not resume:
          return
      tailor_job = dict(resume.get("tailor_job") or {})
      tailor_job["status"] = "failed"
      tailor_job["error_message"] = message
      tailor_job["completed_at"] = _utcnow_iso()
      db.update_resume(resume_id, {"tailor_job": tailor_job}, user_id)


  def _set_completed(resume_id: str, user_id: str, tailored_resume_id: str) -> None:
      resume = db.get_resume(resume_id, user_id)
      if not resume:
          return
      tailor_job = dict(resume.get("tailor_job") or {})
      tailor_job["status"] = "completed"
      tailor_job["tailored_resume_id"] = tailored_resume_id
      tailor_job["completed_at"] = _utcnow_iso()
      db.update_resume(resume_id, {"tailor_job": tailor_job}, user_id)


  def _extract_json_from_text(raw: str) -> dict:
      """Extract the first valid JSON object from LLM output text."""
      raw = raw.strip()
      # Try fenced code block
      match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
      if match:
          try:
              return json.loads(match.group(1))
          except json.JSONDecodeError:
              pass
      # Try direct parse
      try:
          return json.loads(raw)
      except json.JSONDecodeError:
          pass
      # Try to find balanced {} block
      for i, ch in enumerate(raw):
          if ch == "{":
              depth = 0
              for j in range(i, len(raw)):
                  if raw[j] == "{":
                      depth += 1
                  elif raw[j] == "}":
                      depth -= 1
                      if depth == 0:
                          try:
                              return json.loads(raw[i : j + 1])
                          except json.JSONDecodeError:
                              break
      raise ValueError("Could not extract JSON from LLM output.")


  def _extract_p3_payload(raw: str) -> tuple[dict, dict | None]:
      """Return (resume_data, generation_feedback) from P3 output."""
      parsed = _extract_json_from_text(raw)
      if "resume_data" in parsed:
          return parsed["resume_data"], parsed.get("generation_feedback")
      return parsed, None


  async def _call_llm_with_repair(
      prompt: str,
      system_prompt: str,
      llm_config: LLMConfig,
      stage_label: str,
      parse_json: bool = True,
  ) -> tuple[str, dict | None]:
      """
      Call LLM. If parse_json=True, attempt JSON extraction.
      On failure, attempt one repair call. Returns (raw_text, parsed_dict_or_None).
      """
      raw = await llm.complete(prompt, system_prompt=system_prompt, config=llm_config)

      if not parse_json:
          return raw, None

      try:
          parsed = _extract_json_from_text(raw)
          return raw, parsed
      except ValueError:
          logger.warning("%s: JSON parse failed, attempting repair.", stage_label)

      repair_prompt = (
          f"The previous response was not valid JSON. "
          f"Please return only a valid JSON object with no additional text, "
          f"markdown, or explanation.\n\nPrevious response:\n{raw}"
      )
      repaired_raw = await llm.complete(repair_prompt, system_prompt=system_prompt, config=llm_config)
      try:
          parsed = _extract_json_from_text(repaired_raw)
          return repaired_raw, parsed
      except ValueError as exc:
          raise ValueError(f"{stage_label}: JSON extraction failed after repair attempt.") from exc


  async def run_tailor_pipeline(
      resume_id: str,
      user_id: str,
      jd_url: str | None,
      jd_text: str | None,
      prompt_profile_id: str,
      llm_config: LLMConfig,
      apify_api_key: str | None,
  ) -> None:
      """
      Background task: runs the full P1 → P2 → P3 tailor pipeline.

      Updates tailor_job JSONB at each stage. Creates tailored resume on success.
      Profile4 skips P1 and P2 (one-shot mode).
      """
      is_single_stage = prompt_profile_id == "profile4"
      is_freeform = prompt_profile_id == "profile3"
      system_prompt = load_system_prompt()

      try:
          # ── Stage 0: JD extraction ──────────────────────────────────────────
          if jd_url and not jd_text:
              if _is_canceled(resume_id, user_id):
                  return
              _update_progress(resume_id, user_id, "apify")
              from app.services.apify import extract_jd_from_linkedin, ApifyExtractionError
              try:
                  jd_data = extract_jd_from_linkedin(jd_url, apify_api_key or "")
                  jd_text = jd_data["labeled_text"]
              except ApifyExtractionError as exc:
                  _set_failed(resume_id, user_id, str(exc))
                  return

          if not jd_text:
              _set_failed(resume_id, user_id, "No job description text available.")
              return

          # Load master resume
          master_resume = db.get_master_resume(user_id)
          if not master_resume:
              _set_failed(resume_id, user_id, "Master resume not found.")
              return

          resume_content = master_resume.get("content") or ""
          processed_data = master_resume.get("processed_data") or {}

          # Build base template variables
          base_vars: dict[str, str] = {
              "JOB_DESCRIPTION": jd_text,
              "JOB_TITLE": "",
              "COMPANY": "",
              "LOCATION": "",
              "SOURCE_URL": jd_url or "",
              "CURRENT_RESUME": resume_content,
              "MASTER_RESUME": resume_content,
          }

          p1_raw = ""
          p1_json: dict = {}
          p2_raw = ""
          p2_json: dict = {}

          # ── Stage 1: Prompt 1 ───────────────────────────────────────────────
          if not is_single_stage:
              if _is_canceled(resume_id, user_id):
                  return
              _update_progress(resume_id, user_id, "prompt1")

              p1_prompt = build_prompt("prompt1", prompt_profile_id, base_vars)
              parse_p1_json = not is_freeform
              p1_raw, p1_parsed = await _call_llm_with_repair(
                  p1_prompt, system_prompt, llm_config, "Prompt1", parse_json=parse_p1_json
              )
              if p1_parsed:
                  p1_json = p1_parsed

          # ── Stage 2: Prompt 2 ───────────────────────────────────────────────
          if not is_single_stage:
              if _is_canceled(resume_id, user_id):
                  return
              _update_progress(resume_id, user_id, "prompt2")

              p2_vars = {
                  **base_vars,
                  "PROMPT1_JSON": json.dumps(p1_json) if p1_json else "",
                  "PROMPT1_RESPONSE": p1_raw,
                  "PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES": "",
              }
              p2_prompt = build_prompt("prompt2", prompt_profile_id, p2_vars)
              parse_p2_json = not is_freeform
              p2_raw, p2_parsed = await _call_llm_with_repair(
                  p2_prompt, system_prompt, llm_config, "Prompt2", parse_json=parse_p2_json
              )
              if p2_parsed:
                  p2_json = p2_parsed

          # ── Stage 3: Prompt 3 ───────────────────────────────────────────────
          if _is_canceled(resume_id, user_id):
              return
          _update_progress(resume_id, user_id, "prompt3")

          p3_vars = {
              **base_vars,
              "PROMPT1_JSON": json.dumps(p1_json) if p1_json else "",
              "PROMPT1_RESPONSE": p1_raw,
              "PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES": "",
              "PROMPT2_JSON": json.dumps(p2_json) if p2_json else "",
              "PROMPT2_RESPONSE": p2_raw,
          }
          p3_prompt = build_prompt("prompt3", prompt_profile_id, p3_vars)
          p3_raw, _ = await _call_llm_with_repair(
              p3_prompt, system_prompt, llm_config, "Prompt3", parse_json=True
          )

          # ── Stage 4: Post-processing ─────────────────────────────────────────
          _update_progress(resume_id, user_id, "postprocess")
          resume_data, generation_feedback = _extract_p3_payload(p3_raw)

          # Validate against ResumeData schema
          from app.schemas import ResumeData
          validated = ResumeData.model_validate(resume_data)
          resume_data = validated.model_dump()

          # ── Stage 5: Persist ─────────────────────────────────────────────────
          job_record = db.create_job(
              content=jd_text,
              resume_id=resume_id,
              user_id=user_id,
          )
          job_id = job_record["job_id"]

          generation_artifacts = {"prompt2": p2_json} if p2_json else {}

          tailored = db.create_resume(
              user_id=user_id,
              content=resume_content,
              processed_data=resume_data,
              generation_feedback=generation_feedback,
              generation_artifacts=generation_artifacts,
              parent_id=resume_id,
              linked_master_resume_id=resume_id,
              is_master=False,
          )
          tailored_resume_id = tailored["resume_id"]

          db.create_improvement(
              original_resume_id=resume_id,
              tailored_resume_id=tailored_resume_id,
              job_id=job_id,
              improvements=[],
              user_id=user_id,
          )

          _set_completed(resume_id, user_id, tailored_resume_id)
          logger.info("Tailor pipeline completed for resume %s → %s", resume_id, tailored_resume_id)

      except Exception as exc:
          logger.exception("Tailor pipeline failed for resume %s: %s", resume_id, exc)
          _set_failed(resume_id, user_id, str(exc))
  ```

- [ ] **Step 4: Check db.create_resume signature to make sure keyword args match**

  ```bash
  grep -n "def create_resume" apps/backend/app/database.py
  ```

  Read the function signature and adjust the keyword args in the `db.create_resume(...)` call above if needed.

- [ ] **Step 5: Run tests**

  ```bash
  cd apps/backend && uv run pytest tests/service/test_tailor.py -v
  ```

  Expected: All PASS

- [ ] **Step 6: Commit**

  ```bash
  git add apps/backend/app/services/tailor.py apps/backend/tests/service/test_tailor.py
  git commit -m "feat: add tailor pipeline service (P1→P2→P3)"
  ```

---

## Chunk 6: Router + stale job cleanup

**Files:**
- Create: `apps/backend/app/routers/tailor.py`
- Modify: `apps/backend/app/routers/__init__.py`
- Modify: `apps/backend/app/main.py`

---

### Task 6: Tailor router (3 endpoints)

- [ ] **Step 1: Write the failing tests**

  File: `apps/backend/tests/unit/test_tailor_router.py`

  ```python
  """Tests for tailor pipeline router endpoints."""
  import pytest
  from unittest.mock import AsyncMock, MagicMock, patch
  from fastapi.testclient import TestClient


  @pytest.fixture
  def client():
      from app.main import app
      return TestClient(app)


  def _auth_headers():
      return {"Authorization": "Bearer test-token"}


  def _mock_user():
      """Return a mock AuthenticatedUser with user_id='user-1'."""
      from app.security import AuthenticatedUser
      return AuthenticatedUser(user_id="user-1", email="test@example.com", name="Test", picture=None)


  def test_start_tailor_returns_202(client):
      mock_resume = {
          "resume_id": "r1",
          "is_master": True,
          "tailor_job": None,
          "processed_data": {},
          "content": "resume content",
      }
      with patch("app.routers.tailor.db") as mock_db, \
           patch("app.routers.tailor.get_llm_config", return_value=MagicMock(api_key="key")), \
           patch("app.routers.tailor.require_current_user", return_value=_mock_user()), \
           patch("app.routers.tailor.run_tailor_pipeline", new_callable=AsyncMock):
          mock_db.get_resume.return_value = mock_resume
          mock_db.update_resume.return_value = mock_resume

          response = client.post(
              "/api/v1/resumes/r1/tailor",
              json={"prompt_profile_id": "profile2", "jd_text": "Looking for engineers."},
              headers=_auth_headers(),
          )

      assert response.status_code == 202
      data = response.json()
      assert data["status"] == "running"
      assert "job_id" in data


  def test_start_tailor_rejects_when_job_already_running(client):
      mock_resume = {
          "resume_id": "r1",
          "tailor_job": {"status": "running", "job_id": "tj_existing"},
      }
      with patch("app.routers.tailor.db") as mock_db, \
           patch("app.routers.tailor.get_llm_config", return_value=MagicMock(api_key="key")), \
           patch("app.routers.tailor.require_current_user", return_value=_mock_user()):
          mock_db.get_resume.return_value = mock_resume

          response = client.post(
              "/api/v1/resumes/r1/tailor",
              json={"jd_text": "some JD"},
              headers=_auth_headers(),
          )

      assert response.status_code == 409


  def test_start_tailor_rejects_no_jd(client):
      mock_resume = {"resume_id": "r1", "tailor_job": None}
      with patch("app.routers.tailor.db") as mock_db, \
           patch("app.routers.tailor.get_llm_config", return_value=MagicMock(api_key="key")), \
           patch("app.routers.tailor.require_current_user", return_value=_mock_user()):
          mock_db.get_resume.return_value = mock_resume

          response = client.post(
              "/api/v1/resumes/r1/tailor",
              json={"prompt_profile_id": "profile2"},
              headers=_auth_headers(),
          )

      assert response.status_code == 400


  def test_get_tailor_status_returns_job(client):
      mock_resume = {
          "resume_id": "r1",
          "tailor_job": {
              "job_id": "tj_1",
              "status": "running",
              "progress_stage": "prompt1",
              "prompt_profile_id": "profile2",
              "started_at": "2026-06-15T10:00:00Z",
              "completed_at": None,
              "tailored_resume_id": None,
              "error_message": None,
          },
      }
      with patch("app.routers.tailor.db") as mock_db, \
           patch("app.routers.tailor.require_current_user", return_value=_mock_user()):
          mock_db.get_resume.return_value = mock_resume

          response = client.get("/api/v1/resumes/r1/tailor-status", headers=_auth_headers())

      assert response.status_code == 200
      data = response.json()
      assert data["status"] == "running"
      assert data["job_id"] == "tj_1"


  def test_cancel_tailor_sets_canceled(client):
      mock_resume = {
          "resume_id": "r1",
          "tailor_job": {
              "job_id": "tj_1",
              "status": "running",
              "prompt_profile_id": "profile2",
              "started_at": "2026-06-15T10:00:00Z",
          },
      }
      with patch("app.routers.tailor.db") as mock_db, \
           patch("app.routers.tailor.require_current_user", return_value=_mock_user()):
          mock_db.get_resume.return_value = mock_resume
          mock_db.update_resume.return_value = {
              **mock_resume,
              "tailor_job": {**mock_resume["tailor_job"], "status": "canceled"},
          }

          response = client.post("/api/v1/resumes/r1/tailor-cancel", headers=_auth_headers())

      assert response.status_code == 200
      mock_db.update_resume.assert_called_once()
  ```

- [ ] **Step 2: Run to verify they fail**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_tailor_router.py -v
  ```

  Expected: FAIL

- [ ] **Step 3: Create the router**

  File: `apps/backend/app/routers/tailor.py`

  ```python
  """Tailor pipeline endpoints."""

  import logging
  from dataclasses import dataclass
  from datetime import datetime, timezone
  from uuid import uuid4

  from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

  from app.database import db
  from app.llm import LLMConfig, get_llm_config
  from app.schemas.tailor import TailorRequest, TailorStartResponse, TailorStatusResponse
  from app.security import AuthenticatedUser, require_current_user
  from app.services.tailor import run_tailor_pipeline

  logger = logging.getLogger(__name__)
  router = APIRouter(prefix="/resumes", tags=["tailor"])


  def _utcnow_iso() -> str:
      return datetime.now(timezone.utc).isoformat()


  @router.post("/{resume_id}/tailor", status_code=202)
  async def start_tailor(
      resume_id: str,
      request: TailorRequest,
      background_tasks: BackgroundTasks,
      current_user: AuthenticatedUser = Depends(require_current_user),
  ) -> TailorStartResponse:
      """Start a tailor pipeline job in the background."""
      user_id = current_user.user_id

      # Validate JD input
      if not request.jd_url and not request.jd_text:
          raise HTTPException(status_code=400, detail="Provide either jd_url or jd_text.")

      if request.jd_url and "linkedin.com" not in request.jd_url:
          raise HTTPException(status_code=400, detail="jd_url must be a LinkedIn URL.")

      # Check resume exists
      resume = db.get_resume(resume_id, user_id)
      if not resume:
          raise HTTPException(status_code=404, detail="Resume not found.")

      # Check for running job
      existing_job = resume.get("tailor_job") or {}
      if existing_job.get("status") == "running":
          raise HTTPException(status_code=409, detail="A tailor job is already running for this resume.")

      # Resolve LLM config
      try:
          llm_config: LLMConfig = get_llm_config(user_id)
          if not llm_config.api_key:
              raise HTTPException(
                  status_code=503,
                  detail="No LLM API key configured. Please add one in Settings.",
              )
      except HTTPException:
          raise
      except Exception as exc:
          raise HTTPException(status_code=503, detail="Could not resolve LLM configuration.") from exc

      # Resolve Apify key
      from app.config import settings
      apify_api_key: str | None = settings.apify_api_token or None

      if request.jd_url and not apify_api_key:
          raise HTTPException(
              status_code=400,
              detail="LinkedIn URL extraction requires an Apify API key. Please paste the job description text instead.",
          )

      # Write initial tailor_job status
      job_id = f"tj_{uuid4().hex[:12]}"
      tailor_job = {
          "job_id": job_id,
          "status": "running",
          "progress_stage": None,
          "prompt_profile_id": request.prompt_profile_id,
          "jd_source": "linkedin_url" if request.jd_url else "raw_text",
          "jd_url": request.jd_url,
          "jd_text": request.jd_text,
          "error_message": None,
          "started_at": _utcnow_iso(),
          "completed_at": None,
          "tailored_resume_id": None,
      }
      db.update_resume(resume_id, {"tailor_job": tailor_job}, user_id)

      # Kick off background task
      background_tasks.add_task(
          run_tailor_pipeline,
          resume_id=resume_id,
          user_id=user_id,
          jd_url=request.jd_url,
          jd_text=request.jd_text,
          prompt_profile_id=request.prompt_profile_id,
          llm_config=llm_config,
          apify_api_key=apify_api_key,
      )

      return TailorStartResponse(job_id=job_id, status="running", message="Tailor pipeline started.")


  @router.get("/{resume_id}/tailor-status")
  async def get_tailor_status(
      resume_id: str,
      current_user: AuthenticatedUser = Depends(require_current_user),
  ) -> TailorStatusResponse:
      """Poll the current tailor job status."""
      user_id = current_user.user_id
      resume = db.get_resume(resume_id, user_id)
      if not resume:
          raise HTTPException(status_code=404, detail="Resume not found.")

      tailor_job = resume.get("tailor_job")
      if not tailor_job:
          raise HTTPException(status_code=404, detail="No tailor job found for this resume.")

      return TailorStatusResponse(
          job_id=tailor_job.get("job_id", ""),
          status=tailor_job.get("status", "unknown"),
          progress_stage=tailor_job.get("progress_stage"),
          prompt_profile_id=tailor_job.get("prompt_profile_id", ""),
          started_at=tailor_job.get("started_at", ""),
          completed_at=tailor_job.get("completed_at"),
          tailored_resume_id=tailor_job.get("tailored_resume_id"),
          error_message=tailor_job.get("error_message"),
      )


  @router.post("/{resume_id}/tailor-cancel")
  async def cancel_tailor(
      resume_id: str,
      current_user: AuthenticatedUser = Depends(require_current_user),
  ) -> TailorStatusResponse:
      """Cancel a running tailor job."""
      user_id = current_user.user_id
      resume = db.get_resume(resume_id, user_id)
      if not resume:
          raise HTTPException(status_code=404, detail="Resume not found.")

      tailor_job = resume.get("tailor_job") or {}
      if tailor_job.get("status") != "running":
          raise HTTPException(status_code=400, detail="No running tailor job to cancel.")

      updated_job = {**tailor_job, "status": "canceled", "completed_at": _utcnow_iso()}
      db.update_resume(resume_id, {"tailor_job": updated_job}, user_id)

      return TailorStatusResponse(
          job_id=updated_job.get("job_id", ""),
          status="canceled",
          progress_stage=updated_job.get("progress_stage"),
          prompt_profile_id=updated_job.get("prompt_profile_id", ""),
          started_at=updated_job.get("started_at", ""),
          completed_at=updated_job.get("completed_at"),
          tailored_resume_id=None,
          error_message=None,
      )
  ```

- [ ] **Step 4: Register the router in `__init__.py` and `main.py`**

  In `apps/backend/app/routers/__init__.py`, add:
  ```python
  from app.routers.tailor import router as tailor_router
  ```
  And add `"tailor_router"` to `__all__`.

  In `apps/backend/app/main.py`, add:
  ```python
  from app.routers import tailor_router  # add to existing import block
  ```
  And:
  ```python
  app.include_router(tailor_router, prefix="/api/v1")  # after existing routers
  ```

- [ ] **Step 5: Add stale job cleanup to lifespan**

  In `apps/backend/app/main.py`, update the lifespan function to call a stale job cleanup after `db.init_schema()`:

  ```python
  # In lifespan, after db.init_schema():
  _cleanup_stale_tailor_jobs()
  ```

  Add this function to `main.py`:

  ```python
  def _cleanup_stale_tailor_jobs() -> None:
      """Mark orphaned 'running' tailor jobs as failed on startup."""
      from datetime import timedelta
      cutoff_minutes = 10
      try:
          # list_resumes returns list[dict], not a dict with a "resumes" key
          resumes: list[dict] = db.list_resumes(user_id=None, limit=1000)
          now = datetime.now(timezone.utc)
          for resume in resumes:
              tailor_job = resume.get("tailor_job") or {}
              if tailor_job.get("status") != "running":
                  continue
              started_at_str = tailor_job.get("started_at", "")
              try:
                  started_at = datetime.fromisoformat(started_at_str)
                  if (now - started_at) > timedelta(minutes=cutoff_minutes):
                      updated = {
                          **tailor_job,
                          "status": "failed",
                          "error_message": "Job interrupted by server restart.",
                          "completed_at": now.isoformat(),
                      }
                      db.update_resume(resume["resume_id"], {"tailor_job": updated})
                      logger.info("Marked stale tailor job as failed: %s", tailor_job.get("job_id"))
              except Exception:
                  continue
      except Exception as exc:
          logger.warning("Stale tailor job cleanup failed: %s", exc)
  ```

  Add the `datetime` import to `main.py` if not already present.

- [ ] **Step 6: Run tests**

  ```bash
  cd apps/backend && uv run pytest tests/unit/test_tailor_router.py -v
  cd apps/backend && uv run pytest -x -q
  ```

  Expected: All PASS

- [ ] **Step 7: Commit**

  ```bash
  git add apps/backend/app/routers/tailor.py apps/backend/app/routers/__init__.py \
          apps/backend/app/main.py apps/backend/tests/unit/test_tailor_router.py
  git commit -m "feat: add tailor pipeline router (start, status, cancel)"
  ```

---

## Chunk 7: Frontend TailorDialog

**Files:**
- Create: `apps/frontend/lib/api/tailor.ts`
- Create: `apps/frontend/components/tailor/TailorDialog.tsx`
- Modify: `apps/frontend/app/(default)/resumes/[id]/page.tsx` (or the resume builder component — check which has the action buttons)

---

### Task 7: Frontend API client for tailor

- [ ] **Step 1: Create `lib/api/tailor.ts`**

  File: `apps/frontend/lib/api/tailor.ts`

  ```typescript
  import { API_BASE, apiFetch, apiPost, readApiErrorMessage } from './client';

  export interface TailorStartResponse {
    job_id: string;
    status: string;
    message: string;
  }

  export interface TailorStatusResponse {
    job_id: string;
    status: 'running' | 'completed' | 'failed' | 'canceled';
    progress_stage: string | null;
    prompt_profile_id: string;
    started_at: string;
    completed_at: string | null;
    tailored_resume_id: string | null;
    error_message: string | null;
  }

  export async function startTailorJob(
    resumeId: string,
    params: {
      prompt_profile_id: string;
      jd_url?: string;
      jd_text?: string;
    }
  ): Promise<TailorStartResponse> {
    const response = await apiPost(`${API_BASE}/resumes/${resumeId}/tailor`, params);
    if (!response.ok) {
      const message = await readApiErrorMessage(response, 'Failed to start tailor job.');
      throw new Error(message);
    }
    return response.json();
  }

  export async function getTailorStatus(resumeId: string): Promise<TailorStatusResponse> {
    const response = await apiFetch(`${API_BASE}/resumes/${resumeId}/tailor-status`);
    if (!response.ok) {
      const message = await readApiErrorMessage(response, 'Failed to get tailor status.');
      throw new Error(message);
    }
    return response.json();
  }

  export async function cancelTailorJob(resumeId: string): Promise<TailorStatusResponse> {
    const response = await apiPost(`${API_BASE}/resumes/${resumeId}/tailor-cancel`, {});
    if (!response.ok) {
      const message = await readApiErrorMessage(response, 'Failed to cancel tailor job.');
      throw new Error(message);
    }
    return response.json();
  }
  ```

- [ ] **Step 2: Lint check**

  ```bash
  cd apps/frontend && npm run lint -- --max-warnings=0 lib/api/tailor.ts 2>/dev/null || npm run lint
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/frontend/lib/api/tailor.ts
  git commit -m "feat: add frontend API client for tailor pipeline"
  ```

---

### Task 8: TailorDialog component

- [ ] **Step 1: Locate the resume action buttons**

  ```bash
  grep -rn "Improve\|improve\|download\|Download" apps/frontend/app/\(default\)/resumes/ --include="*.tsx" | head -10
  grep -rn "Improve\|TailorButton\|tailor" apps/frontend/components/builder/ --include="*.tsx" | head -10
  ```

  Find where existing action buttons live — this is where the "Tailor" button will be added.

- [ ] **Step 2: Create TailorDialog component**

  File: `apps/frontend/components/tailor/TailorDialog.tsx`

  ```tsx
  'use client';

  import React, { useState, useEffect, useRef, useCallback } from 'react';
  import { useRouter } from 'next/navigation';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
  } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import { Label } from '@/components/ui/label';
  import {
    startTailorJob,
    getTailorStatus,
    cancelTailorJob,
    type TailorStatusResponse,
  } from '@/lib/api/tailor';

  const PROMPT_PROFILES = [
    { value: 'profile1', label: 'Standard' },
    { value: 'profile2', label: 'Enhanced (Default)' },
    { value: 'profile3', label: 'Lean / ATS-focused' },
    { value: 'profile4', label: 'One-shot Writer' },
  ] as const;

  const STAGE_LABELS: Record<string, string> = {
    apify: 'Extracting job description...',
    prompt1: 'Analyzing job description (1/3)...',
    prompt2: 'Building positioning strategy (2/3)...',
    prompt3: 'Writing tailored resume (3/3)...',
    postprocess: 'Finalizing...',
  };

  const STAGE_PROGRESS: Record<string, number> = {
    apify: 10,
    prompt1: 30,
    prompt2: 55,
    prompt3: 80,
    postprocess: 95,
  };

  interface TailorDialogProps {
    resumeId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  type DialogPhase = 'input' | 'running' | 'done' | 'error';

  export function TailorDialog({ resumeId, open, onOpenChange }: TailorDialogProps) {
    const router = useRouter();
    const [phase, setPhase] = useState<DialogPhase>('input');
    const [profileId, setProfileId] = useState('profile2');
    const [jdUrl, setJdUrl] = useState('');
    const [jdText, setJdText] = useState('');
    const [status, setStatus] = useState<TailorStatusResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, []);

    useEffect(() => {
      if (!open) {
        stopPolling();
        setPhase('input');
        setStatus(null);
        setErrorMessage('');
        setJdUrl('');
        setJdText('');
      }
    }, [open, stopPolling]);

    useEffect(() => () => stopPolling(), [stopPolling]);

    const startPolling = useCallback(() => {
      pollRef.current = setInterval(async () => {
        try {
          const s = await getTailorStatus(resumeId);
          setStatus(s);
          if (s.status === 'completed') {
            stopPolling();
            setPhase('done');
          } else if (s.status === 'failed' || s.status === 'canceled') {
            stopPolling();
            setErrorMessage(s.error_message || 'The tailor job failed. Please try again.');
            setPhase('error');
          }
        } catch {
          // ignore transient poll errors
        }
      }, 3000);
    }, [resumeId, stopPolling]);

    const handleSubmit = async () => {
      if (!jdUrl && !jdText.trim()) {
        setErrorMessage('Please provide a LinkedIn URL or paste the job description.');
        return;
      }
      setSubmitting(true);
      setErrorMessage('');
      try {
        await startTailorJob(resumeId, {
          prompt_profile_id: profileId,
          jd_url: jdUrl || undefined,
          jd_text: jdText || undefined,
        });
        setPhase('running');
        startPolling();
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to start. Please try again.');
      } finally {
        setSubmitting(false);
      }
    };

    const handleCancel = async () => {
      stopPolling();
      try {
        await cancelTailorJob(resumeId);
      } catch {
        // best-effort
      }
      onOpenChange(false);
    };

    const handleViewResume = () => {
      if (status?.tailored_resume_id) {
        router.push(`/resumes/${status.tailored_resume_id}`);
      }
      onOpenChange(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') e.stopPropagation();
    };

    const progressPct = status?.progress_stage ? (STAGE_PROGRESS[status.progress_stage] ?? 20) : 5;
    const stageLabel = status?.progress_stage ? (STAGE_LABELS[status.progress_stage] ?? 'Processing...') : 'Starting...';

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          {phase === 'input' && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Tailor Resume to Job</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div>
                  <Label className="font-mono text-xs uppercase tracking-wider">Prompt Profile</Label>
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="mt-1 block w-full border border-black bg-[#F0F0E8] px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {PROMPT_PROFILES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="font-mono text-xs uppercase tracking-wider">LinkedIn Job URL</Label>
                  <Input
                    className="mt-1"
                    placeholder="https://www.linkedin.com/jobs/view/..."
                    value={jdUrl}
                    onChange={(e) => setJdUrl(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="font-mono text-xs uppercase tracking-wider">Or paste job description</Label>
                  <Textarea
                    className="mt-1 h-32 resize-none"
                    placeholder="Paste the full job description here..."
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>

                {errorMessage && (
                  <p className="text-sm text-[#DC2626]">{errorMessage}</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Starting...' : 'Start Tailor'}
                </Button>
              </DialogFooter>
            </>
          )}

          {phase === 'running' && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Tailoring Resume...</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="h-2 w-full bg-gray-200">
                  <div
                    className="h-2 bg-[#1D4ED8] transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="font-sans text-sm text-gray-700">{stageLabel}</p>
                <p className="font-mono text-xs text-gray-500">This usually takes 30–90 seconds.</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}

          {phase === 'done' && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Resume Tailored!</DialogTitle>
              </DialogHeader>

              <div className="py-4">
                <p className="font-sans text-sm text-gray-700">
                  Your tailored resume is ready.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={handleViewResume}>
                  View Resume →
                </Button>
              </DialogFooter>
            </>
          )}

          {phase === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Tailor Failed</DialogTitle>
              </DialogHeader>

              <div className="py-4">
                <p className="font-sans text-sm text-[#DC2626]">{errorMessage}</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={() => { setPhase('input'); setErrorMessage(''); }}>
                  Try Again
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }
  ```

- [ ] **Step 3: Add "Tailor" button to the resume page**

  Find where the action buttons are rendered:

  ```bash
  grep -rn "Download\|Improve\|Cover Letter\|generate" apps/frontend/app/\(default\)/resumes/ --include="*.tsx" | grep -i "button\|Button" | head -10
  ```

  In the file that contains the resume action buttons, add:

  ```tsx
  import { TailorDialog } from '@/components/tailor/TailorDialog';

  // Add state:
  const [tailorOpen, setTailorOpen] = useState(false);

  // Add button near the existing action buttons:
  <Button variant="outline" onClick={() => setTailorOpen(true)}>
    Tailor to Job
  </Button>
  <TailorDialog resumeId={resumeId} open={tailorOpen} onOpenChange={setTailorOpen} />
  ```

- [ ] **Step 4: Run lint**

  ```bash
  cd apps/frontend && npm run lint
  ```

  Fix any lint errors before continuing.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/frontend/components/tailor/ apps/frontend/app/\(default\)/resumes/
  git commit -m "feat: add TailorDialog UI component and Tailor button"
  ```

---

## Chunk 8: End-to-end smoke test

Manually verify the full flow works before calling done.

---

### Task 9: Manual smoke test

- [ ] **Step 1: Start the backend**

  ```bash
  cd apps/backend && uv run uvicorn app.main:app --reload --port 8000
  ```

  Expected: Server starts, no errors about missing columns or imports.

- [ ] **Step 2: Start the frontend**

  ```bash
  cd apps/frontend && npm run dev
  ```

- [ ] **Step 3: Test the API directly**

  Open a resume and get its ID from the URL. Then:

  ```bash
  # Get a backend token first (from browser DevTools → Application → Cookies or Network tab)
  TOKEN="<your-backend-token>"
  RESUME_ID="<your-resume-id>"

  # Start a tailor job
  curl -X POST http://localhost:8000/api/v1/resumes/$RESUME_ID/tailor \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"prompt_profile_id": "profile2", "jd_text": "We are looking for a senior software engineer with 5+ years of Python experience."}'

  # Poll status
  curl http://localhost:8000/api/v1/resumes/$RESUME_ID/tailor-status \
    -H "Authorization: Bearer $TOKEN"
  ```

- [ ] **Step 4: Test via UI**

  - Open a resume page
  - Click "Tailor to Job"
  - Select Profile 2
  - Paste a short job description
  - Click "Start Tailor"
  - Watch the progress bar advance
  - When done, click "View Resume →"
  - Verify the tailored resume appears in the dashboard

- [ ] **Step 5: Final lint + test run**

  ```bash
  cd apps/backend && uv run pytest -x -q
  cd apps/frontend && npm run lint && npm run build
  ```

  Expected: All pass, no errors.

- [ ] **Step 6: Final commit**

  ```bash
  git add -A
  git status  # review what's staged
  git commit -m "feat: complete backend tailor pipeline implementation"
  ```
