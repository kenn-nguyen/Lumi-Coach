"""Editor-note firewall (mechanical, meaning-safe).

Authors may leave private directives inside their master resume as HTML-comment
spans, e.g. ``Raised TPR via QR/MRZ signals <!-- make this the lead bullet -->``.
Prompt 2 reads these raw so it can interpret them; every downstream surface that
emits resume-facing text (Prompt 3) must never see them. Stripping a delimited
``<!-- ... -->`` span removes only the marker, not meaning, so it is safe to do
in code (same class as em dash -> hyphen).
"""

import re

# Eats an optional run of spaces/tabs immediately before the comment so removal
# does not leave a doubled space. Does not touch trailing line whitespace, so
# markdown hard breaks are preserved.
_EDITOR_NOTE_RE = re.compile(r"[ \t]*<!--.*?-->", re.DOTALL)


def strip_editor_notes(text: str) -> str:
    """Remove private author-note spans (``<!-- ... -->``) from prompt-bound text.

    Non-strings are returned unchanged so the helper is safe to apply to optional
    template variables.
    """
    if not isinstance(text, str):
        return text
    return _EDITOR_NOTE_RE.sub("", text)
