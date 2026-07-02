import { beforeEach, describe, expect, it } from "vitest";

import {
  clearBufferedLogs,
  clearRawEmissions,
  formatLogsForExport,
  getBufferedLogs,
  getPersistableSnapshot,
  getRawEmissions,
  recordLog,
  recordRawEmission,
} from "./log-buffer.js";

beforeEach(() => {
  clearBufferedLogs();
});

describe("log-buffer entries", () => {
  it("records entries with timestamp, level, scope, message, data", () => {
    recordLog("info", "Scope", "hello", { a: 1 });
    const logs = getBufferedLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: "info",
      scope: "Scope",
      message: "hello",
      data: { a: 1 },
    });
    expect(typeof logs[0].tsMs).toBe("number");
    // Internal byte accounting is not exposed.
    expect(logs[0].__bytes).toBeUndefined();
  });

  it("omits data when undefined and does not throw", () => {
    expect(() => recordLog("warn", "Scope", "no data")).not.toThrow();
    expect(getBufferedLogs()[0]).not.toHaveProperty("data");
  });

  it("evicts oldest entries past the count cap, keeping newest in order", () => {
    for (let i = 0; i < 1200; i += 1) {
      recordLog("info", "S", `m${i}`);
    }
    const logs = getBufferedLogs();
    expect(logs.length).toBeLessThanOrEqual(1000);
    // Newest preserved, oldest dropped.
    expect(logs[logs.length - 1].message).toBe("m1199");
    expect(logs.some((e) => e.message === "m0")).toBe(false);
  });

  it("evicts by byte budget when entries carry large payloads", () => {
    const big = "x".repeat(3_900); // near the 4k per-string entry cap
    for (let i = 0; i < 1000; i += 1) {
      recordLog("info", "S", `m${i}`, { blob: big });
    }
    // 1000 * ~4k = ~4MB > 3MB byte cap, so count must be trimmed below 1000.
    expect(getBufferedLogs().length).toBeLessThan(1000);
  });

  it("caps long strings in entry data (~4k)", () => {
    recordLog("info", "S", "m", { blob: "y".repeat(10_000) });
    const { blob } = getBufferedLogs()[0].data;
    expect(blob.length).toBeLessThan(10_000);
    expect(blob).toContain("[+");
  });

  it("handles circular references without throwing", () => {
    const obj = { name: "a" };
    obj.self = obj;
    expect(() => recordLog("info", "S", "m", obj)).not.toThrow();
    expect(getBufferedLogs()[0].data.self).toBe("[circular]");
  });
});

describe("log-buffer rawEmissions", () => {
  it("stores full raw output up to the large cap with length", () => {
    recordRawEmission({
      stage: "Prompt 2",
      attempt: 1,
      rawText: '{"a":1}',
      validationMessage: "Unable to parse JSON.",
    });
    const emissions = getRawEmissions();
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toMatchObject({
      stage: "Prompt 2",
      attempt: 1,
      rawText: '{"a":1}',
      rawTextLength: 7,
      validationMessage: "Unable to parse JSON.",
    });
  });

  it("preserves a large failing output near the 50k cap (not the 4k entry cap)", () => {
    const big = "z".repeat(40_000);
    recordRawEmission({ stage: "P3", attempt: "final", rawText: big });
    expect(getRawEmissions()[0].rawText.length).toBe(40_000);
    expect(getRawEmissions()[0].rawTextLength).toBe(40_000);
  });

  it("keeps only the most recent few emissions", () => {
    for (let i = 0; i < 8; i += 1) {
      recordRawEmission({ stage: "P", attempt: i, rawText: `r${i}` });
    }
    const emissions = getRawEmissions();
    expect(emissions.length).toBeLessThanOrEqual(5);
    expect(emissions[emissions.length - 1].rawText).toBe("r7");
  });

  it("clearRawEmissions resets only emissions, not entries", () => {
    recordLog("info", "S", "keep");
    recordRawEmission({ stage: "P", attempt: 1, rawText: "x" });
    clearRawEmissions();
    expect(getRawEmissions()).toHaveLength(0);
    expect(getBufferedLogs()).toHaveLength(1);
  });
});

describe("getPersistableSnapshot", () => {
  it("stays under the persist byte budget and includes emissions", () => {
    const big = "x".repeat(3_900);
    for (let i = 0; i < 1000; i += 1) {
      recordLog("info", "S", `m${i}`, { blob: big });
    }
    recordRawEmission({ stage: "P2", attempt: 1, rawText: "fail" });
    const snap = getPersistableSnapshot();
    const bytes = JSON.stringify(snap.entries).length;
    expect(bytes).toBeLessThanOrEqual(1_600_000);
    expect(snap.rawEmissions).toHaveLength(1);
    // Most-recent entry retained.
    expect(snap.entries[snap.entries.length - 1].message).toBe("m999");
  });
});

describe("formatLogsForExport", () => {
  it("returns the export shape with counts matching arrays", () => {
    recordLog("info", "S", "a");
    recordLog("error", "S", "b");
    recordRawEmission({ stage: "P2", attempt: 1, rawText: "x" });
    const out = formatLogsForExport({ version: "9.9.9", source: "memory" });
    expect(out.appName).toBe("Lumi Coach");
    expect(out.format).toBe("log-export-v1");
    expect(out.version).toBe("9.9.9");
    expect(out.source).toBe("memory");
    expect(out.entryCount).toBe(out.entries.length);
    expect(out.rawEmissionCount).toBe(out.rawEmissions.length);
    expect(out.entries).toHaveLength(2);
    expect(out.rawEmissions).toHaveLength(1);
  });
});
