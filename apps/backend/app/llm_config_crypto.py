"""Encryption helpers for user-scoped LLM API keys."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


class LLMConfigEncryptionError(RuntimeError):
    """Raised when LLM config encryption is unavailable or decryption fails."""


def _get_fernet() -> Fernet:
    secret = settings.llm_config_encryption_key.strip()
    if not secret:
        raise LLMConfigEncryptionError("LLM_CONFIG_ENCRYPTION_KEY is not configured")

    # Derive the Fernet key from a deploy-provided secret so operators can use
    # any high-entropy string instead of hand-formatting a Fernet key.
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key for database storage."""
    value = api_key.strip()
    if not value:
        return ""
    token = _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")
    return f"fernet:{token}"


def decrypt_api_key(encrypted_api_key: str | None) -> str:
    """Decrypt an API key from database storage."""
    if not encrypted_api_key:
        return ""

    token = encrypted_api_key
    if token.startswith("fernet:"):
        token = token.removeprefix("fernet:")

    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise LLMConfigEncryptionError("Stored LLM API key could not be decrypted") from exc
