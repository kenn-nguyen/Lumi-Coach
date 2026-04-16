# Chrome Extension Scaffold

This folder is reserved for the LinkedIn-to-resume Chrome extension.

Planned flow:
- Show a floating generate action on LinkedIn job pages
- Extract job data from LinkedIn
- Run the multi-step prompt pipeline
- Produce `ResumeData` JSON
- Create one job-specific `resume_id`
- Patch the tailored JSON into that record
- Open the resume preview page in SOM Career Coach
- Use the side panel as an admin board for assets, status, and history

Key files:
- `manifest.json`: Chrome extension manifest (MV3)
- `src/background.js`: extension coordinator
- `src/content/linkedin-job.js`: LinkedIn floating action and trigger
- `src/prompts/prompt1.txt`: keyword extraction prompt
- `src/prompts/prompt2.txt`: planning/summarization prompt
- `src/prompts/prompt3.txt`: resume-tailoring prompt
- `src/shared/contracts.js`: shared request/response shape notes

Source-aligned port locations:
- `src/content/site-adapters/linkedin/adapter.ts`
- `src/providers/llm/web-automation/chatgpt-automation.ts`
- `src/providers/llm/prompting/web-automation-renderer.ts`
- `src/providers/llm/prompting/chatgpt-prompt-sequence.ts`

See `PORTING_MAP.md` for the exact source-to-target mapping.
See `ARCHITECTURE.md` for checkpointing and retry behavior.
See `ENGINEERING.md` for architecture and coding practices.

Nothing in this folder is wired into the main app yet.
