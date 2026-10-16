import os
import sys
import time

import psycopg


def _conninfo() -> str:
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url
    return psycopg.conninfo.make_conninfo(
        dbname=os.environ.get("POSTGRES_DB", "mordheim"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        host=os.environ.get("POSTGRES_HOST", "db"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
    )


def wait_for_db(timeout: float) -> None:
    conninfo = _conninfo()
    deadline = time.monotonic() + timeout
    while True:
        try:
            with psycopg.connect(conninfo, connect_timeout=5):
                print("Database is available")
                return
        except Exception as exc:
            if time.monotonic() >= deadline:
                sys.exit(f"Database not available after {timeout:.0f}s: {exc}")
            print(f"Waiting for database... {exc}")
            time.sleep(1)


if __name__ == "__main__":
    wait_for_db(float(os.environ.get("WAIT_FOR_DB_TIMEOUT", "60")))
