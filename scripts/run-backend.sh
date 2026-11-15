#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/apps/backend"

# Settings only reads .env for its own fields; the tracker reads DATABASE_URL and
# Google credentials straight from os.environ, so export .env to the process too.
# uvicorn's --env-file is used rather than uv's: it parses with python-dotenv, the
# same parser Settings uses, whereas uv strips the quotes inside JSON values such
# as CORS_ORIGINS=["http://..."].
ENV_ARGS=()
[[ -f .env ]] && ENV_ARGS=(--env-file .env)

# The ${..+..} form keeps macOS's bash 3.2 from treating an empty array as unset.
exec uv run uvicorn app.main:app --reload --port 8000 ${ENV_ARGS[@]+"${ENV_ARGS[@]}"}
