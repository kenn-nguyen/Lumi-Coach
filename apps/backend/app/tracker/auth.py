"""Who may use the tracker.

One account. The owner and their helper work the same queue from the same login,
exactly as they shared one Google Sheet, so there is no second role to grant and
nothing to keep one of them out of.

A development bypass exists because the tracker has to be runnable headless — in
Docker, in tests, without a Google sign-in. It is deliberately hard to enable by
accident: it needs an explicit environment variable *and* a host that is plainly
local, and it refuses to start in anything that looks deployed.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0", "testserver", "tracker-tests"}

#: Set by Render and most hosts. Its presence means "this is not a dev box".
DEPLOY_MARKERS = ("RENDER", "RENDER_SERVICE_ID", "KUBERNETES_SERVICE_HOST", "DYNO")


@dataclass(frozen=True)
class TrackerUser:
    #: Always the same value: every row belongs to the one account. Kept as a
    #: column and a filter so the data is not stranded if that ever changes.
    user_id: str
    email: str


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def dev_bypass_enabled() -> bool:
    """Whether the no-login path may be used at all.

    Three conditions, all required. The deployment check is the important one: it
    means that even if the flag is left on by mistake, a real deployment ignores it.
    """
    if _env("TRACKER_DEV_NO_AUTH") not in ("1", "true", "TRUE", "yes"):
        return False
    if any(_env(marker) for marker in DEPLOY_MARKERS):
        return False
    return _env("ENVIRONMENT", "development").lower() in ("development", "dev", "local", "test")


def _host_is_local(request: Request) -> bool:
    host = (request.headers.get("host") or "").split(":")[0].strip().lower()
    return host in LOCAL_HOSTS or host.endswith(".localhost")


def _owner_email() -> str:
    return _env("TRACKER_OWNER_EMAIL", "owner@localhost").lower()


def classify(email: str) -> TrackerUser | None:
    """The signed-in account, or ``None`` if it is not the one that owns the data."""
    normalized = (email or "").strip().lower()
    if not normalized:
        return None
    if normalized == _owner_email():
        return TrackerUser(user_id="owner", email=normalized)
    return None


async def current_tracker_user(request: Request) -> TrackerUser:
    """Resolve the caller, honouring the dev bypass only where it is allowed."""
    if dev_bypass_enabled() and _host_is_local(request):
        return TrackerUser(user_id="owner", email=_owner_email())

    try:
        from app.security import require_current_user
    except Exception:  # pragma: no cover - only when the app's auth stack is absent
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign-in is not available")

    authenticated = await require_current_user(request.headers.get("authorization"))
    user = classify(authenticated.email)
    if user is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has no tracker access")
    return user
