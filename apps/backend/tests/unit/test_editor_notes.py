"""Unit tests for the editor-note firewall (app.services.editor_notes)."""

from app.services.editor_notes import strip_editor_notes


def test_strips_inline_note_and_collapses_leading_space() -> None:
    text = "Raised TPR via QR/MRZ signals <!-- make this the lead bullet -->"
    assert strip_editor_notes(text) == "Raised TPR via QR/MRZ signals"


def test_strips_note_in_middle_without_leaving_double_space() -> None:
    text = "Cut latency <!-- add the 5s number --> in production"
    assert strip_editor_notes(text) == "Cut latency in production"


def test_strips_multiline_note() -> None:
    text = "Bullet text <!--\nremember to\nquantify this\n--> stays"
    assert strip_editor_notes(text) == "Bullet text stays"


def test_strips_multiple_notes() -> None:
    text = "A <!-- n1 --> B <!-- n2 --> C"
    assert strip_editor_notes(text) == "A B C"


def test_leaves_real_content_untouched() -> None:
    text = "Shipped to 9 tier-1 banks at 99.5% success"
    assert strip_editor_notes(text) == text


def test_preserves_markdown_hard_break_double_space() -> None:
    # Two trailing spaces before a newline are a markdown hard break; the strip
    # eats whitespace only before a comment span, so these must survive.
    text = "Line one  \nLine two"
    assert strip_editor_notes(text) == text


def test_non_string_returned_unchanged() -> None:
    assert strip_editor_notes(None) is None
    assert strip_editor_notes(42) == 42
