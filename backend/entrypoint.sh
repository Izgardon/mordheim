#!/usr/bin/env sh
set -e

python /app/wait_for_db.py
python /app/manage.py migrate --noinput

# The image serves with gunicorn (see Dockerfile CMD and gunicorn.conf.py);
# docker-compose overrides the command with runserver for local hot reload.
exec "$@"
