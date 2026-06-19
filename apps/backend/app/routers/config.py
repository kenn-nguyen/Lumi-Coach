"""LLM configuration endpoints."""

import hashlib
import json
import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.llm import check_llm_health, get_llm_config, LLMConfig
from app.services.llm_stage_config import delete_override, is_using_override, read_active_config, read_default_config, save_override
from app.llm_config_crypto import (
    LLMConfigEncryptionError,
    decrypt_api_key,
    encrypt_api_key,
)
from app.schemas import (
    LLMConfigRequest,
    LLMConfigResponse,
    FeatureConfigRequest,
    FeatureConfigResponse,
    LanguageConfigRequest,
    LanguageConfigResponse,
    PromptConfigRequest,
    PromptConfigResponse,
    PromptOption,
    OutputConfigRequest,
    OutputConfigResponse,
    ResumeTemplateSettings,
    DEFAULT_RESUME_TEMPLATE_SETTINGS,
    ApiKeyProviderStatus,
    ApiKeyStatusResponse,
    ApiKeysUpdateRequest,
    ApiKeysUpdateResponse,
    ExtensionPromptSyncRequest,
    ExtensionPromptSyncResponse,
)
from app.prompts import DEFAULT_IMPROVE_PROMPT_ID, IMPROVE_PROMPT_OPTIONS
from app.config_cache import invalidate_config_cache
from app.database import db
from app.security import AuthenticatedUser, require_current_user

router = APIRouter(
    prefix="/config",
    tags=["Configuration"],
    dependencies=[Depends(require_current_user)],
)


def _get_config_path() -> Path:
    """Get path to config storage file."""
    return settings.config_path


def _load_config() -> dict:
    """Load config from file."""
    path = _get_config_path()
    if path.exists():
        return json.loads(path.read_text())
    return {}


def _save_config(config: dict) -> None:
    """Save config to file and invalidate the resume router's cache."""
    path = _get_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config, indent=2))
    invalidate_config_cache()


def _mask_api_key(key: str) -> str:
    """Mask API key for display."""
    if not key:
        return ""
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "*" * (len(key) - 8) + key[-4:]


def _get_prompt_options() -> list[PromptOption]:
    """Return available prompt options for resume tailoring."""
    return [PromptOption(**option) for option in IMPROVE_PROMPT_OPTIONS]


def _get_feature_bool(stored: dict, key: str, default: bool = False) -> bool:
    """Resolve feature toggles while preserving explicit saved false values."""
    return bool(stored[key]) if key in stored else default


def _get_date_display(stored: dict, key: str = "default_date_display") -> str:
    """Resolve output date display defaults with a month/year fallback."""
    value = stored.get(key)
    return value if value in {"month-year", "year-only"} else "month-year"


def _get_output_bool(stored: dict, key: str, default: bool) -> bool:
    """Resolve output toggles while preserving explicit saved false values."""
    return bool(stored[key]) if key in stored else default


def _deep_merge_template_settings(*settings: dict | None) -> dict:
    """Merge template settings while preserving nested defaults."""
    merged = json.loads(json.dumps(DEFAULT_RESUME_TEMPLATE_SETTINGS))
    for patch in settings:
        if not isinstance(patch, dict):
            continue
        for key, value in patch.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key].update(value)
            else:
                merged[key] = value
    return merged


def _get_default_template_settings(stored: dict) -> dict:
    """Resolve complete resume template defaults from stored output config."""
    raw_template_settings = stored.get("default_template_settings")
    template_settings = _deep_merge_template_settings(
        raw_template_settings if isinstance(raw_template_settings, dict) else None
    )

    # Legacy top-level fields remain authoritative when present.
    if "default_date_display" in stored:
        template_settings["dateDisplay"] = _get_date_display(stored)
    if "default_fit_one_page" in stored:
        template_settings["fitOnePage"] = _get_output_bool(
            stored, "default_fit_one_page", True
        )

    validated = ResumeTemplateSettings.model_validate(template_settings).model_dump(
        exclude_none=True
    )
    return _deep_merge_template_settings(validated)


def _sync_output_defaults(stored: dict, template_settings: dict) -> None:
    """Persist complete template defaults and legacy top-level mirrors."""
    normalized = _deep_merge_template_settings(
        ResumeTemplateSettings.model_validate(template_settings).model_dump(
            exclude_none=True
        )
    )
    stored["default_template_settings"] = normalized
    stored["default_date_display"] = normalized["dateDisplay"]
    stored["default_fit_one_page"] = normalized["fitOnePage"]


