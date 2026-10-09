"""Say which database the running tracker server is actually connected to.

Row counts do not answer this. A disposable copy is usually cloned from the
working database, so for a while the two are identical and "8,741 rows" proves
nothing about which one is about to be written to.

This asks Postgres which database the server's own connections are open against,
which cannot be confused by a fresh clone.

    python scripts/which_db.py
"""

from __future__ import annotations

import os
import re
import pathlib
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text  # noqa: E402

SAFE_MARKERS = ("test", "tmp", "scratch", "ci")


def _warm_the_server() -> None:
    """Make the server touch its database, so it has a connection to observe.

    The engine is created lazily, so a server that has answered nothing yet holds
    no connection and would look identical to a server that is not running.
    """
    try:
        import urllib.request
        urllib.request.urlopen(
            "http://localhost:8000/api/v1/tracker/jobs?limit=1", timeout=10
        ).read()
    except Exception:
        pass  # if it cannot be reached, the connection check below says so


def main() -> None:
    _warm_the_server()
    src = pathlib.Path(__file__).resolve().parent.parent / "app" / "tracker" / "api.py"
    default = re.search(r'"(postgresql\+psycopg://[^"]+)"', src.read_text()).group(1)
    admin = re.sub(r"/[^/]+$", "/postgres", default)

    with create_engine(admin, isolation_level="AUTOCOMMIT").connect() as c:
        rows = c.execute(text("""
            SELECT datname, count(*) AS connections
            FROM pg_stat_activity
            WHERE datname LIKE '%career_coach%' AND pid <> pg_backend_pid()
              AND application_name NOT LIKE 'psql%'
            GROUP BY datname ORDER BY 2 DESC
        """)).all()

    if not rows:
        print("  nothing is connected — no server is running")
        raise SystemExit(2)

    served = rows[0][0]
    disposable = any(m in served.lower() for m in SAFE_MARKERS)
    print(f"  the live server is serving: {served}")
    for name, n in rows:
        print(f"    {name:<28} {n} open connection(s)")
    print()
    print("  SAFE TO WRITE — this database names itself disposable" if disposable
          else "  *** THIS IS THE WORKING DATABASE — do not write test data to it ***")
    raise SystemExit(0 if disposable else 1)


if __name__ == "__main__":
    main()
