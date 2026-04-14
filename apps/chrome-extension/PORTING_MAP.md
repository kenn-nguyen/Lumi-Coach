# Porting Map

This extension workspace now includes the source-aligned folder layout for the files to be ported.

## Source -> Target

- `/Users/kennng/Documents/SOM - Executive Coach/extension/src/content/site-adapters/linkedin/adapter.ts`
  -> `apps/chrome-extension/src/content/site-adapters/linkedin/adapter.ts`

- `/Users/kennng/Documents/SOM - Executive Coach/extension/src/providers/llm/web-automation/chatgpt-automation.ts`
  -> `apps/chrome-extension/src/providers/llm/web-automation/chatgpt-automation.ts`

- `/Users/kennng/Documents/SOM - Executive Coach/extension/src/providers/llm/prompting/web-automation-renderer.ts`
  -> `apps/chrome-extension/src/providers/llm/prompting/web-automation-renderer.ts`

- `/Users/kennng/Documents/SOM - Executive Coach/extension/src/providers/llm/prompting/chatgpt-prompt-sequence.ts`
  -> `apps/chrome-extension/src/providers/llm/prompting/chatgpt-prompt-sequence.ts`

## Notes

- The current `manifest.json` still points at the original lightweight placeholder JS files.
- The new `src/**/*.ts` files are source placeholders only.
- Porting code into these files should stay inside `apps/chrome-extension` unless explicitly approved otherwise.
