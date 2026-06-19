"""Health check and status endpoints."""

from fastapi import APIRouter, Depends

from app.database import db
from app.llm import (
    get_llm_config,
    get_server_llm_config,
    is_llm_config_configured,
)
from app.schemas import HealthResponse, StatusResponse
from app.security import AuthenticatedUser, require_current_user

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Basic health check endpoint."""
    llm_status = await check_llm_health()

    return HealthResponse(
        status="healthy" if llm_status["healthy"] else "degraded",
        llm=llm_status,
    )


@router.get("/status", response_model=StatusResponse)
async def get_status(
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> StatusResponse:
    """Get comprehensive application status.

    Returns:
        - LLM configuration status
        - Master resume existence
        - Database statistics
    """
    config = get_llm_config(current_user.user_id)
    server_config = get_server_llm_config()
    user_config = db.get_user_llm_config(current_user.user_id)
    has_user_api_key = bool(
        user_config
        and (
            str(user_config.get("provider") or "") == "ollama"
            or user_config.get("encrypted_api_key")
        )
    )
    free_llm_available = bool(server_config.provider == "gemini" and server_config.api_key)
    using_free_llm = (
        free_llm_available
        and not has_user_api_key
        and config.provider == "gemini"
        and not config.is_user_config
    )
    llm_configured = is_llm_config_configured(config)
    db_stats = db.get_stats(current_user.user_id)

    return StatusResponse(
        status="ready" if llm_configured and db_stats["has_master_resume"] else "setup_required",
        llm_configured=llm_configured,
        llm_healthy=llm_configured,
        has_user_api_key=has_user_api_key,
        free_llm_available=free_llm_available,
        using_free_llm=using_free_llm,
        free_llm_provider=server_config.provider if free_llm_available else None,
        free_llm_model=server_config.model if free_llm_available else None,
        has_master_resume=db_stats["has_master_resume"],
        database_stats=db_stats,
    )
