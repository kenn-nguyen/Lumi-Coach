// Per-run working state — the parallel replacement for the single shared
// `extensionSession` blob. Each concurrent tailoring run gets its own isolated
// state object keyed by runId, so N runs can't clobber each other's status,
// prompt artifacts, or (critically) tailoredResumeId / tailoredResumeCommitted
// — the fields the commit-on-success discard reads to decide what to delete.
//
// In-memory only: the durable, user-facing bits live on the queue record. This
// state is the run's scratchpad for the duration of the pipeline and is cleared
// when the run ends. Shape mirrors the fields the orchestrator reads/writes
// (sessionId, status, tailoredResumeId, prompt1..4*, previewUrl, …) via a
// shallow merge, exactly like the old setExtensionState did.

const runStates = new Map();

// Single change listener (the background registers one) so the queue can surface
// each run's live pipeline stage on its Runs-tab card.
let changeListener = null;
export function setRunStateChangeListener(fn) {
  changeListener = typeof fn === "function" ? fn : null;
}
function notifyChange(runId, next) {
  if (!changeListener) return;
  try {
    changeListener(runId, next);
  } catch {
    // A listener error must never break the pipeline.
  }
}

export function initRunState(runId, seed = {}) {
  if (!runId) return { sessionId: null };
  const state = { sessionId: runId, ...seed, updatedAt: Date.now() };
  runStates.set(runId, state);
  return state;
}

export function getRunState(runId) {
  if (!runId) return { sessionId: null };
  return runStates.get(runId) ?? { sessionId: runId };
}

export function setRunState(runId, patch = {}) {
  if (!runId) return { sessionId: null };
  const current = runStates.get(runId) ?? { sessionId: runId };
  const next = { ...current, ...patch, updatedAt: Date.now() };
  runStates.set(runId, next);
  if (patch.status && patch.status !== current.status) {
    notifyChange(runId, next);
  }
  return next;
}

export function clearRunState(runId) {
  if (!runId) return;
  runStates.delete(runId);
}

// Test/inspection helper.
export function _runStateSize() {
  return runStates.size;
}
