from pathlib import Path

from app.prompts.templates import SUMMARY_REWRITE_PROMPT


ROOT = Path(__file__).resolve().parents[3]
BACKEND_DEFAULTS = ROOT / "backend" / "app" / "prompts" / "extension_defaults"


def read_prompt(relative_path: str) -> str:
    return (BACKEND_DEFAULTS / relative_path).read_text()


def test_prompt2_summary_direction_prefers_one_sentence() -> None:
    prompt = read_prompt("prompt2.txt")
    contract = read_prompt("patches/prompt2.output-contract.txt")

    assert "prompt_version: v2.1.0" in prompt
    assert "the 2-3 highest-value proof themes" in prompt
    assert "use 1 by default; use 2 only when the role fit needs a second sentence" in prompt
    assert "`summary_sentences` must be `1` or `2`" in contract
    assert "the 3-5 proof themes" not in prompt
    assert "use 2 unless there is a strong reason not to" not in prompt
    assert "must be `2` unless" not in contract


def test_prompt3_summary_budget_is_documented() -> None:
    prompt = read_prompt("prompt3.txt")

    assert "prompt_version: v2.1.0" in prompt
    assert "Target 35-45 words, with a hard maximum of 50 words." in prompt
    assert "Do not stack proof lists; move extra proof into role bullets." in prompt


def test_summary_rewrite_prompt_uses_short_summary_budget() -> None:
    assert "Prefer 1 sentence and use at most 2 short sentences" in SUMMARY_REWRITE_PROMPT
    assert "Target 35-45 words with a hard maximum of 50 words" in SUMMARY_REWRITE_PROMPT
    assert "Prefer 2-4 sentences" not in SUMMARY_REWRITE_PROMPT
