"""The throttle table (pass 6 PR B).

Every rate limit is a row of `apps.core.throttling.SCOPES` (who shares the count) with its rate in the settings'
`DEFAULT_THROTTLE_RATES`; views take their throttles from that table, never from a class of their own. The behaviour of
each limit is tested in `test_rate_limiting.py` (lowered rates) and `test_auth_throttle_characterisation.py`
(configured rates).
"""

from collections.abc import Iterator
from typing import Any

from django.conf import settings
from django.test import SimpleTestCase
from django.urls import URLPattern, URLResolver, get_resolver

from apps.core.throttling import SCOPES, THROTTLES, throttle_classes


def routed_views(patterns: list[Any] | None = None) -> Iterator[Any]:
    """The class of every class-based view the URL configuration routes to."""
    for entry in get_resolver().url_patterns if patterns is None else patterns:
        if isinstance(entry, URLResolver):
            yield from routed_views(entry.url_patterns)
        elif isinstance(entry, URLPattern) and hasattr(entry.callback, "cls"):
            yield entry.callback.cls


class ThrottleTableTests(SimpleTestCase):
    def test_every_scope_has_a_rate_and_every_rate_a_scope(self):
        self.assertEqual(set(SCOPES), set(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]))

    def test_each_scope_has_one_throttle_counting_as_its_row_says(self):
        for scope, kind in SCOPES.items():
            with self.subTest(scope=scope):
                throttle = THROTTLES[scope]
                self.assertEqual((throttle.scope, throttle.__base__), (scope, kind))
        self.assertEqual(throttle_classes("battle_write_user", "battle_write_ip"), [THROTTLES["battle_write_user"], THROTTLES["battle_write_ip"]])  # fmt: skip

    def test_every_routed_view_throttles_only_through_the_table(self):
        tabled = set(THROTTLES.values())
        throttled = set()
        for view in routed_views():
            with self.subTest(view=view.__name__):
                self.assertLessEqual(set(view.throttle_classes), tabled)
                throttled |= {throttle.scope for throttle in view.throttle_classes}

        self.assertEqual(throttled, set(SCOPES))  # and every row is used by some view
