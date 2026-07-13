import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearActiveRun,
  createRunAbortSignal,
  ensureActiveRun,
  getActiveRunConflict,
  getActiveRun,
  getActiveRunCount,
  listActiveRuns,
  markRunPreviewHandoffStarted,
  requestActiveRunCancel,
  throwIfRunCanceled,
} from "./run-control.js";

afterEach(() => {
  // Multiple runs can coexist now — clear every one between tests.
  for (const run of listActiveRuns()) {
    clearActiveRun(run.runId);
  }
});

describe("run-control", () => {
  it("cancels an active in-flight run and invokes registered cleanup hooks", async () => {
    const cleanup = vi.fn();
    ensureActiveRun({
      runId: "run-1",
      phase: "running",
      inFlight: true,
    });
    const run = getActiveRun("run-1");
    run.cleanupFns.add(cleanup);

    const result = await requestActiveRunCancel({
      runId: "run-1",
      reason: "user",
      phase: "running",
    });

    expect(result).toMatchObject({
      ok: true,
      canceled: true,
      immediate: false,
      runId: "run-1",
      phase: "running",
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(getActiveRun("run-1")?.cancelRequested).toBe(true);
  });

  it("aborts fetch-style signals after cancellation", async () => {
    ensureActiveRun({
      runId: "run-2",
      phase: "running",
      inFlight: true,
    });
    const signal = createRunAbortSignal("run-2");

    expect(signal.aborted).toBe(false);
    await requestActiveRunCancel({ runId: "run-2" });
    expect(signal.aborted).toBe(true);
  });

  it("throws a canceled error after cancellation is requested", async () => {
    ensureActiveRun({
      runId: "run-3",
      phase: "prompt2",
      inFlight: true,
    });

    await requestActiveRunCancel({
      runId: "run-3",
      reason: "user",
      phase: "prompt2",
    });

    expect(() => throwIfRunCanceled("run-3", "Prompt 2")).toThrow(
      /Run canceled during Prompt 2/i,
    );
  });

  it("does not cancel after preview handoff starts", async () => {
    ensureActiveRun({
      runId: "run-4",
      phase: "running",
      inFlight: true,
    });
    markRunPreviewHandoffStarted("run-4");

    const result = await requestActiveRunCancel({ runId: "run-4" });

    expect(result).toMatchObject({
      ok: true,
      canceled: false,
      reason: "not_cancelable",
      runId: "run-4",
    });
  });

  it("allows multiple concurrent runs (parallel queue)", () => {
    ensureActiveRun({
      runId: "run-5",
      phase: "running",
      inFlight: true,
    });
    // No throw — the queue's maxParallel cap gates concurrency, not run-control.
    ensureActiveRun({
      runId: "run-6",
      phase: "running",
      inFlight: true,
    });

    expect(getActiveRun("run-5")?.runId).toBe("run-5");
    expect(getActiveRun("run-6")?.runId).toBe("run-6");
    expect(getActiveRunCount()).toBe(2);
  });

  it("still reports a conflict for a different in-flight run (for callers that check)", () => {
    ensureActiveRun({
      runId: "run-7",
      phase: "running",
      inFlight: true,
    });
    // getActiveRunConflict is retained for the legacy single-run entrypoint.
    expect(getActiveRunConflict("run-8")?.runId).toBe("run-7");
    expect(getActiveRunConflict("run-7")).toBeNull();
  });

  it("keeps each run isolated and clears only the targeted run", () => {
    ensureActiveRun({ runId: "run-9", phase: "running", inFlight: true });
    ensureActiveRun({ runId: "run-10", phase: "running", inFlight: true });

    clearActiveRun("run-9");
    expect(getActiveRun("run-9")).toBeNull();
    expect(getActiveRun("run-10")?.runId).toBe("run-10");
    expect(getActiveRunCount()).toBe(1);
  });
});
