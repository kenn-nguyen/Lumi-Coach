import { afterEach, describe, expect, it } from "vitest";

import {
  initRunState,
  getRunState,
  setRunState,
  clearRunState,
  _runStateSize,
} from "./run-state.js";

afterEach(() => {
  clearRunState("a");
  clearRunState("b");
});

describe("run-state", () => {
  it("seeds and reads a run's state", () => {
    initRunState("a", { sourceTabId: 7 });
    const s = getRunState("a");
    expect(s.sessionId).toBe("a");
    expect(s.sourceTabId).toBe(7);
  });

  it("shallow-merges on setRunState", () => {
    initRunState("a", { status: "starting" });
    setRunState("a", { tailoredResumeId: "r1", tailoredResumeCommitted: false });
    setRunState("a", { status: "patched" });
    const s = getRunState("a");
    expect(s.status).toBe("patched");
    expect(s.tailoredResumeId).toBe("r1");
    expect(s.tailoredResumeCommitted).toBe(false);
  });

  it("keeps two runs fully isolated (the core parallel guarantee)", () => {
    initRunState("a", {});
    initRunState("b", {});
    setRunState("a", { tailoredResumeId: "RA", tailoredResumeCommitted: false });
    setRunState("b", { tailoredResumeId: "RB", tailoredResumeCommitted: true });
    // A committing/failing must never change B's commit tracking, and vice versa.
    expect(getRunState("a").tailoredResumeId).toBe("RA");
    expect(getRunState("a").tailoredResumeCommitted).toBe(false);
    expect(getRunState("b").tailoredResumeId).toBe("RB");
    expect(getRunState("b").tailoredResumeCommitted).toBe(true);
  });

  it("returns a default for an uninitialized run and clears cleanly", () => {
    expect(getRunState("ghost").sessionId).toBe("ghost");
    initRunState("a", {});
    const before = _runStateSize();
    clearRunState("a");
    expect(_runStateSize()).toBe(before - 1);
    expect(getRunState("a").tailoredResumeId).toBeUndefined();
  });

  it("no-ops safely on a null runId", () => {
    expect(getRunState(null).sessionId).toBeNull();
    expect(setRunState(null, { x: 1 }).sessionId).toBeNull();
    initRunState(null, { x: 1 });
    clearRunState(null);
  });
});
