import os
import time

import psycopg


def wait_for_db():
    config = {
        "dbname": os.environ.get("POSTGRES_DB", "mordheim"),
        "user": os.environ.get("POSTGRES_USER", "postgres"),
        "password": os.environ.get("POSTGRES_PASSWORD", "postgres"),
        "host": os.environ.get("POSTGRES_HOST", "db"),
        "port": os.environ.get("POSTGRES_PORT", "5432"),
    }

    while True:
        try:
            with psycopg.connect(**config):
                print("Database is available")
                return
        except Exception as exc:
            print(f"Waiting for database... {exc}")
            time.sleep(1)


if __name__ == "__main__":
    wait_for_db()
