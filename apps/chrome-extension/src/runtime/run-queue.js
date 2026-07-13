// Tailoring job queue — the background service worker's single source of truth
// for every queued/running/finished job. Pure and dependency-injected so it can
// be unit-tested without chrome APIs: the caller supplies persist()/startRun()/
// now(). The SW wires the real implementations (chrome.storage writer + the
// orchestrator launcher) in background.js.
//
// Status lifecycle:
//   queued -> preparing -> running -> succeeded | failed | canceled
//   (running|preparing) may also drop to needs_attention (auth/setup) and later
//   resume to running, or end canceled/failed.
//
// A job "occupies a slot" only while preparing/running; the concurrency cap
// (maxParallel) governs how many occupy slots at once. queued/needs_attention
// jobs count toward the ACTIVE cap (max 5) but not a running slot.

export const ACTIVE_STATUSES = new Set([
  "queued",
  "preparing",
  "running",
  "needs_attention",
]);
export const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled"]);
const SLOT_STATUSES = new Set(["preparing", "running"]);

export const MAX_ACTIVE = 5;
export const HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // keep terminal cards 1 day

function occupiesSlot(status) {
  return SLOT_STATUSES.has(status);
}
function isActive(status) {
  return ACTIVE_STATUSES.has(status);
}
function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

// Stable identity for dedupe: LinkedIn jobs collapse on their normalized URL;
// manual-paste jobs (no URL) fall back to their unique runId so they never
// dedupe against each other.
function jobKeyOf(record) {
  const url = String(record.jobUrl || "").trim();
  return url ? `url:${url.toLowerCase()}` : `run:${record.runId}`;
}

