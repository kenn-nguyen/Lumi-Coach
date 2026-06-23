// Editor-note firewall (mechanical, meaning-safe).
//
// Authors leave private directives inside their master resume / story bank.
// Prompt 2 reads them raw so it can interpret them; every downstream surface
// that emits resume-facing text (Prompt 3) must never see them.
//
// "Stripping" removes the ENTIRE note span — its delimiters AND the text inside
// them — not just the marker characters. We can only do that safely where the
// note is clearly delimited, so we recognise every form a note actually takes
// in stored resumes and remove each whole span:
//
//   1. HTML comment:            `<!-- ... -->`
//   2. Entity-encoded comment:  `&lt;!-- ... --&gt;`  (editors that HTML-encode `<`)
//   3. `<em>…</em>` wrappers left around the above as artifacts
//   4. Plain-text parenthetical anchored on an explicit note marker, e.g.
//      `(Don't keep writer's note... Writer's note: ...)`. Matched ONLY when the
//      parenthetical names a writer's/editor's note, so genuine parentheticals
//      like `(MBA consulting project)` are left untouched.
//
// Each pattern eats an optional run of spaces/tabs immediately before it so
// removal does not leave a doubled space. Trailing line whitespace is left
// alone, so markdown hard breaks are preserved.

// Entity-encoded comment first: it may itself contain stray `<em>` tags, so
// removing the whole `&lt;!-- ... --&gt;` span clears them in one pass.
const ENTITY_COMMENT_RE = /[ \t]*&lt;!--[\s\S]*?--&gt;/g;
const HTML_COMMENT_RE = /[ \t]*<!--[\s\S]*?-->/g;
// Parenthetical note: only when it explicitly names a writer's/editor's note or
// a "don't keep ... note" directive — never a normal parenthetical.
const WRITER_NOTE_PAREN_RE =
  /[ \t]*\([^)]*(?:writer'?s note|editor'?s note|don'?t keep[^)]*note)[^)]*\)/gi;
// Orphaned emphasis tags left once a wrapped note is removed. Resume plain text
// carries no real `<em>` formatting, so dropping the tags (keeping any inner
// text) is meaning-safe.
const EM_TAG_RE = /[ \t]*<\/?em\b[^>]*>/gi;

export function stripEditorNotes(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(ENTITY_COMMENT_RE, "")
    .replace(HTML_COMMENT_RE, "")
    .replace(WRITER_NOTE_PAREN_RE, "")
    .replace(EM_TAG_RE, "");
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