def _get_extension_prompts_root() -> Path:
    """Return the backend-owned path containing extension prompt defaults."""
    return Path(__file__).resolve().parents[1] / "prompts" / "extension_defaults"


def _read_extension_prompt_file(relative_path: str) -> str:
    """Read an extension prompt artifact from the repo."""
    return (_get_extension_prompts_root() / relative_path).read_text()


def _get_extension_prompt_profile_paths() -> dict[str, dict[str, str]]:
    """Return backend-owned prompt-body defaults for each extension prompt profile."""
    return {
        "profile1": {
            "prompt1": "prompt1.txt",
            "prompt2": "prompt2.txt",
            "prompt3": "prompt3.txt",
            "systemPrompt": "system-prompt.txt",
        },
        "profile2": {
            "prompt1": "profiles/profile2/prompt1.txt",
            "prompt2": "profiles/profile2/prompt2.txt",
            "prompt3": "profiles/profile2/prompt3.txt",
            "systemPrompt": "system-prompt.txt",
        },
        "profile3": {
            "prompt1": "profiles/profile3/prompt1.txt",
            "prompt2": "profiles/profile3/prompt2.txt",
            "prompt3": "profiles/profile3/prompt3.txt",
            "systemPrompt": "system-prompt.txt",
        },
        "profile4": {
            "prompt3": "profiles/profile4/prompt3.txt",
        },
    }


def _get_extension_prompt_artifacts() -> dict[str, str]:
    """Build the full extension prompt artifact map."""
    artifacts = {
        "prompt1.template": _read_extension_prompt_file("prompt1.txt"),
        "prompt1.output_contract": _read_extension_prompt_file(
            "patches/prompt1.output-contract.txt"
        ),
        "prompt2.template": _read_extension_prompt_file("prompt2.txt"),
        "prompt2.output_contract": _read_extension_prompt_file(
            "patches/prompt2.output-contract.txt"
        ),
        "prompt3.template": _read_extension_prompt_file("prompt3.txt"),
        "prompt3.output_contract": _read_extension_prompt_file(
            "patches/prompt3.output-contract.txt"
        ),
        "prompt4.template": _read_extension_prompt_file("prompt4.txt"),
        "prompt4.output_contract": _read_extension_prompt_file(
            "patches/prompt4.output-contract.txt"
        ),
        "system.template": _read_extension_prompt_file("system-prompt.txt"),
        "system.guardrails": _read_extension_prompt_file(
            "patches/system.guardrails.txt"
        ),
    }
    for profile_id, template_paths in _get_extension_prompt_profile_paths().items():
        for template_name, relative_path in template_paths.items():
            artifacts[f"{profile_id}.{template_name}.template"] = (
                _read_extension_prompt_file(relative_path)
            )
    return artifacts


def _hash_prompt_artifact(content: str) -> str:
    """Hash prompt artifact content for sync comparisons."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def _log_llm_health_check(config: LLMConfig) -> None:
    """Run a best-effort health check and log outcome without affecting API responses."""
    try:
        health = await check_llm_health(config)
        if not health.get("healthy", False):
            logging.warning(
                "LLM config saved but health check failed",
                extra={"provider": config.provider, "model": config.model},
            )
    except Exception:
        logging.exception(
            "LLM config saved but health check raised exception",
            extra={"provider": config.provider, "model": config.model},
        )


def _decrypt_user_api_key(encrypted_api_key: str | None) -> str:
    if not encrypted_api_key:
        return ""
    try:
        return decrypt_api_key(encrypted_api_key)
    except LLMConfigEncryptionError:
        logging.exception("Failed to decrypt saved user LLM API key")
        return ""


def _user_config_has_effective_key(user_config: dict | None) -> bool:
    """Return true when the user has their own usable LLM key saved."""
    if not user_config:
        return False
    return bool(user_config.get("encrypted_api_key"))


@router.get("/llm-api-key", response_model=LLMConfigResponse)
async def get_llm_config_endpoint(
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> LLMConfigResponse:
    """Get current user's LLM configuration (API key masked)."""
    user_config = db.get_user_llm_config(current_user.user_id)
    config = get_llm_config(current_user.user_id)
    has_user_key = _user_config_has_effective_key(user_config)
    user_api_key = (
        _decrypt_user_api_key(user_config.get("encrypted_api_key"))
        if user_config and has_user_key
        else ""
    )
    return LLMConfigResponse(
        provider=config.provider,
        model=config.model,
        api_key=_mask_api_key(user_api_key),
        api_base=config.api_base,
        is_user_config=has_user_key,
    )


