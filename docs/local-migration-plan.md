# Migration plan: hosted (Neon + Render + Vercel) → fully local

Goal: run the database, backend and frontend on this machine, with the data
restored from Neon, and keep the hosted stack as a paused fallback until the
local copy has proven itself.

Sized for one user: a few thousand tracker rows and tens of resumes. A single
`pg_dump` / `pg_restore` is enough; no replication or incremental sync.

---

## 0. Before touching anything: copy the secrets

**This step comes first because skipping it makes the restored data unreadable.**
Resume PII is encrypted in the database (`app/pii_crypto.py`). The key is
resolved in this order: `PII_ENCRYPTION_KEY`, falling back to
`LLM_CONFIG_ENCRYPTION_KEY`. Hashed lookups use `PII_HASH_KEY` with the same
fallback chain. Encrypted LLM config uses `LLM_CONFIG_ENCRYPTION_KEY`
(`app/llm_config_crypto.py`). A local backend with different keys will start
fine but fail to decrypt every resume.

From the Render dashboard (web service → Environment), copy into a password
manager entry, not a file in the repo:

| Variable | Why |
|---|---|
| `PII_ENCRYPTION_KEY`, `PII_HASH_KEY` (if set) | Decrypt and look up resume PII |
| `LLM_CONFIG_ENCRYPTION_KEY` | Decrypt stored LLM keys; PII fallback key |
| `BACKEND_AUTH_SHARED_SECRET` | Frontend ↔ backend token signing (a new value is fine locally, as long as both sides match) |
| `TRACKER_OWNER_EMAIL` | The only account allowed into `/tracker` |
| `GOOGLE_CREDENTIALS_JSON` | Vertex scorer for the tracker |
| `APIFY_API_TOKEN` | LinkedIn JD and tracker scraping |
| `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY` | In-app tailoring pipeline |
| `DATABASE_URL` | The Neon connection string, used for the dump |

From Vercel (project → Settings → Environment Variables): `AUTH_SECRET`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and any `NEXT_PUBLIC_POSTHOG_*` you want
to keep (or drop them locally).

✅ Verify: every row above has a value saved somewhere outside this repo.

---

## 1. Back up Neon

1. Find Neon's Postgres version: Neon console → project → Settings, or
   `psql "$NEON_URL" -c 'show server_version;'`.
2. Use the **direct** connection string (host without `-pooler`). `pg_dump`
   through the pooler can fail on long transactions.
3. Dump with a client at least as new as the server. Running it inside the
   matching Docker image avoids installing anything:

   ```bash
   mkdir -p ~/lumi-backups
   ```

   ```bash
   docker run --rm -v ~/lumi-backups:/backup postgres:<NEON_MAJOR> \
     pg_dump "<NEON_DIRECT_URL>" -Fc --no-owner --no-acl \
     -f /backup/neon-$(date +%F).dump
   ```

4. Record the row counts to compare against after the restore:

   ```bash
   psql "<NEON_DIRECT_URL>" -c "select relname, n_live_tup from pg_stat_user_tables order by relname;" > ~/lumi-backups/neon-counts-$(date +%F).txt
   ```

   (`n_live_tup` is an estimate; for an exact check, run `select count(*)` on
   `resumes`, `jobs`, `users` and the tracker tables.)

✅ Verify: the `.dump` file is non-empty, and
`pg_restore --list <file> | head` lists the tables.

Keep this dump. It is the rollback point for everything below.

---

## 2. Bring up local Postgres

`docker-compose.local.yml` already defines Postgres with a named volume.

1. **Match the version to Neon.** It pins `postgres:16`. If Neon is 17, change
   the image to `postgres:17` *before the first `up`*. A data volume created by
   16 will not start under 17.
2. Start it. The file now pins `postgres:17` to match Neon, and runs under
   its own Compose project (`lumi-local`), so it can't replace `dev-postgres`:

   ```bash
   POSTGRES_PORT=5434 docker compose -f docker-compose.local.yml up -d
   ```

3. Tracker data lives only in `dev-postgres` (Neon has no tracker tables).
   After restoring Neon, restore a dump of `dev-postgres` into the same
   database, so the app and the tracker share one `DATABASE_URL`, as in production.

✅ Verify: `docker compose -f docker-compose.local.yml ps` shows `healthy`.

---

## 3. Restore

Restore into the empty database **before** the backend first starts.
`init_schema()` runs `create_all` on startup. If it runs first, the restore
collides with tables that already exist.

```bash
docker run --rm --network host -v ~/lumi-backups:/backup postgres:<NEON_MAJOR> \
  pg_restore --no-owner --no-acl -d "postgresql://postgres:postgres@localhost:5432/som_career_coach" \
  /backup/neon-<DATE>.dump
```

