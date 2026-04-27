# Extension Prompt Defaults

This folder contains the backend-owned default prompt artifacts synced to the Chrome extension through:

`POST /api/v1/config/extension-prompts/sync`

The extension stores these artifacts as cached server defaults. User-uploaded prompt bodies still take priority over server defaults, but output contracts, provider patches, and guardrails are system-owned.

## Base Prompt Templates

- `prompt1.txt`: job-description extraction
- `prompt2.txt`: job-fit analysis and prioritization
- `prompt3.txt`: tailored resume generation
- `prompt4.txt`: master-resume extraction into `ResumeData`

Sync artifact keys:

- `prompt1.template`
- `prompt2.template`
- `prompt3.template`
- `prompt4.template`

## Output Contracts

Output contracts live in `patches/` and define the immutable JSON shape expected from each prompt stage.

- `patches/prompt1.output-contract.txt`
- `patches/prompt2.output-contract.txt`
- `patches/prompt3.output-contract.txt`
- `patches/prompt4.output-contract.txt`

Sync artifact keys:

- `prompt1.output_contract`
- `prompt2.output_contract`
- `prompt3.output_contract`
- `prompt4.output_contract`

## Provider Patches

Provider patches live in `patches/` and are applied per prompt/provider/mode for Prompt 1 through Prompt 3.

Supported provider patch suffixes:

- `chatgpt-web`
- `chatgpt-api`
- `claude-web`
- `claude-api`
- `gemini-web`
- `gemini-api`

Filename pattern:

`patches/{prompt}.{provider-mode}.txt`

Sync artifact key pattern:

`{prompt}.patch.{provider-mode}`

Examples:

- `patches/prompt1.chatgpt-web.txt` -> `prompt1.patch.chatgpt-web`
- `patches/prompt2.claude-api.txt` -> `prompt2.patch.claude-api`
- `patches/prompt3.gemini-web.txt` -> `prompt3.patch.gemini-web`

## System Guardrails

- `patches/system.guardrails.txt`

Sync artifact key:

- `system.guardrails`

## Sync Behavior

The sync endpoint hashes each artifact and returns only changed artifacts compared with the extension's local manifest. If sync fails, the extension keeps using its cached server artifacts, then falls back to packaged extension files when an artifact is missing.

When adding, removing, or renaming an artifact, update `_get_extension_prompt_artifacts()` in:

`apps/backend/app/routers/config.py`
