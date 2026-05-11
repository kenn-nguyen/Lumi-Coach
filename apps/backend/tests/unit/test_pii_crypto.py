"""Tests for write-forward PII encryption helpers."""

from __future__ import annotations

import pytest

from app.config import settings
from app.pii_crypto import (
    JSON_MARKER_KEY,
    TEXT_PREFIX,
    decrypt_json,
    decrypt_text,
    encrypt_json,
    encrypt_text,
    hash_lookup,
    is_encrypted_json,
    is_encrypted_text,
)


@pytest.fixture(autouse=True)
def pii_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "pii_encryption_key", "test-pii-secret")
    monkeypatch.setattr(settings, "pii_hash_key", "test-pii-hash-secret")


def test_encrypt_text_marks_and_round_trips_value() -> None:
    encrypted = encrypt_text("jane@example.com")

    assert encrypted is not None
    assert encrypted.startswith(TEXT_PREFIX)
    assert encrypted != "jane@example.com"
    assert is_encrypted_text(encrypted)
    assert decrypt_text(encrypted) == "jane@example.com"


def test_decrypt_text_leaves_legacy_plaintext_readable() -> None:
    assert decrypt_text("legacy@example.com") == "legacy@example.com"
    assert decrypt_text(None) is None


def test_encrypt_json_uses_marker_object_and_round_trips() -> None:
    payload = {
        "personalInfo": {
            "name": "Jane Doe",
            "email": "jane@example.com",
        }
    }

    encrypted = encrypt_json(payload)

    assert is_encrypted_json(encrypted)
    assert encrypted[JSON_MARKER_KEY].startswith(TEXT_PREFIX)
    assert "Jane Doe" not in str(encrypted)
    assert decrypt_json(encrypted) == payload


def test_decrypt_json_leaves_legacy_json_readable() -> None:
    legacy = {"summary": "Plain legacy payload"}

    assert decrypt_json(legacy) == legacy
    assert decrypt_json(None) is None


def test_hash_lookup_is_stable_case_insensitive_and_keyed() -> None:
    assert hash_lookup("Jane@Example.com") == hash_lookup(" jane@example.com ")
    assert hash_lookup("jane@example.com") != hash_lookup("other@example.com")
    assert "jane@example.com" not in hash_lookup("jane@example.com")
