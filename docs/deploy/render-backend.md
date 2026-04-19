# Render Backend Deployment Notes

If you deploy the backend as a native Python Render service, PDF export requires a runtime-safe Playwright install.

## Required Render settings

Backend root directory:

```text
apps/backend
```

Build command:

```bash
pip install . && PLAYWRIGHT_BROWSERS_PATH=0 python -m playwright install chromium
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Required environment variable:

```env
PLAYWRIGHT_BROWSERS_PATH=0
```

## Why this matters

Without `PLAYWRIGHT_BROWSERS_PATH=0`, Render can install Playwright's Chromium binary into a build-time cache path that is not available at runtime. When that happens, PDF download fails with an error like:

```text
Playwright browser executable is missing, and no system Chrome/Edge installation was found.
```

Setting `PLAYWRIGHT_BROWSERS_PATH=0` forces Playwright to install Chromium into the deployed app environment so `playwright.chromium.launch()` can find it during PDF generation.

## Alternative

If you deploy the backend as a Docker service instead of a native Python service, the existing `Dockerfile` already installs Playwright Chromium into the runtime image. That is the more robust long-term option if you plan to keep PDF export on Render.
