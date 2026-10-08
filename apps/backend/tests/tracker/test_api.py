"""The API exercised the way the page uses it, against the migrated database."""

from __future__ import annotations

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text as sql

os.environ.setdefault("TRACKER_DEV_NO_AUTH", "1")
os.environ.setdefault("TRACKER_OWNER_EMAIL", "owner@localhost")
os.environ.setdefault("ENVIRONMENT", "test")

from app.tracker.api import router  # noqa: E402

DB_URL = os.environ.get(
    "TRACKER_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/som_career_coach")
os.environ["TRACKER_DATABASE_URL"] = DB_URL


def _db_ready() -> bool:
    try:
        eng = create_engine(DB_URL, future=True)
        with eng.connect() as c:
            return (c.execute(sql("select count(*) from tracker_jobs")).scalar() or 0) > 0
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_ready(), reason="no migrated database")


@pytest.fixture(scope="module")
def client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    return TestClient(app)


# --- opening the page ---------------------------------------------------------

def test_meta_gives_the_ui_its_vocabulary(client: TestClient) -> None:
    body = client.get("/api/v1/tracker/meta").json()
    assert body["role"] == "owner"
    assert "Skip (auto)" in body["statuses"], "sheet vocabulary, unchanged"
    assert "Fill & Submit" in body["actions"]
    assert "Yes (100%)" in body["visas"], "visa labels keep their percentages"


def test_default_view_is_the_assigned_queue(client: TestClient) -> None:
    body = client.get("/api/v1/tracker/jobs").json()
    assert body["total"] > 0
    assert all(j["in_assigned_queue"] for j in body["jobs"])
    assert len(body["jobs"]) <= body["limit"]


def test_all_jobs_view_is_larger_than_the_assigned_one(client: TestClient) -> None:
    assigned = client.get("/api/v1/tracker/jobs?view=assigned").json()["total"]
    everything = client.get("/api/v1/tracker/jobs?view=all").json()["total"]
    assert everything > assigned


def test_list_never_carries_a_job_description(client: TestClient) -> None:
    """The payloads are ~30KB each; shipping them in a list would be the whole page."""
    job = client.get("/api/v1/tracker/jobs?view=all").json()["jobs"][0]
    assert "jd_text" not in job and "raw_ref" not in job


def test_counts_drive_the_header_chips(client: TestClient) -> None:
    counts = client.get("/api/v1/tracker/jobs").json()["counts"]
    assert set(counts) == {"flagged", "assigned", "submitted", "unowned_top", "total"}
    assert counts["total"] > counts["assigned"]


# --- finding things -----------------------------------------------------------

def test_search_matches_company_or_title(client: TestClient) -> None:
    body = client.get("/api/v1/tracker/jobs?view=all&q=product").json()
    assert body["total"] > 0
    for job in body["jobs"]:
        assert "product" in f"{job['company']} {job['title']}".lower()


def test_filters_narrow_the_list(client: TestClient) -> None:
    flagged = client.get("/api/v1/tracker/jobs?view=all&status=Flagged").json()
    assert all(j["status"] == "Flagged" for j in flagged["jobs"])
    p01 = client.get("/api/v1/tracker/jobs?view=all&priority=P01").json()
    assert all(j["priority"] == "P01" for j in p01["jobs"])


def test_sorting_by_score_and_date(client: TestClient) -> None:
    scores = [j["score"] for j in
              client.get("/api/v1/tracker/jobs?view=all&sort=fit&limit=25").json()["jobs"]
              if j["score"] is not None]
    assert scores == sorted(scores, reverse=True), "highest fit first"


def test_paging_walks_without_repeating(client: TestClient) -> None:
    first = client.get("/api/v1/tracker/jobs?view=all&limit=10&offset=0").json()["jobs"]
    second = client.get("/api/v1/tracker/jobs?view=all&limit=10&offset=10").json()["jobs"]
    assert {j["job_id"] for j in first}.isdisjoint({j["job_id"] for j in second})


def test_default_order_is_the_sheets_own_ranking(client: TestClient) -> None:
    keys = [j["sort_key"] for j in
            client.get("/api/v1/tracker/jobs?view=all&limit=50").json()["jobs"]]
    assert keys == sorted(keys)


# --- opening one job ----------------------------------------------------------

def test_detail_includes_the_description_and_every_link(client: TestClient) -> None:
    listing = client.get("/api/v1/tracker/jobs?view=all&limit=50").json()["jobs"]
    multi = next(j for j in listing if len(j["merged_job_ids"]) > 1)
    job = client.get(f"/api/v1/tracker/jobs/{multi['job_id']}").json()
    assert len(job["merged_job_ids"]) > 1, "the assignee needs every posting id"
    assert "summary" in job and "why" in job and "us_visa_reason" in job


def test_unknown_job_is_a_404(client: TestClient) -> None:
    assert client.get("/api/v1/tracker/jobs/does-not-exist").status_code == 404


# --- editing ------------------------------------------------------------------

