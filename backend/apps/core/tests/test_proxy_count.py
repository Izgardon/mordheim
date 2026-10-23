"""The throttles' proxy count (pass 6 PR A; SEC-04, William's call of 2026-10-21).

`config.proxies.num_proxies` gives NUM_PROXIES: RATE_LIMIT_NUM_PROXIES when set (0 included), else 1 with DEBUG off and
DRF's default (None) with DEBUG on; anything but a whole number of 0 or more is refused. gunicorn's master logs one
warning as it starts when production assumes the 1. `test_settings_characterisation.py` checks the loaded settings in
a fresh process.
"""

import importlib.util
from pathlib import Path
from types import ModuleType
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config.proxies import ASSUMED_WARNING, is_assumed, num_proxies

GUNICORN_CONF = Path(__file__).resolve().parents[3] / "gunicorn.conf.py"


def gunicorn_conf() -> ModuleType:
    spec = importlib.util.spec_from_file_location("gunicorn_conf_under_test", GUNICORN_CONF)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class NumProxiesTests(SimpleTestCase):
    def test_unset_means_one_in_production_and_drfs_default_in_dev(self):
        for environ in ({}, {"RATE_LIMIT_NUM_PROXIES": ""}, {"RATE_LIMIT_NUM_PROXIES": "  "}):
            with self.subTest(environ=environ):
                self.assertEqual((num_proxies(environ, debug=False), num_proxies(environ, debug=True)), (1, None))

    def test_an_explicit_value_always_wins(self):
        for raw, expected in (("0", 0), ("1", 1), ("3", 3), (" 2 ", 2)):
            for debug in (False, True):
                with self.subTest(raw=raw, debug=debug):
                    self.assertEqual(num_proxies({"RATE_LIMIT_NUM_PROXIES": raw}, debug), expected)

    def test_anything_but_a_whole_number_of_zero_or_more_is_refused(self):
        for raw in ("one", "-1", "1.5", "1e2"):
            with self.subTest(raw=raw):
                with self.assertRaisesMessage(ImproperlyConfigured, f"RATE_LIMIT_NUM_PROXIES must be a whole number of proxies, 0 or more (got {raw!r})."):  # fmt: skip
                    num_proxies({"RATE_LIMIT_NUM_PROXIES": raw}, debug=False)

    def test_the_count_is_assumed_only_in_production_with_the_variable_unset(self):
        cases = {
            "production, unset": ({}, True),
            "production, blank": ({"RATE_LIMIT_NUM_PROXIES": " "}, True),
            "production, 0": ({"RATE_LIMIT_NUM_PROXIES": "0"}, False),
            "dev, unset": ({"DJANGO_DEBUG": "1"}, False),
            "dev spelled true": ({"DJANGO_DEBUG": " True "}, False),
            "debug off spelled 0": ({"DJANGO_DEBUG": "0"}, True),
        }
        for label, (environ, expected) in cases.items():
            with self.subTest(case=label):
                self.assertEqual(is_assumed(environ), expected)


class GunicornWarningTests(SimpleTestCase):
    def warnings_logged(self, environ: dict[str, str]) -> list[tuple[object, ...]]:
        server = mock.Mock()
        with mock.patch.dict("os.environ", environ, clear=True):
            gunicorn_conf().on_starting(server)
        return [call.args for call in server.log.warning.call_args_list]

    def test_the_master_warns_once_when_production_assumes_one_proxy(self):
        self.assertEqual(self.warnings_logged({}), [(ASSUMED_WARNING,)])
        self.assertEqual(
            ASSUMED_WARNING,
            "RATE_LIMIT_NUM_PROXIES is not set; assuming 1 proxy (Render). Set it if the deployment changes.",
        )

    def test_no_warning_when_the_count_is_set_or_in_dev(self):
        for environ in ({"RATE_LIMIT_NUM_PROXIES": "1"}, {"RATE_LIMIT_NUM_PROXIES": "0"}, {"DJANGO_DEBUG": "1"}):
            with self.subTest(environ=environ):
                self.assertEqual(self.warnings_logged(environ), [])
