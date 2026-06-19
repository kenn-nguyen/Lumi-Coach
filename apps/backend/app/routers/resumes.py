"""Resume management endpoints."""

import asyncio
import copy
import hashlib
import json
import logging
import unicodedata
from collections import OrderedDict
from collections.abc import Awaitable
from dataclasses import dataclass
from pathlib import Path
from time import monotonic
from typing import Any, Callable, NoReturn
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import ValidationError

from app.config_cache import get_content_language, load_config as _load_config
from app.database import db
from app.llm import (
    LLMConfig,
    SHARED_GEMINI_FALLBACK_LIMIT_MESSAGE,
    USER_LLM_REQUEST_FAILED_MESSAGE,
    SharedGeminiFallbackLimitError,
    UserLlmRequestError,
    get_llm_config,
)
from app.pdf import render_resume_pdf, PDFRenderError
from app.config import settings

logger = logging.getLogger(__name__)
from app.schemas import (
    ExtensionResumeJobLinkRequest,
    GenerateContentResponse,
    GenerationFeedback,
    GenerationArtifacts,
    ImproveResumeConfirmRequest,
    ImproveResumeRequest,
    ImproveResumeResponse,
    ImproveResumeData,
    RefinementStats,
    ResumeDiffSummary,
    ResumeFieldDiff,
    ResumeData,
    ResumeFetchData,
    ResumeFetchResponse,
    ResumeImportContext,
    ResumeListResponse,
    ResumePdfWarmRequest,
    ResumePdfWarmResponse,
    ResumeTemplateSettings,
    ResumeTemplateSettingsResponse,
    ResumeTemplateSettingsUpdate,
    ResumeSummary,
    ResumeUploadResponse,
    ResumeUpdateRequest,
    RewriteBulletRequest,
    RewriteBulletResponse,
    RewriteSummaryRequest,
    RewriteSummaryResponse,
    RawResume,
    UpdateCoverLetterRequest,
    UpdateJobDescriptionRequest,
    UpdateOutreachMessageRequest,
    UpdateTitleRequest,
    normalize_resume_data,
)
from app.services.parser import parse_document, parse_resume_to_json, restore_dates_from_markdown
from app.services.improver import (
    MONTH_PATTERN,
    apply_diffs,
    extract_job_keywords,
    generate_improvements,
    generate_resume_diffs,
    improve_resume,
    verify_diff_result,
)
from app.services.refiner import refine_resume, calculate_keyword_match
from app.schemas.refinement import RefinementConfig
from app.services.cover_letter import (
    build_prompt2_strategy_context,
    generate_cover_letter,
    generate_outreach_message,
    generate_resume_title,
    rewrite_resume_bullet,
    rewrite_resume_summary,
)
from app.security import (
    AuthenticatedUser,
    create_backend_access_token_for_user,
    get_current_user_id,
    require_current_user,
)
from app.prompts import DEFAULT_IMPROVE_PROMPT_ID, IMPROVE_PROMPT_OPTIONS

router = APIRouter(
    prefix="/resumes",
    tags=["Resumes"],
    dependencies=[Depends(require_current_user)],
)


@dataclass
class _PreviewHashEntry:
    preview_hashes: dict[str, str]
    updated_at: float


@dataclass
class _ResumePdfCacheEntry:
    pdf_bytes: bytes
    created_at: float


@dataclass(frozen=True)
class _ResumePdfRequest:
    template: str = "swiss-single"
    page_size: str = "A4"
    margin_top: int = 10
    margin_bottom: int = 10
    margin_left: int = 10
    margin_right: int = 10
    section_spacing: int = 2
    item_spacing: int = 2
    line_height: int = 2
    font_size: int = 2
    header_scale: int = 2
    header_font: str = "serif"
    body_font: str = "sans-serif"
    compact_mode: bool = False
    show_contact_icons: bool = False
    accent_color: str = "blue"
    date_display: str = "month-year"
    experience_header_order: str = "company-first"
    fit_one_page: bool = True
    fit_mode: str | None = None
    fit_one_page_vertical_scale: float | None = None
    lang: str | None = None


_PREVIEW_HASH_CACHE_TTL_SECONDS = 60 * 30
_preview_hash_cache: dict[tuple[str, str], _PreviewHashEntry] = {}
_RESUME_PDF_CACHE_TTL_SECONDS = 60 * 30
_RESUME_PDF_CACHE_MAX_ENTRIES = 24
_resume_pdf_cache: OrderedDict[str, _ResumePdfCacheEntry] = OrderedDict()
_resume_pdf_inflight: dict[str, asyncio.Task[bytes]] = {}
_resume_pdf_cache_lock = asyncio.Lock()


def _resume_pdf_request_to_cache_payload(
    resume_id: str, resume_updated_at: str | None, request: _ResumePdfRequest
) -> dict[str, Any]:
    return {
        "resume_id": resume_id,
        "resume_updated_at": resume_updated_at or "",
        "template": request.template,
        "page_size": request.page_size,
        "margins": {
            "top": request.margin_top,
            "right": request.margin_right,
            "bottom": request.margin_bottom,
            "left": request.margin_left,
        },
        "spacing": {
            "section": request.section_spacing,
            "item": request.item_spacing,
            "line_height": request.line_height,
        },
        "font_size": request.font_size,
        "header_scale": request.header_scale,
        "header_font": request.header_font,
        "body_font": request.body_font,
        "compact_mode": request.compact_mode,
        "show_contact_icons": request.show_contact_icons,
        "accent_color": request.accent_color,
        "date_display": request.date_display,
        "experience_header_order": request.experience_header_order,
        "fit_one_page": request.fit_one_page,
        "fit_mode": request.fit_mode,
        "fit_one_page_vertical_scale": request.fit_one_page_vertical_scale,
        "lang": request.lang,
    }


