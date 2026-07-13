import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFireGate } from "./fire-gate.js";

function makeClock(start = 1000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}

describe("fire-gate", () => {
  let clock;
  let wait;

  beforeEach(() => {
    clock = makeClock();
    // Model wait(ms) as advancing the fake clock by ms and resolving — no real
    // timers, so tests are deterministic and instant.
    wait = vi.fn((ms) => {
      clock.advance(ms);
      return Promise.resolve();
    });
  });

  function makeGate(overrides = {}) {
    return createFireGate({
      now: clock.now,
      wait,
      minGapMs: 400,
      maxGapMs: 1000,
      random: () => 0, // gap = minGapMs = 400 (deterministic)
      ...overrides,
    });
  }

  it("resolves the FIRST acquire immediately, without waiting", async () => {
    const gate = makeGate();
    const meta = await gate.acquire({ runId: "a" });
    expect(wait).not.toHaveBeenCalled();
    expect(meta).toEqual({ runId: "a" });
  });

  it("spaces a second acquire issued immediately after the first by ~the gap", async () => {
    const gate = makeGate();
    await gate.acquire({ runId: "a" });
    await gate.acquire({ runId: "b" });

    expect(wait).toHaveBeenCalledTimes(1);
    const waited = wait.mock.calls[0][0];
    expect(waited).toBeGreaterThanOrEqual(400);
    expect(waited).toBeLessThanOrEqual(1000);
    expect(waited).toBe(400); // random=()=>0 → gap=minGapMs
  });

  it("adds NO latency when the gap has already elapsed (serial performance)", async () => {
    const gate = makeGate();
    await gate.acquire({ runId: "a" });

    // Simulate a serial run: the next fire arrives well after the gap.
    clock.advance(1001); // past maxGapMs

    await gate.acquire({ runId: "b" });
    expect(wait).not.toHaveBeenCalled();
  });

  it("resolves concurrent acquires in FIFO order, each spaced by ~the gap", async () => {
    const gate = makeGate();
    const order = [];

    // Fire four acquires at once without awaiting between them.
    const promises = ["a", "b", "c", "d"].map((runId) =>
      gate.acquire({ runId }).then((meta) => order.push(meta.runId)),
    );
    await Promise.all(promises);

    expect(order).toEqual(["a", "b", "c", "d"]);
    // First fires immediately; the other three each wait one gap.
    expect(wait).toHaveBeenCalledTimes(3);
    for (const call of wait.mock.calls) {
      expect(call[0]).toBe(400);
    }
  });

  it("reset() clears the chain so the next acquire fires immediately", async () => {
    const gate = makeGate();
    await gate.acquire({ runId: "a" });
    gate.reset();

    await gate.acquire({ runId: "b" });
    expect(wait).not.toHaveBeenCalled();
  });
});
