import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearActiveRun,
  createRunAbortSignal,
  ensureActiveRun,
  getActiveRunConflict,
  getActiveRun,
  markRunPreviewHandoffStarted,
  requestActiveRunCancel,
  throwIfRunCanceled,
} from "./run-control.js";

afterEach(() => {
  clearActiveRun();
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

  it("blocks a second run while another run is in flight", () => {
    ensureActiveRun({
      runId: "run-5",
      phase: "running",
      inFlight: true,
    });

    expect(getActiveRunConflict("run-6")?.runId).toBe("run-5");
    expect(() =>
      ensureActiveRun({
        runId: "run-6",
        phase: "preflight",
      }),
    ).toThrow(/tailoring run is already in progress/i);
  });

  it("blocks a second run while the first run is in preflight", () => {
    ensureActiveRun({
      runId: "run-7",
      phase: "preflight",
      inFlight: false,
    });

    expect(getActiveRunConflict("run-8")?.runId).toBe("run-7");
    expect(() =>
      ensureActiveRun({
        runId: "run-8",
        phase: "preflight",
        inFlight: false,
      }),
    ).toThrow(/tailoring run is already in progress/i);
  });

  it("allows replacing a setup-required repair run", () => {
    ensureActiveRun({
      runId: "run-9",
      phase: "setup_required",
      inFlight: false,
    });

    expect(getActiveRunConflict("run-10")).toBeNull();
    ensureActiveRun({
      runId: "run-10",
      phase: "preflight",
      inFlight: false,
    });

    expect(getActiveRun()?.runId).toBe("run-10");
  });
});
