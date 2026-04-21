let activeRun = null;

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
  if (!activeRun) return null;
  if (runId && activeRun.runId !== runId) return null;
  return activeRun;
}

export function ensureActiveRun(init = {}) {
  const runId = init.runId ?? activeRun?.runId ?? null;
  if (!runId) {
    throw new Error("A run id is required to create active run state.");
  }

  if (!activeRun || activeRun.runId !== runId) {
    activeRun = {
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
    return activeRun;
  }

  activeRun.sourceTabId = init.sourceTabId ?? activeRun.sourceTabId ?? null;
  activeRun.activeRunJob = init.activeRunJob ?? activeRun.activeRunJob ?? null;
  if (typeof init.startedAt === "number") {
    activeRun.startedAt = init.startedAt;
  }
  if (typeof init.phase === "string" && init.phase.trim()) {
    activeRun.phase = init.phase.trim();
  }
  if (typeof init.inFlight === "boolean") {
    activeRun.inFlight = init.inFlight;
  }
  if (typeof init.cancelable === "boolean") {
    activeRun.cancelable = init.cancelable;
  }
  return activeRun;
}

export function updateActiveRun(runId, patch = {}) {
  const run = getActiveRun(runId);
  if (!run) return null;
  Object.assign(run, patch || {});
  return run;
}

export function clearActiveRun(runId = null) {
  if (!activeRun) return;
  if (runId && activeRun.runId !== runId) return;
  activeRun.cleanupFns.clear();
  activeRun = null;
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
