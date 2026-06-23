import { describe, expect, it } from "vitest";

import { stripEditorNotes, stripEditorNotesDeep } from "./editor-notes.js";

describe("stripEditorNotes", () => {
  it("strips an inline note and collapses the leading space", () => {
    expect(
      stripEditorNotes("Raised TPR via QR/MRZ signals <!-- make this lead -->"),
    ).toBe("Raised TPR via QR/MRZ signals");
  });

  it("strips a note in the middle without leaving a double space", () => {
    expect(stripEditorNotes("Cut latency <!-- add 5s --> in production")).toBe(
      "Cut latency in production",
    );
  });

  it("strips multiline notes", () => {
    expect(stripEditorNotes("Bullet <!--\nquantify\n--> stays")).toBe(
      "Bullet stays",
    );
  });

  it("leaves real content untouched", () => {
    const text = "Shipped to 9 tier-1 banks at 99.5% success";
    expect(stripEditorNotes(text)).toBe(text);
  });

  it("returns non-strings unchanged", () => {
    expect(stripEditorNotes(null)).toBe(null);
    expect(stripEditorNotes(42)).toBe(42);
  });
});

describe("stripEditorNotesDeep", () => {
  it("strips notes from nested strings and preserves shape", () => {
    const input = {
      summary: "Senior PM <!-- emphasize fintech -->",
      bullets: ["Shipped X <!-- add metric -->", "Owned Y"],
      meta: { title: "PM <!-- bridge title -->" },
    };
    expect(stripEditorNotesDeep(input)).toEqual({
      summary: "Senior PM",
      bullets: ["Shipped X", "Owned Y"],
      meta: { title: "PM" },
    });
  });

  it("passes through null and arrays", () => {
    expect(stripEditorNotesDeep(null)).toBe(null);
    expect(stripEditorNotesDeep(["A <!-- n -->", "B"])).toEqual(["A", "B"]);
  });
});
