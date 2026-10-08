"""Minimal server for working on the tracker.

Mounts only the tracker router, so the feature can be run and exercised without
the rest of the backend's dependency tree. Production uses app.main, which mounts
the same router alongside everything else.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

os.environ.setdefault("TRACKER_DEV_NO_AUTH", "1")
os.environ.setdefault("TRACKER_OWNER_EMAIL", "owner@localhost")
os.environ.setdefault("ENVIRONMENT", "development")

from app.tracker.api import router  # noqa: E402

app = FastAPI(title="Tracker (dev)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api/v1")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
