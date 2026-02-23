#!/usr/bin/env sh
set -e

python /app/wait_for_db.py
python /app/manage.py migrate --noinput
exec python /app/manage.py runserver 0.0.0.0:8000
