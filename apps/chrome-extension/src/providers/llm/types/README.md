# LLM Types

Reserved for provider-local types that may be needed during the port, such as:
- prompt input/output contracts
- automation result types
- provider debug event types

Current prompt rendering types:
- `prompting.ts`

Prompt 1 contract:
- use raw scraped JD text as the primary source field: `jobDescriptionRawText`
- treat title, company, and location as best-effort helper context only