def _build_resume_pdf_cache_key(
    resume_id: str, resume_updated_at: str | None, request: _ResumePdfRequest
) -> str:
    serialized = json.dumps(
        _resume_pdf_request_to_cache_payload(resume_id, resume_updated_at, request),
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _prune_resume_pdf_cache_locked(now: float) -> None:
    expired_keys = [
        cache_key
        for cache_key, entry in _resume_pdf_cache.items()
        if now - entry.created_at > _RESUME_PDF_CACHE_TTL_SECONDS
    ]
    for cache_key in expired_keys:
        _resume_pdf_cache.pop(cache_key, None)
    while len(_resume_pdf_cache) > _RESUME_PDF_CACHE_MAX_ENTRIES:
        _resume_pdf_cache.popitem(last=False)


def _log_resume_pdf_task_result(task: asyncio.Task[bytes], cache_key: str) -> None:
    try:
        error = task.exception()
    except asyncio.CancelledError:
        return
    except Exception:
        return
    if error is not None:
        logger.warning(f"Resume PDF warm task failed for cache key {cache_key}: {error}")


async def _render_and_store_resume_pdf(
    cache_key: str, render_pdf: Awaitable[bytes]
) -> bytes:
    current_task = asyncio.current_task()
    try:
        pdf_bytes = await render_pdf
    except Exception:
        async with _resume_pdf_cache_lock:
            if _resume_pdf_inflight.get(cache_key) is current_task:
                _resume_pdf_inflight.pop(cache_key, None)
        raise

    async with _resume_pdf_cache_lock:
        if _resume_pdf_inflight.get(cache_key) is current_task:
            _resume_pdf_inflight.pop(cache_key, None)
            _resume_pdf_cache[cache_key] = _ResumePdfCacheEntry(
                pdf_bytes=pdf_bytes,
                created_at=monotonic(),
            )
            _resume_pdf_cache.move_to_end(cache_key)
            _prune_resume_pdf_cache_locked(monotonic())

    return pdf_bytes


async def _get_or_render_resume_pdf(
    cache_key: str, render_pdf_factory: Callable[[], Awaitable[bytes]]
) -> bytes:
    now = monotonic()
    async with _resume_pdf_cache_lock:
        _prune_resume_pdf_cache_locked(now)
        cached_entry = _resume_pdf_cache.get(cache_key)
        if cached_entry is not None:
            _resume_pdf_cache.move_to_end(cache_key)
            return cached_entry.pdf_bytes

        inflight_task = _resume_pdf_inflight.get(cache_key)
        if inflight_task is None:
            inflight_task = asyncio.create_task(
                _render_and_store_resume_pdf(cache_key, render_pdf_factory())
            )
            inflight_task.add_done_callback(
                lambda task, key=cache_key: _log_resume_pdf_task_result(task, key)
            )
            _resume_pdf_inflight[cache_key] = inflight_task

    return await inflight_task


async def _warm_resume_pdf(
    cache_key: str, render_pdf_factory: Callable[[], Awaitable[bytes]]
) -> str:
    now = monotonic()
    async with _resume_pdf_cache_lock:
        _prune_resume_pdf_cache_locked(now)
        cached_entry = _resume_pdf_cache.get(cache_key)
        if cached_entry is not None:
            _resume_pdf_cache.move_to_end(cache_key)
            return "ready"

        if cache_key in _resume_pdf_inflight:
            return "warming"

        inflight_task = asyncio.create_task(
            _render_and_store_resume_pdf(cache_key, render_pdf_factory())
        )
        inflight_task.add_done_callback(
            lambda task, key=cache_key: _log_resume_pdf_task_result(task, key)
        )
        _resume_pdf_inflight[cache_key] = inflight_task
        return "warming"


def _build_resume_pdf_request_from_query(
    *,
    template: str,
    page_size: str,
    margin_top: int,
    margin_bottom: int,
    margin_left: int,
    margin_right: int,
    section_spacing: int,
    item_spacing: int,
    line_height: int,
    font_size: int,
    header_scale: int,
    header_font: str,
    body_font: str,
    compact_mode: bool,
    show_contact_icons: bool,
    accent_color: str,
    date_display: str,
    experience_header_order: str,
    fit_one_page: bool,
    fit_mode: str | None,
    fit_one_page_vertical_scale: float | None,
    lang: str | None,
) -> _ResumePdfRequest:
    return _ResumePdfRequest(
        template=template,
        page_size=page_size,
        margin_top=margin_top,
        margin_bottom=margin_bottom,
        margin_left=margin_left,
        margin_right=margin_right,
        section_spacing=section_spacing,
        item_spacing=item_spacing,
        line_height=line_height,
        font_size=font_size,
        header_scale=header_scale,
        header_font=header_font,
        body_font=body_font,
        compact_mode=compact_mode,
        show_contact_icons=show_contact_icons,
        accent_color=accent_color,
        date_display=date_display,
        experience_header_order=experience_header_order,
        fit_one_page=fit_one_page,
        fit_mode=fit_mode,
        fit_one_page_vertical_scale=fit_one_page_vertical_scale,
        lang=lang,
    )


def _build_resume_pdf_request_from_warm_payload(
    payload: ResumePdfWarmRequest,
) -> _ResumePdfRequest:
    template_settings = payload.template_settings
    margins = template_settings.margins if template_settings and template_settings.margins else None
    spacing = template_settings.spacing if template_settings and template_settings.spacing else None
    font_size = template_settings.fontSize if template_settings and template_settings.fontSize else None
    render_layout = payload.render_layout
    return _ResumePdfRequest(
        template=template_settings.template if template_settings and template_settings.template else "swiss-single",
        page_size=template_settings.pageSize if template_settings and template_settings.pageSize else "A4",
        margin_top=margins.top if margins else 10,
        margin_bottom=margins.bottom if margins else 10,
        margin_left=margins.left if margins else 10,
        margin_right=margins.right if margins else 10,
        section_spacing=spacing.section if spacing else 2,
        item_spacing=spacing.item if spacing else 2,
        line_height=spacing.lineHeight if spacing else 2,
        font_size=font_size.base if font_size else 2,
        header_scale=font_size.headerScale if font_size else 2,
        header_font=font_size.headerFont if font_size else "serif",
        body_font=font_size.bodyFont if font_size else "sans-serif",
        compact_mode=template_settings.compactMode if template_settings and template_settings.compactMode is not None else False,
        show_contact_icons=template_settings.showContactIcons if template_settings and template_settings.showContactIcons is not None else False,
        accent_color=template_settings.accentColor if template_settings and template_settings.accentColor else "blue",
        date_display=template_settings.dateDisplay if template_settings and template_settings.dateDisplay else "month-year",
        experience_header_order=(
            template_settings.experienceHeaderOrder
            if template_settings and template_settings.experienceHeaderOrder
            else "company-first"
        ),
        fit_one_page=(
            template_settings.fitOnePage
            if template_settings and template_settings.fitOnePage is not None
            else True
        ),
        fit_mode=render_layout.fitMode if render_layout else None,
        fit_one_page_vertical_scale=(
            render_layout.fitOnePageVerticalScale if render_layout else None
        ),
        lang=payload.lang,
    )


def _build_resume_pdf_render_url(
    resume_id: str, request: _ResumePdfRequest, auth_token: str
) -> str:
    params = (
        f"template={request.template}"
        f"&pageSize={request.page_size}"
        f"&marginTop={request.margin_top}"
        f"&marginBottom={request.margin_bottom}"
        f"&marginLeft={request.margin_left}"
        f"&marginRight={request.margin_right}"
        f"&sectionSpacing={request.section_spacing}"
        f"&itemSpacing={request.item_spacing}"
        f"&lineHeight={request.line_height}"
        f"&fontSize={request.font_size}"
        f"&headerScale={request.header_scale}"
        f"&headerFont={request.header_font}"
        f"&bodyFont={request.body_font}"
        f"&compactMode={str(request.compact_mode).lower()}"
        f"&showContactIcons={str(request.show_contact_icons).lower()}"
        f"&accentColor={request.accent_color}"
        f"&dateDisplay={request.date_display}"
        f"&experienceHeaderOrder={request.experience_header_order}"
        f"&fitOnePage={str(request.fit_one_page).lower()}"
    )
    if request.fit_mode is not None:
        params = f"{params}&fitMode={request.fit_mode}"
    if request.fit_one_page_vertical_scale is not None:
        params = (
            f"{params}&fitOnePageVerticalScale={request.fit_one_page_vertical_scale}"
        )
    params = f"{params}&authToken={quote(auth_token, safe='')}"
    if request.lang:
        params = f"{params}&lang={request.lang}"
    return f"{settings.frontend_base_url}/print/resumes/{resume_id}?{params}"


async def _render_resume_pdf_for_request(
    resume_id: str,
    request: _ResumePdfRequest,
    current_user: AuthenticatedUser,
) -> bytes:
    auth_token, _ = create_backend_access_token_for_user(current_user)
    url = _build_resume_pdf_render_url(resume_id, request, auth_token)
    explicit_fit_layout = (
        request.fit_mode is not None or request.fit_one_page_vertical_scale is not None
    )
    pdf_margins = {
        "top": request.margin_top,
        "right": request.margin_right,
        "bottom": request.margin_bottom,
        "left": request.margin_left,
    }
    return await render_resume_pdf(
        url,
        request.page_size,
        margins=pdf_margins,
        fit_one_page=request.fit_one_page and not explicit_fit_layout,
        calibrate_fit_one_page=request.fit_one_page and explicit_fit_layout,
    )


def _sanitize_pdf_download_filename(filename: str | None, fallback: str) -> str:
    """Return a safe PDF filename for Content-Disposition."""
    raw = unicodedata.normalize("NFC", (filename or fallback).strip())
    invalid_chars = {'/', '\\', ':', '*', '?', '"', '<', '>', '|', '\r', '\n', '\0'}
    sanitized = "".join("-" if char in invalid_chars else char for char in raw).strip()
    if not sanitized:
        sanitized = fallback
    if not sanitized.lower().endswith(".pdf"):
        sanitized = f"{sanitized}.pdf"
    if len(sanitized) > 180:
        sanitized = f"{sanitized[:176].rstrip()}.pdf"
    return sanitized


def _resolve_current_user_id(current_user: AuthenticatedUser | object) -> str | None:
    """Return the authenticated user id when called by FastAPI or direct tests."""
    if isinstance(current_user, AuthenticatedUser):
        return current_user.user_id
    return get_current_user_id()


def _get_feature_bool(config: dict, key: str, default: bool = False) -> bool:
    """Resolve feature toggles while preserving explicit saved false values."""
    return bool(config[key]) if key in config else default


def _set_cached_preview_hash(user_id: str | None, job_id: str, prompt_id: str, preview_hash: str) -> None:
    if not user_id:
        return
    now = asyncio.get_running_loop().time()
    _prune_preview_hash_cache(now)
    cache_key = (user_id, job_id)
    existing = _preview_hash_cache.get(cache_key)
    preview_hashes = dict(existing.preview_hashes) if existing else {}
    preview_hashes[prompt_id] = preview_hash
    _preview_hash_cache[cache_key] = _PreviewHashEntry(
        preview_hashes=preview_hashes,
        updated_at=now,
    )


def _get_cached_preview_hashes(user_id: str | None, job_id: str) -> dict[str, str]:
    if not user_id:
        return {}
    now = asyncio.get_running_loop().time()
    _prune_preview_hash_cache(now)
    entry = _preview_hash_cache.get((user_id, job_id))
    return dict(entry.preview_hashes) if entry else {}


def _prune_preview_hash_cache(now: float | None = None) -> None:
    current = now if now is not None else 0.0
    expired_keys = [
        key
        for key, entry in _preview_hash_cache.items()
        if current - entry.updated_at > _PREVIEW_HASH_CACHE_TTL_SECONDS
    ]
    for key in expired_keys:
        _preview_hash_cache.pop(key, None)

PRESERVED_PERSONAL_INFO_FIELDS = (
    "name",
    "customTagline",
    "email",
    "phone",
    "location",
    "website",
    "linkedin",
    "github",
)
PRESERVED_EXPERIENCE_FIELDS = ("title", "company", "website", "context", "years")


def _resolve_rewrite_strategy_context(
    resume: dict[str, Any], resume_id: str, *, role_title: str = "", role_company: str = ""
) -> str | None:
    generation_artifacts = resume.get("generation_artifacts")
    prompt2_artifact = (
        generation_artifacts.get("prompt2")
        if isinstance(generation_artifacts, dict)
        else None
    )
    strategy_context = build_prompt2_strategy_context(
        prompt2_artifact,
        role_title=role_title,
        role_company=role_company,
    )
    if strategy_context:
        return strategy_context

    improvement = db.get_improvement_by_tailored_resume(resume_id)
    if improvement:
        job = db.get_job(improvement["job_id"])
        if job:
            return job.get("content")

    return None


def _get_default_prompt_id() -> str:
    """Get configured default prompt id from config file."""
    config = _load_config()
    option_ids = {option["id"] for option in IMPROVE_PROMPT_OPTIONS}
    prompt_id = config.get("default_prompt_id", DEFAULT_IMPROVE_PROMPT_ID)
    return prompt_id if prompt_id in option_ids else DEFAULT_IMPROVE_PROMPT_ID


def _hash_job_content(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _normalize_payload(value: Any) -> Any:
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    if isinstance(value, list):
        return [_normalize_payload(item) for item in value]
    if isinstance(value, dict):
        normalized: dict[Any, Any] = {}
        for key, val in value.items():
            normalized_key = (
                unicodedata.normalize("NFC", key) if isinstance(key, str) else key
            )
            normalized[normalized_key] = _normalize_payload(val)
        return normalized
    return value


def _hash_improved_data(data: dict[str, Any]) -> str:
    """Hash canonicalized improved data for preview/confirm validation."""
    normalized = _normalize_payload(data)
    serialized = json.dumps(
        normalized,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,  # Preserve original behavior for hash stability
        default=str,  # Handle non-serializable types gracefully
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _normalize_personal_info_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value).strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    normalized = _normalize_payload(value)
    return json.dumps(
        normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )


def _raise_improve_error(
    action: str,
    stage: str,
    error: Exception,
    detail: str,
) -> NoReturn:
    logger.error("Resume %s failed during %s: %s", action, stage, error)
    if isinstance(error, SharedGeminiFallbackLimitError):
        raise HTTPException(
            status_code=429,
            detail=SHARED_GEMINI_FALLBACK_LIMIT_MESSAGE,
        ) from error
    if isinstance(error, UserLlmRequestError):
        raise HTTPException(
            status_code=502,
            detail=USER_LLM_REQUEST_FAILED_MESSAGE,
        ) from error
    raise HTTPException(status_code=500, detail=detail)


def _raise_generation_error(error: Exception, fallback_detail: str) -> NoReturn:
    """Raise a user-safe generation error without leaking provider internals."""
    if isinstance(error, SharedGeminiFallbackLimitError):
        raise HTTPException(
            status_code=429,
            detail=SHARED_GEMINI_FALLBACK_LIMIT_MESSAGE,
        ) from error
    if isinstance(error, UserLlmRequestError):
        raise HTTPException(
            status_code=502,
            detail=USER_LLM_REQUEST_FAILED_MESSAGE,
        ) from error
    raise HTTPException(status_code=500, detail=fallback_detail) from error


def _get_original_resume_data(resume: dict[str, Any]) -> dict[str, Any] | None:
    original_data = resume.get("processed_data")
    if not original_data and resume.get("content_type") == "json":
        try:
            original_data = json.loads(resume["content"])
        except json.JSONDecodeError as e:
            logger.warning("Skipping resume diff due to JSON parse failure: %s", e)
    return original_data


def _get_original_markdown(resume: dict[str, Any]) -> str | None:
    """Get the original markdown content from a resume.

    Checks ``original_markdown`` first (persisted at upload), then
    falls back to ``content`` if it's still in markdown format.
    """
    md = resume.get("original_markdown")
    if md and isinstance(md, str):
        return md
    if resume.get("content_type") == "md":
        content = resume.get("content", "")
        if content and isinstance(content, str):
            return content
    return None


def _has_month(date_str: str) -> bool:
    """Return True if the date string contains a month name."""
    return bool(MONTH_PATTERN.search(date_str))


def _restore_original_dates(
    original_data: dict[str, Any] | None,
    improved_data: dict[str, Any],
) -> dict[str, Any]:
    """Restore original date/years values that the LLM may have truncated.

    Compares each entry's ``years`` field in the tailored resume against
    the corresponding entry in the original.  If the original has more
    date precision (e.g. includes a month) and the tailored version lost
    it, the original value is restored.
    """
    if not original_data:
        return improved_data

    result = copy.deepcopy(improved_data)

    for section_key in ("workExperience", "education", "personalProjects"):
        orig_entries = original_data.get(section_key, [])
        result_entries = result.get(section_key, [])
        for idx, orig_entry in enumerate(orig_entries):
            if idx >= len(result_entries):
                break
            if not isinstance(orig_entry, dict) or not isinstance(result_entries[idx], dict):
                continue
            orig_years = orig_entry.get("years", "")
            result_years = result_entries[idx].get("years", "")
            if (
                isinstance(orig_years, str)
                and isinstance(result_years, str)
                and orig_years
                and orig_years != result_years
                and _has_month(orig_years)
                and not _has_month(result_years)
            ):
                logger.info(
                    "Restoring date in %s[%d]: %r → %r",
                    section_key,
                    idx,
                    result_years,
                    orig_years,
                )
                result_entries[idx]["years"] = orig_years

    # Custom sections (itemList)
    orig_custom = original_data.get("customSections", {})
    result_custom = result.get("customSections", {})
    if isinstance(orig_custom, dict) and isinstance(result_custom, dict):
        for section_key, orig_section in orig_custom.items():
            if not isinstance(orig_section, dict):
                continue
            result_section = result_custom.get(section_key)
            if not isinstance(result_section, dict):
                continue
            if orig_section.get("sectionType") != "itemList":
                continue
            orig_items = orig_section.get("items", [])
            result_items = result_section.get("items", [])
            for idx, orig_item in enumerate(orig_items):
                if idx >= len(result_items):
                    break
                if not isinstance(orig_item, dict) or not isinstance(result_items[idx], dict):
                    continue
                orig_years = orig_item.get("years", "")
                result_years = result_items[idx].get("years", "")
                if (
                    isinstance(orig_years, str)
                    and isinstance(result_years, str)
                    and orig_years
                    and orig_years != result_years
                    and _has_month(orig_years)
                    and not _has_month(result_years)
                ):
                    result_items[idx]["years"] = orig_years

    return result


def _preserve_original_skills(
    original_data: dict[str, Any] | None,
    improved_data: dict[str, Any],
) -> dict[str, Any]:
    """Restore any skills, certs, languages, or awards dropped by the LLM.

    This is a hard safety net: regardless of what the LLM returns, no
    original item from these lists is ever lost.  Dropped items are
    appended at the end of the improved list.
    """
    if not original_data:
        return improved_data

    result = copy.deepcopy(improved_data)

    orig_additional = original_data.get("additional", {})
    if not isinstance(orig_additional, dict):
        return result
    result_additional = result.setdefault("additional", {})

    list_fields = [
        "technicalSkills",
        "certificationsTraining",
        "languages",
        "awards",
    ]
    for field in list_fields:
        orig_items = orig_additional.get(field, [])
        if not isinstance(orig_items, list) or not orig_items:
            continue
        current_items = result_additional.get(field, [])
        if not isinstance(current_items, list):
            current_items = []

        # Build a case-insensitive index of what the LLM kept
        current_lower = {
            item.casefold() for item in current_items if isinstance(item, str)
        }

        # Append any originals that were dropped
        restored = 0
        for item in orig_items:
            if isinstance(item, str) and item.casefold() not in current_lower:
                current_items.append(item)
                current_lower.add(item.casefold())
                restored += 1

        if restored:
            logger.info("Restored %d dropped items in additional.%s", restored, field)
        result_additional[field] = current_items

    return result


def _build_resume_fetch_response(
    resume: dict[str, Any],
    request_id: str | None = None,
) -> ResumeFetchResponse:
    """Build a standard fetch-style response from a resume record."""
    processing_status = resume.get("processing_status", "pending")
    raw_resume = RawResume(
        id=None,
        content=resume["content"],
        content_type=resume["content_type"],
        created_at=resume["created_at"],
        processing_status=processing_status,
    )

    processed_data = resume.get("processed_data")
    if processed_data:
        processed_data = normalize_resume_data(processed_data)

    processed_resume = (
        ResumeData.model_validate(processed_data) if processed_data else None
    )
    raw_generation_feedback = resume.get("generation_feedback")
    generation_feedback = (
        GenerationFeedback.model_validate(raw_generation_feedback)
        if raw_generation_feedback
        else None
    )
    raw_generation_artifacts = resume.get("generation_artifacts")
    generation_artifacts = (
        GenerationArtifacts.model_validate(raw_generation_artifacts)
        if raw_generation_artifacts
        else None
    )
    raw_template_settings = resume.get("template_settings")
    template_settings = (
        ResumeTemplateSettings.model_validate(raw_template_settings).model_dump(
            exclude_none=True
        )
        if raw_template_settings
        else None
    )
    raw_import_context = resume.get("import_context")
    import_context = (
        ResumeImportContext.model_validate(raw_import_context)
        if raw_import_context
        else None
    )

    return ResumeFetchResponse(
        request_id=request_id or str(uuid4()),
        data=ResumeFetchData(
            resume_id=resume["resume_id"],
            filename=resume.get("filename"),
            raw_resume=raw_resume,
            processed_resume=processed_resume,
            generation_feedback=generation_feedback,
            generation_artifacts=generation_artifacts,
            cover_letter=resume.get("cover_letter"),
            outreach_message=resume.get("outreach_message"),
            parent_id=resume.get("parent_id"),
            linked_master_resume_id=resume.get("linked_master_resume_id"),
            import_context=import_context,
            title=resume.get("title"),
            template_settings=template_settings,
        ),
    )


def _protect_custom_sections(
    original_data: dict[str, Any] | None,
    improved_data: dict[str, Any],
) -> dict[str, Any]:
    """Protect custom sections from LLM hallucination.

    - If an item originally had description: [], revert any fabricated descriptions.
    - If the LLM added items that weren't in the original, remove them.
    """
    if not original_data:
        return improved_data

    orig_custom = original_data.get("customSections")
    if not isinstance(orig_custom, dict) or not orig_custom:
        return improved_data

    result = copy.deepcopy(improved_data)
    result_custom = result.get("customSections")
    if not isinstance(result_custom, dict):
        return result

    for section_key, orig_section in orig_custom.items():
        if not isinstance(orig_section, dict):
            continue
        result_section = result_custom.get(section_key)
        if not isinstance(result_section, dict):
            # Section was removed by LLM — restore original
            result_custom[section_key] = copy.deepcopy(orig_section)
            logger.info("Restored missing custom section: %s", section_key)
            continue

        section_type = orig_section.get("sectionType", "")
        if section_type == "itemList":
            orig_items = orig_section.get("items", [])
            result_items = result_section.get("items", [])
            if not isinstance(orig_items, list) or not isinstance(result_items, list):
                continue

            # Trim any items the LLM added beyond the original count
            if len(result_items) > len(orig_items):
                logger.info(
                    "Trimming %d hallucinated items from customSections.%s",
                    len(result_items) - len(orig_items),
                    section_key,
                )
                result_items = result_items[: len(orig_items)]

            # Revert fabricated descriptions on items that had empty descriptions
            for idx, orig_item in enumerate(orig_items):
                if idx >= len(result_items):
                    break
                if not isinstance(orig_item, dict):
                    continue
                orig_desc = orig_item.get("description")
                if isinstance(orig_desc, list) and len(orig_desc) == 0:
                    result_desc = result_items[idx].get("description")
                    if isinstance(result_desc, list) and len(result_desc) > 0:
                        logger.info(
                            "Reverted fabricated description on customSections.%s.items[%d]",
                            section_key,
                            idx,
                        )
                        result_items[idx]["description"] = []

            result_section["items"] = result_items

    result["customSections"] = result_custom
    return result


def _preserve_experience_identity_fields(
    original_items: list[Any], result_items: list[Any]
) -> None:
    original_by_id: dict[int, dict[str, Any]] = {}
    for item in original_items:
        if isinstance(item, dict) and isinstance(item.get("id"), int):
            original_by_id[item["id"]] = item

    for index, result_item in enumerate(result_items):
        if not isinstance(result_item, dict):
            continue

        original_item = None
        result_id = result_item.get("id")
        if isinstance(result_id, int):
            original_item = original_by_id.get(result_id)
        if original_item is None and index < len(original_items):
            candidate = original_items[index]
            if isinstance(candidate, dict):
                original_item = candidate
        if not isinstance(original_item, dict):
            continue

        for field in PRESERVED_EXPERIENCE_FIELDS:
            if field in original_item:
                result_item[field] = copy.deepcopy(original_item[field])


def _preserve_generated_resume_facts(
    original_data: dict[str, Any] | None,
    improved_data: dict[str, Any],
    preserve_facts: bool,
) -> tuple[dict[str, Any], list[str]]:
    """Preserve protected factual fields from original, return warnings if unable.

    Uses deep copy to prevent mutation of original data.
    """
    warnings: list[str] = []

    if not preserve_facts:
        return improved_data, warnings

    if not original_data:
        warnings.append(
            "Original resume data unavailable - protected factual fields may be AI-generated"
        )
        return improved_data, warnings

    original_info = original_data.get("personalInfo")
    if not isinstance(original_info, dict):
        warnings.append("Original personal info missing or invalid")
        return improved_data, warnings

    result = copy.deepcopy(improved_data)
    result_info = result.get("personalInfo")
    if not isinstance(result_info, dict):
        result_info = {}
        result["personalInfo"] = result_info

    for field in PRESERVED_PERSONAL_INFO_FIELDS:
        if field in original_info:
            result_info[field] = copy.deepcopy(original_info[field])

    original_experience = original_data.get("workExperience", [])
    result_experience = result.get("workExperience", [])
    if isinstance(original_experience, list) and isinstance(result_experience, list):
        _preserve_experience_identity_fields(original_experience, result_experience)

    return result, warnings


def _calculate_diff_from_resume(
    resume: dict[str, Any],
    improved_data: dict[str, Any],
) -> tuple[ResumeDiffSummary | None, list[ResumeFieldDiff] | None, str | None]:
    """Calculate resume diffs when structured data is available.

    Returns (summary, changes, error_reason). Error reason is None on success,
    or a string describing why diff calculation failed.
    """
    original_data = _get_original_resume_data(resume)
    if not original_data:
        return None, None, "original_data_missing"
    from app.services.improver import calculate_resume_diff

    try:
        summary, changes = calculate_resume_diff(original_data, improved_data)
        return summary, changes, None
    except Exception as e:
        logger.warning("Skipping resume diff due to calculation failure: %s", e)
        return None, None, f"calculation_error: {str(e)}"


def _validate_confirm_payload(
    original_data: dict[str, Any] | None,
    improved_data: dict[str, Any],
    preserve_facts: bool,
) -> None:
    if not preserve_facts:
        return
    if not original_data:
        logger.warning(
            "Skipping confirm payload validation; structured resume data unavailable."
        )
        return
    original_info = original_data.get("personalInfo")
    improved_info = improved_data.get("personalInfo")
    # JSON-008: Explicit null checks with clear error messages
    if original_info is None:
        raise ValueError("Original resume missing personalInfo")
    if improved_info is None:
        raise ValueError("Improved resume missing personalInfo")
    if not isinstance(original_info, dict):
        raise ValueError(
            f"Original personalInfo is not a dict: {type(original_info).__name__}"
        )
    if not isinstance(improved_info, dict):
        raise ValueError(
            f"Improved personalInfo is not a dict: {type(improved_info).__name__}"
        )
    fields = set(original_info.keys()) | set(improved_info.keys())
    mismatches = [
        field
        for field in sorted(fields)
        if field in PRESERVED_PERSONAL_INFO_FIELDS
        if _normalize_personal_info_value(original_info.get(field))
        != _normalize_personal_info_value(improved_info.get(field))
    ]
    if mismatches:
        raise ValueError(f"personalInfo fields changed: {', '.join(mismatches)}")


async def _generate_auxiliary_messages(
    improved_data: dict[str, Any],
    job_content: str,
    language: str,
    enable_cover_letter: bool,
    enable_outreach: bool,
    llm_config: LLMConfig,
) -> tuple[str | None, str | None, str | None, list[str]]:
    """Generate cover letter, outreach message, and resume title.

    Returns (cover_letter, outreach_message, title, warnings).
    """
    cover_letter = None
    outreach_message = None
    title = None
    warnings: list[str] = []
    generation_tasks: list[Awaitable[str]] = []
    task_labels: list[str] = []

    # Title generation is always on (no feature flag)
    generation_tasks.append(generate_resume_title(job_content, language, config=llm_config))
    task_labels.append("title")

    if enable_cover_letter:
        generation_tasks.append(
            generate_cover_letter(improved_data, job_content, language, config=llm_config)
        )
        task_labels.append("cover_letter")
    if enable_outreach:
        generation_tasks.append(
            generate_outreach_message(improved_data, job_content, language, config=llm_config)
        )
        task_labels.append("outreach")

    results = await asyncio.gather(*generation_tasks, return_exceptions=True)
    for label, result in zip(task_labels, results):
        if isinstance(result, Exception):
            logger.warning(
                "%s generation failed: %s",
                label,
                result,
                exc_info=result,
            )
            if label != "title":
                warnings.append(f"{label.replace('_', ' ').title()} generation failed")
        else:
            if label == "title":
                title = result
            elif label == "cover_letter":
                cover_letter = result
            elif label == "outreach":
                outreach_message = result

    return cover_letter, outreach_message, title, warnings

ALLOWED_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/json",
    "text/json",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
}
MAX_FILE_SIZE = 4 * 1024 * 1024  # 4MB
RESUME_DATA_JSON_KEYS = {
    "personalInfo",
    "summary",
    "workExperience",
    "education",
    "personalProjects",
    "additional",
    "sectionMeta",
    "customSections",
}


def _parse_resume_json_payload(
    content: bytes,
) -> tuple[dict[str, Any], dict[str, Any] | None, dict[str, Any] | None]:
    """Parse and validate an uploaded ResumeData JSON payload."""
    try:
        json_content = content.decode("utf-8")
    except UnicodeDecodeError as e:
        logger.error("JSON resume decoding failed: %s", e)
        raise HTTPException(
            status_code=422,
            detail="Failed to decode JSON file. Please ensure it is valid UTF-8 JSON.",
        ) from e

    try:
        parsed_json = json.loads(json_content)
        generation_feedback = None
        generation_artifacts = None
        resume_payload = parsed_json
        if isinstance(parsed_json, dict) and "resume_data" in parsed_json:
            wrapped_payload = ResumeUpdateRequest.model_validate(parsed_json)
            resume_payload = wrapped_payload.resume_data.model_dump()
            generation_feedback = (
                wrapped_payload.generation_feedback.model_dump(exclude_none=True)
                if wrapped_payload.generation_feedback
                else None
            )
            generation_artifacts = (
                wrapped_payload.generation_artifacts.model_dump(exclude_none=True)
                if wrapped_payload.generation_artifacts
                else None
            )
        if not isinstance(resume_payload, dict) or not (
            RESUME_DATA_JSON_KEYS & set(resume_payload.keys())
        ):
            raise ValueError("JSON payload is not resume-shaped")
        processed_data = ResumeData.model_validate(resume_payload).model_dump()
        return processed_data, generation_feedback, generation_artifacts
    except json.JSONDecodeError as e:
        logger.error("JSON resume parsing failed: %s", e)
        raise HTTPException(
            status_code=422,
            detail="Failed to parse JSON file. Please ensure it is valid ResumeData JSON.",
        ) from e
    except ValidationError as e:
        logger.error("JSON resume validation failed: %s", e)
        raise HTTPException(
            status_code=422,
            detail=f"Uploaded JSON does not match ResumeData schema: {e}",
        ) from e
    except ValueError as e:
        logger.error("JSON resume validation failed: %s", e)
        raise HTTPException(
            status_code=422,
            detail="Uploaded JSON does not match ResumeData schema.",
        ) from e


def _build_resume_import_context(
    *,
    jd_url: str | None,
    jd_text: str | None,
) -> dict[str, Any]:
    """Normalize optional JD provenance captured during tailored JSON import."""
    context: dict[str, Any] = {"mode": "imported_tailored_json"}
    normalized_url = jd_url.strip() if isinstance(jd_url, str) else ""
    normalized_text = jd_text.strip() if isinstance(jd_text, str) else ""
    if normalized_url:
        context["jd_url"] = normalized_url
    if normalized_text:
        context["jd_text"] = normalized_text
    return context


def _derive_imported_resume_title(
    *,
    file_name: str,
    processed_data: dict[str, Any],
) -> str | None:
    """Pick a stable title for imported JSON child resumes."""
    file_stem = Path(file_name).stem.strip()
    if file_stem:
        return file_stem

    personal_info = processed_data.get("personalInfo")
    if isinstance(personal_info, dict):
        title = personal_info.get("title")
        if isinstance(title, str) and title.strip():
            return title.strip()

    return None


def _compose_tracking_resume_title(
    company: str | None, role_title: str | None
) -> str | None:
    normalized_company = company.strip() if isinstance(company, str) else ""
    normalized_role_title = role_title.strip() if isinstance(role_title, str) else ""
    if not normalized_role_title:
        return None
    if normalized_company:
        return f"{normalized_company} - {normalized_role_title}"
    return normalized_role_title


def _build_resume_summary_title(
    resume: dict[str, Any], extension_run: dict[str, Any] | None
) -> str | None:
    current_title = (
        resume.get("title").strip()
        if isinstance(resume.get("title"), str)
        else None
    )
    if current_title:
        return current_title

    if not isinstance(extension_run, dict):
        return None

    job_source = extension_run.get("job_source")
    if job_source in {"linkedin", "apify_backend"}:
        tracking_title = _compose_tracking_resume_title(
            extension_run.get("company"),
            extension_run.get("title"),
        )
        return tracking_title

    return None


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ResumeUploadResponse:
    """Upload and process a resume file (PDF/DOCX/JSON).

    Converts the file to Markdown and stores it in the database.
    For schema-valid JSON uploads, stores structured data directly.
    """
    file_name = file.filename or "resume"
    file_suffix = Path(file_name).suffix.lower()
    is_json_upload = file_suffix == ".json" or file.content_type in {"application/json", "text/json"}

    # Validate file type
    if file.content_type not in ALLOWED_TYPES and not is_json_upload:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Allowed: PDF, DOC, DOCX, JSON",
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    if is_json_upload:
        processed_data, generation_feedback, generation_artifacts = _parse_resume_json_payload(
            content
        )

        resume = await db.create_resume_atomic_master(
            content=json.dumps(processed_data, indent=2),
            content_type="json",
            filename=file_name,
            processed_data=processed_data,
            processing_status="ready",
            generation_feedback=generation_feedback,
            generation_artifacts=generation_artifacts,
        )

        return ResumeUploadResponse(
            message=f"File {file_name} uploaded successfully",
            request_id=str(uuid4()),
            resume_id=resume["resume_id"],
            processing_status="ready",
            is_master=resume.get("is_master", False),
        )

    # PDF / DOCX / TXT / MD — convert to markdown then LLM-parse to structured JSON
    suffix = Path(file_name).suffix.lower()
    is_plain_text = suffix in {".txt", ".md"} or file.content_type in {
        "text/plain",
        "text/markdown",
        "text/x-markdown",
    }
    try:
        if is_plain_text:
            markdown_text = content.decode("utf-8", errors="replace")
        else:
            markdown_text = await parse_document(content, file_name)

        llm_config = get_llm_config()
        processed_data = await parse_resume_to_json(markdown_text, config=llm_config)
    except Exception as e:
        logger.error("Failed to parse uploaded resume %s: %s", file_name, e)
        raise HTTPException(status_code=422, detail="Failed to parse resume. Please try again.")

    resume = await db.create_resume_atomic_master(
        content=markdown_text,
        content_type="markdown",
        filename=file_name,
        processed_data=processed_data,
        processing_status="ready",
    )

    return ResumeUploadResponse(
        message=f"File {file_name} uploaded successfully",
        request_id=str(uuid4()),
        resume_id=resume["resume_id"],
        processing_status="ready",
        is_master=resume.get("is_master", False),
    )


@router.post("/import-tailored-json", response_model=ResumeUploadResponse)
async def import_tailored_json_resume(
    file: UploadFile = File(...),
    jd_url: str | None = Form(default=None),
    jd_text: str | None = Form(default=None),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ResumeUploadResponse:
    """Import a ResumeData JSON file as a tailored child linked to the current master."""
    file_name = file.filename or "resume.json"
    file_suffix = Path(file_name).suffix.lower()
    is_json_upload = file_suffix == ".json" or file.content_type in {"application/json", "text/json"}

    if not is_json_upload:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a ResumeData JSON file.",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    user_id = _resolve_current_user_id(current_user)
    master_resume = db.get_master_resume(user_id)
    if not master_resume:
        raise HTTPException(
            status_code=400,
            detail="No master resume was found in Lumi Coach. Upload a master resume first.",
        )

    normalized_jd_text = jd_text.strip() if isinstance(jd_text, str) else ""
    if not normalized_jd_text:
        raise HTTPException(
            status_code=400,
            detail="Job description text is required when importing a tailored resume.",
        )

    processed_data, _generation_feedback, _generation_artifacts = _parse_resume_json_payload(
        content
    )

    imported_resume = db.create_resume(
        content=json.dumps(processed_data, indent=2),
        content_type="json",
        filename=file_name,
        is_master=False,
        parent_id=master_resume["resume_id"],
        linked_master_resume_id=master_resume["resume_id"],
        import_context=_build_resume_import_context(jd_url=jd_url, jd_text=normalized_jd_text),
        processed_data=processed_data,
        processing_status="ready",
        title=_derive_imported_resume_title(file_name=file_name, processed_data=processed_data),
        user_id=user_id,
    )

    imported_job = db.create_job(
        content=normalized_jd_text,
        resume_id=imported_resume["resume_id"],
        user_id=user_id,
    )
    db.create_improvement(
        original_resume_id=master_resume["resume_id"],
        tailored_resume_id=imported_resume["resume_id"],
        job_id=imported_job["job_id"],
        improvements=[],
        user_id=user_id,
    )

    return ResumeUploadResponse(
        message=f"File {file_name} imported successfully",
        request_id=str(uuid4()),
        resume_id=imported_resume["resume_id"],
        processing_status="ready",
        is_master=False,
    )

    # Convert to markdown
    try:
        markdown_content = await parse_document(content, file_name)
    except Exception as e:
        logger.error(f"Document parsing failed: {e}")
        raise HTTPException(
            status_code=422,
            detail="Failed to parse document. Please ensure it's a valid PDF or DOCX file.",
        )

    # Store in database first with "processing" status (atomic master assignment)
    # original_markdown is preserved permanently for date reference even after
    # builder saves overwrite `content` with JSON.
    resume = await db.create_resume_atomic_master(
        content=markdown_content,
        content_type="md",
        filename=file_name,
        processed_data=None,
        processing_status="processing",
        original_markdown=markdown_content,
    )

    # Try to parse to structured JSON (optional, may fail if LLM not configured)
    try:
        llm_config = get_llm_config(_resolve_current_user_id(current_user))
        processed_data = await parse_resume_to_json(markdown_content, config=llm_config)
        db.update_resume(
            resume["resume_id"],
            {
                "processed_data": processed_data,
                "processing_status": "ready",
            },
        )
        resume["processed_data"] = processed_data
        resume["processing_status"] = "ready"
    except Exception as e:
        # LLM parsing failed, update status to failed
        logger.warning(f"Resume parsing to JSON failed for {file.filename}: {e}")
        db.update_resume(resume["resume_id"], {"processing_status": "failed"})
        resume["processing_status"] = "failed"

    # Return accurate status to client (API-001 fix)
    return ResumeUploadResponse(
        message=(
            f"File {file.filename} uploaded successfully"
            if resume["processing_status"] == "ready"
            else f"File {file.filename} uploaded but parsing failed"
        ),
        request_id=str(uuid4()),
        resume_id=resume["resume_id"],
        processing_status=resume["processing_status"],
        is_master=resume.get("is_master", False),
    )


@router.get("", response_model=ResumeFetchResponse)
async def get_resume(resume_id: str = Query(...)) -> ResumeFetchResponse:
    """Fetch resume details by ID.

    Returns both raw markdown and structured data (if available),
    plus cover letter and outreach message if they exist.
    Applies lazy migration for section metadata if needed.
    """
    resume = db.get_resume(resume_id)

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    return _build_resume_fetch_response(resume)


@router.post("/{resume_id}/clone", response_model=ResumeFetchResponse)
async def clone_resume_endpoint(resume_id: str) -> ResumeFetchResponse:
    """Create a non-master child resume cloned from an existing resume."""
    source_resume = db.get_resume(resume_id)
    if not source_resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    cloned_resume = db.create_resume(
        content=source_resume["content"],
        content_type=source_resume.get("content_type", "md"),
        filename=source_resume.get("filename"),
        is_master=False,
        parent_id=resume_id,
        processed_data=copy.deepcopy(source_resume.get("processed_data")),
        processing_status=source_resume.get("processing_status", "ready"),
        cover_letter=source_resume.get("cover_letter"),
        outreach_message=source_resume.get("outreach_message"),
        template_settings=copy.deepcopy(source_resume.get("template_settings")),
        title=source_resume.get("title"),
        original_markdown=source_resume.get("original_markdown"),
    )

    return _build_resume_fetch_response(cloned_resume)


@router.get("/list", response_model=ResumeListResponse)
async def list_resumes(
    include_master: bool = Query(False),
    limit: int | None = Query(default=None, ge=1, le=100),
    search: str | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ResumeListResponse:
    """List resumes, optionally including the master resume."""
    user_id = _resolve_current_user_id(current_user)
    resumes = db.list_resumes(
        user_id=user_id,
        limit=limit,
        include_master=include_master,
        search=search,
    )

    resumes.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
    extension_run_by_resume_id = db.get_extension_run_metadata_by_resume_ids(
        [resume["resume_id"] for resume in resumes if not resume.get("is_master", False)],
        user_id=user_id,
    )

    summaries = [
        ResumeSummary(
            resume_id=resume["resume_id"],
            filename=resume.get("filename"),
            is_master=resume.get("is_master", False),
            parent_id=resume.get("parent_id"),
            processing_status=resume.get("processing_status", "pending"),
            created_at=resume.get("created_at", ""),
            updated_at=resume.get("updated_at", ""),
            title=_build_resume_summary_title(
                resume, extension_run_by_resume_id.get(resume["resume_id"])
            ),
            job_source_url=(
                extension_run_by_resume_id.get(resume["resume_id"], {}).get("source_url")
            )
            or (
                resume.get("import_context", {}).get("jd_url")
                if isinstance(resume.get("import_context"), dict)
                else None
            ),
        )
        for resume in resumes
    ]

    return ResumeListResponse(request_id=str(uuid4()), data=summaries)


@router.post("/improve/preview", response_model=ImproveResumeResponse)
async def improve_resume_preview_endpoint(
    request: ImproveResumeRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ImproveResumeResponse:
    """Preview a tailored resume without persisting it.

    The response includes resume_preview data but leaves resume_id null.
    """
    resume = db.get_resume(request.resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")

    language = get_content_language()
    prompt_id = request.prompt_id or _get_default_prompt_id()
    llm_config = get_llm_config(_resolve_current_user_id(current_user))

    stage = "load_job_keywords"
    detail = "Failed to preview resume. Please try again."
    try:
        return await asyncio.wait_for(
            _improve_preview_flow(
                request=request,
                resume=resume,
                job=job,
                language=language,
                prompt_id=prompt_id,
                llm_config=llm_config,
            ),
            timeout=240.0,  # 4-minute hard limit
        )
    except asyncio.TimeoutError:
        logger.error(
            "Improve preview timed out after 240s for resume %s / job %s",
            request.resume_id,
            request.job_id,
        )
        raise HTTPException(
            status_code=504,
            detail="Resume tailoring timed out. Please try again with a shorter job description or a simpler prompt.",
        )
    except Exception as e:
        _raise_improve_error("preview", stage, e, detail)


async def _improve_preview_flow(
    *,
    request: ImproveResumeRequest,
    resume: dict[str, Any],
    job: dict[str, Any],
    language: str,
    prompt_id: str,
    llm_config: LLMConfig,
) -> ImproveResumeResponse:
    """Inner flow for improve/preview, extracted so it can be wrapped in wait_for."""
    feature_config = _load_config()
    preserve_generated_resume_facts = feature_config.get(
        "preserve_generated_resume_facts", True
    )
    job_keywords = job.get("job_keywords")
    job_keywords_hash = job.get("job_keywords_hash")
    content_hash = _hash_job_content(job["content"])
    if not job_keywords or job_keywords_hash != content_hash:
        job_keywords = await extract_job_keywords(job["content"], config=llm_config)
        # Cache extracted keywords with a content hash for basic invalidation.
        try:
            updated_job = db.update_job(
                request.job_id,
                {"job_keywords": job_keywords, "job_keywords_hash": content_hash},
            )
            if not updated_job:
                logger.warning(
                    "Failed to persist job keywords for job %s.",
                    request.job_id,
                )
        except Exception as e:
            logger.warning(
                "Failed to persist job keywords for job %s: %s",
                request.job_id,
                e,
            )
    original_resume_data = _get_original_resume_data(resume)
    # Collect warnings throughout the process
    response_warnings: list[str] = []

    # Diff-based improvement: generate targeted changes, apply with verification
    if original_resume_data:
        diff_result = await generate_resume_diffs(
            original_resume=resume["content"],
            job_description=job["content"],
            job_keywords=job_keywords,
            language=language,
            prompt_id=prompt_id,
            original_resume_data=original_resume_data,
            config=llm_config,
        )

        improved_data, applied_changes, rejected_changes = apply_diffs(
            original=original_resume_data,
            changes=diff_result.changes,
        )

        diff_warnings = verify_diff_result(
            original=original_resume_data,
            result=improved_data,
            applied_changes=applied_changes,
            job_keywords=job_keywords,
        )
        response_warnings.extend(diff_warnings)

        if rejected_changes:
            response_warnings.append(
                f"{len(rejected_changes)} change(s) rejected during verification"
            )

        logger.info(
            "Diff-based improve: %d applied, %d rejected, %d warnings",
            len(applied_changes),
            len(rejected_changes),
            len(diff_warnings),
        )
    else:
        # Fallback to full-output mode when no structured data available
        improved_data = await improve_resume(
            original_resume=resume["content"],
            job_description=job["content"],
            job_keywords=job_keywords,
            language=language,
            prompt_id=prompt_id,
            original_resume_data=original_resume_data,
            config=llm_config,
        )

    # Safety nets (defense in depth — should rarely activate with diff-based flow)
    improved_data, preserve_warnings = _preserve_generated_resume_facts(
        original_resume_data,
        improved_data,
        preserve_generated_resume_facts,
    )
    response_warnings.extend(preserve_warnings)

    improved_data = _restore_original_dates(original_resume_data, improved_data)
    original_markdown = _get_original_markdown(resume)
    if original_markdown:
        improved_data = restore_dates_from_markdown(improved_data, original_markdown)
    improved_data = _preserve_original_skills(original_resume_data, improved_data)
    improved_data = _protect_custom_sections(original_resume_data, improved_data)

    # Multi-pass refinement: keyword injection, AI phrase removal, alignment validation
    refinement_stats: RefinementStats | None = None
    refinement_attempted = False
    refinement_successful = False
    try:
        # Get master resume for alignment validation
        master_resume = db.get_master_resume()
        master_data = (
            _get_original_resume_data(master_resume)
            if master_resume
            else _get_original_resume_data(resume)
        )
        if master_data:
            initial_match = calculate_keyword_match(improved_data, job_keywords)
            refinement_attempted = True
            refinement_result = await refine_resume(
                initial_tailored=improved_data,
                master_resume=master_data,
                job_description=job["content"],
                job_keywords=job_keywords,
                config=RefinementConfig(),
                llm_config=llm_config,
            )
            improved_data = refinement_result.refined_data
            refinement_stats = RefinementStats(
                passes_completed=refinement_result.passes_completed,
                keywords_injected=(
                    len(refinement_result.keyword_analysis.injectable_keywords)
                    if refinement_result.keyword_analysis
                    else 0
                ),
                ai_phrases_removed=refinement_result.ai_phrases_removed,
                alignment_violations_fixed=(
                    len(
                        [
                            v
                            for v in refinement_result.alignment_report.violations
                            if v.severity == "critical"
                        ]
                    )
                    if refinement_result.alignment_report
                    else 0
                ),
                initial_match_percentage=initial_match,
                final_match_percentage=refinement_result.final_match_percentage,
            )
            refinement_successful = True
            logger.info(
                "Refinement completed: %d passes, %d AI phrases removed",
                refinement_result.passes_completed,
                len(refinement_result.ai_phrases_removed),
            )
    except Exception as e:
        logger.warning("Refinement failed, using unrefined result: %s", e)
        if refinement_attempted:
            response_warnings.append(f"Refinement failed: {str(e)}")

    normalized_preview = ResumeData.model_validate(improved_data).model_dump()
    normalized_preview = normalize_resume_data(normalized_preview)

    improved_data = normalized_preview
    improved_text = json.dumps(improved_data, indent=2)
    preview_hash = _hash_improved_data(improved_data)
    current_user_id = get_current_user_id()
    _set_cached_preview_hash(current_user_id, request.job_id, prompt_id, preview_hash)
    preview_hashes = job.get("preview_hashes")
    if not isinstance(preview_hashes, dict):
        preview_hashes = {}
    preview_hashes[prompt_id] = preview_hash
    # NOTE: preview_hashes updates are last-write-wins; concurrent previews can race.
    try:
        updated_job = db.update_job(
            request.job_id,
            {
                "preview_hash": preview_hash,
                "preview_prompt_id": prompt_id,
                "preview_hashes": preview_hashes,
            },
        )
        if not updated_job:
            logger.warning(
                "Failed to persist preview hash for job %s.", request.job_id
            )
    except Exception as e:
        logger.warning(
            "Failed to persist preview hash for job %s: %s", request.job_id, e
        )
    diff_summary, detailed_changes, diff_error = _calculate_diff_from_resume(
        resume,
        improved_data,
    )
    if diff_error:
        response_warnings.append(f"Could not calculate changes: {diff_error}")
    improvements = generate_improvements(job_keywords)

    request_id = str(uuid4())
    return ImproveResumeResponse(
        request_id=request_id,
        data=ImproveResumeData(
            request_id=request_id,
            resume_id=None,
            job_id=request.job_id,
            resume_preview=ResumeData.model_validate(improved_data),
            improvements=[
                {
                    "suggestion": imp["suggestion"],
                    "lineNumber": imp.get("lineNumber"),
                }
                for imp in improvements
            ],
            markdownOriginal=resume["content"],
            markdownImproved=improved_text,
            cover_letter=None,
            outreach_message=None,
            diff_summary=diff_summary,
            detailed_changes=detailed_changes,
            refinement_stats=refinement_stats,
            warnings=response_warnings,
            refinement_attempted=refinement_attempted,
            refinement_successful=refinement_successful,
        ),
    )


@router.post("/improve/confirm", response_model=ImproveResumeResponse)
async def improve_resume_confirm_endpoint(
    request: ImproveResumeConfirmRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ImproveResumeResponse:
    """Confirm and persist a tailored resume."""
    resume = db.get_resume(request.resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")

    feature_config = _load_config()
    enable_cover_letter = _get_feature_bool(feature_config, "enable_cover_letter")
    enable_outreach = _get_feature_bool(feature_config, "enable_outreach_message")
    preserve_generated_resume_facts = feature_config.get(
        "preserve_generated_resume_facts", True
    )
    language = get_content_language()
    llm_config = get_llm_config(_resolve_current_user_id(current_user))

    stage = "serialize_improved_data"
    detail = "Failed to confirm resume. Please try again."
    try:
        improved_data = request.improved_data.model_dump()
        improved_text = json.dumps(improved_data, indent=2)
        # NOTE: This endpoint relies on preview-hash validation to ensure the payload matches a prior preview.
        # Stronger guarantees would require server-side preview storage or re-running the improvement.
        try:
            _validate_confirm_payload(
                _get_original_resume_data(resume),
                improved_data,
                preserve_generated_resume_facts,
            )
        except ValueError as e:
            logger.warning("Resume confirm rejected: %s", e)
            raise HTTPException(
                status_code=400,
                detail="Invalid improved resume data. Please retry preview.",
            )
        current_user_id = get_current_user_id()
        preview_hashes = job.get("preview_hashes")
        allowed_hashes: set[str] = set()
        if isinstance(preview_hashes, dict):
            allowed_hashes.update(preview_hashes.values())
        elif isinstance(preview_hashes, list):
            allowed_hashes.update(
                [value for value in preview_hashes if isinstance(value, str)]
            )
        else:
            preview_hash = job.get("preview_hash")
            if isinstance(preview_hash, str):
                allowed_hashes.add(preview_hash)
        allowed_hashes.update(_get_cached_preview_hashes(current_user_id, request.job_id).values())

        if not allowed_hashes:
            logger.warning(
                "Rejecting confirm; preview hash missing for job %s.",
                request.job_id,
            )
            raise HTTPException(
                status_code=400,
                detail="Preview required before confirmation. Please retry preview.",
            )

        request_hash = _hash_improved_data(improved_data)
        if request_hash not in allowed_hashes:
            logger.warning("Resume confirm rejected due to preview hash mismatch.")
            raise HTTPException(
                status_code=400,
                detail="Invalid improved resume data. Please retry preview.",
            )

        stage = "calculate_diff"
        response_warnings: list[str] = []
        diff_summary, detailed_changes, diff_error = _calculate_diff_from_resume(
            resume,
            improved_data,
        )
        if diff_error:
            response_warnings.append(f"Could not calculate changes: {diff_error}")

        stage = "generate_auxiliary_messages"
        (
            cover_letter,
            outreach_message,
            title,
            aux_warnings,
        ) = await _generate_auxiliary_messages(
            improved_data,
            job["content"],
            language,
            enable_cover_letter,
            enable_outreach,
            llm_config,
        )
        response_warnings.extend(aux_warnings)

        stage = "create_resume"
        tailored_resume = db.create_resume(
            content=improved_text,
            content_type="json",
            filename=f"tailored_{resume.get('filename', 'resume')}",
            is_master=False,
            parent_id=request.resume_id,
            processed_data=improved_data,
            processing_status="ready",
            cover_letter=cover_letter,
            outreach_message=outreach_message,
            title=title,
        )

        improvements_payload = [imp.model_dump() for imp in request.improvements]
        stage = "create_improvement"
        request_id = str(uuid4())
        db.create_improvement(
            original_resume_id=request.resume_id,
            tailored_resume_id=tailored_resume["resume_id"],
            job_id=request.job_id,
            improvements=improvements_payload,
        )

        return ImproveResumeResponse(
            request_id=request_id,
            data=ImproveResumeData(
                request_id=request_id,
                resume_id=tailored_resume["resume_id"],
                job_id=request.job_id,
                resume_preview=request.improved_data,
                improvements=request.improvements,
                markdownOriginal=resume["content"],
                markdownImproved=improved_text,
                cover_letter=cover_letter,
                outreach_message=outreach_message,
                diff_summary=diff_summary,
                detailed_changes=detailed_changes,
                warnings=response_warnings,
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        _raise_improve_error("confirm", stage, e, detail)


@router.post("/improve", response_model=ImproveResumeResponse)
async def improve_resume_endpoint(
    request: ImproveResumeRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ImproveResumeResponse:
    """Improve/tailor a resume for a specific job description.

    Uses LLM to analyze the job and generate an optimized resume version
    with improvement suggestions. Also generates cover letter and outreach
    message if enabled in feature configuration.
    Persists the tailored resume and returns a non-null resume_id.
    """
    # Fetch resume
    resume = db.get_resume(request.resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Fetch job description
    job = db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")

    # Load feature configuration and content language
    feature_config = _load_config()
    enable_cover_letter = _get_feature_bool(feature_config, "enable_cover_letter")
    enable_outreach = _get_feature_bool(feature_config, "enable_outreach_message")
    preserve_generated_resume_facts = feature_config.get(
        "preserve_generated_resume_facts", True
    )
    language = get_content_language()
    llm_config = get_llm_config(_resolve_current_user_id(current_user))

    try:
        # Extract keywords from job description
        job_keywords = await extract_job_keywords(job["content"], config=llm_config)

        # Generate improved resume in the configured language
        prompt_id = request.prompt_id or _get_default_prompt_id()

        original_resume_data = _get_original_resume_data(resume)
        # Collect warnings throughout the process
        response_warnings: list[str] = []

        # Diff-based improvement: generate targeted changes, apply with verification
        if original_resume_data:
            diff_result = await generate_resume_diffs(
                original_resume=resume["content"],
                job_description=job["content"],
                job_keywords=job_keywords,
                language=language,
                prompt_id=prompt_id,
                original_resume_data=original_resume_data,
                config=llm_config,
            )

            improved_data, applied_changes, rejected_changes = apply_diffs(
                original=original_resume_data,
                changes=diff_result.changes,
            )

            diff_warnings = verify_diff_result(
                original=original_resume_data,
                result=improved_data,
                applied_changes=applied_changes,
                job_keywords=job_keywords,
            )
            response_warnings.extend(diff_warnings)

            if rejected_changes:
                response_warnings.append(
                    f"{len(rejected_changes)} change(s) rejected during verification"
                )

            logger.info(
                "Diff-based improve (legacy): %d applied, %d rejected, %d warnings",
                len(applied_changes),
                len(rejected_changes),
                len(diff_warnings),
            )
        else:
            # Fallback to full-output mode when no structured data available
            improved_data = await improve_resume(
                original_resume=resume["content"],
                job_description=job["content"],
                job_keywords=job_keywords,
                language=language,
                prompt_id=prompt_id,
                original_resume_data=original_resume_data,
                config=llm_config,
            )

        # Safety nets (defense in depth)
        improved_data, preserve_warnings = _preserve_generated_resume_facts(
            original_resume_data,
            improved_data,
            preserve_generated_resume_facts,
        )
        response_warnings.extend(preserve_warnings)

        improved_data = _restore_original_dates(original_resume_data, improved_data)
        original_markdown = _get_original_markdown(resume)
        if original_markdown:
            improved_data = restore_dates_from_markdown(improved_data, original_markdown)
        improved_data = _preserve_original_skills(original_resume_data, improved_data)
        improved_data = _protect_custom_sections(original_resume_data, improved_data)

        # Multi-pass refinement: keyword injection, AI phrase removal, alignment validation
        refinement_stats: RefinementStats | None = None
        refinement_attempted = False
        refinement_successful = False
        try:
            # Get master resume for alignment validation
            master_resume = db.get_master_resume()
            master_data = (
                _get_original_resume_data(master_resume)
                if master_resume
                else _get_original_resume_data(resume)
            )
            if master_data:
                initial_match = calculate_keyword_match(improved_data, job_keywords)
                refinement_attempted = True
                refinement_result = await refine_resume(
                    initial_tailored=improved_data,
                    master_resume=master_data,
                    job_description=job["content"],
                    job_keywords=job_keywords,
                    config=RefinementConfig(),
                    llm_config=llm_config,
                )
                improved_data = refinement_result.refined_data
                refinement_stats = RefinementStats(
                    passes_completed=refinement_result.passes_completed,
                    keywords_injected=(
                        len(refinement_result.keyword_analysis.injectable_keywords)
                        if refinement_result.keyword_analysis
                        else 0
                    ),
                    ai_phrases_removed=refinement_result.ai_phrases_removed,
                    alignment_violations_fixed=(
                        len(
                            [
                                v
                                for v in refinement_result.alignment_report.violations
                                if v.severity == "critical"
                            ]
                        )
                        if refinement_result.alignment_report
                        else 0
                    ),
                    initial_match_percentage=initial_match,
                    final_match_percentage=refinement_result.final_match_percentage,
                )
                refinement_successful = True
                logger.info(
                    "Refinement completed: %d passes, %d AI phrases removed",
                    refinement_result.passes_completed,
                    len(refinement_result.ai_phrases_removed),
                )
        except Exception as e:
            logger.warning("Refinement failed, using unrefined result: %s", e)
            if refinement_attempted:
                response_warnings.append(f"Refinement failed: {str(e)}")

        # Convert improved data to JSON string for storage
        improved_text = json.dumps(improved_data, indent=2)

        # Calculate differences between original and improved resume
        diff_summary, detailed_changes, diff_error = _calculate_diff_from_resume(
            resume,
            improved_data,
        )
        if diff_error:
            response_warnings.append(f"Could not calculate changes: {diff_error}")

        # Generate improvement suggestions
        improvements = generate_improvements(job_keywords)

        # Generate cover letter, outreach message, and title in parallel if enabled
        (
            cover_letter,
            outreach_message,
            title,
            aux_warnings,
        ) = await _generate_auxiliary_messages(
            improved_data,
            job["content"],
            language,
            enable_cover_letter,
            enable_outreach,
            llm_config,
        )
        response_warnings.extend(aux_warnings)

        # Store the tailored resume with cover letter, outreach message, and title
        tailored_resume = db.create_resume(
            content=improved_text,
            content_type="json",
            filename=f"tailored_{resume.get('filename', 'resume')}",
            is_master=False,
            parent_id=request.resume_id,
            processed_data=improved_data,
            processing_status="ready",
            cover_letter=cover_letter,
            outreach_message=outreach_message,
            title=title,
        )

        # Store improvement record
        request_id = str(uuid4())
        db.create_improvement(
            original_resume_id=request.resume_id,
            tailored_resume_id=tailored_resume["resume_id"],
            job_id=request.job_id,
            improvements=improvements,
        )

        return ImproveResumeResponse(
            request_id=request_id,
            data=ImproveResumeData(
                request_id=request_id,
                resume_id=tailored_resume["resume_id"],
                job_id=request.job_id,
                resume_preview=ResumeData.model_validate(improved_data),
                improvements=[
                    {
                        "suggestion": imp["suggestion"],
                        "lineNumber": imp.get("lineNumber"),
                    }
                    for imp in improvements
                ],
                markdownOriginal=resume["content"],
                markdownImproved=improved_text,
                cover_letter=cover_letter,
                outreach_message=outreach_message,
                # Diff metadata
                diff_summary=diff_summary,
                detailed_changes=detailed_changes,
                refinement_stats=refinement_stats,
                warnings=response_warnings,
                refinement_attempted=refinement_attempted,
                refinement_successful=refinement_successful,
            ),
        )

    except Exception as e:
        logger.error(f"Resume improvement failed: {e}")
        _raise_generation_error(e, "Failed to improve resume. Please try again.")


@router.patch("/{resume_id}", response_model=ResumeFetchResponse)
async def update_resume_endpoint(
    resume_id: str, payload: dict[str, Any]
) -> ResumeFetchResponse:
    """Update a resume with new structured data."""
    existing = db.get_resume(resume_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Resume not found")

    generation_feedback_update = existing.get("generation_feedback")
    generation_artifacts_update = existing.get("generation_artifacts")
    if "resume_data" in payload:
        parsed_payload = ResumeUpdateRequest.model_validate(payload)
        resume_data = parsed_payload.resume_data
        if "generation_feedback" in payload:
            generation_feedback_update = (
                parsed_payload.generation_feedback.model_dump(exclude_none=True)
                if parsed_payload.generation_feedback
                else None
            )
        if "generation_artifacts" in payload:
            generation_artifacts_update = (
                parsed_payload.generation_artifacts.model_dump(exclude_none=True)
                if parsed_payload.generation_artifacts
                else None
            )
    else:
        resume_data = ResumeData.model_validate(payload)

    updated_data = resume_data.model_dump()
    updated_content = json.dumps(updated_data, indent=2)

    updated = db.update_resume(
        resume_id,
        {
            "content": updated_content,
            "content_type": "json",
            "processed_data": updated_data,
            "processing_status": "ready",
            "generation_feedback": generation_feedback_update,
            "generation_artifacts": generation_artifacts_update,
        },
    )

    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update resume")
    return _build_resume_fetch_response(updated)


@router.patch("/{resume_id}/template-settings", response_model=ResumeTemplateSettingsResponse)
async def update_resume_template_settings_endpoint(
    resume_id: str, payload: ResumeTemplateSettingsUpdate
) -> ResumeTemplateSettingsResponse:
    """Update per-resume output settings used by preview and PDF rendering."""
    existing = db.get_resume(resume_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Resume not found")

    next_settings = copy.deepcopy(existing.get("template_settings") or {})
    next_settings.update(payload.model_dump(exclude_none=True))

    if not next_settings:
        next_settings = {"dateDisplay": "month-year", "fitOnePage": True}

    updated = db.update_resume(resume_id, {"template_settings": next_settings})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update resume settings")

    return ResumeTemplateSettingsResponse(
        request_id=str(uuid4()),
        data=ResumeTemplateSettings.model_validate(
            updated.get("template_settings") or next_settings
        ).model_dump(exclude_none=True),
    )


@router.post("/link-job-context")
async def link_extension_generated_resume_to_job(
    request: ExtensionResumeJobLinkRequest,
) -> dict[str, Any]:
    """Link an extension-generated tailored resume to a stored job context."""

    original_resume = db.get_resume(request.original_resume_id)
    if not original_resume:
        raise HTTPException(status_code=404, detail="Original resume not found")

    tailored_resume = db.get_resume(request.tailored_resume_id)
    if not tailored_resume:
        raise HTTPException(status_code=404, detail="Tailored resume not found")

    job = db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")

    existing_improvement = db.get_improvement_by_tailored_resume(
        request.tailored_resume_id
    )
    if existing_improvement:
        raise HTTPException(
            status_code=409,
            detail="This tailored resume is already linked to a job context.",
        )

    improvement = db.create_improvement(
        original_resume_id=request.original_resume_id,
        tailored_resume_id=request.tailored_resume_id,
        job_id=request.job_id,
        improvements=[],
    )

    return {
        "message": "Job context linked successfully",
        "request_id": improvement["request_id"],
        "data": {
            "original_resume_id": request.original_resume_id,
            "tailored_resume_id": request.tailored_resume_id,
            "job_id": request.job_id,
            "improvements": [],
        },
    }


@router.get("/{resume_id}/pdf")
async def download_resume_pdf(
    resume_id: str,
    template: str = Query("swiss-single"),
    pageSize: str = Query("A4", pattern="^(A4|LETTER)$"),
    marginTop: int = Query(10, ge=5, le=25),
    marginBottom: int = Query(10, ge=5, le=25),
    marginLeft: int = Query(10, ge=5, le=25),
    marginRight: int = Query(10, ge=5, le=25),
    sectionSpacing: int = Query(2, ge=1, le=5),
    itemSpacing: int = Query(2, ge=1, le=5),
    lineHeight: int = Query(2, ge=1, le=5),
    fontSize: int = Query(2, ge=1, le=5),
    headerScale: int = Query(2, ge=1, le=5),
    headerFont: str = Query("serif", pattern="^(serif|sans-serif|mono)$"),
    bodyFont: str = Query("sans-serif", pattern="^(serif|sans-serif|mono)$"),
    compactMode: bool = Query(False),
    showContactIcons: bool = Query(False),
    accentColor: str = Query("blue", pattern="^(blue|green|orange|red)$"),
    dateDisplay: str = Query("month-year", pattern="^(month-year|year-only)$"),
    experienceHeaderOrder: str = Query(
        "company-first", pattern="^(company-first|role-first)$"
    ),
    fitOnePage: bool = Query(True),
    fitMode: str | None = Query(None, pattern="^(off|gentle|balanced|compact)$"),
    fitOnePageVerticalScale: float | None = Query(None, ge=0.5, le=2.0),
    lang: str | None = Query(None, pattern="^[a-z]{2}(-[A-Z]{2})?$"),
    filename: str | None = Query(None, max_length=220),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> Response:
    """Generate a PDF for a resume using headless Chromium.

    Accepts template settings for customization:
    - template: swiss-single, swiss-two-column, modern, or modern-two-column
    - pageSize: A4 or LETTER
    - marginTop/Bottom/Left/Right: page margins in mm (5-25)
    - sectionSpacing: gap between sections (1-5)
    - itemSpacing: gap between items (1-5)
    - lineHeight: text line height (1-5)
    - fontSize: base font size (1-5)
    - headerScale: header size scale (1-5)
    - headerFont: serif, sans-serif, or mono
    - bodyFont: serif, sans-serif, or mono
    - compactMode: enable tighter spacing
    - showContactIcons: show icons in contact info
    - dateDisplay: month-year or year-only
    - experienceHeaderOrder: company-first or role-first
    - fitOnePage: condense slight one-page overflow; long resumes may continue
    - fitMode/fitOnePageVerticalScale: runtime preview fit layout for PDF parity
    - lang: locale used for print page translations
    """
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    pdf_request = _build_resume_pdf_request_from_query(
        template=template,
        page_size=pageSize,
        margin_top=marginTop,
        margin_bottom=marginBottom,
        margin_left=marginLeft,
        margin_right=marginRight,
        section_spacing=sectionSpacing,
        item_spacing=itemSpacing,
        line_height=lineHeight,
        font_size=fontSize,
        header_scale=headerScale,
        header_font=headerFont,
        body_font=bodyFont,
        compact_mode=compactMode,
        show_contact_icons=showContactIcons,
        accent_color=accentColor,
        date_display=dateDisplay,
        experience_header_order=experienceHeaderOrder,
        fit_one_page=fitOnePage,
        fit_mode=fitMode,
        fit_one_page_vertical_scale=fitOnePageVerticalScale,
        lang=lang,
    )
    cache_key = _build_resume_pdf_cache_key(
        resume_id,
        resume.get("updated_at"),
        pdf_request,
    )

    try:
        pdf_bytes = await _get_or_render_resume_pdf(
            cache_key,
            lambda: _render_resume_pdf_for_request(
                resume_id,
                pdf_request,
                current_user,
            ),
        )
    except PDFRenderError as e:
        raise HTTPException(status_code=503, detail=str(e))

    download_filename = _sanitize_pdf_download_filename(
        filename, f"resume_{resume_id}.pdf"
    )
    ascii_filename = (
        download_filename.encode("ascii", "ignore").decode("ascii").strip()
        or f"resume_{resume_id}.pdf"
    )
    headers = {
        "Content-Disposition": (
            f'attachment; filename="{ascii_filename}"; '
            f"filename*=UTF-8''{quote(download_filename, safe='')}"
        )
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.post("/{resume_id}/pdf/warm", response_model=ResumePdfWarmResponse)
async def warm_resume_pdf_endpoint(
    resume_id: str,
    payload: ResumePdfWarmRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ResumePdfWarmResponse:
    """Warm the cached PDF artifact so later downloads return faster."""
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    pdf_request = _build_resume_pdf_request_from_warm_payload(payload)
    cache_key = _build_resume_pdf_cache_key(
        resume_id,
        resume.get("updated_at"),
        pdf_request,
    )

    try:
        status = await _warm_resume_pdf(
            cache_key,
            lambda: _render_resume_pdf_for_request(
                resume_id,
                pdf_request,
                current_user,
            ),
        )
    except PDFRenderError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return ResumePdfWarmResponse(request_id=str(uuid4()), status=status)


@router.delete("/{resume_id}")
async def delete_resume(resume_id: str) -> dict:
    """Delete a resume by ID."""
    if not db.delete_resume(resume_id):
        raise HTTPException(status_code=404, detail="Resume not found")

    return {"message": "Resume deleted successfully"}


@router.post("/{resume_id}/retry-processing", response_model=ResumeUploadResponse)
async def retry_processing(
    resume_id: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ResumeUploadResponse:
    """Retry AI processing for a failed or stuck resume.

    Re-runs parse_resume_to_json() on the stored markdown content.
    Works for resumes with processing_status == "failed" or "processing".
    """
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if resume.get("processing_status") not in ("failed", "processing"):
        raise HTTPException(
            status_code=400,
            detail="Only resumes with 'failed' or 'processing' status can be retried.",
        )

    markdown_content = resume.get("content", "")
    if not markdown_content:
        raise HTTPException(
            status_code=400,
            detail="Resume has no stored content to re-process.",
        )

    try:
        llm_config = get_llm_config(_resolve_current_user_id(current_user))
        processed_data = await parse_resume_to_json(markdown_content, config=llm_config)
        db.update_resume(
            resume_id,
            {
                "processed_data": processed_data,
                "processing_status": "ready",
            },
        )
        return ResumeUploadResponse(
            message="Resume processing succeeded on retry",
            request_id=str(uuid4()),
            resume_id=resume_id,
            processing_status="ready",
            is_master=resume.get("is_master", False),
        )
    except Exception as e:
        logger.warning(f"Retry processing failed for resume {resume_id}: {e}")
        db.update_resume(resume_id, {"processing_status": "failed"})
        return ResumeUploadResponse(
            message="Retry processing failed",
            request_id=str(uuid4()),
            resume_id=resume_id,
            processing_status="failed",
            is_master=resume.get("is_master", False),
        )


@router.patch("/{resume_id}/cover-letter")
async def update_cover_letter(
    resume_id: str, request: UpdateCoverLetterRequest
) -> dict:
    """Update the cover letter for a resume."""
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    db.update_resume(resume_id, {"cover_letter": request.content})
    return {"message": "Cover letter updated successfully"}


@router.patch("/{resume_id}/outreach-message")
async def update_outreach_message(
    resume_id: str, request: UpdateOutreachMessageRequest
) -> dict:
    """Update the outreach message for a resume."""
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    db.update_resume(resume_id, {"outreach_message": request.content})
    return {"message": "Outreach message updated successfully"}


@router.patch("/{resume_id}/job-description")
async def update_job_description_for_resume(
    resume_id: str, request: UpdateJobDescriptionRequest
) -> dict[str, Any]:
    """Update the linked job description for a tailored resume."""
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if not resume.get("parent_id"):
        raise HTTPException(
            status_code=400,
            detail="Job description can only be updated for tailored resumes.",
        )

    improvement = db.get_improvement_by_tailored_resume(resume_id)
    if not improvement:
        raise HTTPException(
            status_code=400,
            detail="No job context found for this resume. "
            "The resume may have been created before job tracking was implemented.",
        )

    job = db.get_job(improvement["job_id"])
    if not job:
        raise HTTPException(
            status_code=404,
            detail="The associated job description was not found.",
        )

    content = request.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    updated_job = db.update_job(
        improvement["job_id"],
        {
            "content": content,
            "job_keywords": None,
            "job_keywords_hash": None,
        },
    )
    if not updated_job:
        raise HTTPException(status_code=500, detail="Failed to update job description")

    return {
        "message": "Job description updated successfully",
        "job_id": improvement["job_id"],
        "content": updated_job["content"],
    }


@router.patch("/{resume_id}/title")
async def update_title(resume_id: str, request: UpdateTitleRequest) -> dict:
    """Update the title for a resume."""
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    title = request.title.strip()[:80]
    db.update_resume(resume_id, {"title": title})
    return {"message": "Title updated successfully"}


@router.post(
    "/{resume_id}/generate-cover-letter", response_model=GenerateContentResponse
)
async def generate_cover_letter_endpoint(
    resume_id: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> GenerateContentResponse:
    """Generate a cover letter on-demand for an existing tailored resume.

    This endpoint allows users to generate a cover letter after a resume has been
    tailored, without needing to re-tailor the entire resume. It requires:
    - The resume must be a tailored resume (has parent_id)
    - The resume must have an associated job context in the improvements table
    """
    # Get the resume
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Check if it's a tailored resume (has parent_id)
    if not resume.get("parent_id"):
        raise HTTPException(
            status_code=400,
            detail="Cover letter can only be generated for tailored resumes. "
            "Please tailor this resume to a job description first.",
        )

    # Get improvement record to find the job_id
    improvement = db.get_improvement_by_tailored_resume(resume_id)
    if not improvement:
        raise HTTPException(
            status_code=400,
            detail="No job context found for this resume. "
            "The resume may have been created before job tracking was implemented.",
        )

    # Get the job description
    job = db.get_job(improvement["job_id"])
    if not job:
        raise HTTPException(
            status_code=404,
            detail="The associated job description was not found.",
        )

    # Get resume data
    resume_data = resume.get("processed_data")
    if not resume_data:
        raise HTTPException(
            status_code=400,
            detail="Resume has no processed data. Please re-upload the resume.",
        )

    # Get language setting
    language = get_content_language()

    # Generate cover letter
    try:
        llm_config = get_llm_config(_resolve_current_user_id(current_user))
        cover_letter_content = await generate_cover_letter(
            resume_data, job["content"], language, config=llm_config
        )
    except Exception as e:
        logger.error(f"Cover letter generation failed: {e}")
        _raise_generation_error(e, "Failed to generate cover letter. Please try again.")

    # Save to resume record
    db.update_resume(resume_id, {"cover_letter": cover_letter_content})

    return GenerateContentResponse(
        content=cover_letter_content,
        message="Cover letter generated successfully",
    )


@router.post("/{resume_id}/generate-outreach", response_model=GenerateContentResponse)
async def generate_outreach_endpoint(
    resume_id: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> GenerateContentResponse:
    """Generate an outreach message on-demand for an existing tailored resume.

    This endpoint allows users to generate a cold outreach message after a resume
    has been tailored. It requires:
    - The resume must be a tailored resume (has parent_id)
    - The resume must have an associated job context in the improvements table
    """
    # Get the resume
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Check if it's a tailored resume (has parent_id)
    if not resume.get("parent_id"):
        raise HTTPException(
            status_code=400,
            detail="Outreach message can only be generated for tailored resumes. "
            "Please tailor this resume to a job description first.",
        )

    # Get improvement record to find the job_id
    improvement = db.get_improvement_by_tailored_resume(resume_id)
    if not improvement:
        raise HTTPException(
            status_code=400,
            detail="No job context found for this resume. "
            "The resume may have been created before job tracking was implemented.",
        )

    # Get the job description
    job = db.get_job(improvement["job_id"])
    if not job:
        raise HTTPException(
            status_code=404,
            detail="The associated job description was not found.",
        )

    # Get resume data
    resume_data = resume.get("processed_data")
    if not resume_data:
        raise HTTPException(
            status_code=400,
            detail="Resume has no processed data. Please re-upload the resume.",
        )

    # Get language setting
    language = get_content_language()

    # Generate outreach message
    try:
        llm_config = get_llm_config(_resolve_current_user_id(current_user))
        outreach_content = await generate_outreach_message(
            resume_data, job["content"], language, config=llm_config
        )
    except Exception as e:
        logger.error(f"Outreach message generation failed: {e}")
        _raise_generation_error(e, "Failed to generate outreach message. Please try again.")

    # Save to resume record
    db.update_resume(resume_id, {"outreach_message": outreach_content})

    return GenerateContentResponse(
        content=outreach_content,
        message="Outreach message generated successfully",
    )


@router.post("/{resume_id}/rewrite-bullet", response_model=RewriteBulletResponse)
async def rewrite_bullet_endpoint(
    resume_id: str,
    request: RewriteBulletRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> RewriteBulletResponse:
    """Generate a one-bullet rewrite suggestion without persisting it."""
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    current_bullet = request.current_bullet.strip()
    if not current_bullet:
        raise HTTPException(status_code=400, detail="Current bullet is required.")

    strategy_context = _resolve_rewrite_strategy_context(
        resume,
        resume_id,
        role_title=request.role_context.title,
        role_company=request.role_context.company,
    )
    if not strategy_context:
        strategy_context = request.job_description

    language = get_content_language()

    try:
        llm_config = get_llm_config(_resolve_current_user_id(current_user))
        rewritten_bullet = await rewrite_resume_bullet(
            current_bullet=current_bullet,
            original_bullet=request.original_bullet,
            role_title=request.role_context.title,
            role_company=request.role_context.company,
            role_years=request.role_context.years,
            strategy_context=strategy_context,
            user_instruction=request.user_instruction,
            language=language,
            config=llm_config,
        )
    except Exception as e:
        logger.error(f"Bullet rewrite generation failed: {e}")
        _raise_generation_error(e, "Failed to rewrite bullet. Please try again.")

    return RewriteBulletResponse(
        rewritten_bullet=rewritten_bullet,
        message="Bullet rewritten successfully",
    )


@router.post("/{resume_id}/rewrite-summary", response_model=RewriteSummaryResponse)
async def rewrite_summary_endpoint(
    resume_id: str,
    request: RewriteSummaryRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> RewriteSummaryResponse:
    """Generate a summary rewrite suggestion without persisting it."""
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    current_summary = request.current_summary.strip()
    if not current_summary:
        raise HTTPException(status_code=400, detail="Current summary is required.")

    strategy_context = _resolve_rewrite_strategy_context(resume, resume_id)
    if not strategy_context:
        strategy_context = request.job_description

    language = get_content_language()

    try:
        llm_config = get_llm_config(_resolve_current_user_id(current_user))
        rewritten_summary = await rewrite_resume_summary(
            current_summary=current_summary,
            original_summary=request.original_summary,
            strategy_context=strategy_context,
            user_instruction=request.user_instruction,
            language=language,
            config=llm_config,
        )
    except Exception as e:
        logger.error(f"Summary rewrite generation failed: {e}")
        _raise_generation_error(e, "Failed to rewrite summary. Please try again.")

    return RewriteSummaryResponse(
        rewritten_summary=rewritten_summary,
        message="Summary rewritten successfully",
    )


@router.get("/{resume_id}/job-description")
async def get_job_description_for_resume(resume_id: str) -> dict:
    """Get the job description used to tailor this resume.

    This endpoint retrieves the original job description that was used
    to tailor a resume. Only works for tailored resumes (those with parent_id).
    """
    # Get the resume
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Check if it's a tailored resume (has parent_id)
    if not resume.get("parent_id"):
        raise HTTPException(
            status_code=400,
            detail="Job description is only available for tailored resumes.",
        )

    # Get improvement record to find the job_id
    improvement = db.get_improvement_by_tailored_resume(resume_id)
    if not improvement:
        raise HTTPException(
            status_code=400,
            detail="No job context found for this resume. "
            "The resume may have been created before job tracking was implemented.",
        )

    # Get the job description
    job = db.get_job(improvement["job_id"])
    if not job:
        raise HTTPException(
            status_code=404,
            detail="The associated job description was not found.",
        )

    return {
        "job_id": job["job_id"],
        "content": job["content"],
    }


@router.get("/{resume_id}/cover-letter/pdf")
async def download_cover_letter_pdf(
    resume_id: str,
    pageSize: str = Query("A4", pattern="^(A4|LETTER)$"),
    lang: str | None = Query(None, pattern="^[a-z]{2}(-[A-Z]{2})?$"),
    filename: str | None = Query(None, max_length=220),
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> Response:
    """Generate a PDF for a cover letter using headless Chromium.

    Args:
        resume_id: The ID of the resume containing the cover letter
        pageSize: A4 or LETTER
        lang: locale used for print page translations
    """
    resume = db.get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    cover_letter = resume.get("cover_letter")
    if not cover_letter:
        raise HTTPException(
            status_code=404, detail="No cover letter found for this resume"
        )

    # Build print URL (same pattern as resume PDF)
    auth_token, _ = create_backend_access_token_for_user(current_user)
    url = (
        f"{settings.frontend_base_url}/print/cover-letter/{resume_id}"
        f"?pageSize={pageSize}&authToken={quote(auth_token, safe='')}"
    )
    if lang:
        url = f"{url}&lang={lang}"

    # Render PDF with cover letter selector
    try:
        pdf_bytes = await render_resume_pdf(
            url, pageSize, selector=".cover-letter-print"
        )
    except PDFRenderError as e:
        raise HTTPException(status_code=503, detail=str(e))

    download_filename = _sanitize_pdf_download_filename(
        filename, f"cover_letter_{resume_id}.pdf"
    )
    ascii_filename = (
        download_filename.encode("ascii", "ignore").decode("ascii").strip()
        or f"cover_letter_{resume_id}.pdf"
    )
    headers = {
        "Content-Disposition": (
            f'attachment; filename="{ascii_filename}"; '
            f"filename*=UTF-8''{quote(download_filename, safe='')}"
        )
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
