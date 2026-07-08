"""Pydantic schemas for tailor pipeline endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, field_validator

VALID_PROMPT_PROFILES = {
    "profile1",
    "profile2",
    "profile3",
    "profile4",
    "profile5",
}


class TailorRequest(BaseModel):
    prompt_profile_id: str = "profile5"
    jd_url: str | None = None
    jd_text: str | None = None

    @field_validator("jd_url", "jd_text", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("prompt_profile_id")
    @classmethod
    def validate_profile(cls, v: str) -> str:
        if v not in VALID_PROMPT_PROFILES:
            raise ValueError(
                f"Invalid prompt profile: {v!r}. Must be one of {sorted(VALID_PROMPT_PROFILES)}"
            )
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
