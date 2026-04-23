# AGENTS.md - Resume Matcher

> **Context file for Codex.** Full documentation at [docs/agent/README.md](docs/agent/README.md).

---

## Project Overview

Resume Matcher is an AI-powered application for tailoring resumes to job descriptions.

| Layer | Stack |
|-------|-------|
| **Backend** | FastAPI + Python 3.13+, LiteLLM (multi-provider AI) |
| **Frontend** | Next.js 16 + React 19, Tailwind CSS v4 |
| **Chrome Extension** | MV3 extension, content script + background worker, local storage, prompt pipeline |
| **Database** | TinyDB (JSON file storage) |
| **PDF** | Headless Chromium via Playwright |

---

## First Steps

**Before exploring code, read the [navigator skill](.claude/skills/navigator/SKILL.md)** for codebase orientation.

If working inside `apps/chrome-extension`, also read:
- [apps/chrome-extension/AGENTS.md](apps/chrome-extension/AGENTS.md)
- [apps/chrome-extension/ARCHITECTURE.md](apps/chrome-extension/ARCHITECTURE.md)
- [apps/chrome-extension/ENGINEERING.md](apps/chrome-extension/ENGINEERING.md)

---

## Skills-First Workflow

**Before starting any task, identify which skills apply and invoke them.** This is mandatory, not optional.

### How to Use Skills

1. **Read the task** — understand what the user is asking.
2. **Scan the catalog below** — identify every skill that could apply.
3. **Invoke the matching skills** (via the Skill tool) before writing any code or giving answers.
4. **Follow skill instructions** — each skill has its own process; respect it.

### Skills Catalog

| Skill | Invoke command | When to use |
|-------|---------------|-------------|
| **using-superpowers** | `/using-superpowers` | At conversation start — establishes skill discovery and usage |
| **navigator** | `/navigator` | First step when exploring code, finding files, or understanding project structure |
| **codebase-navigator** | `/codebase-navigator` | Advanced code search with ripgrep — find functions, classes, endpoints, trace data flows |
| **brainstorming** | `/brainstorming` | Before any creative work — creating features, building components, adding functionality |
| **simple** | `/simple` | Lightweight brainstorming for small/medium creative or architectural decisions |
| **writing-plans** | `/writing-plans` | When you have a spec or requirements for a multi-step task, before touching code |
| **systematic-debugging** | `/systematic-debugging` | When encountering any bug, test failure, or unexpected behavior — before proposing fixes |
| **code-review** | `/code-review` | When receiving code review feedback — verify before implementing, don't blindly agree |
| **requesting-code-review** | `/requesting-code-review` | After completing tasks or major features — verify work meets requirements before merging |
| **design-principles** | `/design-principles` | When designing new UI components or modifying existing component styles (Swiss International Style) |
| **react-patterns** | `/react-patterns` | React/Next.js performance optimization — local/offline or Docker-deployed apps |
| **nextjs-performance** | `/nextjs-performance` | Next.js 15 critical fixes — components, data fetching, Server Actions, bundle size |
| **tailwind-pattern** | `/tailwind-pattern` | Tailwind CSS patterns — layouts, cards, navigation, forms, buttons, typography |
| **fastapi** | `/fastapi` | Python APIs with FastAPI, Pydantic v2, JWT auth — prevents 7 documented errors |

### Task-to-Skills Mapping

| Task type | Skills to invoke (in order) |
|-----------|----------------------------|
| **New feature** | brainstorming (or simple) → writing-plans → navigator → [frontend/backend skills] → requesting-code-review |
| **Bug fix** | systematic-debugging → codebase-navigator → [frontend/backend skills] → requesting-code-review |
| **Frontend UI work** | design-principles → react-patterns → nextjs-performance → tailwind-pattern |
| **Backend API work** | fastapi → codebase-navigator |
| **Code exploration** | navigator → codebase-navigator |
| **Responding to review** | code-review |
| **Multi-step implementation** | writing-plans → [relevant skills per step] |

---

## Non-Negotiable Rules

1. **All frontend UI changes** MUST follow [Swiss International Style](docs/agent/design/style-guide.md)
2. **All Python functions** MUST have type hints
3. **Run `npm run lint`** before committing frontend changes
4. **Run `npm run format`** (Prettier) before committing
5. **Log detailed errors server-side**, return generic messages to clients
6. **Do NOT modify** `.github/workflows/` files without explicit request

---

## Essential Commands

```bash
# Backend (from repo root)
cd apps/backend
uv sync                                              # Install Python dependencies
uv run uvicorn app.main:app --reload --port 8000     # FastAPI on :8000

# Frontend (from repo root, in a separate terminal)
cd apps/frontend
npm install                                          # Install Node.js dependencies
npm run dev                                          # Next.js on :3000

# Chrome extension (from repo root)
cd apps/chrome-extension
npm test                                             # Vitest suite for extension runtime/content/shared code

# Quality checks (from apps/frontend)
npm run lint          # Lint frontend
npm run format        # Format with Prettier

# Build (from apps/frontend)
npm run build
```

---

## Project Structure

