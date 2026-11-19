import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase

BACKEND_DIR = Path(__file__).resolve().parents[3]


def _load_settings(**env: str) -> subprocess.CompletedProcess[str]:
    """Import config.settings in a fresh interpreter with the given environment.

    Values are set explicitly (even to "") because settings call load_dotenv(),
    which only fills variables that are absent. RESEND_API_KEY is blanked unless a
    test sets it, so a developer's local .env can't trip the email guards, and
    FRONTEND_URL holds a real site unless a test is about that guard.
    """
    return subprocess.run(
        [sys.executable, "-c", "import config.settings as s; print(s.DEBUG, len(s.SECRET_KEY))"],
        cwd=BACKEND_DIR,
        env={**os.environ, "RESEND_API_KEY": "", "FRONTEND_URL": "https://mordheim.example.org", **env},
        capture_output=True,
        text=True,
        timeout=30,
    )


class SettingsGuardTests(SimpleTestCase):
    def test_debug_is_off_unless_enabled(self):
        result = _load_settings(
            DJANGO_DEBUG="", DJANGO_SECRET_KEY="a-unique-production-key-for-the-settings-guard-tests"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(result.stdout.startswith("False"))

    def test_production_refuses_missing_secret_key(self):
        result = _load_settings(DJANGO_DEBUG="0", DJANGO_SECRET_KEY="")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY must be set", result.stderr)

    def test_production_refuses_the_old_default_key(self):
        result = _load_settings(DJANGO_DEBUG="0", DJANGO_SECRET_KEY="dev-secret-key")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY must be set", result.stderr)

    def test_dev_falls_back_to_throwaway_key(self):
        result = _load_settings(DJANGO_DEBUG="1", DJANGO_SECRET_KEY="")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(result.stdout.startswith("True"))

    def test_production_refuses_a_frontend_url_left_on_the_local_default(self):
        # Reset links and the social sign-in redirect URI are built from it, so localhost in production is a
        # configuration error, not a default to live with (apps.users.services.sso).
        production = {"DJANGO_DEBUG": "0", "DJANGO_SECRET_KEY": "a-unique-production-key-for-the-settings-guard-tests"}
        for address in ("", "http://localhost:5173", "http://mordheim.example.org"):
            with self.subTest(frontend_url=address):
                result = _load_settings(**production, FRONTEND_URL=address)

                self.assertNotEqual(result.returncode, 0)
                self.assertIn("FRONTEND_URL must be the site's https:// address", result.stderr)
        real = _load_settings(**production, FRONTEND_URL="https://mordheim-eight.vercel.app")
        self.assertEqual(real.returncode, 0, real.stderr)

    def test_dev_keeps_the_local_frontend_url(self):
        result = _load_settings(DJANGO_DEBUG="1", DJANGO_SECRET_KEY="", FRONTEND_URL="http://localhost:5173")

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_production_with_email_refuses_resends_shared_sender(self):
        # resend.dev delivers only to the Resend account's own address, so no player would get a reset link
        email_on = {
            "DJANGO_DEBUG": "0",
            "DJANGO_SECRET_KEY": "a-unique-production-key-for-the-settings-guard-tests",
            "RATE_LIMIT_NUM_PROXIES": "1",
            "RESEND_API_KEY": "re_test_key",
            "FRONTEND_URL": "https://mordheim.example.org",
        }
        for sender in ("onboarding@resend.dev", "Mordheim <Onboarding@Resend.dev>", "bot@mail.resend.dev"):
            with self.subTest(sender=sender):
                result = _load_settings(**email_on, DEFAULT_FROM_EMAIL=sender)

                self.assertNotEqual(result.returncode, 0)
                self.assertIn("DEFAULT_FROM_EMAIL must be an address on Resend's verified domain", result.stderr)
        verified = _load_settings(**email_on, DEFAULT_FROM_EMAIL="Mordheim <no-reply@mordheim.example.org>")
        self.assertEqual(verified.returncode, 0, verified.stderr)
