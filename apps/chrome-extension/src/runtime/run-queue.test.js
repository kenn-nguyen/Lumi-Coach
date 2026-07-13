import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRunQueue, MAX_ACTIVE, HISTORY_TTL_MS } from "./run-queue.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeClock(start = 1000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
    set: (v) => {
      t = v;
    },
  };
}

function job(runId, extra = {}) {
  return { runId, title: `T-${runId}`, jobUrl: `https://x/${runId}`, ...extra };
}

describe("run-queue", () => {
  let clock;
  let started;
  let persist;
  let startRun;

  beforeEach(() => {
    clock = makeClock();
    started = [];
    persist = vi.fn(async () => {});
    startRun = vi.fn(async (record) => {
      started.push(record.runId);
    });
  });

  function makeQueue(maxParallel = 1) {
    return createRunQueue({ persist, startRun, now: clock.now, maxParallel });
  }

  it("runs the first job and keeps the rest queued when serial", async () => {
    const q = makeQueue(1);
    expect(q.enqueue(job("a"))).toEqual({ ok: true, runId: "a" });
    expect(q.enqueue(job("b"))).toEqual({ ok: true, runId: "b" });
    await flush();
    expect(started).toEqual(["a"]);
    expect(q.get("a").status).toBe("preparing");
    expect(q.get("b").status).toBe("queued");
  });

  it("starts the next queued job when the running one succeeds", async () => {
    const q = makeQueue(1);
    q.enqueue(job("a"));
    q.enqueue(job("b"));
    await flush();
    q.markRunning("a");
    q.markSucceeded("a", { tailoredResumeId: "r1" });
    await flush();
    expect(started).toEqual(["a", "b"]);
    expect(q.get("a").status).toBe("succeeded");
    expect(q.get("a").tailoredResumeId).toBe("r1");
    expect(q.get("b").status).toBe("preparing");
  });

  it("runs up to maxParallel concurrently", async () => {
    const q = makeQueue(3);
    q.enqueue(job("a"));
    q.enqueue(job("b"));
    q.enqueue(job("c"));
    q.enqueue(job("d"));
    await flush();
    expect(started.sort()).toEqual(["a", "b", "c"]);
    expect(q.get("d").status).toBe("queued");
    expect(q.countSlots()).toBe(3);
  });

  it("enforces the 5-active cap", () => {
    const q = makeQueue(1);
    for (let i = 0; i < MAX_ACTIVE; i += 1) {
      expect(q.enqueue(job(`j${i}`)).ok).toBe(true);
    }
    const over = q.enqueue(job("extra"));
    expect(over).toEqual({ ok: false, reason: "cap", limit: MAX_ACTIVE });
  });

  it("dedupes an already-active job by URL", () => {
    const q = makeQueue(1);
    q.enqueue(job("a", { jobUrl: "https://job/1" }));
    const dup = q.enqueue(job("b", { jobUrl: "https://job/1" }));
    expect(dup).toEqual({ ok: false, reason: "duplicate", existingRunId: "a" });
  });

  it("does not dedupe manual jobs with no URL", () => {
    const q = makeQueue(1);
    expect(q.enqueue(job("a", { jobUrl: "" })).ok).toBe(true);
    expect(q.enqueue(job("b", { jobUrl: "" })).ok).toBe(true);
  });

  it("removes a queued job silently, cancels a running one", async () => {
    const q = makeQueue(1);
    q.enqueue(job("a"));
    q.enqueue(job("b"));
    await flush();
    q.markRunning("a");
    // queued b -> removed (no history)
    expect(q.requestCancelOrRemove("b").action).toBe("removed");
    expect(q.get("b")).toBeNull();
    // running a -> cancel (caller tears down, then marks canceled)
    expect(q.requestCancelOrRemove("a").action).toBe("cancel");
    q.markCanceled("a");
    expect(q.get("a").status).toBe("canceled");
  });

  it("frees the running slot on needs_attention and resumes others", async () => {
    const q = makeQueue(1);
    q.enqueue(job("a"));
    q.enqueue(job("b"));
    await flush();
    q.markRunning("a");
    q.markNeedsAttention("a", { subStage: "Sign in" });
    await flush();
    expect(q.get("a").status).toBe("needs_attention");
    expect(started).toEqual(["a", "b"]); // b started once a freed the slot
  });

  it("heals in-flight jobs to needs_attention on hydrate (SW restart)", () => {
    const q = makeQueue(1);
    q.hydrate([
      { runId: "a", status: "running", jobUrl: "u" },
      { runId: "b", status: "queued", jobUrl: "v" },
      { runId: "c", status: "succeeded", jobUrl: "w", endedAt: 500 },
    ]);
    expect(q.get("a").status).toBe("needs_attention");
    expect(q.get("b").status).toBe("queued");
    expect(q.get("c").status).toBe("succeeded");
  });

  it("orders active newest-first, then terminal newest-finished-first", async () => {
    const q = makeQueue(3);
    q.enqueue(job("a"));
    clock.advance(1);
    q.enqueue(job("b"));
    clock.advance(1);
    q.enqueue(job("c"));
    await flush();
    q.markRunning("a");
    clock.advance(1);
    q.markFailed("a");
    // active b,c newest-queued first → c, b ; then terminal a
    expect(q.getSnapshot().map((r) => r.runId)).toEqual(["c", "b", "a"]);
  });

  it("prunes terminal jobs older than the TTL", () => {
    const q = makeQueue(1);
    q.hydrate([
      { runId: "old", status: "succeeded", endedAt: clock.now() },
      { runId: "fresh", status: "succeeded", endedAt: clock.now() },
    ]);
    clock.advance(HISTORY_TTL_MS + 1);
    q.get("fresh"); // no-op read
    // bump 'fresh' end time to now so it survives
    q.markSucceeded("fresh");
    q.pruneHistory();
    expect(q.get("old")).toBeNull();
    expect(q.get("fresh")).not.toBeNull();
  });

  it("raising maxParallel starts more queued jobs", async () => {
    const q = makeQueue(1);
    q.enqueue(job("a"));
    q.enqueue(job("b"));
    q.enqueue(job("c"));
    await flush();
    expect(started).toEqual(["a"]);
    q.setMaxParallel(3);
    await flush();
    expect(started.sort()).toEqual(["a", "b", "c"]);
  });

  it("resumes needs_attention runs back into the queue", async () => {
    const q = makeQueue(1);
    q.enqueue(job("a"));
    await flush();
    q.markRunning("a");
    q.markNeedsAttention("a", { subStage: "Sign in" });
    expect(q.get("a").status).toBe("needs_attention");
    const changed = q.resumeNeedsAttention();
    await flush();
    expect(changed).toBe(true);
    expect(q.get("a").status).toBe("preparing"); // pumped back into a run slot
    expect(q.get("a").subStage).toBe(null);
  });

  it("persists after mutations via the injected writer", async () => {
    const q = makeQueue(1);
    q.enqueue(job("a"));
    await flush();
    expect(persist).toHaveBeenCalled();
  });
});