@router.put("/llm-api-key", response_model=LLMConfigResponse)
async def update_llm_config(
    request: LLMConfigRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> LLMConfigResponse:
    """Update LLM configuration.

    Saves the configuration and returns it (API key masked).

    Note: We intentionally do NOT hard-fail the update based on a live health check.
    Users may configure proxies/aggregators or temporarily unavailable endpoints and
    still need to persist the configuration. Connectivity can be verified via
    `/config/llm-test` and the System Status panel.
    """
    existing = db.get_user_llm_config(current_user.user_id)
    fallback = get_llm_config(current_user.user_id)
    existing_provider = str(existing["provider"]) if existing else fallback.provider

    resolved_provider = request.provider or (
        existing_provider
    )
    resolved_model = request.model or (
        str(existing["model"]) if existing else fallback.model
    )
    if resolved_provider == "vertex_ai":
        raise HTTPException(
            status_code=400,
            detail=(
                "Vertex AI is configured on the backend for shared use and cannot "
                "be saved as a per-user provider yet."
            ),
        )
    provider_changed = bool(request.provider and request.provider != existing_provider)
    if request.api_base is not None:
        resolved_api_base = request.api_base
    elif provider_changed:
        resolved_api_base = None
    else:
        resolved_api_base = existing.get("api_base") if existing else fallback.api_base

    encrypted_api_key = existing.get("encrypted_api_key") if existing else None
    if request.api_key is not None:
        api_key = request.api_key.strip()
        if api_key:
            try:
                encrypted_api_key = encrypt_api_key(api_key)
            except LLMConfigEncryptionError as exc:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Server is not configured to save API keys securely. "
                        "Please contact support."
                    ),
                ) from exc
        else:
            encrypted_api_key = None

    saved = db.upsert_user_llm_config(
        user_id=current_user.user_id,
        provider=resolved_provider,
        model=resolved_model,
        api_base=resolved_api_base,
        encrypted_api_key=encrypted_api_key,
    )

    test_config = LLMConfig(
        provider=str(saved["provider"]),
        model=str(saved["model"]),
        api_key=_decrypt_user_api_key(saved.get("encrypted_api_key")),
        api_base=saved.get("api_base"),
        is_user_config=True,
    )

    # Best-effort health check for server-side logs/diagnostics (do not block response).
    background_tasks.add_task(_log_llm_health_check, test_config)

    return LLMConfigResponse(
        provider=test_config.provider,
        model=test_config.model,
        api_key=_mask_api_key(test_config.api_key),
        api_base=test_config.api_base,
        is_user_config=bool(test_config.api_key),
    )


