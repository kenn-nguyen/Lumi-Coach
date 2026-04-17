"""Backend bearer token verification and request-scoped user context."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from contextvars import ContextVar
from dataclasses import dataclass
from time import time
from typing import Any

from fastapi import Depends, Header, HTTPException, status

from app.config import settings
from app.database import db

_current_user_id: ContextVar[str | None] = ContextVar("current_user_id", default=None)


@dataclass
class AuthenticatedUser:
    user_id: str
    email: str
    name: str | None = None
    picture: str | None = None


def _base64url_decode(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _sign(signing_input: str, secret: str) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return _base64url_encode(digest)


def create_backend_access_token_for_user(user: AuthenticatedUser) -> tuple[str, int]:
    now = int(time())
    expires_at = now + settings.auth_token_ttl_seconds
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "iss": settings.auth_token_issuer,
        "aud": settings.auth_token_audience,
        "iat": now,
        "exp": expires_at,
    }
    encoded_header = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = _base64url_encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    )
    signing_input = f"{encoded_header}.{encoded_payload}"
    signature = _sign(signing_input, settings.auth_shared_secret)
    return f"{signing_input}.{signature}", expires_at


def _decode_backend_token(token: str) -> dict[str, Any]:
    try:
        encoded_header, encoded_payload, signature = token.split(".")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        ) from exc

    expected_signature = _sign(
        f"{encoded_header}.{encoded_payload}",
        settings.auth_shared_secret,
    )
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token signature",
        )

    try:
        payload = json.loads(_base64url_decode(encoded_payload).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token payload",
        ) from exc

    if payload.get("iss") != settings.auth_token_issuer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token issuer",
        )
    if payload.get("aud") != settings.auth_token_audience:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token audience",
        )

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp <= int(time()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expired bearer token",
        )

    if not payload.get("sub") or not payload.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token subject",
        )

    return payload


async def require_current_user(
    authorization: str | None = Header(default=None),
) -> AuthenticatedUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = authorization.removeprefix("Bearer ").strip()
    payload = _decode_backend_token(token)
    user = AuthenticatedUser(
        user_id=str(payload["sub"]),
        email=str(payload["email"]),
        name=str(payload.get("name") or "") or None,
        picture=str(payload.get("picture") or "") or None,
    )

    stored_user = db.upsert_user(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
    )
    resolved_user = AuthenticatedUser(
        user_id=str(stored_user["user_id"]),
        email=str(stored_user["email"]),
        name=stored_user.get("name"),
        picture=stored_user.get("picture"),
    )
    _current_user_id.set(resolved_user.user_id)
    return resolved_user


def get_current_user_id() -> str | None:
    return _current_user_id.get()
