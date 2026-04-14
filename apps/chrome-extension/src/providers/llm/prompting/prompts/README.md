# Prompt Assets

The active prompt templates currently live in:
- `apps/chrome-extension/src/prompts/prompt1.txt`
- `apps/chrome-extension/src/prompts/prompt2.txt`
- `apps/chrome-extension/src/prompts/prompt3.txt`

Reserved future prompt slot:
- `apps/chrome-extension/src/prompts/prompt4-repair.txt`

Use `src/providers/llm/prompting/prompt-loader.ts` to:
- load the template text from the packaged extension
- replace placeholders such as `{{JOB_DESCRIPTION}}`
- render the final prompt string for the ChatGPT automation layer

This folder remains reserved in case prompt assets are moved closer to the LLM provider later.

The repair prompt is intentionally not wired yet. It is only reserved as a future schema-fix step after Prompt 3 validation.
