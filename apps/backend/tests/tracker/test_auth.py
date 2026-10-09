"""Access rules, including the guards on the development bypass."""

from __future__ import annotations

import importlib

import pytest

import app.tracker.auth as auth


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch):
    for key in ("TRACKER_DEV_NO_AUTH", "ENVIRONMENT", "RENDER", "RENDER_SERVICE_ID",
                "KUBERNETES_SERVICE_HOST", "DYNO", "TRACKER_OWNER_EMAIL"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("TRACKER_OWNER_EMAIL", "owner@example.com")
    importlib.reload(auth)
    yield
    importlib.reload(auth)


@pytest.mark.unit
def test_bypass_is_off_unless_asked_for() -> None:
    assert auth.dev_bypass_enabled() is False


@pytest.mark.unit
def test_bypass_needs_the_flag_and_a_dev_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TRACKER_DEV_NO_AUTH", "1")
    monkeypatch.setenv("ENVIRONMENT", "development")
    assert auth.dev_bypass_enabled() is True
    monkeypatch.setenv("ENVIRONMENT", "production")
    assert auth.dev_bypass_enabled() is False


@pytest.mark.unit
@pytest.mark.parametrize("marker", ["RENDER", "RENDER_SERVICE_ID", "KUBERNETES_SERVICE_HOST", "DYNO"])
def test_a_deployed_host_refuses_the_bypass_even_if_the_flag_is_left_on(
    monkeypatch: pytest.MonkeyPatch, marker: str
) -> None:
    """The flag being set by mistake must not open a real deployment."""
    monkeypatch.setenv("TRACKER_DEV_NO_AUTH", "1")
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv(marker, "srv-abc123")
    assert auth.dev_bypass_enabled() is False


@pytest.mark.unit
def test_only_the_owning_account_gets_in() -> None:
    """One account holds the data; the helper signs in as it, nobody else gets in."""
    owner = auth.classify("Owner@Example.com")
    assert owner is not None, "the owner email is matched regardless of case"
    assert owner.user_id == "owner"

    for stranger in ("stranger@example.com", "helper@example.com", ""):
        assert auth.classify(stranger) is None, f"{stranger!r} should have no access"


@pytest.mark.unit
def test_only_listed_hosts_count_as_local() -> None:
    class Req:
        def __init__(self, host: str) -> None:
            self.headers = {"host": host}

    assert auth._host_is_local(Req("localhost:3000"))
    assert auth._host_is_local(Req("127.0.0.1:8000"))
    assert auth._host_is_local(Req("app.localhost"))
    assert not auth._host_is_local(Req("tracker.onrender.com"))
    assert not auth._host_is_local(Req("evil.com"))
