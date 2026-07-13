// Live runs keyed by runId. Was a single `activeRun` variable; now a Map so the
// queue can hold several concurrent runs. Every helper below preserves its old
// behavior for the single-run case: a null runId resolves to the sole live run,
// and getActiveRunConflict still treats any OTHER busy run as a conflict (so the
// capacity gate can keep it at one until parallelism is switched on).
const activeRuns = new Map();

function firstActiveRun() {
  for (const run of activeRuns.values()) return run;
  return null;
}

export function createRunCanceledError(runId = null, stage = "") {
  const stageText = String(stage || "").trim();
  const error = new Error(
    stageText ? `Run canceled during ${stageText}.` : "Run canceled.",
  );
  error.name = "RunCanceledError";
  error.code = "RUN_CANCELED";
  error.runId = runId ?? null;
  error.stage = stageText;
  return error;
}

export function isRunCanceledError(error) {
  if (!error) return false;
  if (error.code === "RUN_CANCELED" || error.name === "RunCanceledError") {
    return true;
  }
  if (error.name === "AbortError") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /run canceled|request aborted|operation was aborted|aborterror/i.test(
    message,
  );
}

export function getActiveRun(runId = null) {
  if (!runId) return firstActiveRun();
  return activeRuns.get(runId) ?? null;
}

// All live runs (terminal-or-not) in insertion order. For the scheduler + the
// cancel-all path.
export function listActiveRuns() {
  return Array.from(activeRuns.values());
}

// Count of runs that still occupy a concurrency slot (not yet terminal). The
// capacity gate compares this against maxParallel.
export function getActiveRunCount() {
  let count = 0;
  for (const run of activeRuns.values()) {
    if (run.terminal !== true) count += 1;
  }
  return count;
}

export function getActiveRunConflict(runId = null) {
  for (const run of activeRuns.values()) {
    if (runId && run.runId === runId) continue;
    const phase = String(run.phase || "").trim();
    if (
      run.inFlight === true ||
      run.cancelRequested === true ||
      phase === "preflight"
    ) {
      return run;
    }
  }
  return null;
}

export function ensureActiveRun(init = {}) {
  const runId = init.runId ?? firstActiveRun()?.runId ?? null;
  if (!runId) {
    throw new Error("A run id is required to create active run state.");
  }

  let run = activeRuns.get(runId);
  if (!run) {
    // Parallel queue: multiple runs coexist, keyed by runId. Concurrency is
    // capped by the queue scheduler (maxParallel), not here — so there is no
    // single-run conflict throw and no eviction of other runs.
    run = {
      runId,
      sourceTabId: init.sourceTabId ?? null,
      activeRunJob: init.activeRunJob ?? null,
      phase: init.phase ?? "created",
      inFlight: init.inFlight === true,
      startedAt: init.startedAt ?? Date.now(),
      cancelRequested: false,
      cancelReason: null,
      cancelPhase: null,
      cancelRequestedAt: null,
      cancelable: init.cancelable !== false,
      previewHandoffStarted: false,
      terminal: false,
      cleanupFns: new Set(),
    };
    activeRuns.set(runId, run);
    return run;
  }

  run.sourceTabId = init.sourceTabId ?? run.sourceTabId ?? null;
  run.activeRunJob = init.activeRunJob ?? run.activeRunJob ?? null;
  if (typeof init.startedAt === "number") {
    run.startedAt = init.startedAt;
  }
  if (typeof init.phase === "string" && init.phase.trim()) {
    run.phase = init.phase.trim();
  }
  if (typeof init.inFlight === "boolean") {
    run.inFlight = init.inFlight;
  }
  if (typeof init.cancelable === "boolean") {
    run.cancelable = init.cancelable;
  }
  return run;
}

export function updateActiveRun(runId, patch = {}) {
  const run = getActiveRun(runId);
  if (!run) return null;
  Object.assign(run, patch || {});
  return run;
}

export function clearActiveRun(runId = null) {
  const run = getActiveRun(runId);
  if (!run) return;
  run.cleanupFns.clear();
  activeRuns.delete(run.runId);
}

export function registerRunCleanup(runId, cleanup) {
  const run = getActiveRun(runId);
  if (!run || typeof cleanup !== "function") {
    return () => {};
  }
  run.cleanupFns.add(cleanup);
  return () => {
    run.cleanupFns.delete(cleanup);
  };
}

export function createRunAbortSignal(runId) {
  const controller = new AbortController();
  const unregister = registerRunCleanup(runId, () => controller.abort());
  if (getActiveRun(runId)?.cancelRequested) {
    controller.abort();
  }
  controller.signal.addEventListener(
    "abort",
    () => {
      unregister();
    },
    { once: true },
  );
  return controller.signal;
}

export function throwIfRunCanceled(runId, stage = "") {
  const run = getActiveRun(runId);
  if (!run) return;
  if (run.cancelRequested || (run.terminal && run.phase === "canceled")) {
    throw createRunCanceledError(runId, stage);
  }
}

export function markRunPreviewHandoffStarted(runId) {
  const run = getActiveRun(runId);
  if (!run) return null;
  run.previewHandoffStarted = true;
  run.cancelable = false;
  run.phase = "preview_handoff";
  return run;
}

export function markRunTerminal(runId, phase = "completed") {
  const run = getActiveRun(runId);
  if (!run) return null;
  run.terminal = true;
  run.cancelable = false;
  run.inFlight = false;
  run.phase = phase;
  return run;
}

export async function requestActiveRunCancel(options = {}) {
  const run = getActiveRun(options.runId ?? null);
  if (!run) {
    return { ok: true, canceled: false, reason: "no_active_run" };
  }

  if (run.previewHandoffStarted || run.terminal || run.cancelable === false) {
    return {
      ok: true,
      canceled: false,
      reason: "not_cancelable",
      runId: run.runId,
    };
  }

  if (!run.cancelRequested) {
    run.cancelRequested = true;
    run.cancelReason = options.reason ?? "user";
    run.cancelPhase = options.phase ?? run.phase ?? "running";
    run.cancelRequestedAt = Date.now();
    const cleanups = Array.from(run.cleanupFns);
    await Promise.allSettled(
      cleanups.map((cleanup) =>
        cleanup({
          runId: run.runId,
          reason: run.cancelReason,
          phase: run.cancelPhase,
        }),
      ),
    );
  }

  return {
    ok: true,
    canceled: true,
    immediate: run.inFlight !== true,
    runId: run.runId,
    phase: run.cancelPhase,
  };
}