@router.post("/llm-test")
async def test_llm_connection(
    request: LLMConfigRequest | None = None,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> dict:
    """Test LLM connection with provided or stored configuration.

    If request body is provided, tests with those values (for pre-save testing).
    Otherwise, tests with the currently saved configuration.
    """
    base_config = get_llm_config(current_user.user_id)

    # Build config: use request values if provided, otherwise fall back to stored/default
    test_provider = (
        request.provider
        if request and request.provider
        else base_config.provider
    )
    if request and request.api_key is not None:
        test_api_key = request.api_key
    elif request and request.provider and request.provider != base_config.provider:
        test_api_key = ""
    else:
        test_api_key = base_config.api_key

    config = LLMConfig(
        provider=test_provider,
        model=(
            request.model
            if request and request.model
            else base_config.model
        ),
        api_key=test_api_key,
        api_base=(
            request.api_base
            if request and request.api_base is not None
            else base_config.api_base
        ),
        is_user_config=bool((request and request.api_key) or base_config.is_user_config),
    )

    test_prompt = "Hi"
    return await check_llm_health(config, include_details=True, test_prompt=test_prompt)


@router.get("/features", response_model=FeatureConfigResponse)
async def get_feature_config() -> FeatureConfigResponse:
    """Get current feature configuration."""
    stored = _load_config()

    return FeatureConfigResponse(
        enable_cover_letter=_get_feature_bool(stored, "enable_cover_letter"),
        enable_outreach_message=_get_feature_bool(stored, "enable_outreach_message"),
        preserve_generated_resume_facts=stored.get(
            "preserve_generated_resume_facts", True
        ),
    )


@router.put("/features", response_model=FeatureConfigResponse)
async def update_feature_config(request: FeatureConfigRequest) -> FeatureConfigResponse:
    """Update feature configuration."""
    stored = _load_config()

    # Update only provided fields
    if request.enable_cover_letter is not None:
        stored["enable_cover_letter"] = request.enable_cover_letter
    if request.enable_outreach_message is not None:
        stored["enable_outreach_message"] = request.enable_outreach_message
    if request.preserve_generated_resume_facts is not None:
        stored["preserve_generated_resume_facts"] = (
            request.preserve_generated_resume_facts
        )

    # Save config
    _save_config(stored)

    return FeatureConfigResponse(
        enable_cover_letter=_get_feature_bool(stored, "enable_cover_letter"),
        enable_outreach_message=_get_feature_bool(stored, "enable_outreach_message"),
        preserve_generated_resume_facts=stored.get(
            "preserve_generated_resume_facts", True
        ),
    )


@router.get("/output", response_model=OutputConfigResponse)
async def get_output_config() -> OutputConfigResponse:
    """Get current resume output defaults."""
    stored = _load_config()
    default_template_settings = _get_default_template_settings(stored)
    return OutputConfigResponse(
        default_date_display=default_template_settings["dateDisplay"],
        default_fit_one_page=default_template_settings["fitOnePage"],
        default_template_settings=default_template_settings,
    )


@router.put("/output", response_model=OutputConfigResponse)
async def update_output_config(request: OutputConfigRequest) -> OutputConfigResponse:
    """Update resume output defaults."""
    stored = _load_config()
    default_template_settings = _get_default_template_settings(stored)

    if request.default_template_settings is not None:
        default_template_settings = _deep_merge_template_settings(
            default_template_settings,
            request.default_template_settings.model_dump(exclude_none=True),
        )

    if request.default_date_display is not None:
        default_template_settings["dateDisplay"] = request.default_date_display
    if request.default_fit_one_page is not None:
        default_template_settings["fitOnePage"] = request.default_fit_one_page

    _sync_output_defaults(stored, default_template_settings)

    _save_config(stored)
    default_template_settings = _get_default_template_settings(stored)
    return OutputConfigResponse(
        default_date_display=default_template_settings["dateDisplay"],
        default_fit_one_page=default_template_settings["fitOnePage"],
        default_template_settings=default_template_settings,
    )


# Supported languages for i18n and generated content.
SUPPORTED_LANGUAGES = ["en"]


@router.get("/language", response_model=LanguageConfigResponse)
async def get_language_config() -> LanguageConfigResponse:
    """Get current language configuration."""
    stored = _load_config()

    return LanguageConfigResponse(
        ui_language="en",
        content_language="en",
        supported_languages=SUPPORTED_LANGUAGES,
    )


@router.put("/language", response_model=LanguageConfigResponse)
async def update_language_config(
    request: LanguageConfigRequest,
) -> LanguageConfigResponse:
    """Update language configuration."""
    stored = _load_config()

    # Validate and update UI language
    if request.ui_language is not None:
        if request.ui_language not in SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported UI language: {request.ui_language}. Supported: {SUPPORTED_LANGUAGES}",
            )
        stored["ui_language"] = request.ui_language

    # Validate and update content language
    if request.content_language is not None:
        if request.content_language not in SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported content language: {request.content_language}. Supported: {SUPPORTED_LANGUAGES}",
            )
        stored["content_language"] = request.content_language

    # Save config
    _save_config(stored)

    return LanguageConfigResponse(
        ui_language="en",
        content_language="en",
        supported_languages=SUPPORTED_LANGUAGES,
    )


@router.get("/prompts", response_model=PromptConfigResponse)
async def get_prompt_config() -> PromptConfigResponse:
    """Get current prompt configuration for resume tailoring."""
    stored = _load_config()
    options = _get_prompt_options()
    option_ids = {option.id for option in options}
    default_prompt_id = stored.get("default_prompt_id", DEFAULT_IMPROVE_PROMPT_ID)
    if default_prompt_id not in option_ids:
        default_prompt_id = DEFAULT_IMPROVE_PROMPT_ID

    return PromptConfigResponse(
        default_prompt_id=default_prompt_id,
        prompt_options=options,
    )


