// Fire-gate — a global minimum-interval throttle for web-automation LLM prompt
// fires (ChatGPT/Claude/Gemini web). When several tailoring jobs run at once,
// their prompt fires can land back-to-back and trip bot detection. The gate
// spaces fires out so no two land closer together than a randomized gap.
//
// CRITICAL: this is a MINIMUM-INTERVAL throttle, NOT a fixed pre-delay. Serial
// runs — where fires are naturally seconds apart — pay ZERO added latency: if
// the gap has already elapsed since the previous fire, acquire() resolves
// immediately. Only fires that arrive closer together than the gap get spaced,
// and each waits only the remaining time.
//
// Pure and dependency-injected (no chrome APIs): the caller supplies now()/
// wait()/random() so timing is deterministic under test.

export function createFireGate({
  now = () => Date.now(),
  wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  minGapMs = 500,
  maxGapMs = 3234,
  random = Math.random,
} = {}) {
  // All callers serialize through this single FIFO promise chain, so the gap is
  // measured off the ACTUAL previous release, never a stale timestamp.
  let chain = Promise.resolve();
  let lastFireAt = null; // timestamp of the previous fire's release, or null

  function acquire(meta = {}) {
    const result = chain.then(async () => {
      const gap = minGapMs + random() * (maxGapMs - minGapMs);
      const elapsed = lastFireAt === null ? Infinity : now() - lastFireAt;
      const remaining = gap - elapsed;
      if (remaining > 0) await wait(remaining);
      lastFireAt = now();
      return meta;
    });
    // Keep the chain alive even if a caller's continuation rejects, so one
    // failure can't wedge the gate for everyone behind it.
    chain = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  function reset() {
    chain = Promise.resolve();
    lastFireAt = null;
  }

  return { acquire, reset };
}

// Default singleton used by the real extension (created with defaults).
const defaultFireGate = createFireGate();

export function acquireWebFireSlot(meta) {
  return defaultFireGate.acquire(meta);
}

export function resetWebFireGate() {
  return defaultFireGate.reset();
}
