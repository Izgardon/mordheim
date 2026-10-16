"""gunicorn settings, loaded automatically from the working directory.

Render starts the app with `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
from backend/, so this file applies in production without a dashboard change
(the command-line --bind still wins). Without it gunicorn runs one sync worker,
which serves a single request at a time for every user.

Requests are I/O-bound: almost all of their time is spent waiting on Neon round
trips, so threads add far more concurrency per MB than extra processes on a
0.5 CPU / 512 MB instance. 2 workers x 8 threads = 16 concurrent requests and at
most 16 database connections.
"""

import os

wsgi_app = "config.wsgi:application"
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

worker_class = "gthread"
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "8"))

timeout = 60
graceful_timeout = 30
keepalive = 5

# Recycle workers periodically so slow memory growth can't exhaust 512 MB.
max_requests = 1000
max_requests_jitter = 100

accesslog = "-"
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(M)sms'