export function createRunQueue({
  persist = async () => {},
  startRun = async () => {},
  now = () => Date.now(),
  maxParallel = 1,
} = {}) {
  const records = new Map(); // runId -> record
  let cap = Math.max(1, Number(maxParallel) || 1);
  let persistChain = Promise.resolve();

  function schedulePersist() {
    // Serialized writer (hazard #1): every mutation chains onto the previous
    // write so concurrent updates can never interleave read-modify-write.
    persistChain = persistChain
      .then(() => persist(snapshotForStorage()))
      .catch(() => {});
    return persistChain;
  }

  function snapshotForStorage() {
    return Array.from(records.values()).map((r) => ({ ...r }));
  }

  function countActive() {
    let n = 0;
    for (const r of records.values()) if (isActive(r.status)) n += 1;
    return n;
  }
  function countSlots() {
    let n = 0;
    for (const r of records.values()) if (occupiesSlot(r.status)) n += 1;
    return n;
  }

  function oldestQueued() {
    let pick = null;
    for (const r of records.values()) {
      if (r.status !== "queued") continue;
      if (!pick || r.enqueuedAt < pick.enqueuedAt) pick = r;
    }
    return pick;
  }

  // Start queued jobs until the running slots are full. Marks a job "preparing"
  // synchronously before launching so a re-entrant pump() can't double-start it.
  function pump() {
    while (countSlots() < cap) {
      const next = oldestQueued();
      if (!next) break;
      next.status = "preparing";
      next.startedAt = now();
      Promise.resolve()
        .then(() => startRun({ ...next }))
        .catch((err) => {
          markFailed(next.runId, {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
    schedulePersist();
  }

  function patch(runId, changes) {
    const r = records.get(runId);
    if (!r) return null;
    Object.assign(r, changes);
    return r;
  }

  function enqueue(input = {}) {
    const runId = String(input.runId || "").trim();
    if (!runId) return { ok: false, reason: "no_run_id" };
    if (records.has(runId)) return { ok: false, reason: "duplicate_run_id" };

    if (countActive() >= MAX_ACTIVE) {
      return { ok: false, reason: "cap", limit: MAX_ACTIVE };
    }

    const candidate = {
      runId,
      title: input.title ?? "",
      company: input.company ?? "",
      jobUrl: input.jobUrl ?? "",
      sourceUrl: input.sourceUrl ?? "",
      jdText: input.jdText ?? "",
      providerProfileId: input.providerProfileId ?? null,
      promptProfileId: input.promptProfileId ?? null,
      baseResumeId: input.baseResumeId ?? null,
      status: "queued",
      subStage: null,
      tailoredResumeId: null,
      previewUrl: null,
      error: null,
      logAvailable: false,
      // Opaque run-start snapshot (jobInput with full JD text, activeRunJob,
      // prompt1CustomInstruction, tabId). Carried verbatim to startRun so the
      // run is independent of the source tab. Stripped from UI broadcasts.
      payload: input.payload ?? null,
      enqueuedAt: now(),
      startedAt: null,
      endedAt: null,
    };

    const key = jobKeyOf(candidate);
    for (const r of records.values()) {
      if (isActive(r.status) && jobKeyOf(r) === key) {
        return { ok: false, reason: "duplicate", existingRunId: r.runId };
      }
    }

    records.set(runId, candidate);
    pump();
    return { ok: true, runId };
  }

  function markRunning(runId, changes = {}) {
    return patch(runId, { ...changes, status: "running", stageStartedAt: now() });
  }
  // subStage = the human step label; stageStartedAt anchors the live elapsed
  // timer the card shows for the current step.
  function setSubStage(runId, subStage, stageStartedAt = undefined) {
    const changes = { subStage };
    if (stageStartedAt !== undefined) changes.stageStartedAt = stageStartedAt;
    return patch(runId, changes);
  }
  function markNeedsAttention(runId, changes = {}) {
    // Frees the running slot so other queued jobs can proceed while this one
    // waits for the user (auth/setup). Re-pump to fill the freed slot.
    const r = patch(runId, { ...changes, status: "needs_attention" });
    pump();
    return r;
  }
  function markSucceeded(runId, changes = {}) {
    const r = patch(runId, {
      ...changes,
      status: "succeeded",
      endedAt: now(),
    });
    pump();
    return r;
  }
  function markFailed(runId, changes = {}) {
    const r = patch(runId, { ...changes, status: "failed", endedAt: now() });
    pump();
    return r;
  }
  // Cooperative cancel in flight — the run hasn't stopped yet (it's finishing
  // the current LLM response before it can abort). Show "Cancelling…" until the
  // terminal markCanceled arrives.
  function markCanceling(runId) {
    return patch(runId, { canceling: true, subStage: "Cancelling…" });
  }
  function markCanceled(runId, changes = {}) {
    const r = patch(runId, {
      ...changes,
      status: "canceled",
      canceling: false,
      endedAt: now(),
    });
    pump();
    return r;
  }

  // Cancel a running/paused job (caller must then tear down the real run and
  // call markCanceled), or silently drop a still-queued job (no history entry).
  function requestCancelOrRemove(runId) {
    const r = records.get(runId);
    if (!r) return { action: "noop" };
    if (r.status === "queued") {
      records.delete(runId);
      schedulePersist();
      return { action: "removed", record: { ...r } };
    }
    if (isActive(r.status)) {
      return { action: "cancel", record: { ...r } };
    }
    // Terminal → "Remove" from history.
    records.delete(runId);
    schedulePersist();
    return { action: "removed", record: { ...r } };
  }

  // Flip paused (needs_attention) runs back to queued and pump — called after
  // the user resolves auth/setup so paused jobs resume automatically (hazard #3).
  function resumeNeedsAttention() {
    let changed = false;
    for (const r of records.values()) {
      if (r.status === "needs_attention") {
        r.status = "queued";
        r.subStage = null;
        changed = true;
      }
    }
    if (changed) pump();
    return changed;
  }

  function setMaxParallel(n) {
    const next = Math.max(1, Number(n) || 1);
    if (next === cap) return;
    cap = next;
    // Raising the cap can start more jobs; lowering it never stops running ones.
    pump();
  }

  function pruneHistory() {
    const cutoff = now() - HISTORY_TTL_MS;
    let changed = false;
    for (const [id, r] of records) {
      if (isTerminal(r.status) && (r.endedAt ?? 0) < cutoff) {
        records.delete(id);
        changed = true;
      }
    }
    if (changed) schedulePersist();
  }

  // Restore from persisted storage on SW startup. Any job that was mid-flight
  // when the worker died cannot be resumed (in-page automation state is gone),
  // so it is healed to needs_attention rather than silently re-run (hazard #6).
  function hydrate(list = []) {
    records.clear();
    for (const raw of Array.isArray(list) ? list : []) {
      if (!raw || !raw.runId) continue;
      const r = { ...raw };
      if (occupiesSlot(r.status) || r.status === "preparing") {
        r.status = "needs_attention";
        r.subStage = "Interrupted — the browser paused this run. Retry it.";
      }
      records.set(r.runId, r);
    }
  }

  // Sorted view for the UI: ACTIVE jobs first (newest-queued at the very top, so
  // what you just added / what's running is front and center), then TERMINAL
  // jobs (most recently finished first). Newest-first within each group.
  function getSnapshot() {
    const all = Array.from(records.values());
    const active = all
      .filter((r) => isActive(r.status))
      .sort((a, b) => (b.enqueuedAt ?? 0) - (a.enqueuedAt ?? 0));
    const terminal = all
      .filter((r) => isTerminal(r.status))
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
    return [...active, ...terminal].map((r) => ({ ...r }));
  }

  function get(runId) {
    const r = records.get(runId);
    return r ? { ...r } : null;
  }

  return {
    enqueue,
    markRunning,
    setSubStage,
    markNeedsAttention,
    markSucceeded,
    markFailed,
    markCanceling,
    markCanceled,
    requestCancelOrRemove,
    resumeNeedsAttention,
    setMaxParallel,
    pruneHistory,
    hydrate,
    getSnapshot,
    get,
    countActive,
    countSlots,
    getMaxParallel: () => cap,
    // test/inspection helpers
    _size: () => records.size,
  };
}
