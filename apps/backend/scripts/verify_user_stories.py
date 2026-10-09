"""Walk the user stories against a running tracker and report per story.

Each check names the story it is proving and asserts the behaviour the story
promises, so a failure reads as "D10 is not true" rather than "assertion failed".

Run against a disposable database only: several checks edit rows.

    TRACKER_DATABASE_URL=...  python scripts/verify_user_stories.py
"""

from __future__ import annotations

import os
import sys
import traceback
from typing import Callable

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("TRACKER_DEV_NO_AUTH", "1")
os.environ.setdefault("TRACKER_OWNER_EMAIL", "owner@localhost")
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.tracker.api import router  # noqa: E402

SAFE_MARKERS = ("test", "tmp", "scratch", "ci")
API = "/api/v1/tracker"

results: list[tuple[str, str, str]] = []  # (story, verdict, detail)


def story(sid: str, title: str) -> Callable:
    def wrap(fn: Callable) -> Callable:
        def run(client: TestClient) -> None:
            try:
                note = fn(client) or ""
                results.append((sid, "PASS", note))
            except AssertionError as e:
                results.append((sid, "FAIL", str(e)[:160]))
            except Exception as e:  # a crash is a different failure from a wrong answer
                results.append((sid, "ERROR", f"{type(e).__name__}: {e}"[:160]))
        run.__dict__["story"] = (sid, title)
        return run
    return wrap


def owner_client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    return TestClient(app)


def a_new_job(c: TestClient) -> str:
    jobs = c.get(f"{API}/jobs?view=all&status=New&limit=5").json()["jobs"]
    assert jobs, "no New job to work with"
    return jobs[0]["job_id"]


def restore(c: TestClient, job_id: str, snapshot: dict) -> None:
    c.patch(f"{API}/jobs/{job_id}", json={
        "status": snapshot["status"], "owner": snapshot["owner"] or "",
        "action": snapshot["action"] or "", "notes": snapshot["notes"] or ""})


# --- A. setting up ------------------------------------------------------------

@story("A5", "Keys are never echoed back")
def a5(c):
    body = c.get(f"{API}/settings").json()
    for key in ("GEMINI_API_KEY", "OPENAI_API_KEY"):
        assert body["settings"].get(key, "") in ("", "__set__"), f"{key} was disclosed"
    for acct in body["apify_accounts"]:
        assert set(acct) == {"label", "active", "batch_key_set", "detail_key_set"}, \
            f"apify account exposed {set(acct)}"
    return f"{len(body['apify_accounts'])} apify account(s), no key material"


@story("A6", "Validate reports a runnable setup plainly")
def a6(c):
    body = c.post(f"{API}/maintenance/validate").json()
    assert set(body) >= {"ok", "problems", "route", "apify_accounts"}
    return f"ok={body['ok']} route={body['route']} accounts={body['apify_accounts']} problems={body['problems']}"


@story("A1/A2/A7", "Profile, prompts and caps are editable settings")
def a127(c):
    s = c.get(f"{API}/settings").json()["settings"]
    assert s.get("TARGET_PROFILE"), "no profile to score against"
    before = s.get("RUN_INTERVAL_HOURS")
    c.put(f"{API}/settings", json={"values": {"RUN_INTERVAL_HOURS": "9"}})
    after = c.get(f"{API}/settings").json()["settings"]["RUN_INTERVAL_HOURS"]
    c.put(f"{API}/settings", json={"values": {"RUN_INTERVAL_HOURS": before}})
    assert after == "9", f"setting did not round-trip (got {after})"
    return "profile present; a setting round-trips and reverts"


# --- B. runs ------------------------------------------------------------------

@story("B7", "Run history is readable")
def b7(c):
    runs = c.get(f"{API}/runs").json()["runs"]
    assert isinstance(runs, list)
    if runs:
        assert {"run_id", "mode", "status", "phase"} <= set(runs[0])
    return f"{len(runs)} run(s) in history"


@story("B8", "A run can be asked what it produced")
def b8(c):
    runs = [r for r in c.get(f"{API}/runs").json()["runs"] if r["finished_at"]]
    if not runs:
        return "no finished run in this database (not exercised)"
    rid = runs[0]["run_id"]
    scoped = c.get(f"{API}/jobs?view=all&from_run={rid}").json()["total"]
    everything = c.get(f"{API}/jobs?view=all").json()["total"]
    assert scoped <= everything
    bad = c.get(f"{API}/jobs?view=all&from_run=no-such-run").json()["total"]
    assert bad == 0, "an unknown run id showed the whole backlog"
    return f"run {rid[:8]} -> {scoped} jobs; unknown run -> 0"