On macOS, `--network host` does not reach the host. Use
`host.docker.internal` in the URL instead of `localhost`.

✅ Verify: re-run the row-count query against local Postgres and diff it with
the Neon file. Counts must match exactly.

---

## 4. Configure the backend and frontend

**Backend**: create `apps/backend/.env` from `.env.example`:

- `DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5434/som_career_coach`
  (port 5434: `dev-postgres` from `docker-compose.dev.yml` keeps 5432)
- `PII_ENCRYPTION_KEY`, `PII_HASH_KEY`, `LLM_CONFIG_ENCRYPTION_KEY`: **the exact Render values**
- `BACKEND_AUTH_SHARED_SECRET`: any long random value, the same as the frontend's
- `FRONTEND_BASE_URL=http://localhost:3000`
- `TRACKER_OWNER_EMAIL`, `GOOGLE_CREDENTIALS_JSON`, `APIFY_API_TOKEN`, the LLM vars: from step 0
- Leave `TRACKER_DEV_NO_AUTH` unset. Sign in for real so the user id matches the restored rows (see below).

**Frontend**: create `apps/frontend/.env.local`:

- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `BACKEND_AUTH_SHARED_SECRET`: the same value as the backend's
- `BACKEND_ORIGIN=http://localhost:8000` (or leave the Next.js rewrite default)

**Google OAuth redirect.** Users are keyed by the Google account's `sub`
(`auth.config.ts` → `session.user.id = token.sub`). Signing in locally with the
same Google account and the **same OAuth client** gives the same `sub`, so the
restored resumes stay attached to you. In Google Cloud Console → Credentials →
that OAuth client, add:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

A *different* OAuth client would also give the same `sub` for the same Google
account. Reusing the existing one is simply fewer moving parts.

---

## 5. Run and verify

Recommended split: Postgres in Docker, backend and frontend on the host.
`docker-compose.dev.yml`'s backend container does not install Chromium, so PDF
export would fail there, and it expects an `apps/backend/.env.dev` that has no
example file.

```bash
cd apps/backend && uv sync && uv run playwright install chromium
```

```bash
cd apps/backend && uv run uvicorn app.main:app --reload --port 8000
```

```bash
cd apps/frontend && npm install && npm run dev
```

Checklist. Each item must pass before moving on:

- [ ] `python scripts/which_db.py` reports the **local** database, not Neon
- [ ] Sign in with Google at `http://localhost:3000`
- [ ] Dashboard lists the same resumes as production
- [ ] Open one resume: names, emails and phone numbers read correctly (proves the PII key is right)
- [ ] Download a PDF (proves Chromium works)
- [ ] Run one in-app tailor end to end
- [ ] `/tracker` loads, and the counts match production
- [ ] Start one small tracker run from the UI (proves Apify and the Vertex credentials)
- [ ] The Chrome extension can reach the local backend, if you use it. Its backend URL may point at the hosted origin and need changing.

**If PII reads as garbage or errors:** the key is wrong. Stop. Do not edit or
save any resume, or the data will be re-encrypted inconsistently. Fix the key
and reload.

---

## 6. Backups (now your job)

The data lives in a Docker volume. `docker compose down -v` or a dead disk
deletes it.

- Nightly dump to a synced folder, via `launchd` or cron:

  ```bash
  docker exec som-career-coach-postgres pg_dump -U postgres -Fc som_career_coach > ~/Library/Mobile\ Documents/com~apple~CloudDocs/lumi-backups/lumi-$(date +%F).dump
  ```

- Keep the last 14 dumps: `find <dir> -name 'lumi-*.dump' -mtime +14 -delete`.
- Test a restore into a scratch database once, so you know the backups work.

---

## 7. Tracker schedule

Render ran `scripts/run_pipeline.py` every 6 hours. Locally:

- Run it by hand when you sit down: `cd apps/backend && uv run python scripts/run_pipeline.py`, or
- Add a `launchd` job on the same 6-hour cadence. It only fires while the Mac is awake, and missed runs are skipped, not queued.

---

## 8. Retire the hosted stack (after about a week of local use)

Pause rather than delete, so you can roll back:

1. Render: suspend the web service **and** the cron job (`som-career-coach-tracker`). Otherwise the cron keeps scraping into Neon and spending Apify credits.
2. Vercel: pause or remove the production deployment.
3. Neon: leave the project in place. It scales to zero when idle. Delete it only once a local backup has been restore-tested.
4. Keep `render.yaml` in the repo, so the hosted stack can be redeployed.

**Rollback at any point before step 8:** stop the local stack, then point the
frontend back at production. Neon has not been modified, because nothing in
this plan writes to it.

---

## Not in this plan

The `/tailor <url>` Claude Code flow (Claude writes, local API validates, saves
and renders) builds on the local stack. It is a separate change, made after
step 5 passes.
