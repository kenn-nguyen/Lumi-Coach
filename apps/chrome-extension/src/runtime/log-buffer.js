// Diagnostic log buffer for the "Save logs" export.
//
// Two separate stores so a saved file is sufficient to debug a failure without
// being bloated by successful work:
//   - entries[]:      lean timeline. Fed by every logInfo/logWarn/logError, with
//                     each string capped SMALL so full prompt I/O of succeeded
//                     stages becomes a short preview. Doubly bounded (count +
//                     bytes) and self-evicting — this is the in-memory cleanup.
//   - rawEmissions[]: FULL raw output(s) that led to a failure (the original
//                     failing output + each self-heal/repair attempt), at high
//                     fidelity. Bounded to the last few, cleared at run start so
//                     it reflects only the current failed stage's attempts.
//
// No chrome dependency — pure module, unit-testable in isolation.

const ENTRY_STRING_CAP = 4_000;
const RAW_STRING_CAP = 50_000;
const MAX_ENTRIES = 1_000;
const MAX_BYTES = 3_000_000;
const MAX_RAW_EMISSIONS = 5;
const PERSIST_MAX_BYTES = 1_500_000;

const MAX_CLONE_DEPTH = 8;
const MAX_ARRAY_ITEMS = 250;

let entries = [];
let rawEmissions = [];
let approxBytes = 0;

function nowMs() {
  // Date.now is available in the extension runtime (background SW / content).
  return Date.now();
}

function capString(value, cap) {
  if (typeof value !== "string") {
    return value;
  }
  if (value.length <= cap) {
    return value;
  }
  return `${value.slice(0, cap)}…[+${value.length - cap} chars]`;
}

// Recursive, size-bounded, circular-safe clone. Caps strings, limits depth and
// array length so one huge or cyclic object can't bloat memory or the export.
function safeClone(value, stringCap, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }

  const type = typeof value;
  if (type === "string") {
    return capString(value, stringCap);
  }
  if (type === "number" || type === "boolean") {
    return value;
  }
  if (type === "bigint") {
    return value.toString();
  }
  if (type === "function" || type === "symbol") {
    return undefined;
  }

  if (depth >= MAX_CLONE_DEPTH) {
    return "[truncated: max depth]";
  }

  if (type === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      const out = [];
      const limit = Math.min(value.length, MAX_ARRAY_ITEMS);
      for (let index = 0; index < limit; index += 1) {
        out.push(safeClone(value[index], stringCap, depth + 1, seen));
      }
      if (value.length > MAX_ARRAY_ITEMS) {
        out.push(`[+${value.length - MAX_ARRAY_ITEMS} more items]`);
      }
      seen.delete(value);
      return out;
    }

    if (value instanceof Error) {
      seen.delete(value);
      return {
        name: value.name,
        message: capString(value.message ?? "", stringCap),
        stack: capString(value.stack ?? "", stringCap),
      };
    }

    const out = {};
    for (const key of Object.keys(value)) {
      const cloned = safeClone(value[key], stringCap, depth + 1, seen);
      if (cloned !== undefined) {
        out[key] = cloned;
      }
    }
    seen.delete(value);
    return out;
  }

  return undefined;
}

function estimateBytes(entry) {
  try {
    return JSON.stringify(entry).length;
  } catch {
    return 0;
  }
}

function evictToBounds() {
  while (
    entries.length > MAX_ENTRIES ||
    (approxBytes > MAX_BYTES && entries.length > 1)
  ) {
    const removed = entries.shift();
    approxBytes -= removed.__bytes ?? 0;
  }
  if (entries.length === 0) {
    approxBytes = 0;
  }
}

export function recordLog(level, scope, message, data) {
  const entry = {
    tsMs: nowMs(),
    level,
    scope,
    message,
    ...(data === undefined
      ? {}
      : { data: safeClone(data, ENTRY_STRING_CAP) }),
  };
  entry.__bytes = estimateBytes(entry);
  approxBytes += entry.__bytes;
  entries.push(entry);
  evictToBounds();
}

// Record the FULL raw output that led to a failure (original + each repair
// attempt). High fidelity on purpose; this is the payload I actually need.
export function recordRawEmission({ stage, attempt, rawText, validationMessage }) {
  const text = typeof rawText === "string" ? rawText : "";
  rawEmissions.push({
    tsMs: nowMs(),
    stage: stage ?? null,
    attempt: attempt ?? null,
    rawTextLength: text.length,
    rawText: capString(text, RAW_STRING_CAP),
    validationMessage: capString(validationMessage ?? "", ENTRY_STRING_CAP),
  });
  if (rawEmissions.length > MAX_RAW_EMISSIONS) {
    rawEmissions = rawEmissions.slice(-MAX_RAW_EMISSIONS);
  }
}

export function clearRawEmissions() {
  rawEmissions = [];
}

export function clearBufferedLogs() {
  entries = [];
  rawEmissions = [];
  approxBytes = 0;
}

function strip(entry) {
  const { __bytes, ...rest } = entry;
  return rest;
}

export function getBufferedLogs() {
  return entries.map(strip);
}

export function getRawEmissions() {
  return rawEmissions.slice();
}

// Most-recent entries trimmed to a byte budget, plus all raw emissions. Used for
// the single overwriting failure snapshot persisted to chrome.storage.
export function getPersistableSnapshot() {
  const trimmed = [];
  let bytes = 0;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const size = entries[index].__bytes ?? 0;
    if (bytes + size > PERSIST_MAX_BYTES && trimmed.length > 0) {
      break;
    }
    bytes += size;
    trimmed.push(strip(entries[index]));
  }
  trimmed.reverse();
  return { entries: trimmed, rawEmissions: rawEmissions.slice() };
}

export function formatLogsForExport(meta = {}) {
  return {
    appName: "Lumi Coach",
    format: "log-export-v1",
    exportedAt: new Date().toISOString(),
    ...meta,
    entryCount: entries.length,
    rawEmissionCount: rawEmissions.length,
    entries: getBufferedLogs(),
    rawEmissions: getRawEmissions(),
  };
}