@router.put("/prompts", response_model=PromptConfigResponse)
async def update_prompt_config(
    request: PromptConfigRequest,
) -> PromptConfigResponse:
    """Update prompt configuration for resume tailoring."""
    stored = _load_config()
    options = _get_prompt_options()
    option_ids = {option.id for option in options}

    if request.default_prompt_id is not None:
        if request.default_prompt_id not in option_ids:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Unsupported prompt id: "
                    f"{request.default_prompt_id}. Supported: {sorted(option_ids)}"
                ),
            )
        stored["default_prompt_id"] = request.default_prompt_id

    _save_config(stored)

    default_prompt_id = stored.get("default_prompt_id", DEFAULT_IMPROVE_PROMPT_ID)
    if default_prompt_id not in option_ids:
        default_prompt_id = DEFAULT_IMPROVE_PROMPT_ID

    return PromptConfigResponse(
        default_prompt_id=default_prompt_id,
        prompt_options=options,
    )


@router.post(
    "/extension-prompts/sync",
    response_model=ExtensionPromptSyncResponse,
)
async def sync_extension_prompts(
    request: ExtensionPromptSyncRequest,
) -> ExtensionPromptSyncResponse:
    """Return only the extension prompt artifacts that changed."""
    artifacts = _get_extension_prompt_artifacts()
    manifest = {
        artifact_key: _hash_prompt_artifact(content)
        for artifact_key, content in artifacts.items()
    }
    local_manifest = request.manifest if isinstance(request.manifest, dict) else {}
    changed = {
        artifact_key: content
        for artifact_key, content in artifacts.items()
        if local_manifest.get(artifact_key) != manifest[artifact_key]
    }
    removed = sorted(
        artifact_key
        for artifact_key in local_manifest
        if artifact_key not in manifest
    )

    return ExtensionPromptSyncResponse(
        changed=changed,
        removed=removed,
        manifest=manifest,
    )


# Supported API key providers
SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "openrouter", "deepseek"]
API_KEY_PROVIDER_TO_LLM_PROVIDER = {
    "openai": "openai",
    "anthropic": "anthropic",
    "google": "gemini",
    "openrouter": "openrouter",
    "deepseek": "deepseek",
}


def _mask_key_short(key: str | None) -> str | None:
    """Mask API key showing only last 4 characters."""
    if not key:
        return None
    if len(key) <= 4:
        return "*" * len(key)
    return "..." + key[-4:]


