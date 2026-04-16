"""TinyDB database layer for JSON storage."""

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from tinydb import Query, TinyDB
from tinydb.table import Table

from app.config import settings

logger = logging.getLogger(__name__)


class Database:
    """TinyDB wrapper for SOM Career Coach data."""

    _master_resume_lock = asyncio.Lock()

    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path or settings.db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db: TinyDB | None = None

    @property
    def db(self) -> TinyDB:
        """Lazy initialization of TinyDB instance."""
        if self._db is None:
            self._db = TinyDB(self.db_path)
        return self._db

    @property
    def resumes(self) -> Table:
        """Resumes table."""
        return self.db.table("resumes")

    @property
    def jobs(self) -> Table:
        """Job descriptions table."""
        return self.db.table("jobs")

    @property
    def users(self) -> Table:
        """Users table."""
        return self.db.table("users")

    @property
    def improvements(self) -> Table:
        """Improvement results table."""
        return self.db.table("improvements")

    def close(self) -> None:
        """Close database connection."""
        if self._db is not None:
            self._db.close()
            self._db = None

    # Resume operations
    def _resolve_user_scope(self, user_id: str | None = None) -> str | None:
        if user_id:
            return user_id
        try:
            from app.security import get_current_user_id

            return get_current_user_id()
        except Exception:
            return None

    def upsert_user(
        self,
        *,
        user_id: str,
        email: str,
        name: str | None = None,
        picture: str | None = None,
    ) -> dict[str, Any]:
        """Create or update a signed-in user record."""
        User = Query()
        now = datetime.now(timezone.utc).isoformat()
        existing = self.users.search(User.user_id == user_id)
        if existing:
            self.users.update(
                {
                    "email": email,
                    "name": name,
                    "picture": picture,
                    "updated_at": now,
                },
                User.user_id == user_id,
            )
            return self.users.search(User.user_id == user_id)[0]

        doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": now,
            "updated_at": now,
        }
        self.users.insert(doc)
        return doc

    def clear_unowned_records(self) -> dict[str, int]:
        """Delete legacy records that have no owner.

        This is intended as a pre-production cleanup step after auth has been
        introduced. It preserves any data already associated with a signed-in
        user and removes only ownerless legacy records.
        """
        Resume = Query()
        Job = Query()
        Improvement = Query()
        resumes_removed = self.resumes.remove(~Resume.user_id.exists())
        jobs_removed = self.jobs.remove(~Job.user_id.exists())
        improvements_removed = self.improvements.remove(~Improvement.user_id.exists())
        return {
            "resumes": len(resumes_removed),
            "jobs": len(jobs_removed),
            "improvements": len(improvements_removed),
        }

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
        title: str | None = None,
        original_markdown: str | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a new resume entry.

        processing_status: "pending", "processing", "ready", "failed"
        """
        resume_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        resolved_user_id = self._resolve_user_scope(user_id)

        doc: dict[str, Any] = {
            "resume_id": resume_id,
            "user_id": resolved_user_id,
            "content": content,
            "content_type": content_type,
            "filename": filename,
            "is_master": is_master,
            "parent_id": parent_id,
            "processed_data": processed_data,
            "processing_status": processing_status,
            "cover_letter": cover_letter,
            "outreach_message": outreach_message,
            "generation_feedback": generation_feedback,
            "generation_artifacts": generation_artifacts,
            "title": title,
            "created_at": now,
            "updated_at": now,
        }
        if original_markdown is not None:
            doc["original_markdown"] = original_markdown
        self.resumes.insert(doc)
        return doc

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
        """Create a new resume with atomic master assignment.

        Uses an asyncio.Lock to prevent race conditions when multiple uploads
        happen concurrently and both try to become master. This avoids blocking
        the FastAPI event loop unlike threading.Lock.
        """
        async with self._master_resume_lock:
            resolved_user_id = self._resolve_user_scope(user_id)
            current_master = self.get_master_resume(resolved_user_id)
            is_master = current_master is None

            # Recovery behavior: if the current master is stuck in failed or
            # processing state, promote the next upload to become the new master.
            if current_master and current_master.get("processing_status") in ("failed", "processing"):
                Resume = Query()
                self.resumes.update(
                    {"is_master": False},
                    (Resume.resume_id == current_master["resume_id"])
                    & (Resume.user_id == resolved_user_id),
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
        """Get resume by ID."""
        Resume = Query()
        resolved_user_id = self._resolve_user_scope(user_id)
        query = Resume.resume_id == resume_id
        if resolved_user_id is not None:
            query = query & (Resume.user_id == resolved_user_id)
        result = self.resumes.search(query)
        return result[0] if result else None

    def get_master_resume(self, user_id: str | None = None) -> dict[str, Any] | None:
        """Get the master resume if exists."""
        Resume = Query()
        resolved_user_id = self._resolve_user_scope(user_id)
        query = Resume.is_master == True
        if resolved_user_id is not None:
            query = query & (Resume.user_id == resolved_user_id)
        result = self.resumes.search(query)
        return result[0] if result else None

    def update_resume(
        self, resume_id: str, updates: dict[str, Any], user_id: str | None = None
    ) -> dict[str, Any]:
        """Update resume by ID.

        Raises:
            ValueError: If resume not found.
        """
        Resume = Query()
        resolved_user_id = self._resolve_user_scope(user_id)
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        query = Resume.resume_id == resume_id
        if resolved_user_id is not None:
            query = query & (Resume.user_id == resolved_user_id)
        updated_count = self.resumes.update(updates, query)

        if not updated_count:
            raise ValueError(f"Resume not found: {resume_id}")

        result = self.get_resume(resume_id, resolved_user_id)
        if not result:
            raise ValueError(f"Resume disappeared after update: {resume_id}")

        return result

    def delete_resume(self, resume_id: str, user_id: str | None = None) -> bool:
        """Delete resume by ID."""
        Resume = Query()
        resolved_user_id = self._resolve_user_scope(user_id)
        query = Resume.resume_id == resume_id
        if resolved_user_id is not None:
            query = query & (Resume.user_id == resolved_user_id)
        removed = self.resumes.remove(query)
        return len(removed) > 0

    def list_resumes(self, user_id: str | None = None) -> list[dict[str, Any]]:
        """List all resumes."""
        resolved_user_id = self._resolve_user_scope(user_id)
        if resolved_user_id is None:
            return list(self.resumes.all())
        Resume = Query()
        return list(self.resumes.search(Resume.user_id == resolved_user_id))

    def set_master_resume(self, resume_id: str, user_id: str | None = None) -> bool:
        """Set a resume as the master, unsetting any existing master.

        Returns False if the resume doesn't exist.
        """
        Resume = Query()
        resolved_user_id = self._resolve_user_scope(user_id)

        # First verify the target resume exists
        target_query = Resume.resume_id == resume_id
        if resolved_user_id is not None:
            target_query = target_query & (Resume.user_id == resolved_user_id)
        target = self.resumes.search(target_query)
        if not target:
            logger.warning("Cannot set master: resume %s not found", resume_id)
            return False

        # Unset current master
        master_query = Resume.is_master == True
        if resolved_user_id is not None:
            master_query = master_query & (Resume.user_id == resolved_user_id)
        self.resumes.update({"is_master": False}, master_query)
        # Set new master
        updated = self.resumes.update({"is_master": True}, target_query)
        return len(updated) > 0

    # Job operations
    def create_job(
        self, content: str, resume_id: str | None = None, user_id: str | None = None
    ) -> dict[str, Any]:
        """Create a new job description entry."""
        job_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        resolved_user_id = self._resolve_user_scope(user_id)

        doc = {
            "job_id": job_id,
            "user_id": resolved_user_id,
            "content": content,
            "resume_id": resume_id,
            "created_at": now,
        }
        self.jobs.insert(doc)
        return doc

    def get_job(self, job_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        """Get job by ID."""
        Job = Query()
        resolved_user_id = self._resolve_user_scope(user_id)
        query = Job.job_id == job_id
        if resolved_user_id is not None:
            query = query & (Job.user_id == resolved_user_id)
        result = self.jobs.search(query)
        return result[0] if result else None

    def update_job(
        self, job_id: str, updates: dict[str, Any], user_id: str | None = None
    ) -> dict[str, Any] | None:
        """Update a job by ID."""
        Job = Query()
        resolved_user_id = self._resolve_user_scope(user_id)
        query = Job.job_id == job_id
        if resolved_user_id is not None:
            query = query & (Job.user_id == resolved_user_id)
        updated = self.jobs.update(updates, query)
        if not updated:
            return None
        return self.get_job(job_id, resolved_user_id)

    # Improvement operations
    def create_improvement(
        self,
        original_resume_id: str,
        tailored_resume_id: str,
        job_id: str,
        improvements: list[dict[str, Any]],
        user_id: str | None = None,
    ) -> dict[str, Any]:
        """Create an improvement result entry."""
        request_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        resolved_user_id = self._resolve_user_scope(user_id)

        doc = {
            "request_id": request_id,
            "user_id": resolved_user_id,
            "original_resume_id": original_resume_id,
            "tailored_resume_id": tailored_resume_id,
            "job_id": job_id,
            "improvements": improvements,
            "created_at": now,
        }
        self.improvements.insert(doc)
        return doc

    def get_improvement_by_tailored_resume(
        self, tailored_resume_id: str, user_id: str | None = None
    ) -> dict[str, Any] | None:
        """Get improvement record by tailored resume ID.

        This is used to retrieve the job context for on-demand
        cover letter and outreach message generation.
        """
        Improvement = Query()
        resolved_user_id = self._resolve_user_scope(user_id)
        query = Improvement.tailored_resume_id == tailored_resume_id
        if resolved_user_id is not None:
            query = query & (Improvement.user_id == resolved_user_id)
        result = self.improvements.search(query)
        return result[0] if result else None

    # Stats
    def get_stats(self) -> dict[str, Any]:
        """Get database statistics."""
        return {
            "total_resumes": len(self.resumes),
            "total_jobs": len(self.jobs),
            "total_improvements": len(self.improvements),
            "has_master_resume": self.get_master_resume() is not None,
        }

    def reset_database(self) -> None:
        """Reset the database by truncating all tables and clearing uploads."""
        # Truncate tables
        self.resumes.truncate()
        self.jobs.truncate()
        self.improvements.truncate()
        self.users.truncate()

        # Clear uploads directory
        uploads_dir = settings.data_dir / "uploads"
        if uploads_dir.exists():
            import shutil

            shutil.rmtree(uploads_dir)
            uploads_dir.mkdir(parents=True, exist_ok=True)


# Global database instance
db = Database()
