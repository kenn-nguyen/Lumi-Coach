"""PostgreSQL database layer for SOM Career Coach."""

from __future__ import annotations

import asyncio
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
    String,
    Text,
    create_engine,
    delete,
    inspect,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class UserModel(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
    processed_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    outreach_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_feedback: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    generation_artifacts: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    template_settings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    prompt_artifacts: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
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
        self._ensure_resume_schema()
        self._ensure_extension_runs_schema()

    def _ensure_resume_schema(self) -> None:
        """Apply lightweight additive schema updates for local/dev databases."""
        inspector = inspect(self._engine)
        columns = {column["name"] for column in inspector.get_columns("resumes")}
        if "template_settings" in columns:
            return

        with self._engine.begin() as connection:
            connection.execute(text("ALTER TABLE resumes ADD COLUMN template_settings JSONB"))
        logger.info("Added resumes.template_settings column")

    def _ensure_extension_runs_schema(self) -> None:
        """Apply additive schema updates for extension run telemetry."""
        inspector = inspect(self._engine)
        if "extension_runs" not in inspector.get_table_names():
            return

        columns = {column["name"] for column in inspector.get_columns("extension_runs")}
        if "prompt_artifacts" in columns:
            return

        with self._engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE extension_runs "
                    "ADD COLUMN prompt_artifacts JSONB DEFAULT '{}'::jsonb"
                )
            )
        logger.info("Added extension_runs.prompt_artifacts column")

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

    def _serialize_user(self, user: UserModel) -> dict[str, Any]:
        return {
            "user_id": user.user_id,
            "email": user.email,
            "name": user.name,
            "picture": user.picture,
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
            "content": resume.content,
            "content_type": resume.content_type,
            "filename": resume.filename,
            "is_master": resume.is_master,
            "parent_id": resume.parent_id,
            "processed_data": resume.processed_data,
            "processing_status": resume.processing_status,
            "cover_letter": resume.cover_letter,
            "outreach_message": resume.outreach_message,
            "generation_feedback": resume.generation_feedback,
            "generation_artifacts": resume.generation_artifacts,
            "template_settings": resume.template_settings,
            "title": resume.title,
            "original_markdown": resume.original_markdown,
            "created_at": self._to_iso(resume.created_at),
            "updated_at": self._to_iso(resume.updated_at),
        }

    def _serialize_job(self, job: JobModel) -> dict[str, Any]:
        return {
            "job_id": job.job_id,
            "user_id": job.user_id,
            "content": job.content,
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
            "improvements": improvement.improvements,
            "created_at": self._to_iso(improvement.created_at),
        }

    def _serialize_extension_run(self, run: ExtensionRunModel) -> dict[str, Any]:
        return {
            "user_id": run.user_id,
            "run_id": run.run_id,
            "status": run.status,
            "title": run.title,
            "company": run.company,
            "location": run.location,
            "source_url": run.source_url,
            "job_source": run.job_source,
            "resume_id": run.resume_id,
            "preview_url": run.preview_url,
            "provider_id": run.provider_id,
            "provider_label": run.provider_label,
            "generated_at": self._to_iso(run.generated_at),
            "total_duration_ms": run.total_duration_ms,
            "summary": run.summary,
            "prompt_artifacts": run.prompt_artifacts,
            "created_at": self._to_iso(run.created_at),
            "updated_at": self._to_iso(run.updated_at),
        }

    def upsert_user(
        self,
        *,
        user_id: str,
        email: str,
        name: str | None = None,
        picture: str | None = None,
    ) -> dict[str, Any]:
        with self._session() as session:
            user = session.get(UserModel, user_id)
            if user is None:
                user = session.query(UserModel).filter(UserModel.email == email).first()
            if user is None:
                user = UserModel(
                    user_id=user_id,
                    email=email,
                    name=name,
                    picture=picture,
                )
                session.add(user)
            else:
                # Keep the existing stored user_id when this email has already been
                # seen before. Auth.js can hand us a different transient subject for
                # the same Google account, but app data ownership must remain stable.
                user.email = email
                user.name = name
                user.picture = picture
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
                content=content,
                content_type=content_type,
                filename=filename,
                is_master=is_master,
                parent_id=parent_id,
                processed_data=processed_data,
                processing_status=processing_status,
                cover_letter=cover_letter,
                outreach_message=outreach_message,
                generation_feedback=generation_feedback,
                generation_artifacts=generation_artifacts,
                template_settings=template_settings,
                title=title,
                original_markdown=original_markdown,
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

    def list_resumes(self, user_id: str | None = None) -> list[dict[str, Any]]:
        resolved_user_id = self._resolve_user_scope(user_id)
        with self._session() as session:
            query = session.query(ResumeModel)
            if resolved_user_id is not None:
                query = query.filter(ResumeModel.user_id == resolved_user_id)
            resumes = query.order_by(ResumeModel.updated_at.desc()).all()
            return [self._serialize_resume(resume) for resume in resumes]

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
                content=content,
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
                improvements=improvements,
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

            run.status = status
            run.title = title
            run.company = company
            run.location = location
            run.source_url = source_url
            run.job_source = job_source
            run.resume_id = resume_id
            run.preview_url = preview_url
            run.provider_id = provider_id
            run.provider_label = provider_label
            run.generated_at = generated_at
            run.total_duration_ms = total_duration_ms
            run.summary = summary or {}
            run.prompt_artifacts = prompt_artifacts or {}
            run.updated_at = _utcnow()

            session.commit()
            session.refresh(run)
            return self._serialize_extension_run(run)

    def get_stats(self) -> dict[str, Any]:
        with self._session() as session:
            total_resumes = session.query(ResumeModel).count()
            total_jobs = session.query(JobModel).count()
            total_improvements = session.query(ImprovementModel).count()
            total_extension_runs = session.query(ExtensionRunModel).count()
            has_master_resume = (
                session.query(ResumeModel)
                .filter(ResumeModel.is_master.is_(True))
                .first()
                is not None
            )
            return {
                "total_resumes": total_resumes,
                "total_jobs": total_jobs,
                "total_improvements": total_improvements,
                "total_extension_runs": total_extension_runs,
                "has_master_resume": has_master_resume,
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