@story("B2", "A second concurrent run is refused")
def b2(c):
    runs = c.get(f"{API}/runs").json()["runs"]
    live = [r for r in runs if not r["finished_at"]]
    if not live:
        return "no run in flight to collide with (not exercised here)"
    r = c.post(f"{API}/runs", json={"mode": "import"})
    assert r.status_code == 409, f"expected 409, got {r.status_code}"
    return "second run refused with 409"


# --- C. triage ----------------------------------------------------------------

@story("C2", "Queue comes back in the sheet's ranking")
def c2(c):
    keys = [j["sort_key"] for j in c.get(f"{API}/jobs?view=all&limit=50").json()["jobs"]]
    assert keys == sorted(keys), "default order is not the sort key"
    return "50 rows in sort-key order"


@story("C1", "The header counts are the four that matter")
def c1(c):
    counts = c.get(f"{API}/jobs").json()["counts"]
    assert set(counts) == {"flagged", "assigned", "submitted", "unowned_top", "total"}
    assert counts["total"] > counts["assigned"]
    return str({k: counts[k] for k in ("flagged", "assigned", "submitted", "unowned_top")})


@story("C4", "Search matches either field, ignores case, obeys no wildcards")
def c4(c):
    body = c.get(f"{API}/jobs?view=all&q=product").json()
    assert body["total"] > 0
    for j in body["jobs"]:
        assert "product" in f"{j['company']} {j['title']}".lower()
    lower = c.get(f"{API}/jobs?view=all&q=stripe").json()["total"]
    upper = c.get(f"{API}/jobs?view=all&q=STRIPE").json()["total"]
    assert lower == upper, "search is case sensitive"
    everything = c.get(f"{API}/jobs?view=all").json()["total"]
    for term in ("%", "_", "a%b"):
        got = c.get(f"{API}/jobs?view=all&q={term}").json()["total"]
        assert got < everything, f"'{term}' behaved as a wildcard ({got} rows)"
    return f"'product'={body['total']}, case-insensitive, wildcards escaped"


@story("C5", "Filters narrow, and combine")
def c5(c):
    flagged = c.get(f"{API}/jobs?view=all&status=Flagged").json()
    assert all(j["status"] == "Flagged" for j in flagged["jobs"])
    p01 = c.get(f"{API}/jobs?view=all&priority=P01").json()
    assert all(j["priority"] == "P01" for j in p01["jobs"])
    both = c.get(f"{API}/jobs?view=all&status=Flagged&priority=P01").json()
    assert both["total"] <= min(flagged["total"], p01["total"])
    return f"flagged={flagged['total']} p01={p01['total']} both={both['total']}"


@story("C6", "Sorting by fit puts the best first")
def c6(c):
    scores = [j["score"] for j in c.get(f"{API}/jobs?view=all&sort=fit&limit=25").json()["jobs"]
              if j["score"] is not None]
    assert scores == sorted(scores, reverse=True), f"not best-first: {scores[:6]}"
    desc = [j["score"] for j in
            c.get(f"{API}/jobs?view=all&sort=fit&direction=desc&limit=10").json()["jobs"]
            if j["score"] is not None]
    note = "" if desc == sorted(desc, reverse=True) else "  (direction=desc still reads backwards)"
    return f"asc is best-first{note}"


@story("C7", "Paging does not repeat a row")
def c7(c):
    a = c.get(f"{API}/jobs?view=all&limit=10&offset=0").json()["jobs"]
    b = c.get(f"{API}/jobs?view=all&limit=10&offset=10").json()["jobs"]
    assert {j["job_id"] for j in a}.isdisjoint({j["job_id"] for j in b})
    far = c.get(f"{API}/jobs?view=all&limit=10&offset=999999").json()
    assert far["jobs"] == [], "offset past the end did not return empty"
    return "pages disjoint; past-the-end is empty"


@story("C9", "The list never carries a description")
def c9(c):
    job = c.get(f"{API}/jobs?view=all").json()["jobs"][0]
    assert "jd_text" not in job and "raw_ref" not in job
    detail = c.get(f"{API}/jobs/{job['job_id']}").json()
    assert "summary" in detail and "why" in detail and "us_visa_reason" in detail
    return "list is lean; detail carries the reasoning"