@router.get("/api-keys", response_model=ApiKeyStatusResponse)
async def get_api_keys_status(
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ApiKeyStatusResponse:
    """Get status of the current user's saved API keys across all providers."""
    user_config = db.get_user_llm_config(current_user.user_id)
    configured_provider = str(user_config.get("provider")) if user_config else ""
    configured_key = _decrypt_user_api_key(
        user_config.get("encrypted_api_key") if user_config else None
    )
    extra_api_keys: dict = user_config.get("extra_api_keys", {}) if user_config else {}

    providers = []
    for provider in SUPPORTED_PROVIDERS:
        llm_provider = API_KEY_PROVIDER_TO_LLM_PROVIDER.get(provider, provider)
        # Primary key: primary encrypted_api_key matches this provider
        primary_key = configured_key if llm_provider == configured_provider else ""
        # Extra key: stored in extra_api_keys dict under provider name
        extra_encrypted = extra_api_keys.get(provider, "")
        extra_key = _decrypt_user_api_key(extra_encrypted) if extra_encrypted else ""
        # Use whichever is available for display; extra_keys take precedence for multi-key display
        display_key = extra_key or primary_key
        providers.append(
            ApiKeyProviderStatus(
                provider=provider,
                configured=bool(display_key),
                masked_key=_mask_key_short(display_key),
            )
        )

    return ApiKeyStatusResponse(providers=providers)


@router.post("/api-keys", response_model=ApiKeysUpdateResponse)
async def update_api_keys(
    request: ApiKeysUpdateRequest,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> ApiKeysUpdateResponse:
    """Save API keys for one or more providers, stored per-user."""
    keys_to_store: dict[str, str] = {}
    updated: list[str] = []

    for provider, key_value in request.model_dump(exclude_none=True).items():
        trimmed = (key_value or "").strip()
        if trimmed:
            keys_to_store[provider] = encrypt_api_key(trimmed)
            updated.append(provider)

    if keys_to_store:
        db.upsert_user_extra_api_keys(user_id=current_user.user_id, keys=keys_to_store)

    return ApiKeysUpdateResponse(
        message="API keys saved.",
        updated_providers=updated,
    )


@router.delete("/api-keys")
async def delete_all_api_keys(
    confirm: str | None = None,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> dict:
    """Clear the current user's saved API key.

    This is a destructive operation. Requires confirmation token.

    Args:
        confirm: Must be "CLEAR_ALL_KEYS" to execute

    Returns:
        Success message
    """
    if confirm != "CLEAR_ALL_KEYS":
        raise HTTPException(
            status_code=400,
            detail="Confirmation required. Pass confirm=CLEAR_ALL_KEYS query parameter.",
        )
    if db.get_user_llm_config(current_user.user_id):
        db.clear_user_llm_api_key(current_user.user_id)
    return {"message": "Your saved API key has been cleared"}


@router.delete("/api-keys/{provider}")
async def delete_api_key(
    provider: str,
    current_user: AuthenticatedUser = Depends(require_current_user),
) -> dict:
    """Delete the current user's saved API key for a specific provider.

    Clears from both the primary encrypted_api_key (if it belongs to this
    provider) and from extra_api_keys.

    Args:
        provider: The provider name (openai, anthropic, google, openrouter, deepseek)

    Returns:
        Success message
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported provider: {provider}. Supported: {SUPPORTED_PROVIDERS}",
        )

    user_config = db.get_user_llm_config(current_user.user_id)
    if user_config:
        # Clear primary key if it belongs to this provider
        provider_matches = (
            API_KEY_PROVIDER_TO_LLM_PROVIDER.get(provider, provider)
            == str(user_config.get("provider"))
        )
        if provider_matches and user_config.get("encrypted_api_key"):
            db.clear_user_llm_api_key(current_user.user_id)

        # Always clear from extra_api_keys
        db.delete_user_extra_api_key(user_id=current_user.user_id, provider_key=provider)

    return {"message": f"Your saved API key for {provider} has been cleared"}


@router.get("/apify-key")
async def get_apify_key() -> dict:
    """Get the stored Apify API token (masked)."""
    stored = _load_config()
    token = str(stored.get("apify_api_token", ""))
    return {"api_key": _mask_api_key(token), "configured": bool(token)}


@router.put("/apify-key")
async def update_apify_key(request: dict) -> dict:
    """Save the Apify API token to config storage."""
    api_key = str(request.get("api_key", "")).strip()
    stored = _load_config()
    if api_key:
        stored["apify_api_token"] = api_key
    else:
        stored.pop("apify_api_token", None)
    _save_config(stored)
    token = str(stored.get("apify_api_token", ""))
    return {"api_key": _mask_api_key(token), "configured": bool(token)}


@router.get("/llm-stage-config")
async def get_llm_stage_config(template: bool = False) -> dict:
    """Return the active LLM stage config YAML and whether an override is in use.

    Pass ?template=true to always get the bundled default regardless of any override.
    """
    content = read_default_config() if template else read_active_config()
    return {
        "content": content,
        "is_override": False if template else is_using_override(),
    }


@router.put("/llm-stage-config")
async def upload_llm_stage_config(file: UploadFile = File(...)) -> dict:
    """Upload a YAML file to override the bundled LLM stage config."""
    if file.content_type not in {"application/x-yaml", "text/yaml", "text/plain", "application/octet-stream"}:
        # be lenient — browsers may send application/octet-stream for .yaml
        pass
    content = (await file.read()).decode("utf-8")
    try:
        save_override(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "LLM stage config updated", "is_override": True}


@router.delete("/llm-stage-config")
async def reset_llm_stage_config() -> dict:
    """Remove the override and revert to the bundled default config."""
    deleted = delete_override()
    return {"message": "Override removed" if deleted else "No override was active", "is_override": False}


@router.post("/reset")
async def reset_database_endpoint() -> dict[str, str]:
    """Reject global database resets from the user-facing app."""
    raise HTTPException(
        status_code=410,
        detail=(
            "Global database reset is disabled. Delete user-owned resumes "
            "individually or use a dedicated user data deletion flow."
        ),
    )
