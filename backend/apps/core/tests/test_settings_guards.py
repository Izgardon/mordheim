import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase

BACKEND_DIR = Path(__file__).resolve().parents[3]


def _load_settings(**env: str) -> subprocess.CompletedProcess[str]:
    """Import config.settings in a fresh interpreter with the given environment.

    Values are set explicitly (even to "") because settings call load_dotenv(),
    which only fills variables that are absent.
    """
    return subprocess.run(
        [sys.executable, "-c", "import config.settings as s; print(s.DEBUG, len(s.SECRET_KEY))"],
        cwd=BACKEND_DIR,
        env={**os.environ, **env},
        capture_output=True,
        text=True,
        timeout=30,
    )


class SettingsGuardTests(SimpleTestCase):
    def test_debug_is_off_unless_enabled(self):
        result = _load_settings(DJANGO_DEBUG="", DJANGO_SECRET_KEY="a-unique-production-key-for-tests")
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
