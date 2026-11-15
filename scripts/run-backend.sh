#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/apps/backend"

# Settings only reads .env for its own fields; the tracker reads DATABASE_URL and
# Google credentials straight from os.environ, so export .env to the process too.
ENV_ARGS=()
[[ -f .env ]] && ENV_ARGS=(--env-file .env)

# The ${..+..} form keeps macOS's bash 3.2 from treating an empty array as unset.
exec uv run ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} uvicorn app.main:app --reload --port 8000
