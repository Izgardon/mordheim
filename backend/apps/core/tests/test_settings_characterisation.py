"""Settings as Phase 0 left them (pass 6; INFRA-TEST-07 / AUTH-TEST-18, SEC-04, BUG-56, INFRA-CQ-01, INFRA-CQ-03).

The fresh-process tests import `config.settings` (or run `check --deploy`) in a new interpreter with `load_dotenv`
switched off, so a local `.env` can't fill what a test leaves unset. `test_settings_guards.py` keeps Phase 0's
guards: DEBUG off unless set, a missing or old default key refused, the dev fallback key. PR A refuses to start with
DEBUG off and a key under 50 characters or without RATE_LIMIT_NUM_PROXIES, and, once RESEND_API_KEY is set, without
real FRONTEND_URL and DEFAULT_FROM_EMAIL values; it adds LOGGING and renders JSON only in production.
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from django.conf import settings
from django.test import SimpleTestCase

BACKEND_DIR = Path(__file__).resolve().parents[3]
UNSET = (
    "RATE_LIMIT_NUM_PROXIES",
    "FRONTEND_URL",
    "DEFAULT_FROM_EMAIL",
    "RESEND_API_KEY",
    "PASSWORD_RESET_TIMEOUT",
    "SECURE_HSTS_SECONDS",
)
LONG_KEY = "a-unique-production-key-for-the-settings-tests-0123456789"  # 57 characters
SHORT_KEY = "short-unique-key"
NO_DOTENV = "import dotenv; dotenv.load_dotenv = lambda *args, **kwargs: False\n"
READ_SETTINGS = NO_DOTENV + (
    "import json\n"
    "import config.settings as s\n"
    "names = ['DEBUG', 'FRONTEND_URL', 'DEFAULT_FROM_EMAIL', 'RESEND_API_KEY', 'PASSWORD_RESET_TIMEOUT',\n"
    "         'SECURE_PROXY_SSL_HEADER', 'SECURE_HSTS_SECONDS', 'SESSION_COOKIE_SECURE', 'CSRF_COOKIE_SECURE']\n"
    "values = {name: getattr(s, name, None) for name in names}\n"
    "values['SECRET_KEY_LENGTH'] = len(s.SECRET_KEY)\n"
    "values['NUM_PROXIES'] = s.REST_FRAMEWORK.get('NUM_PROXIES', 'absent')\n"
    "print(json.dumps(values))\n"
)
CHECK_DEPLOY = NO_DOTENV + (
    "import os\n"
    "os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')\n"
    "from django.core.management import execute_from_command_line\n"
    "execute_from_command_line(['manage.py', 'check', '--deploy'])\n"
)


def run(code: str, **env: str) -> subprocess.CompletedProcess[str]:
    base = {key: value for key, value in os.environ.items() if key not in UNSET}
    return subprocess.run(
        [sys.executable, "-c", code], cwd=BACKEND_DIR, env={**base, **env}, capture_output=True, text=True, timeout=60
    )


def load_settings(**env: str) -> dict[str, Any]:
    result = run(READ_SETTINGS, **env)
    assert result.returncode == 0, result.stderr
    values: dict[str, Any] = json.loads(result.stdout.strip().splitlines()[-1])
    return values


class ProductionStartupTests(SimpleTestCase):
    def test_production_starts_with_a_short_secret_key(self):
        # Characterises current behaviour (SEC-01 rest, pinned; flips in PR A: a key under 50 characters is refused)
        values = load_settings(DJANGO_DEBUG="0", DJANGO_SECRET_KEY=SHORT_KEY)

        self.assertEqual((values["DEBUG"], values["SECRET_KEY_LENGTH"]), (False, 16))

    def test_production_without_num_proxies_assumes_one_and_starts_without_email_settings_and_hardened(self):
        # SEC-04 (was pinned: NUM_PROXIES absent, so the whole X-Forwarded-For was the throttles' identity; flipped
        # in PR A: production assumes Render's one proxy, William 2026-10-21, and gunicorn warns once)
        values = load_settings(DJANGO_DEBUG="0", DJANGO_SECRET_KEY=LONG_KEY)

        self.assertEqual(values["NUM_PROXIES"], 1)
        email = {name: values[name] for name in ("FRONTEND_URL", "DEFAULT_FROM_EMAIL", "RESEND_API_KEY", "PASSWORD_RESET_TIMEOUT")}  # fmt: skip
        self.assertEqual(email, {"FRONTEND_URL": "http://localhost:5173", "DEFAULT_FROM_EMAIL": "no-reply@example.com", "RESEND_API_KEY": "", "PASSWORD_RESET_TIMEOUT": 3600})  # fmt: skip
        hardening = [values[name] for name in ("SECURE_PROXY_SSL_HEADER", "SECURE_HSTS_SECONDS", "SESSION_COOKIE_SECURE", "CSRF_COOKIE_SECURE")]  # fmt: skip
        self.assertEqual(hardening, [["HTTP_X_FORWARDED_PROTO", "https"], 60 * 60 * 24 * 30, True, True])

    def test_dev_leaves_the_https_hardening_off(self):
        values = load_settings(DJANGO_DEBUG="1", DJANGO_SECRET_KEY="")

        hardening = [values[name] for name in ("SECURE_PROXY_SSL_HEADER", "SECURE_HSTS_SECONDS", "SESSION_COOKIE_SECURE", "CSRF_COOKIE_SECURE")]  # fmt: skip
        self.assertEqual(hardening, [None, None, None, None])

    def test_a_resend_key_alone_starts_with_the_placeholder_link_and_sender(self):
        # Characterises current behaviour (BUG-56, pinned; flips in PR A: with the key set, startup requires real
        # FRONTEND_URL and DEFAULT_FROM_EMAIL values), so reset links would point at localhost
        values = load_settings(DJANGO_DEBUG="0", DJANGO_SECRET_KEY=LONG_KEY, RESEND_API_KEY="re_not_a_real_key")

        self.assertEqual((values["FRONTEND_URL"], values["DEFAULT_FROM_EMAIL"]), ("http://localhost:5173", "no-reply@example.com"))  # fmt: skip

    def test_an_explicit_proxy_count_always_wins_and_dev_keeps_drfs_default_when_unset(self):
        # SEC-04 (was: read only when set, else absent in production too)
        cases = {("0", "0"): 0, ("0", "2"): 2, ("0", " 1 "): 1, ("0", ""): 1, ("1", "1"): 1, ("1", "0"): 0, ("1", ""): "absent"}  # fmt: skip
        for (debug, raw), expected in cases.items():
            with self.subTest(DJANGO_DEBUG=debug, RATE_LIMIT_NUM_PROXIES=raw):
                values = load_settings(DJANGO_DEBUG=debug, DJANGO_SECRET_KEY=LONG_KEY, RATE_LIMIT_NUM_PROXIES=raw)

                self.assertEqual(values["NUM_PROXIES"], expected)

    def test_a_proxy_count_that_is_not_a_whole_number_of_zero_or_more_stops_startup(self):
        # SEC-04 (was a bare ValueError for "one"; now ImproperlyConfigured naming the variable, DEBUG on or off)
        for debug in ("0", "1"):
            for raw in ("one", "-1", "1.5"):
                with self.subTest(DJANGO_DEBUG=debug, RATE_LIMIT_NUM_PROXIES=raw):
                    broken = run(READ_SETTINGS, DJANGO_DEBUG=debug, DJANGO_SECRET_KEY=LONG_KEY, RATE_LIMIT_NUM_PROXIES=raw)  # fmt: skip

                    self.assertNotEqual(broken.returncode, 0)
                    self.assertIn(f"ImproperlyConfigured: RATE_LIMIT_NUM_PROXIES must be a whole number of proxies, 0 or more (got {raw!r}).", broken.stderr)  # fmt: skip


class DeployCheckTests(SimpleTestCase):
    def test_check_deploy_reports_only_the_three_silenced_checks(self):
        result = run(CHECK_DEPLOY, DJANGO_DEBUG="0", DJANGO_SECRET_KEY=LONG_KEY)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("System check identified no issues (3 silenced).", result.stdout)

    def test_check_deploy_warns_about_a_short_key_that_startup_accepts(self):
        # Characterises current behaviour (SEC-01 rest, INFRA-CQ-03, pinned; flips in PR A: startup refuses it, and
        # CI gains `check --deploy`)
        result = run(CHECK_DEPLOY, DJANGO_DEBUG="0", DJANGO_SECRET_KEY=SHORT_KEY)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("(security.W009)", result.stdout + result.stderr)


class LoadedSettingsTests(SimpleTestCase):
    def test_there_is_no_logging_configuration(self):
        # Characterises current behaviour (INFRA-CQ-01, pinned; flips in PR A: LOGGING to stdout, django.request at
        # WARNING), so with DEBUG off a 500's traceback reaches no handler
        self.assertEqual(settings.LOGGING, {})

    def test_the_unused_session_message_and_csrf_machinery_stays_loaded(self):
        # Characterises current behaviour (INFRA-CQ-03, pinned; flips in PR B's settings hygiene)
        self.assertTrue({"django.contrib.sessions", "django.contrib.messages"} <= set(settings.INSTALLED_APPS))
        unused = {
            "django.contrib.sessions.middleware.SessionMiddleware",
            "django.middleware.csrf.CsrfViewMiddleware",
            "django.contrib.messages.middleware.MessageMiddleware",
        }
        self.assertTrue(unused <= set(settings.MIDDLEWARE))
