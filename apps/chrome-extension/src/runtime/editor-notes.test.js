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

  // Real-world forms found in stored master resumes (entity-encoded comments,
  // <em> wrappers, and plain-text parentheticals).
  it("strips an entity-encoded comment wrapped in <em>", () => {
    expect(
      stripEditorNotes(
        "reusable risk-decisioning features <em>&lt;!--Don't keep writer's note in the final bullet. Writer's note: suitable for trust roles--&gt;</em>",
      ),
    ).toBe("reusable risk-decisioning features");
  });

  it("strips an entity-encoded comment with the <em> opening inside it", () => {
    expect(
      stripEditorNotes(
        "where the durable revenue and margin sat&lt;!--<em> Don't keep writer's note. Writer's note: proves P&L ownership --&gt;</em>",
      ),
    ).toBe("where the durable revenue and margin sat");
  });

  it("strips a plain-text writer's-note parenthetical", () => {
    expect(
      stripEditorNotes(
        "scaled to 500K daily requests. (Don't keep writer's note in the final bullet. Writer's note: highly relevant for client-facing positions)",
      ),
    ).toBe("scaled to 500K daily requests.");
  });

  it("preserves a genuine parenthetical that is not a note", () => {
    const text =
      "delivered a prioritized roadmap to Asia product leadership (MBA consulting project)";
    expect(stripEditorNotes(text)).toBe(text);
  });

  it("strips the note but keeps an adjacent genuine parenthetical", () => {
    expect(
      stripEditorNotes(
        "delivered roadmap (MBA consulting project) <em>&lt;!--Writer's note: preserve MBA info--&gt;</em>",
      ),
    ).toBe("delivered roadmap (MBA consulting project)");
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
