"""API routers."""

from app.routers.admin import router as admin_router
from app.routers.config import router as config_router
from app.routers.enrichment import router as enrichment_router
from app.routers.evals import router as evals_router
from app.routers.user_evals import router as user_evals_router
from app.routers.extension import router as extension_router
from app.routers.health import router as health_router
from app.routers.jobs import router as jobs_router
from app.routers.resumes import router as resumes_router
from app.routers.tailor import router as tailor_router

__all__ = [
    "resumes_router",
    "admin_router",
    "jobs_router",
    "config_router",
    "extension_router",
    "health_router",
    "enrichment_router",
    "evals_router",
    "user_evals_router",
    "tailor_router",
]
