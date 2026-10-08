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


# --- what the assignee may not do --------------------------------------------

def test_the_assignee_cannot_reach_settings_or_reassign(monkeypatch: pytest.MonkeyPatch) -> None:
    """They share the rows, not the controls — as the sheet protects its tabs."""
    import app.tracker.auth as auth_module
    from app.tracker.auth import TrackerUser

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[auth_module.current_tracker_user] = lambda: TrackerUser(
        user_id="owner", email="helper@example.com", is_owner=False)
    helper = TestClient(app)

    assert helper.get("/api/v1/tracker/jobs").status_code == 200, "they still see the queue"
    for path in ("/api/v1/tracker/settings",):
        assert helper.get(path).status_code == 403
    assert helper.post("/api/v1/tracker/maintenance/reassign").status_code == 403
    assert helper.post("/api/v1/tracker/jobs/bulk",
                       json={"job_ids": ["1"], "op": "assign"}).status_code == 403

    job_id = helper.get("/api/v1/tracker/jobs").json()["jobs"][0]["job_id"]
    assert helper.patch(f"/api/v1/tracker/jobs/{job_id}",
                        json={"owner": "Me"}).status_code == 403, "cannot re-assign away"
    before = helper.get(f"/api/v1/tracker/jobs/{job_id}").json()["notes"] or ""
    assert helper.patch(f"/api/v1/tracker/jobs/{job_id}",
                        json={"notes": "on it"}).status_code == 200, "but can leave a note"
    helper.patch(f"/api/v1/tracker/jobs/{job_id}", json={"notes": before})


# --- flagging ----------------------------------------------------------------

def test_flagging_without_a_reason_is_refused(client: TestClient, scratch_job: str) -> None:
    """A flag hands the job back to the owner; without a reason it is just noise."""
    client.patch(f"/api/v1/tracker/jobs/{scratch_job}", json={"notes": ""})
    refused = client.patch(f"/api/v1/tracker/jobs/{scratch_job}", json={"status": "Flagged"})
    assert refused.status_code == 422
    assert "note" in refused.json()["detail"].lower()
    assert client.get(f"/api/v1/tracker/jobs/{scratch_job}").json()["status"] != "Flagged"


def test_flagging_works_when_the_note_comes_with_it(client: TestClient, scratch_job: str) -> None:
    updated = client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                           json={"status": "Flagged", "notes": "form wants a portfolio URL"}).json()
    assert updated["status"] == "Flagged"
    assert updated["notes"] == "form wants a portfolio URL"


def test_flagging_works_when_a_note_is_already_there(client: TestClient, scratch_job: str) -> None:
    client.patch(f"/api/v1/tracker/jobs/{scratch_job}", json={"notes": "asked about salary"})
    assert client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                        json={"status": "Flagged"}).status_code == 200


# --- seeing what a run produced ----------------------------------------------

def test_a_run_can_be_asked_what_it_produced(client: TestClient) -> None:
    """New jobs are usually low-ranked, so 'what just arrived' needs its own filter."""
    runs = client.get("/api/v1/tracker/runs").json()["runs"]
    finished = [r for r in runs if r["finished_at"]]
    if not finished:
        pytest.skip("no completed run in this database")

    run_id = finished[0]["run_id"]
    body = client.get(f"/api/v1/tracker/jobs?view=all&from_run={run_id}").json()
    assert body["total"] >= 0
    unfiltered = client.get("/api/v1/tracker/jobs?view=all").json()["total"]
    assert body["total"] <= unfiltered


def test_an_unknown_run_returns_nothing_rather_than_everything(client: TestClient) -> None:
    body = client.get("/api/v1/tracker/jobs?view=all&from_run=no-such-run").json()
    assert body["total"] == 0, "a bad filter must not silently show the whole backlog"


# --- dead links are reversible -----------------------------------------------

def test_a_posting_can_be_written_off_and_taken_back(client: TestClient, scratch_job: str) -> None:
    """A link can fail for a minute; a posting wrongly written off is one nobody
    will try again."""
    link = client.get(f"/api/v1/tracker/jobs/{scratch_job}").json()["merged_job_ids"][0]

    marked = client.post(f"/api/v1/tracker/jobs/{scratch_job}/dead-link",
                         json={"link_id": link}).json()
    assert marked["dead_links"].get(link) is True

    restored = client.post(f"/api/v1/tracker/jobs/{scratch_job}/dead-link",
                           json={"link_id": link, "dead": False}).json()
    assert link not in restored["dead_links"]


def test_meta_publishes_the_assignees_shorter_status_list(client: TestClient) -> None:
    body = client.get("/api/v1/tracker/meta").json()
    assert body["assignee_statuses"] == ["New", "Filled", "Submitted", "Flagged"]
    assert "Skip (auto)" in body["statuses"], "the owner still sees everything"


# --- search treats punctuation as text ---------------------------------------

@pytest.mark.parametrize("term", ["%", "_", "a%b", "%%%"])
def test_wildcards_are_searched_for_not_obeyed(client: TestClient, term: str) -> None:
    """LIKE reads % and _ as wildcards. A user typing them means the characters."""
    everything = client.get("/api/v1/tracker/jobs?view=all").json()["total"]
    found = client.get(f"/api/v1/tracker/jobs?view=all&q={term}").json()["total"]
    assert found < everything, f"searching {term!r} returned the whole table"


def test_a_real_percentage_matches_only_itself(client: TestClient) -> None:
    body = client.get("/api/v1/tracker/jobs?view=all&q=100%25").json()
    for job in body["jobs"]:
        assert "100%" in f"{job['company']} {job['title']}".lower()


def test_search_is_case_insensitive(client: TestClient) -> None:
    lower = client.get("/api/v1/tracker/jobs?view=all&q=stripe").json()["total"]
    upper = client.get("/api/v1/tracker/jobs?view=all&q=STRIPE").json()["total"]
    assert lower == upper and lower > 0


# --- text fields have a size ---------------------------------------------------

def test_an_overlong_note_is_refused_rather_than_truncated(client: TestClient, scratch_job: str) -> None:
    """Notes ride along in every list response, and silently losing the tail of
    someone's text is worse than telling them it is too long."""
    refused = client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                           json={"notes": "x" * 5_000})
    assert refused.status_code == 422
    assert (client.get(f"/api/v1/tracker/jobs/{scratch_job}").json()["notes"] or "") == ""


def test_a_normal_note_is_fine(client: TestClient, scratch_job: str) -> None:
    note = "Applied through their own site; they asked for a cover letter too."
    assert client.patch(f"/api/v1/tracker/jobs/{scratch_job}",
                        json={"notes": note}).json()["notes"] == note
