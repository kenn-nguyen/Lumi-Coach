# Running the tracker

## Deploying

The tracker ships inside the backend: `app/main.py` mounts `/api/v1/tracker/*`, and the
frontend serves `/tracker`. Nothing extra is needed to deploy it beyond configuration.

**Required environment**

| Variable | Why |
|---|---|
| `DATABASE_URL` | The tracker tables are created on first boot alongside the app's own. |
| `LLM_PROVIDER=vertex_ai` | Or set `GEMINI_API_ROUTE=developer` in Settings to use an AI Studio key instead. |
| `VERTEXAI_PROJECT`, `VERTEXAI_LOCATION` | `global` is what has been verified. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service-account JSON. On Google Cloud this is unnecessary — the attached account is used. |
| `TRACKER_OWNER_EMAIL` | The account that may change Settings. |
| `TRACKER_ASSIGNEE_EMAILS` | Comma-separated. They share the queue, not the controls. |

**Never set `TRACKER_DEV_NO_AUTH` in production.** It is refused when a deployment
marker (`RENDER`, `DYNO`, `KUBERNETES_SERVICE_HOST`…) is present or `ENVIRONMENT` is
not a development one, but it should not be set at all.

## The schedule

Runs are started by calling the runner on a cadence; the gate inside decides whether a
run is actually due, so the cron can be simple and the cadence stays editable in Settings.

```bash
python -m scripts.run_pipeline            # honours quiet hours and the interval
python -m scripts.run_pipeline --force    # ignores both
```

Hourly is a sensible cron: with `RUN_INTERVAL_HOURS=6` and quiet hours 19→11, that
produces roughly two runs a day inside the window.

## Cost

Two things actually cost money, and only one of them is controllable per run:

* **Apify.** The search actor **rejects `maxItems` below 150**, so a run cannot be made
  arbitrarily small by asking for fewer results. A **short `--lookback-hours`** is the
  real lever — a one-hour window on a narrow search returns a handful of jobs.
* **Scoring.** Capped by `SCORING_MAX_JOBS_PER_EXECUTION`, and avoided entirely for any
  job whose scoring fingerprint has not changed. In a live run, 2 of 5 scraped jobs were
  recognised and skipped without being sent to the model.

```bash
# A deliberately cheap end-to-end check
python -m scripts.run_pipeline --lookback-hours 1 --max-scored 3 --force
```

## Local development

```bash
docker compose -f docker-compose.dev.yml up -d postgres
python -m scripts.migrate_tracker_sheet --xlsx "/path/to/Linkedin JD update.xlsx"
python -m uvicorn scripts.dev_tracker_server:app --port 8000   # tracker only, no login
cd ../frontend && BACKEND_ORIGIN=http://localhost:8000 TRACKER_DEV_NO_AUTH=1 npm run dev
```

## Tests

```bash
TRACKER_XLSX="/path/to/Linkedin JD update.xlsx" \
TRACKER_FIXTURES_DIR="/path/to/fixtures" \
docker compose -f docker-compose.tracker.yml run --rm tracker-tests
```

Brings up a throwaway Postgres, migrates the workbook into it, and runs the suite.
