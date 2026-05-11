"""Write-forward encryption helpers for stored user PII.

Legacy plaintext values remain readable. New writes are wrapped with a stable
marker so serializers can decrypt only values that were encrypted by this app.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

TEXT_PREFIX = "pii:v1:"
JSON_MARKER_KEY = "__pii_encrypted__"


class PIIEncryptionError(RuntimeError):
    """Raised when PII encryption is unavailable or encrypted data is invalid."""


def _get_secret() -> str:
    secret = (
        settings.pii_encryption_key.strip()
        or settings.llm_config_encryption_key.strip()
    )
    if not secret:
        raise PIIEncryptionError("PII_ENCRYPTION_KEY is not configured")
    return secret


def _get_hash_secret() -> str:
    secret = (
        settings.pii_hash_key.strip()
        or settings.pii_encryption_key.strip()
        or settings.llm_config_encryption_key.strip()
    )
    if not secret:
        raise PIIEncryptionError("PII_HASH_KEY is not configured")
    return secret


def _get_fernet() -> Fernet:
    digest = hashlib.sha256(_get_secret().encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def is_encrypted_text(value: Any) -> bool:
    """Return whether a scalar value uses the PII encryption marker."""
    return isinstance(value, str) and value.startswith(TEXT_PREFIX)


def is_encrypted_json(value: Any) -> bool:
    """Return whether a JSON value is an encrypted marker object."""
    return (
        isinstance(value, dict)
        and set(value.keys()) == {JSON_MARKER_KEY}
        and is_encrypted_text(value.get(JSON_MARKER_KEY))
    )


def encrypt_text(value: str | None) -> str | None:
    """Encrypt a string for write-forward database storage."""
    if value is None:
        return None
    if is_encrypted_text(value):
        return value
    if value == "":
        return ""
    token = _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{TEXT_PREFIX}{token}"


def decrypt_text(value: str | None) -> str | None:
    """Decrypt marked strings while leaving legacy plaintext untouched."""
    if value is None:
        return None
    if not is_encrypted_text(value):
        return value

    token = value.removeprefix(TEXT_PREFIX)
    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise PIIEncryptionError("Stored PII value could not be decrypted") from exc


def encrypt_json(value: Any) -> Any:
    """Encrypt JSON-compatible values for database storage."""
    if value is None or is_encrypted_json(value):
        return value
    if value == {} or value == []:
        return value

    serialized = json.dumps(value, separators=(",", ":"), sort_keys=True)
    encrypted = encrypt_text(serialized)
    return {JSON_MARKER_KEY: encrypted}


def decrypt_json(value: Any) -> Any:
    """Decrypt marked JSON values while leaving legacy JSON untouched."""
    if not is_encrypted_json(value):
        return value

    decrypted = decrypt_text(value[JSON_MARKER_KEY])
    if not decrypted:
        return None
    try:
        return json.loads(decrypted)
    except json.JSONDecodeError as exc:
        raise PIIEncryptionError("Stored PII JSON could not be decoded") from exc


def hash_lookup(value: str) -> str:
    """Create a deterministic keyed lookup hash for encrypted identifiers."""
    normalized = value.strip().lower()
    if not normalized:
        return ""
    return hmac.new(
        _get_hash_secret().encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