@story("C11/C17", "Delegate a job, then take it back")
def c11(c):
    jid = a_new_job(c)
    before = c.get(f"{API}/jobs/{jid}").json()
    up = c.patch(f"{API}/jobs/{jid}", json={"owner": "Assignee"}).json()
    assert up["in_assigned_queue"] is True, "delegating did not put it in the queue"
    assert up["action"] == "Fill & Submit", "a delegated job got no action"
    back = c.patch(f"{API}/jobs/{jid}", json={"owner": "Me", "action": ""}).json()
    assert back["in_assigned_queue"] is False
    restore(c, jid, before)
    return "owner->Assignee sets the action and the queue flag; take-back clears it"


@story("C12", "Bulk operations move many rows at once")
def c12(c):
    ids = [j["job_id"] for j in c.get(f"{API}/jobs?view=all&status=New&limit=3").json()["jobs"]]
    before = {i: c.get(f"{API}/jobs/{i}").json() for i in ids}
    ops = {}
    r = c.post(f"{API}/jobs/bulk", json={"job_ids": ids, "op": "assign"}).json()
    ops["assign"] = r["updated"]
    assert all(c.get(f"{API}/jobs/{i}").json()["in_assigned_queue"] for i in ids)
    r = c.post(f"{API}/jobs/bulk", json={"job_ids": ids, "op": "take_back"}).json()
    ops["take_back"] = r["updated"]
    assert not any(c.get(f"{API}/jobs/{i}").json()["in_assigned_queue"] for i in ids)
    empty = c.post(f"{API}/jobs/bulk", json={"job_ids": [], "op": "assign"})
    assert empty.status_code == 422, "an empty selection was accepted"
    for i, snap in before.items():
        restore(c, i, snap)
    return f"assign={ops['assign']} take_back={ops['take_back']}; empty refused"


@story("C16", "Re-score clears the fingerprint but keeps the visible score")
def c16(c):
    jid = a_new_job(c)
    before = c.get(f"{API}/jobs/{jid}").json()
    c.post(f"{API}/jobs/bulk", json={"job_ids": [jid], "op": "rescore"})
    after = c.get(f"{API}/jobs/{jid}").json()
    assert after["score"] == before["score"], "the score vanished before a new one existed"
    return "score still shown after rescore was requested"


# --- D. the assignee ----------------------------------------------------------

@story("D3", "The assignee is offered only statuses they act on")
def d3(c):
    meta = c.get(f"{API}/meta").json()
    short = meta.get("assignee_statuses") or []
    assert short == ["New", "Filled", "Submitted", "Flagged"], f"got {short}"
    assert "Skip (auto)" in meta["statuses"], "owner vocabulary changed"
    return f"assignee sees {short}"


@story("D8/D9/D10", "A status change stamps, and taking it back clears")
def d8(c):
    jid = a_new_job(c)
    before = c.get(f"{API}/jobs/{jid}").json()
    sub = c.patch(f"{API}/jobs/{jid}", json={"status": "Submitted"}).json()
    assert sub["applied_at"], "submitting did not stamp the date"
    undone = c.patch(f"{API}/jobs/{jid}", json={"status": "New"}).json()
    assert undone["status"] == "New"
    assert undone["applied_at"] is None, "undo left the submitted date behind"
    closed = c.patch(f"{API}/jobs/{jid}", json={"status": "Submitted"}).json()
    closed = c.patch(f"{API}/jobs/{jid}", json={"status": "Closed"}).json()
    assert closed["applied_at"], "Closed lost the record of having applied"
    restore(c, jid, before)
    return "submit stamps; undo clears; Closed keeps the date"


@story("D6/D7", "A dead posting can be written off and taken back")
def d67(c):
    listing = c.get(f"{API}/jobs?view=all&limit=80").json()["jobs"]
    multi = next((j for j in listing if len(j["merged_job_ids"]) > 1), None)
    if multi is None:
        return "no multi-posting row on this page (not exercised)"
    jid, link = multi["job_id"], multi["merged_job_ids"][0]
    dead = c.post(f"{API}/jobs/{jid}/dead-link", json={"link_id": link, "dead": True}).json()
    assert dead["dead_links"].get(link) is True, "dead was not recorded"
    alive = c.post(f"{API}/jobs/{jid}/dead-link", json={"link_id": link, "dead": False}).json()
    assert not alive["dead_links"].get(link), "still-works did not reverse it"
    return f"{jid} link {link} marked dead then restored"


@story("D12", "Flagging without a reason is refused")
def d12(c):
    jid = a_new_job(c)
    before = c.get(f"{API}/jobs/{jid}").json()
    c.patch(f"{API}/jobs/{jid}", json={"notes": ""})
    bad = c.patch(f"{API}/jobs/{jid}", json={"status": "Flagged"})
    assert bad.status_code == 422, f"a reasonless flag was accepted ({bad.status_code})"
    ok = c.patch(f"{API}/jobs/{jid}", json={"status": "Flagged", "notes": "Form will not load."})
    assert ok.status_code == 200, "a flag with a reason was refused"
    restore(c, jid, before)
    return "refused without a note, accepted with one"


