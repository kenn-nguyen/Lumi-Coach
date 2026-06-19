"""PostgreSQL database layer for SOM Career Coach."""

from __future__ import annotations

import asyncio
import gzip
import json
import logging
import shutil
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    create_engine,
    delete,
    func,
    inspect,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    load_only,
    mapped_column,
    sessionmaker,
)

from app.config import settings
from app.pii_crypto import (
    decrypt_bytes,
    decrypt_json,
    decrypt_text,
    encrypt_bytes,
    encrypt_json,
    encrypt_text,
    hash_lookup,
)

logger = logging.getLogger(__name__)
EXTENSION_RUN_PROMPT_ARTIFACT_RETENTION_COUNT = 100
ADMIN_EXTENSION_RUN_SCAN_LIMIT = 1000


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class UserModel(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    email_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    picture: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class UserLlmConfigModel(Base):
    __tablename__ = "llm_configs"

    user_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    api_base: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class ResumeModel(Base):
    __tablename__ = "resumes"

    resume_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(32), default="md")
    filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_master: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    parent_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    linked_master_resume_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, index=True
    )
    import_context: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    processed_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    outreach_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_feedback: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    generation_artifacts: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    template_settings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    title_search: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    original_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    tailor_job: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class JobModel(Base):
    __tablename__ = "jobs"

    job_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    resume_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class ImprovementModel(Base):
    __tablename__ = "improvements"

    request_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True
    )
    original_resume_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    tailored_resume_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    job_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    improvements: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ExtensionRunModel(Base):
    __tablename__ = "extension_runs"

    user_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    run_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    company: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resume_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    preview_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    provider_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prompt_profile_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    prompt1_version_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt2_version_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt3_version_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    system_prompt_version_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    prompt_artifacts: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    prompt_artifacts_blob: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class Database:
    """PostgreSQL-backed repository for SOM Career Coach data."""

    _master_resume_lock = asyncio.Lock()

    def __init__(self, database_url: str | None = None):
        self.database_url = database_url or settings.database_url
        self._engine = create_engine(
            self.database_url,
            future=True,
            pool_pre_ping=True,
        )
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
            future=True,
        )

    def init_schema(self) -> None:
        Base.metadata.create_all(self._engine)
        self._ensure_user_schema()
        self._ensure_resume_schema()
        self._ensure_extension_runs_schema()

    def _ensure_user_schema(self) -> None:
        """Apply additive schema updates for encrypted user lookup."""
        inspector = inspect(self._engine)
        if "users" not in inspector.get_table_names():
            return

        user_columns = inspector.get_columns("users")
        columns = {column["name"] for column in user_columns}
        column_types = {
            column["name"]: str(column["type"]).upper()
            for column in user_columns
        }
        with self._engine.begin() as connection:
            if "CHAR" in column_types.get("email", ""):
                connection.execute(text("ALTER TABLE users ALTER COLUMN email TYPE TEXT"))
            if "CHAR" in column_types.get("name", ""):
                connection.execute(text("ALTER TABLE users ALTER COLUMN name TYPE TEXT"))
            if "email_hash" not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN email_hash VARCHAR(64)"))
                logger.info("Added users.email_hash column")
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS "
                    "ix_users_email_hash ON users (email_hash)"
                )
            )

    def _ensure_resume_schema(self) -> None:
        """Apply lightweight additive schema updates for local/dev databases."""
        inspector = inspect(self._engine)
        if "resumes" not in inspector.get_table_names():
            return
        columns = {column["name"] for column in inspector.get_columns("resumes")}

        with self._engine.begin() as connection:
            if "template_settings" not in columns:
                connection.execute(text("ALTER TABLE resumes ADD COLUMN template_settings JSONB"))
                logger.info("Added resumes.template_settings column")
            if "linked_master_resume_id" not in columns:
                connection.execute(
                    text("ALTER TABLE resumes ADD COLUMN linked_master_resume_id VARCHAR(36)")
                )
                logger.info("Added resumes.linked_master_resume_id column")
            if "import_context" not in columns:
                connection.execute(text("ALTER TABLE resumes ADD COLUMN import_context JSONB"))
                logger.info("Added resumes.import_context column")
            if "title_search" not in columns:
                connection.execute(text("ALTER TABLE resumes ADD COLUMN title_search TEXT"))
                logger.info("Added resumes.title_search column")
            if "tailor_job" not in columns:
                connection.execute(text("ALTER TABLE resumes ADD COLUMN tailor_job JSONB"))
                logger.info("Added resumes.tailor_job column")
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS "
                    "ix_resumes_linked_master_resume_id ON resumes (linked_master_resume_id)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS "
                    "ix_resumes_title_search ON resumes (title_search)"
                )
            )
        self._backfill_resume_title_search()

    def _ensure_extension_runs_schema(self) -> None:
        """Apply additive schema updates for extension run telemetry."""
        inspector = inspect(self._engine)
        if "extension_runs" not in inspector.get_table_names():
            return

        columns = {column["name"] for column in inspector.get_columns("extension_runs")}

        with self._engine.begin() as connection:
            if "prompt_artifacts" not in columns:
                connection.execute(
                    text(
                        "ALTER TABLE extension_runs "
                        "ADD COLUMN prompt_artifacts JSONB DEFAULT '{}'::jsonb"
                    )
                )
                logger.info("Added extension_runs.prompt_artifacts column")
            if "prompt_artifacts_blob" not in columns:
                connection.execute(
                    text("ALTER TABLE extension_runs ADD COLUMN prompt_artifacts_blob BYTEA")
                )
                logger.info("Added extension_runs.prompt_artifacts_blob column")
            if "prompt_profile_id" not in columns:
                connection.execute(
                    text("ALTER TABLE extension_runs ADD COLUMN prompt_profile_id VARCHAR(64)")
                )
                logger.info("Added extension_runs.prompt_profile_id column")
            if "prompt1_version_id" not in columns:
                connection.execute(
                    text("ALTER TABLE extension_runs ADD COLUMN prompt1_version_id VARCHAR(128)")
                )
                logger.info("Added extension_runs.prompt1_version_id column")
            if "prompt2_version_id" not in columns:
                connection.execute(
                    text("ALTER TABLE extension_runs ADD COLUMN prompt2_version_id VARCHAR(128)")
                )
                logger.info("Added extension_runs.prompt2_version_id column")
            if "prompt3_version_id" not in columns:
                connection.execute(
                    text("ALTER TABLE extension_runs ADD COLUMN prompt3_version_id VARCHAR(128)")
                )
                logger.info("Added extension_runs.prompt3_version_id column")
            if "system_prompt_version_id" not in columns:
                connection.execute(
                    text(
                        "ALTER TABLE extension_runs "
                        "ADD COLUMN system_prompt_version_id VARCHAR(128)"
                    )
                )
                logger.info("Added extension_runs.system_prompt_version_id column")
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS "
                    "ix_extension_runs_prompt_profile_id ON extension_runs (prompt_profile_id)"
                )
            )

    def close(self) -> None:
        self._engine.dispose()

    def _session(self) -> Session:
        return self._session_factory()

    def _resolve_user_scope(self, user_id: str | None = None) -> str | None:
        if user_id:
            return user_id
        try:
            from app.security import get_current_user_id

            return get_current_user_id()
        except Exception:
            return None

    @staticmethod
    def _to_iso(value: datetime | None) -> str | None:
        return value.isoformat() if value else None

    @staticmethod
    def _normalize_resume_title_search(title: str | None) -> str | None:
        if not isinstance(title, str):
            return None
        normalized = " ".join(title.strip().lower().split())
        return normalized or None

    def _backfill_resume_title_search(self) -> None:
        with self._session() as session:
            resumes = (
                session.query(ResumeModel)
                .options(load_only(ResumeModel.resume_id, ResumeModel.title, ResumeModel.title_search))
                .filter(ResumeModel.title.is_not(None))
                .filter(ResumeModel.title_search.is_(None))
                .all()
            )
            if not resumes:
                return

            updated_count = 0
            for resume in resumes:
                normalized_title = self._normalize_resume_title_search(decrypt_text(resume.title))
                if not normalized_title:
                    continue
                resume.title_search = normalized_title
                updated_count += 1
            if updated_count:
                session.commit()
                logger.info("Backfilled resumes.title_search for %s rows", updated_count)

    def _serialize_user(self, user: UserModel) -> dict[str, Any]:
        return {
            "user_id": user.user_id,
            "email": decrypt_text(user.email) or "",
            "name": decrypt_text(user.name),
            "picture": decrypt_text(user.picture),
            "created_at": self._to_iso(user.created_at),
            "updated_at": self._to_iso(user.updated_at),
        }

    def _serialize_llm_config(self, config: UserLlmConfigModel) -> dict[str, Any]:
        return {
            "user_id": config.user_id,
            "provider": config.provider,
            "model": config.model,
            "api_base": config.api_base,
            "encrypted_api_key": config.encrypted_api_key,
            "created_at": self._to_iso(config.created_at),
            "updated_at": self._to_iso(config.updated_at),
        }

    def _serialize_resume(self, resume: ResumeModel) -> dict[str, Any]:
        return {
            "resume_id": resume.resume_id,
            "user_id": resume.user_id,
            "content": decrypt_text(resume.content) or "",
            "content_type": resume.content_type,
            "filename": decrypt_text(resume.filename),
            "is_master": resume.is_master,
            "parent_id": resume.parent_id,
            "linked_master_resume_id": getattr(resume, "linked_master_resume_id", None),
            "import_context": decrypt_json(getattr(resume, "import_context", None)),
            "processed_data": decrypt_json(resume.processed_data),
            "processing_status": resume.processing_status,
            "cover_letter": decrypt_text(resume.cover_letter),
            "outreach_message": decrypt_text(resume.outreach_message),
            "generation_feedback": decrypt_json(resume.generation_feedback),
            "generation_artifacts": decrypt_json(resume.generation_artifacts),
            "template_settings": resume.template_settings,
            "title": decrypt_text(resume.title),
            "original_markdown": decrypt_text(resume.original_markdown),
            "tailor_job": getattr(resume, "tailor_job", None),
            "created_at": self._to_iso(resume.created_at),
            "updated_at": self._to_iso(resume.updated_at),
        }

    @staticmethod
    def _read_prompt2_recommended_title(
        generation_artifacts: dict[str, Any] | None,
    ) -> str | None:
        """Extract Prompt 2's recommended title when present."""
        if not isinstance(generation_artifacts, dict):
            return None
        prompt2 = generation_artifacts.get("prompt2")
        if not isinstance(prompt2, dict):
            return None
        recommended_title = prompt2.get("recommended_title")
        if not isinstance(recommended_title, str):
            return None
        cleaned = recommended_title.strip()
        return cleaned or None

    def _build_resume_list_title(self, resume: ResumeModel) -> str | None:
        """Mirror the viewer title fallback logic for dashboard list rows."""
        stored_title = (decrypt_text(resume.title) or "").strip()
        if stored_title:
            return stored_title

        prompt2_recommended_title = self._read_prompt2_recommended_title(
            decrypt_json(getattr(resume, "generation_artifacts", None))
        )
        if prompt2_recommended_title:
            return prompt2_recommended_title
        return None

    def _serialize_resume_list_item(self, resume: ResumeModel) -> dict[str, Any]:
        return {
            "resume_id": resume.resume_id,
            "filename": decrypt_text(resume.filename),
            "is_master": resume.is_master,
            "parent_id": resume.parent_id,
            "linked_master_resume_id": getattr(resume, "linked_master_resume_id", None),
            "import_context": decrypt_json(getattr(resume, "import_context", None)),
            "processing_status": resume.processing_status,
            "title": self._build_resume_list_title(resume),
            "created_at": self._to_iso(resume.created_at),
            "updated_at": self._to_iso(resume.updated_at),
        }

    def _serialize_job(self, job: JobModel) -> dict[str, Any]:
        return {
            "job_id": job.job_id,
            "user_id": job.user_id,
            "content": decrypt_text(job.content) or "",
            "resume_id": job.resume_id,
            "created_at": self._to_iso(job.created_at),
            "updated_at": self._to_iso(job.updated_at),
        }

    def _serialize_improvement(self, improvement: ImprovementModel) -> dict[str, Any]:
        return {
            "request_id": improvement.request_id,
            "user_id": improvement.user_id,
            "original_resume_id": improvement.original_resume_id,
            "tailored_resume_id": improvement.tailored_resume_id,
            "job_id": improvement.job_id,
            "improvements": decrypt_json(improvement.improvements),
            "created_at": self._to_iso(improvement.created_at),
        }

    def _serialize_extension_run(
        self,
        run: ExtensionRunModel,
        *,
        include_summary: bool = True,
        include_prompt_artifacts: bool = True,
    ) -> dict[str, Any]:
        serialized = {
            "user_id": run.user_id,
            "run_id": run.run_id,
            "status": run.status,
            "title": decrypt_text(run.title),
            "company": decrypt_text(run.company),
            "location": decrypt_text(run.location),
            "source_url": decrypt_text(run.source_url),
            "job_source": run.job_source,
            "resume_id": run.resume_id,
            "preview_url": decrypt_text(run.preview_url),
            "provider_id": run.provider_id,
            "provider_label": run.provider_label,
            "generated_at": self._to_iso(run.generated_at),
            "total_duration_ms": run.total_duration_ms,
            "prompt_profile_id": run.prompt_profile_id,
            "prompt1_version_id": run.prompt1_version_id,
            "prompt2_version_id": run.prompt2_version_id,
            "prompt3_version_id": run.prompt3_version_id,
            "system_prompt_version_id": run.system_prompt_version_id,
            "created_at": self._to_iso(run.created_at),
            "updated_at": self._to_iso(run.updated_at),
        }
        if include_summary:
            serialized["summary"] = decrypt_json(run.summary)
        if include_prompt_artifacts:
            serialized["prompt_artifacts"] = self._load_extension_run_prompt_artifacts(run)
        return serialized

    @staticmethod
    def _encode_prompt_artifacts_blob(
        prompt_artifacts: dict[str, Any] | None,
    ) -> bytes | None:
        if not isinstance(prompt_artifacts, dict) or not prompt_artifacts:
            return None
        serialized = json.dumps(
            prompt_artifacts,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        return encrypt_bytes(gzip.compress(serialized))

    @staticmethod
    def _decode_prompt_artifacts_blob(
        prompt_artifacts_blob: bytes | bytearray | memoryview | None,
    ) -> dict[str, Any] | None:
        if prompt_artifacts_blob is None:
            return None
        decrypted = decrypt_bytes(prompt_artifacts_blob)
        if not decrypted:
            return None
        parsed = json.loads(gzip.decompress(decrypted).decode("utf-8"))
        return parsed if isinstance(parsed, dict) else None

    def _load_extension_run_prompt_artifacts(
        self,
        run: ExtensionRunModel,
    ) -> dict[str, Any]:
        decoded_blob = self._decode_prompt_artifacts_blob(run.prompt_artifacts_blob)
        if isinstance(decoded_blob, dict):
            return decoded_blob
        legacy_prompt_artifacts = decrypt_json(run.prompt_artifacts)
        return legacy_prompt_artifacts if isinstance(legacy_prompt_artifacts, dict) else {}

    @staticmethod
    def _build_prompt_setup_from_columns(run: ExtensionRunModel) -> dict[str, Any] | None:
        result = {}
        if isinstance(run.prompt_profile_id, str) and run.prompt_profile_id.strip():
            result["prompt_profile_id"] = run.prompt_profile_id.strip()
        if isinstance(run.prompt1_version_id, str) and run.prompt1_version_id.strip():
            result["prompt1_version_id"] = run.prompt1_version_id.strip()
        if isinstance(run.prompt2_version_id, str) and run.prompt2_version_id.strip():
            result["prompt2_version_id"] = run.prompt2_version_id.strip()
        if isinstance(run.prompt3_version_id, str) and run.prompt3_version_id.strip():
            result["prompt3_version_id"] = run.prompt3_version_id.strip()
        if (
            isinstance(run.system_prompt_version_id, str)
            and run.system_prompt_version_id.strip()
        ):
            result["system_prompt_version_id"] = run.system_prompt_version_id.strip()
        return result or None

    def _extract_extension_run_prompt_setup(
        self,
        *,
        run: ExtensionRunModel | None = None,
        summary: dict[str, Any] | None,
        prompt_artifacts: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        if run is not None:
            from_columns = self._build_prompt_setup_from_columns(run)
            if from_columns:
                return from_columns

        prompt3_feedback = (
            prompt_artifacts.get("prompt3", {}).get("feedback")
            if isinstance(prompt_artifacts, dict)
            else None
        )
        if isinstance(prompt3_feedback, dict):
            prompt_setup = prompt3_feedback.get("prompt_setup")
            if isinstance(prompt_setup, dict) and prompt_setup:
                return {
                    key: value
                    for key, value in prompt_setup.items()
                    if isinstance(value, str) and value.strip()
                } or None

        metadata = (
            prompt_artifacts.get("metadata") if isinstance(prompt_artifacts, dict) else None
        )
        if not isinstance(metadata, dict):
            return None

        prompts = metadata.get("prompts")
        system_prompt = metadata.get("systemPrompt")
        result = {}
        prompt_profile_id = metadata.get("promptProfileId")
        if isinstance(prompt_profile_id, str) and prompt_profile_id.strip():
            result["prompt_profile_id"] = prompt_profile_id.strip()

        if isinstance(prompts, dict):
            for prompt_name in ("prompt1", "prompt2", "prompt3"):
                metadata_value = prompts.get(prompt_name)
                version_id = (
                    metadata_value.get("versionId")
                    if isinstance(metadata_value, dict)
                    else None
                )
                if isinstance(version_id, str) and version_id.strip():
                    result[f"{prompt_name}_version_id"] = version_id.strip()

        system_prompt_version_id = (
            system_prompt.get("versionId") if isinstance(system_prompt, dict) else None
        )
        if (
            isinstance(system_prompt_version_id, str)
            and system_prompt_version_id.strip()
        ):
            result["system_prompt_version_id"] = system_prompt_version_id.strip()

        return result or None

    def _serialize_admin_extension_run(
        self,
        run: ExtensionRunModel,
        *,
        user_email: str | None,
        include_summary: bool = False,
        include_prompt_artifacts: bool = False,
    ) -> dict[str, Any]:
        serialized = self._serialize_extension_run(
            run,
            include_summary=include_summary,
            include_prompt_artifacts=include_prompt_artifacts,
        )
        prompt_artifacts = serialized.get("prompt_artifacts")
        prompt_setup = self._extract_extension_run_prompt_setup(
            run=run,
            summary=serialized.get("summary"),
            prompt_artifacts=prompt_artifacts if isinstance(prompt_artifacts, dict) else None,
        )
        serialized["user_email"] = user_email
        serialized["prompt_setup"] = prompt_setup
        if not include_summary:
            serialized.pop("summary", None)
        if not include_prompt_artifacts:
            serialized.pop("prompt_artifacts", None)
        serialized.pop("prompt_profile_id", None)
        serialized.pop("prompt1_version_id", None)
        serialized.pop("prompt2_version_id", None)
        serialized.pop("prompt3_version_id", None)
        serialized.pop("system_prompt_version_id", None)
        return serialized

    def list_extension_runs_for_admin(
        self,
        *,
        status: str | None = None,
        prompt_profile_id: str | None = None,
        search: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
        include_prompt_artifacts: bool = False,
        scan_limit: int = ADMIN_EXTENSION_RUN_SCAN_LIMIT,
    ) -> dict[str, Any]:
        normalized_status = (status or "").strip().lower()
        normalized_profile = (prompt_profile_id or "").strip().lower()
        normalized_search = (search or "").strip().lower()
        bounded_limit = max(1, min(limit, 500))
        bounded_offset = max(0, offset)
        bounded_scan_limit = max(bounded_limit + bounded_offset, min(scan_limit, 5000))
        extension_run_columns: list[Any] = [
            ExtensionRunModel.user_id,
            ExtensionRunModel.run_id,
            ExtensionRunModel.status,
            ExtensionRunModel.title,
            ExtensionRunModel.company,
            ExtensionRunModel.location,
            ExtensionRunModel.source_url,
            ExtensionRunModel.job_source,
            ExtensionRunModel.resume_id,
            ExtensionRunModel.preview_url,
            ExtensionRunModel.provider_id,
            ExtensionRunModel.provider_label,
            ExtensionRunModel.generated_at,
            ExtensionRunModel.total_duration_ms,
            ExtensionRunModel.prompt_profile_id,
            ExtensionRunModel.prompt1_version_id,
            ExtensionRunModel.prompt2_version_id,
            ExtensionRunModel.prompt3_version_id,
            ExtensionRunModel.system_prompt_version_id,
            ExtensionRunModel.created_at,
            ExtensionRunModel.updated_at,
        ]
        if include_prompt_artifacts:
            extension_run_columns.extend(
                [
                    ExtensionRunModel.prompt_artifacts,
                    ExtensionRunModel.prompt_artifacts_blob,
                ]
            )

        with self._session() as session:
            query = (
                session.query(ExtensionRunModel, UserModel)
                .outerjoin(UserModel, UserModel.user_id == ExtensionRunModel.user_id)
                .options(
                    load_only(*extension_run_columns),
                    load_only(UserModel.email),
                )
                .order_by(
                    ExtensionRunModel.generated_at.desc().nullslast(),
                    ExtensionRunModel.updated_at.desc(),
                    ExtensionRunModel.created_at.desc(),
                )
            )
            if normalized_status and normalized_status != "all":
                query = query.filter(ExtensionRunModel.status == normalized_status)

            candidates = query.limit(bounded_scan_limit).all()

        filtered: list[dict[str, Any]] = []
        for run, user in candidates:
            serialized = self._serialize_admin_extension_run(
                run,
                user_email=decrypt_text(user.email) if user else None,
                include_summary=False,
                include_prompt_artifacts=include_prompt_artifacts,
            )
            event_timestamp = (
                serialized.get("generated_at")
                or serialized.get("updated_at")
                or serialized.get("created_at")
            )
            event_datetime = None
            if isinstance(event_timestamp, str) and event_timestamp:
                try:
                    event_datetime = datetime.fromisoformat(
                        event_timestamp.replace("Z", "+00:00")
                    )
                except ValueError:
                    event_datetime = None
            if date_from and event_datetime and event_datetime < date_from:
                continue
            if date_to and event_datetime and event_datetime >= date_to:
                continue

            prompt_setup = serialized.get("prompt_setup")
            prompt_setup_profile_id = (
                prompt_setup.get("prompt_profile_id")
                if isinstance(prompt_setup, dict)
                else None
            )
            summary_profile_id = (
                serialized.get("summary", {}).get("prompt_profile_id")
                if isinstance(serialized.get("summary"), dict)
                else None
            )
            effective_profile_id = (
                prompt_setup_profile_id or summary_profile_id or ""
            ).strip().lower()
            if normalized_profile and normalized_profile != "all":
                if effective_profile_id != normalized_profile:
                    continue

            if normalized_search:
                haystacks = [
                    serialized.get("user_email"),
                    serialized.get("company"),
                    serialized.get("title"),
                    serialized.get("location"),
                    serialized.get("source_url"),
                ]
                if not any(
                    isinstance(value, str) and normalized_search in value.lower()
                    for value in haystacks
                ):
                    continue

            filtered.append(serialized)

        total = len(filtered)
        items = filtered[bounded_offset : bounded_offset + bounded_limit]
        return {"items": items, "total": total}

    def get_extension_run_for_admin(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> dict[str, Any] | None:
        with self._session() as session:
            row = (
                session.query(ExtensionRunModel, UserModel)
                .outerjoin(UserModel, UserModel.user_id == ExtensionRunModel.user_id)
                .filter(
                    ExtensionRunModel.user_id == user_id,
                    ExtensionRunModel.run_id == run_id,
                )
                .first()
            )
            if row is None:
                return None
            run, user = row
            return self._serialize_admin_extension_run(
                run,
                user_email=decrypt_text(user.email) if user else None,
                include_summary=True,
                include_prompt_artifacts=True,
            )

    def _extract_prompt_setup_from_payload(
        self,
        *,
        summary: dict[str, Any] | None,
        prompt_artifacts: dict[str, Any] | None,
    ) -> dict[str, str | None]:
        extracted = self._extract_extension_run_prompt_setup(
            run=None,
            summary=summary if isinstance(summary, dict) else None,
            prompt_artifacts=prompt_artifacts if isinstance(prompt_artifacts, dict) else None,
        )
        return {
            "prompt_profile_id": extracted.get("prompt_profile_id")
            if isinstance(extracted, dict)
            else None,
            "prompt1_version_id": extracted.get("prompt1_version_id")
            if isinstance(extracted, dict)
            else None,
            "prompt2_version_id": extracted.get("prompt2_version_id")
            if isinstance(extracted, dict)
            else None,
            "prompt3_version_id": extracted.get("prompt3_version_id")
            if isinstance(extracted, dict)
            else None,
            "system_prompt_version_id": extracted.get("system_prompt_version_id")
            if isinstance(extracted, dict)
            else None,
        }

    def upsert_user(
        self,
        *,
        user_id: str,
        email: str,
        name: str | None = None,
        picture: str | None = None,
    ) -> dict[str, Any]:
        normalized_email = email.strip().lower()
        email_hash = hash_lookup(normalized_email)
        with self._session() as session:
            user = session.get(UserModel, user_id)
            if user is None:
                user = (
                    session.query(UserModel)
                    .filter(UserModel.email_hash == email_hash)
                    .first()
                )
            if user is None:
                user = session.query(UserModel).filter(UserModel.email == email).first()
            if user is None:
                user = UserModel(
                    user_id=user_id,
                    email=encrypt_text(email) or "",
                    email_hash=email_hash,
                    name=encrypt_text(name),
                    picture=encrypt_text(picture),
                )
                session.add(user)
            else:
                # Keep the existing stored user_id when this email has already been
                # seen before. Auth.js can hand us a different transient subject for
                # the same Google account, but app data ownership must remain stable.
                user.email = encrypt_text(email) or ""
                user.email_hash = email_hash
                user.name = encrypt_text(name)
                user.picture = encrypt_text(picture)
                user.updated_at = _utcnow()
            session.commit()
            session.refresh(user)
            return self._serialize_user(user)

    def get_user_llm_config(self, user_id: str) -> dict[str, Any] | None:
        with self._session() as session:
            config = session.get(UserLlmConfigModel, user_id)
            return self._serialize_llm_config(config) if config else None

    def upsert_user_llm_config(
        self,
        *,
        user_id: str,
        provider: str,
        model: str,
        api_base: str | None = None,
        encrypted_api_key: str | None = None,
    ) -> dict[str, Any]:
        with self._session() as session:
            config = session.get(UserLlmConfigModel, user_id)
            if config is None:
                config = UserLlmConfigModel(
                    user_id=user_id,
                    provider=provider,
                    model=model,
                    api_base=api_base,
                    encrypted_api_key=encrypted_api_key,
                )
                session.add(config)
            else:
                config.provider = provider
                config.model = model
                config.api_base = api_base
                config.encrypted_api_key = encrypted_api_key
                config.updated_at = _utcnow()
            session.commit()
            session.refresh(config)
            return self._serialize_llm_config(config)

    def clear_user_llm_api_key(self, user_id: str) -> bool:
        with self._session() as session:
            config = session.get(UserLlmConfigModel, user_id)
            if config is None:
                return False
            config.encrypted_api_key = None
            config.updated_at = _utcnow()
            session.commit()
            return True

    def create_resume(
        self,
        content: str,
        content_type: str = "md",
        filename: str | None = None,
        is_master: bool = False,
        parent_id: str | None = None,
        linked_master_resume_id: str | None = None,
        import_context: dict[str, Any] | None = None,
        processed_data: dict[str, Any] | None = None,
        processing_status: str = "pending",
        cover_letter: str | None = None,
        outreach_message: str | None = None,
        generation_feedback: dict[str, Any] | None = None,
        generation_artifacts: dict[str, Any] | None = None,
        template_settings: dict[str, Any] | None = None,
        title: str | None = None,
        original_markdown: str | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            resume = ResumeModel(
                resume_id=str(uuid4()),
                user_id=resolved_user_id,
                content=encrypt_text(content) or "",
                content_type=content_type,
                filename=encrypt_text(filename),
                is_master=is_master,
                parent_id=parent_id,
                linked_master_resume_id=linked_master_resume_id,
                import_context=encrypt_json(import_context),
                processed_data=encrypt_json(processed_data),
                processing_status=processing_status,
                cover_letter=encrypt_text(cover_letter),
                outreach_message=encrypt_text(outreach_message),
                generation_feedback=encrypt_json(generation_feedback),
                generation_artifacts=encrypt_json(generation_artifacts),
                template_settings=template_settings,
                title=encrypt_text(title),
                title_search=self._normalize_resume_title_search(title),
                original_markdown=encrypt_text(original_markdown),
            )
            session.add(resume)
            session.commit()
            session.refresh(resume)
            return self._serialize_resume(resume)

    async def create_resume_atomic_master(
        self,
        content: str,
        content_type: str = "md",
        filename: str | None = None,
        processed_data: dict[str, Any] | None = None,
        processing_status: str = "pending",
        cover_letter: str | None = None,
        outreach_message: str | None = None,
        generation_feedback: dict[str, Any] | None = None,
        generation_artifacts: dict[str, Any] | None = None,
        original_markdown: str | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        async with self._master_resume_lock:
            resolved_user_id = self._resolve_user_scope(user_id)
            current_master = self.get_master_resume(resolved_user_id)
            is_master = current_master is None

            if current_master and current_master.get("processing_status") in ("failed", "processing"):
                self.update_resume(
                    current_master["resume_id"],
                    {"is_master": False},
                    resolved_user_id,
                )
                is_master = True

            return self.create_resume(
                content=content,
                content_type=content_type,
                filename=filename,
                is_master=is_master,
                processed_data=processed_data,
                processing_status=processing_status,
                cover_letter=cover_letter,
                outreach_message=outreach_message,
                generation_feedback=generation_feedback,
                generation_artifacts=generation_artifacts,
                original_markdown=original_markdown,
                user_id=resolved_user_id,
            )

    def get_resume(self, resume_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            resume = session.get(ResumeModel, resume_id)
            if resume is None:
                return None
            if resolved_user_id is not None and resume.user_id != resolved_user_id:
                return None
            return self._serialize_resume(resume)

    def get_master_resume(self, user_id: str | None = None) -> dict[str, Any] | None:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            query = session.query(ResumeModel).filter(ResumeModel.is_master.is_(True))
            if resolved_user_id is not None:
                query = query.filter(ResumeModel.user_id == resolved_user_id)
            resume = query.order_by(ResumeModel.created_at.desc()).first()
            return self._serialize_resume(resume) if resume else None

    def update_resume(
        self, resume_id: str, updates: dict[str, Any], user_id: str | None = None
    ) -> dict[str, Any]:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            resume = session.get(ResumeModel, resume_id)
            if resume is None or (
                resolved_user_id is not None and resume.user_id != resolved_user_id
            ):
                raise ValueError(f"Resume not found: {resume_id}")

            for key, value in updates.items():
                if hasattr(resume, key):
                    if key == "title":
                        resume.title_search = self._normalize_resume_title_search(value)
                    if key in {
                        "content",
                        "filename",
                        "cover_letter",
                        "outreach_message",
                        "title",
                        "original_markdown",
                    }:
                        value = encrypt_text(value)
                    elif key in {
                        "import_context",
                        "processed_data",
                        "generation_feedback",
                        "generation_artifacts",
                    }:
                        value = encrypt_json(value)
                    setattr(resume, key, value)
            resume.updated_at = _utcnow()
            session.commit()
            session.refresh(resume)
            return self._serialize_resume(resume)

    def delete_resume(self, resume_id: str, user_id: str | None = None) -> bool:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            resume = session.get(ResumeModel, resume_id)
            if resume is None or (
                resolved_user_id is not None and resume.user_id != resolved_user_id
            ):
                return False
            session.delete(resume)
            session.commit()
            return True

    def list_resumes(
        self,
        user_id: str | None = None,
        limit: int | None = None,
        include_master: bool = False,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        resolved_user_id = self._resolve_user_scope(user_id)
        normalized_search = self._normalize_resume_title_search(search)
        with self._session() as session:
            list_item_columns = load_only(
                ResumeModel.resume_id,
                ResumeModel.filename,
                ResumeModel.is_master,
                ResumeModel.parent_id,
                ResumeModel.linked_master_resume_id,
                ResumeModel.import_context,
                ResumeModel.processing_status,
                ResumeModel.title,
                ResumeModel.generation_artifacts,
                ResumeModel.created_at,
                ResumeModel.updated_at,
                ResumeModel.user_id,
            )

            def _scoped_resume_query() -> Any:
                query = session.query(ResumeModel).options(list_item_columns)
                if resolved_user_id is not None:
                    query = query.filter(ResumeModel.user_id == resolved_user_id)
                return query

            if normalized_search:
                search_query = _scoped_resume_query().filter(
                    ResumeModel.title_search.like(f"%{normalized_search}%")
                )
                if not include_master:
                    search_query = search_query.filter(ResumeModel.is_master.is_(False))
                search_query = search_query.order_by(ResumeModel.updated_at.desc())
                if limit is not None:
                    search_query = search_query.limit(max(1, limit))
                search_resumes = search_query.all()
                return [self._serialize_resume_list_item(resume) for resume in search_resumes]

            non_master_query = _scoped_resume_query().filter(ResumeModel.is_master.is_(False))
            non_master_query = non_master_query.order_by(ResumeModel.updated_at.desc())
            if limit is not None:
                non_master_query = non_master_query.limit(max(1, limit))
            non_master_resumes = non_master_query.all()
            serialized_resumes = [
                self._serialize_resume_list_item(resume) for resume in non_master_resumes
            ]

            if not include_master:
                return serialized_resumes

            master_resume = (
                _scoped_resume_query()
                .filter(ResumeModel.is_master.is_(True))
                .order_by(ResumeModel.updated_at.desc(), ResumeModel.created_at.desc())
                .first()
            )
            if master_resume is None:
                return serialized_resumes

            return [self._serialize_resume_list_item(master_resume), *serialized_resumes]

    def get_extension_run_source_urls_by_resume_ids(
        self,
        resume_ids: list[str],
        user_id: str | None = None,
    ) -> dict[str, str]:
        metadata = self.get_extension_run_metadata_by_resume_ids(
            resume_ids, user_id=user_id
        )
        source_urls: dict[str, str] = {}
        for resume_id, item in metadata.items():
            source_url = item.get("source_url")
            if isinstance(source_url, str) and source_url:
                source_urls[resume_id] = source_url
        return source_urls

    def get_extension_run_metadata_by_resume_ids(
        self,
        resume_ids: list[str],
        user_id: str | None = None,
    ) -> dict[str, dict[str, Any]]:
        resolved_user_id = self._resolve_user_scope(user_id)
        normalized_resume_ids = [resume_id for resume_id in resume_ids if resume_id]
        if not normalized_resume_ids:
            return {}

        with self._session() as session:
            query = session.query(ExtensionRunModel).filter(
                ExtensionRunModel.resume_id.in_(normalized_resume_ids)
            )
            if resolved_user_id is not None:
                query = query.filter(ExtensionRunModel.user_id == resolved_user_id)
            runs = query.order_by(
                ExtensionRunModel.generated_at.desc(),
                ExtensionRunModel.updated_at.desc(),
            ).all()

            metadata_by_resume_id: dict[str, dict[str, Any]] = {}
            for run in runs:
                if not run.resume_id or run.resume_id in metadata_by_resume_id:
                    continue
                metadata_by_resume_id[run.resume_id] = {
                    "source_url": decrypt_text(run.source_url),
                    "job_source": run.job_source,
                    "title": decrypt_text(run.title),
                    "company": decrypt_text(run.company),
                }
            return metadata_by_resume_id

    def _prune_extension_run_prompt_artifacts(
        self,
        session: Session,
        *,
        user_id: str,
        retain_count: int = EXTENSION_RUN_PROMPT_ARTIFACT_RETENTION_COUNT,
    ) -> None:
        if retain_count < 0:
            retain_count = 0

        runs = (
            session.query(ExtensionRunModel)
            .filter(ExtensionRunModel.user_id == user_id)
            .order_by(
                ExtensionRunModel.generated_at.desc().nullslast(),
                ExtensionRunModel.updated_at.desc(),
                ExtensionRunModel.created_at.desc(),
            )
            .all()
        )

        for run in runs[retain_count:]:
            if run.prompt_artifacts in ({}, None) and run.prompt_artifacts_blob is None:
                continue
            run.prompt_artifacts = encrypt_json({})
            run.prompt_artifacts_blob = None

    def set_master_resume(self, resume_id: str, user_id: str | None = None) -> bool:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            target = session.get(ResumeModel, resume_id)
            if target is None or (
                resolved_user_id is not None and target.user_id != resolved_user_id
            ):
                logger.warning("Cannot set master: resume %s not found", resume_id)
                return False

            query = session.query(ResumeModel).filter(ResumeModel.is_master.is_(True))
            if resolved_user_id is not None:
                query = query.filter(ResumeModel.user_id == resolved_user_id)
            for resume in query.all():
                resume.is_master = False

            target.is_master = True
            target.updated_at = _utcnow()
            session.commit()
            return True

    def create_job(
        self, content: str, resume_id: str | None = None, user_id: str | None = None
    ) -> dict[str, Any]:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            job = JobModel(
                job_id=str(uuid4()),
                user_id=resolved_user_id,
                content=encrypt_text(content) or "",
                resume_id=resume_id,
            )
            session.add(job)
            session.commit()
            session.refresh(job)
            return self._serialize_job(job)

    def get_job(self, job_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            job = session.get(JobModel, job_id)
            if job is None:
                return None
            if resolved_user_id is not None and job.user_id != resolved_user_id:
                return None
            return self._serialize_job(job)

    def update_job(
        self, job_id: str, updates: dict[str, Any], user_id: str | None = None
    ) -> dict[str, Any] | None:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            job = session.get(JobModel, job_id)
            if job is None or (resolved_user_id is not None and job.user_id != resolved_user_id):
                return None
            for key, value in updates.items():
                if hasattr(job, key):
                    if key == "content":
                        value = encrypt_text(value)
                    setattr(job, key, value)
            job.updated_at = _utcnow()
            session.commit()
            session.refresh(job)
            return self._serialize_job(job)

    def create_improvement(
        self,
        original_resume_id: str,
        tailored_resume_id: str,
        job_id: str,
        improvements: list[dict[str, Any]],
        user_id: str | None = None,
    ) -> dict[str, Any]:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            improvement = ImprovementModel(
                request_id=str(uuid4()),
                user_id=resolved_user_id,
                original_resume_id=original_resume_id,
                tailored_resume_id=tailored_resume_id,
                job_id=job_id,
                improvements=encrypt_json(improvements),
            )
            session.add(improvement)
            session.commit()
            session.refresh(improvement)
            return self._serialize_improvement(improvement)

    def get_improvement_by_tailored_resume(
        self, tailored_resume_id: str, user_id: str | None = None
    ) -> dict[str, Any] | None:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            query = session.query(ImprovementModel).filter(
                ImprovementModel.tailored_resume_id == tailored_resume_id
            )
            if resolved_user_id is not None:
                query = query.filter(ImprovementModel.user_id == resolved_user_id)
            improvement = query.order_by(ImprovementModel.created_at.desc()).first()
            return self._serialize_improvement(improvement) if improvement else None

    def upsert_extension_run(
        self,
        *,
        run_id: str,
        status: str,
        user_id: str | None = None,
        title: str | None = None,
        company: str | None = None,
        location: str | None = None,
        source_url: str | None = None,
        job_source: str | None = None,
        resume_id: str | None = None,
        preview_url: str | None = None,
        provider_id: str | None = None,
        provider_label: str | None = None,
        generated_at: datetime | None = None,
        total_duration_ms: int | None = None,
        summary: dict[str, Any] | None = None,
        prompt_artifacts: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        resolved_user_id = self._resolve_user_scope(user_id)
        if not resolved_user_id:
            raise ValueError("Extension run requires an authenticated user")

        with self._session() as session:
            run = session.get(ExtensionRunModel, (resolved_user_id, run_id))
            if run is None:
                run = ExtensionRunModel(
                    user_id=resolved_user_id,
                    run_id=run_id,
                    status=status,
                )
                session.add(run)

            prompt_setup = self._extract_prompt_setup_from_payload(
                summary=summary,
                prompt_artifacts=prompt_artifacts,
            )
            run.status = status
            run.title = encrypt_text(title)
            run.company = encrypt_text(company)
            run.location = encrypt_text(location)
            run.source_url = encrypt_text(source_url)
            run.job_source = job_source
            run.resume_id = resume_id
            run.preview_url = encrypt_text(preview_url)
            run.provider_id = provider_id
            run.provider_label = provider_label
            run.generated_at = generated_at
            run.total_duration_ms = total_duration_ms
            run.prompt_profile_id = prompt_setup.get("prompt_profile_id")
            run.prompt1_version_id = prompt_setup.get("prompt1_version_id")
            run.prompt2_version_id = prompt_setup.get("prompt2_version_id")
            run.prompt3_version_id = prompt_setup.get("prompt3_version_id")
            run.system_prompt_version_id = prompt_setup.get("system_prompt_version_id")
            run.summary = encrypt_json(summary or {})
            run.prompt_artifacts = encrypt_json({})
            run.prompt_artifacts_blob = self._encode_prompt_artifacts_blob(prompt_artifacts)
            run.updated_at = _utcnow()
            self._prune_extension_run_prompt_artifacts(
                session,
                user_id=resolved_user_id,
            )

            session.commit()
            session.refresh(run)
            return self._serialize_extension_run(run)

    def get_stats(self, user_id: str) -> dict[str, Any]:
        """Return per-user counts in a single database round trip."""
        with self._session() as session:
            row = session.execute(
                select(
                    select(func.count())
                    .where(ResumeModel.user_id == user_id)
                    .scalar_subquery()
                    .label("total_resumes"),
                    select(func.count())
                    .where(JobModel.user_id == user_id)
                    .scalar_subquery()
                    .label("total_jobs"),
                    select(func.count())
                    .where(ImprovementModel.user_id == user_id)
                    .scalar_subquery()
                    .label("total_improvements"),
                    select(func.count())
                    .where(ExtensionRunModel.user_id == user_id)
                    .scalar_subquery()
                    .label("total_extension_runs"),
                    select(func.count())
                    .where(
                        ResumeModel.user_id == user_id,
                        ResumeModel.is_master.is_(True),
                    )
                    .scalar_subquery()
                    .label("has_master_resume"),
                )
            ).one()
            return {
                "total_resumes": row.total_resumes,
                "total_jobs": row.total_jobs,
                "total_improvements": row.total_improvements,
                "total_extension_runs": row.total_extension_runs,
                "has_master_resume": bool(row.has_master_resume),
            }

    def reset_database(self) -> None:
        with self._session() as session:
            session.execute(delete(ExtensionRunModel))
            session.execute(delete(ImprovementModel))
            session.execute(delete(JobModel))
            session.execute(delete(ResumeModel))
            session.execute(delete(UserModel))
            session.commit()

        uploads_dir = settings.data_dir / "uploads"
        if uploads_dir.exists():
            shutil.rmtree(uploads_dir)
            uploads_dir.mkdir(parents=True, exist_ok=True)


db = Database()