```
apps/
├── backend/                 # FastAPI + Python
│   ├── app/
│   │   ├── main.py          # Entry point
│   │   ├── config.py        # Environment settings
│   │   ├── database.py      # TinyDB wrapper
│   │   ├── llm.py           # LiteLLM wrapper
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── schemas/         # Pydantic models
│   │   └── prompts/         # LLM prompt templates
│   └── data/                # Database storage
│
├── chrome-extension/        # MV3 browser extension for LinkedIn/manual JD tailoring
│   ├── src/background.js    # Background worker, auth/session state, prompt sync
│   ├── src/content/         # Floating launcher/board UI and page adapters
│   ├── src/runtime/         # Orchestration, validation, storage, API client
│   ├── src/shared/          # Route classification, contracts, ZIP helpers
│   └── src/prompts/         # Packaged prompt fallback assets
│
└── frontend/                # Next.js + React
    ├── app/                 # Pages (dashboard, builder, tailor, print)
    ├── components/          # UI components
    ├── lib/                 # Utilities, API client
    ├── hooks/               # Custom React hooks
    └── messages/            # i18n translations (en, es, zh, ja)
```

---

## Documentation by Task

### For Backend Changes
1. [Backend guide](docs/agent/architecture/backend-guide.md) - Architecture, modules, services
2. [API contracts](docs/agent/apis/front-end-apis.md) - API specifications
3. [LLM integration](docs/agent/llm-integration.md) - Multi-provider AI support
4. [apps/backend/app/routers/config.py](apps/backend/app/routers/config.py) - extension prompt sync endpoint and backend-owned prompt defaults

### For Frontend Changes
1. [Frontend workflow](docs/agent/architecture/frontend-workflow.md) - User flow, components
2. [Style guide](docs/agent/design/style-guide.md) - **REQUIRED** Swiss International Style
3. [Coding standards](docs/agent/coding-standards.md) - Frontend conventions

### For Chrome Extension Changes
1. [apps/chrome-extension/ARCHITECTURE.md](apps/chrome-extension/ARCHITECTURE.md) - runtime flow and checkpointing
2. [apps/chrome-extension/ENGINEERING.md](apps/chrome-extension/ENGINEERING.md) - extension architecture guidance
3. [apps/chrome-extension/src/runtime/orchestrator.js](apps/chrome-extension/src/runtime/orchestrator.js) - prompt pipeline and generation flow
4. [apps/chrome-extension/src/content/linkedin-job.js](apps/chrome-extension/src/content/linkedin-job.js) - floating board UI, multi-tab status, manual JD mode

### For Template/PDF Changes
1. [PDF template guide](docs/agent/design/pdf-template-guide.md) - PDF rendering
2. [Template system](docs/agent/design/template-system.md) - Resume templates
3. [Resume templates](docs/agent/features/resume-templates.md) - Template types & controls

### For Features
| Feature | Documentation |
|---------|---------------|
| Custom sections | [custom-sections.md](docs/agent/features/custom-sections.md) |
| Resume templates | [resume-templates.md](docs/agent/features/resume-templates.md) |
| i18n | [i18n.md](docs/agent/features/i18n.md) |
| AI enrichment | [enrichment.md](docs/agent/features/enrichment.md) |
| JD matching | [jd-match.md](docs/agent/features/jd-match.md) |

---

## Code Patterns

### Backend Error Handling
```python
except Exception as e:
    logger.error(f"Operation failed: {e}")
    raise HTTPException(status_code=500, detail="Operation failed. Please try again.")
```

### Frontend Textarea Fix
All textareas need Enter key handling:
```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter') e.stopPropagation();
};
```

### Mutable Defaults (Python)
Always use `copy.deepcopy()` for mutable defaults:
```python
import copy
data = copy.deepcopy(DEFAULT_DATA)  # Correct
# data = DEFAULT_DATA  # Wrong - shared state bug
```

### Extension Prompt Discipline
- Prompt bodies may be user-overridden, but output contracts and guardrails are system-owned.
- Backend-owned default prompt artifacts now live under `apps/backend/app/prompts/extension_defaults/`.
- The extension sync route is `POST /api/v1/config/extension-prompts/sync`.
- Packaged prompt files under `apps/chrome-extension/src/prompts/` remain the local fallback.

### Extension Pipeline Rules
- Prompt 4 extracts the uploaded master resume into `ResumeData` and must emit authoritative `sectionMeta`.
- Prompt 1 and Prompt 2 are validated intermediate JSON stages; if invalid, they get one repair attempt and then fail hard.
- Prompt 3 must preserve the source resume structure from Prompt 4 / current resume `sectionMeta`.
- Persist raw plus parsed intermediate outputs where available (`prompt1Raw`, `prompt2Raw`) for debugging and export.

### Extension Manual JD Mode
- LinkedIn job pages remain scrape-first.
- Non-job pages open the floating board in `Paste JD` mode by default.
- Manual runs still go through the JD guardrail before Prompt 1.
- Cross-tab run state is shared through the background worker; avoid tab-local assumptions about the active run.

---

## Design System Quick Reference

| Element | Value |
|---------|-------|
| Canvas background | `#F0F0E8` |
| Ink (text) | `#000000` |
| Hyper Blue (links) | `#1D4ED8` |
| Signal Green (success) | `#15803D` |
| Alert Orange (warning) | `#F97316` |
| Alert Red (error) | `#DC2626` |
| Headers font | `font-serif` |
| Body font | `font-sans` |
| Metadata font | `font-mono` |
| Borders | `rounded-none`, 1px black, hard shadows |

---

## Definition of Done

Before completing a task:

- [ ] Code compiles without errors
- [ ] `npm run lint` passes
- [ ] UI changes follow Swiss International Style
- [ ] Python functions have type hints
- [ ] Schema/prompt changes documented
- [ ] Extension changes run `cd apps/chrome-extension && npm test` when applicable

---

## Out of Scope

Do NOT modify without explicit request:
- `.github/workflows/` files
- CI/CD configuration
- Docker build behavior
- Existing tests (removal/disabling)

---

> **Full agent documentation**: [docs/agent/README.md](docs/agent/README.md)