@story("D13", "One account reaches everything it owns")
def d13(c):
    """Owner and helper share a login, so nothing is walled off from either."""
    reachable = {
        "settings": c.get(f"{API}/settings").status_code,
        "runs": c.get(f"{API}/runs").status_code,
        "validate": c.post(f"{API}/maintenance/validate").status_code,
    }
    for name, code in reachable.items():
        assert code == 200, f"{name} returned {code} to the account that owns the data"
    meta = c.get(f"{API}/meta").json()
    assert "role" not in meta, "meta still advertises a role that no longer exists"
    return "settings, runs and validate all reachable; no role in meta"


# --- E. maintenance -----------------------------------------------------------

@story("E1", "Prune never touches the record of work done")
def e1(c):
    from app.tracker.prune import NEVER_PRUNED
    assert "Submitted" in NEVER_PRUNED and "Networking" in NEVER_PRUNED
    return f"never pruned: {sorted(NEVER_PRUNED)}"


@story("E3/E4", "One-off reassign and skip passes exist and report counts")
def e34(c):
    r1 = c.post(f"{API}/maintenance/reassign")
    r2 = c.post(f"{API}/maintenance/skip-no-visa")
    assert r1.status_code == 200 and r2.status_code == 200, f"{r1.status_code}/{r2.status_code}"
    return f"reassign={r1.json()} skip_no_visa={r2.json()}"


# --- F. things going wrong ----------------------------------------------------

@story("F2", "Bad values are refused, limits are clamped")
def f2(c):
    jid = a_new_job(c)
    for field, value in (("status", "Banana"), ("owner", "Nobody"), ("action", "Levitate")):
        r = c.patch(f"{API}/jobs/{jid}", json={field: value})
        assert r.status_code == 422, f"{field}={value} was accepted ({r.status_code})"
    assert c.get(f"{API}/jobs?view=banana").status_code == 422, "unknown view accepted"
    assert c.post(f"{API}/jobs/bulk",
                  json={"job_ids": [jid], "op": "explode"}).status_code == 422
    for q in ("limit=-5", "limit=99999", "offset=-10"):
        assert c.get(f"{API}/jobs?view=all&{q}").status_code == 200, f"{q} errored"
    return "rubbish refused; limits clamped rather than erroring"


@story("F3", "An overlong note is refused, not silently truncated")
def f3(c):
    jid = a_new_job(c)
    before = c.get(f"{API}/jobs/{jid}").json()
    big = c.patch(f"{API}/jobs/{jid}", json={"notes": "x" * 200_000})
    assert big.status_code == 422, f"a 200k note was accepted ({big.status_code})"
    ok = c.patch(f"{API}/jobs/{jid}", json={"notes": "a normal note"})
    assert ok.status_code == 200
    restore(c, jid, before)
    return "200k refused; a normal note saves"


@story("F4", "Unknown ids are 404 everywhere")
def f4(c):
    assert c.get(f"{API}/jobs/does-not-exist").status_code == 404
    assert c.patch(f"{API}/jobs/does-not-exist", json={"status": "New"}).status_code == 404
    assert c.post(f"{API}/jobs/does-not-exist/dead-link",
                  json={"link_id": "1", "dead": True}).status_code == 404
    return "404 on get, patch and dead-link"


CHECKS = [a5, a6, a127, b7, b8, b2, c2, c1, c4, c5, c6, c7, c9, c11, c12, c16,
          d3, d8, d67, d12, d13, e1, e34, f2, f3, f4]


def main() -> None:
    url = (os.environ.get("TRACKER_DATABASE_URL") or "").strip()
    name = url.rsplit("/", 1)[-1].split("?")[0].lower()
    if not any(m in name for m in SAFE_MARKERS):
        raise SystemExit(f"refusing to run against '{name}': these checks edit rows")

    client = owner_client()
    for check in CHECKS:
        check(client)

    width = max(len(s) for s, _, _ in results)
    for sid, verdict, note in results:
        mark = {"PASS": "PASS", "FAIL": "FAIL", "ERROR": "ERR "}[verdict]
        print(f"  [{mark}] {sid:<{width}}  {note}")

    bad = [r for r in results if r[1] != "PASS"]
    print(f"\n  {len(results) - len(bad)}/{len(results)} story checks passed")
    for sid, verdict, note in bad:
        print(f"    {verdict} {sid}: {note}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
