// Editor-note firewall (mechanical, meaning-safe).
//
// Authors may leave private directives inside their master resume / story bank
// as HTML-comment spans, e.g. `Raised TPR via QR/MRZ signals <!-- make this the
// lead bullet -->`. Prompt 2 reads these raw so it can interpret them; every
// downstream surface that emits resume-facing text (Prompt 3) must never see
// them. Stripping a delimited `<!-- ... -->` span removes only the marker, not
// meaning, so it is safe to do in code (same class as em dash -> hyphen).

// Eats an optional run of spaces/tabs immediately before the comment so removal
// does not leave a doubled space. Does not touch trailing line whitespace, so
// markdown hard breaks are preserved.
const EDITOR_NOTE_RE = /[ \t]*<!--[\s\S]*?-->/g;

export function stripEditorNotes(text) {
  if (typeof text !== "string") return text;
  return text.replace(EDITOR_NOTE_RE, "");
}

// Recursively strips note spans from every string inside a value, preserving
// the original shape (objects stay objects, arrays stay arrays) so JSON
// payloads still serialize correctly.
export function stripEditorNotesDeep(value) {
  if (typeof value === "string") return stripEditorNotes(value);
  if (Array.isArray(value)) return value.map(stripEditorNotesDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = stripEditorNotesDeep(val);
    }
    return out;
  }
  return value;
}
