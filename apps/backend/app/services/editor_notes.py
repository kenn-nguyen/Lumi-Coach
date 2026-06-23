"""Editor-note firewall (mechanical, meaning-safe).

Authors leave private directives inside their master resume / story bank.
Prompt 2 reads them raw so it can interpret them; every downstream surface that
emits resume-facing text (Prompt 3) must never see them.

"Stripping" removes the ENTIRE note span -- its delimiters AND the text inside
them -- not just the marker characters. We can only do that safely where the
note is clearly delimited, so we recognise every form a note actually takes in
stored resumes and remove each whole span:

  1. HTML comment:            ``<!-- ... -->``
  2. Entity-encoded comment:  ``&lt;!-- ... --&gt;`` (editors that HTML-encode ``<``)
  3. ``<em>...</em>`` wrappers left around the above as artifacts
  4. Plain-text parenthetical anchored on an explicit note marker, e.g.
     ``(Don't keep writer's note... Writer's note: ...)``. Matched ONLY when the
     parenthetical names a writer's/editor's note, so genuine parentheticals
     like ``(MBA consulting project)`` are left untouched.

Each pattern eats an optional run of spaces/tabs immediately before it so
removal does not leave a doubled space. Trailing line whitespace is left alone,
so markdown hard breaks are preserved. Mirrors the extension's editor-notes.js.
"""

import re

# Entity-encoded comment first: it may itself contain stray ``<em>`` tags, so
# removing the whole ``&lt;!-- ... --&gt;`` span clears them in one pass.
_ENTITY_COMMENT_RE = re.compile(r"[ \t]*&lt;!--.*?--&gt;", re.DOTALL)
_HTML_COMMENT_RE = re.compile(r"[ \t]*<!--.*?-->", re.DOTALL)
# Parenthetical note: only when it explicitly names a writer's/editor's note or
# a "don't keep ... note" directive -- never a normal parenthetical.
_WRITER_NOTE_PAREN_RE = re.compile(
    r"[ \t]*\([^)]*(?:writer'?s note|editor'?s note|don'?t keep[^)]*note)[^)]*\)",
    re.IGNORECASE,
)
# Orphaned emphasis tags left once a wrapped note is removed. Resume plain text
# carries no real ``<em>`` formatting, so dropping the tags (keeping any inner
# text) is meaning-safe.
_EM_TAG_RE = re.compile(r"[ \t]*</?em\b[^>]*>", re.IGNORECASE)


def strip_editor_notes(text: str) -> str:
    """Remove private author-note spans from prompt-bound text.

    Handles literal and entity-encoded HTML comments, ``<em>`` wrappers, and
    explicit plain-text writer's/editor's-note parentheticals. Non-strings are
    returned unchanged so the helper is safe to apply to optional template
    variables.
    """
    if not isinstance(text, str):
        return text
    text = _ENTITY_COMMENT_RE.sub("", text)
    text = _HTML_COMMENT_RE.sub("", text)
    text = _WRITER_NOTE_PAREN_RE.sub("", text)
    text = _EM_TAG_RE.sub("", text)
    return text