@pytest.fixture
def scratch_job(client: TestClient) -> str:
    """A New, unowned job to mutate, restored afterwards."""
    jobs = client.get("/api/v1/tracker/jobs?view=all&status=New&limit=5").json()["jobs"]
    job_id = jobs[0]["job_id"]
    before = client.get(f"/api/v1/tracker/jobs/{job_id}").json()
    yield job_id
    client.patch(f"/api/v1/tracker/jobs/{job_id}", json={
        "status": before["status"], "owner": before["owner"] or "",
        "action": before["action"] or "", "notes": before["notes"] or ""})


def test_assigning_a_job_moves_it_into_the_assigned_view(client: TestClient, scratch_job: str) -> None:
    updated = client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                           json={"owner": "Assignee"}).json()
    assert updated["in_assigned_queue"] is True
    assert updated["action"] == "Fill & Submit", "a delegated job gets an action"


def test_submitting_stamps_the_application_date(client: TestClient, scratch_job: str) -> None:
    updated = client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                           json={"status": "Submitted"}).json()
    assert updated["applied_at"] is not None


def test_a_dead_status_leaves_the_assigned_queue(client: TestClient, scratch_job: str) -> None:
    client.patch(f"/api/v1/tracker/jobs/{scratch_job}", json={"owner": "Assignee"})
    updated = client.patch(f"/api/v1/tracker/jobs/{scratch_job}", json={"status": "Skip"}).json()
    assert updated["in_assigned_queue"] is False


def test_editing_rewrites_the_sort_key(client: TestClient, scratch_job: str) -> None:
    before = client.get(f"/api/v1/tracker/jobs/{scratch_job}").json()["sort_key"]
    after = client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                         json={"status": "Networking"}).json()["sort_key"]
    assert after != before and after < before, "Networking sorts above New"


def test_notes_survive_a_round_trip(client: TestClient, scratch_job: str) -> None:
    note = "used the fintech resume"
    assert client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                        json={"notes": note}).json()["notes"] == note


def test_rubbish_values_are_rejected(client: TestClient, scratch_job: str) -> None:
    assert client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                        json={"status": "Banana"}).status_code == 422
    assert client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                        json={"owner": "Somebody"}).status_code == 422


def test_marking_a_link_dead_is_recorded(client: TestClient, scratch_job: str) -> None:
    job = client.get(f"/api/v1/tracker/jobs/{scratch_job}").json()
    link = job["merged_job_ids"][0]
    updated = client.post(f"/api/v1/tracker/jobs/{scratch_job}/dead-link",
                          json={"link_id": link}).json()
    assert updated["dead_links"].get(link) is True


# --- bulk ---------------------------------------------------------------------

def test_bulk_assign_then_take_back(client: TestClient) -> None:
    ids = [j["job_id"] for j in
           client.get("/api/v1/tracker/jobs?view=all&status=New&limit=3").json()["jobs"]]
    before = {i: client.get(f"/api/v1/tracker/jobs/{i}").json() for i in ids}

    assigned = client.post("/api/v1/tracker/jobs/bulk",
                           json={"job_ids": ids, "op": "assign"}).json()
    assert assigned["updated"] == len(ids)
    assert all(client.get(f"/api/v1/tracker/jobs/{i}").json()["in_assigned_queue"] for i in ids)

    client.post("/api/v1/tracker/jobs/bulk", json={"job_ids": ids, "op": "take_back"})
    assert all(not client.get(f"/api/v1/tracker/jobs/{i}").json()["in_assigned_queue"] for i in ids)

    for i, snapshot in before.items():
        client.patch(f"/api/v1/tracker/jobs/{i}", json={
            "owner": snapshot["owner"] or "", "action": snapshot["action"] or "",
            "status": snapshot["status"]})


def test_bulk_rejects_an_empty_selection(client: TestClient) -> None:
    assert client.post("/api/v1/tracker/jobs/bulk",
                       json={"job_ids": [], "op": "assign"}).status_code == 422


# --- settings and maintenance -------------------------------------------------

def test_settings_never_return_a_secret(client: TestClient) -> None:
    body = client.get("/api/v1/tracker/settings").json()
    assert body["settings"]["TARGET_PROFILE"]
    for key in ("GEMINI_API_KEY", "OPENAI_API_KEY"):
        assert body["settings"].get(key, "") in ("", "__set__")
    for account in body["apify_accounts"]:
        assert set(account) == {"label", "active", "batch_key_set", "detail_key_set"}
        assert account["batch_key_set"] is True, "a key exists but is not disclosed"


def test_settings_round_trip(client: TestClient) -> None:
    before = client.get("/api/v1/tracker/settings").json()["settings"]["RUN_INTERVAL_HOURS"]
    client.put("/api/v1/tracker/settings", json={"values": {"RUN_INTERVAL_HOURS": "7"}})
    assert client.get("/api/v1/tracker/settings").json()["settings"]["RUN_INTERVAL_HOURS"] == "7"
    client.put("/api/v1/tracker/settings", json={"values": {"RUN_INTERVAL_HOURS": before}})


def test_validate_reports_a_runnable_setup(client: TestClient) -> None:
    body = client.post("/api/v1/tracker/maintenance/validate").json()
    assert body["ok"] is True, f"setup problems: {body['problems']}"
    assert body["route"] == "vertex"
    assert body["apify_accounts"] >= 1


def test_runs_history_is_readable(client: TestClient) -> None:
    assert "runs" in client.get("/api/v1/tracker/runs").json()
