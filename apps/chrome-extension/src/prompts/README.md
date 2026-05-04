# Prompt Slots

Current prompt chain:

- `prompt1.txt`: job-description extraction
- `prompt2.txt`: compression and prioritization
- `prompt3.txt`: final SOM Career Coach JSON generation
- `prompt4.txt`: master-resume extraction from uploaded Markdown

Reserved for future use:

- `prompt4-repair.txt`

Planned purpose of the reserved repair prompt:

- repair malformed or schema-invalid Prompt 3 output
- preserve content as much as possible
- correct structure only
- return valid SOM Career Coach JSON

This repair step is intentionally not implemented yet.

## Prompt Version Metadata

Every packaged prompt artifact should start with a metadata block:

```txt
---
prompt_artifact: prompt1.template
prompt_version: v1
prompt_label: short-human-readable-label
prompt_notes: One sentence describing the behavior this version represents.
ai_update_notes: When changing this artifact manually or with AI, update prompt_version, prompt_label, and prompt_notes so promptMetadata identifies the new prompt behavior.
---
```

The extension records this block in run `promptMetadata` and strips it before model execution. Keep the packaged fallback metadata aligned with the backend-owned default artifacts in `apps/backend/app/prompts/extension_defaults/`.
