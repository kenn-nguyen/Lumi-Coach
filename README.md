# Lumi Coach

Lumi Coach is an AI-powered resume tailoring platform built around a simple workflow: start from a live LinkedIn job, generate a targeted resume, then review and refine the result in the web workspace.

[Chrome Web Store](https://chromewebstore.google.com/detail/lumi-coach/iklflomjpppjfkaegdimkgabancffdhb) · [Web App](https://som-career-coach-iota.vercel.app/) · [Privacy Policy](https://som-career-coach-iota.vercel.app/privacy)

## Overview

This repository powers the Lumi Coach web app and Chrome extension.

Lumi Coach is designed for fast, structured job-application workflows:
- capture job context directly from LinkedIn
- run multi-step AI tailoring against a master resume
- open the generated draft in the web workspace for review
- export polished resumes and related artifacts

The product combines:
- a **Chrome extension** for LinkedIn-triggered job capture and resume runs
- a **Next.js web app** for editing, previewing, and managing resumes
- a **FastAPI backend** for resume APIs, PDF generation, and orchestration support

## How It Works

1. Upload or create your master resume.
2. Open a live LinkedIn job posting.
3. Launch Lumi Coach from the extension.
4. Run the tailoring workflow.
5. Review the generated resume in the Lumi Coach workspace.
6. Export the final PDF.

## Core Features

### LinkedIn-triggered tailoring
Start from a real LinkedIn job page instead of copying job descriptions between tabs.

### Multi-step AI orchestration
Lumi Coach uses structured prompt chaining and provider integrations to analyze the role, position the candidate, and draft a tailored resume.

### Resume workspace
Review, edit, rename, preview, and export tailored resumes in the web app.

### Chrome extension workflow
The extension handles job capture, account-aware local storage, run status, retry/refresh behavior, and exportable run analytics.

### PDF export
Generate print-ready resumes with configurable template and page settings.

## Product Notes

- Lumi Coach is optimized around LinkedIn job workflows.
- The extension uses account-isolated local storage on the browser.
- The web app and extension support authenticated handoff between the run flow and the resume workspace.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, React 19, TypeScript |
| Backend | FastAPI, Python 3.13+, LiteLLM |
| Database | TinyDB |
| Styling | Tailwind CSS v4 |
| PDF Rendering | Playwright / headless Chromium |
| Browser Extension | Chrome Extension (Manifest V3) |

## Repository Structure

```text
apps/
├── backend/           FastAPI API, orchestration, PDF rendering
├── frontend/          Next.js web app
└── chrome-extension/  LinkedIn workflow extension

docs/                  Internal architecture, design, and agent docs
assets/                Repository assets
```

## Local Development

### Prerequisites

- Python 3.13+
- Node.js 22+
- `uv`

### Quick Start

```bash
# Clone the repository
git clone https://github.com/kenn-nguyen/Lumi-Coach.git
cd Lumi-Coach

# Backend
cd apps/backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Chrome Extension Development

The extension source lives in [`apps/chrome-extension`](apps/chrome-extension).

To test locally:
1. open Chrome extension management
2. enable developer mode
3. load the `apps/chrome-extension` directory as an unpacked extension

## Docker

Docker images are published to:

- `ghcr.io/kenn-nguyen/lumi-coach`

Example:

```bash
docker run --name lumi-coach \
  -p 3000:3000 \
  -v lumi-coach-data:/app/backend/data \
  ghcr.io/kenn-nguyen/lumi-coach:latest
```

Endpoints:

- App: [http://localhost:3000](http://localhost:3000)
- API health: [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)
- API docs: [http://localhost:3000/docs](http://localhost:3000/docs)

## Contributing

Contributions are welcome.

If you want to work on Lumi Coach:
- open an issue or discussion for bugs and feature ideas
- follow the repo conventions in [`AGENTS.md`](AGENTS.md)
- run frontend lint/formatting before submitting changes

## Privacy

Lumi Coach is built to support authenticated resume tailoring workflows across the web app and Chrome extension.

- extension-local data stays on the user’s browser unless a feature explicitly sends it to Lumi Coach services or the selected AI provider
- saved provider keys in the extension are not uploaded just because they are stored locally
- account switching in the extension uses isolated local workspaces

See the full policy here: [Privacy Policy](https://som-career-coach-iota.vercel.app/privacy)

## License

This project is licensed under the Apache 2.0 License. See [LICENSE](LICENSE) for details.
