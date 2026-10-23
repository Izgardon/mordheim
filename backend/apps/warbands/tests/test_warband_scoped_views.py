"""Every warband endpoint checks access through WarbandScopedView (design 0.29), and the generic unit
views keep the view names the per-kind views had (DRF serves them in OPTIONS responses)."""

from typing import Any, cast

from django.test import SimpleTestCase
from django.urls import URLPattern

from apps.warbands.urls import urlpatterns
from apps.warbands.views.base import WarbandScopedView

UNIT_VIEW_NAMES = {
    f"warbands-{segment}{suffix}": f"Warband{model}{role}View"
    for segment, model in (("heroes", "Hero"), ("henchmen-groups", "HenchmenGroup"), ("hirelings", "Hireling"))
    for suffix, role in (
        ("", "ListCreate"),
        ("-detail-list", "DetailList"),
        ("-detail", "Detail"),
        ("-kill-history", "KillHistory"),
        ("-level-up", "LevelUp"),
    )
}


def _view_class(pattern: URLPattern) -> Any:
    return cast(Any, pattern.callback).view_class  # set by as_view()


class WarbandScopedViewStructureTests(SimpleTestCase):
    def test_every_route_under_a_warband_uses_the_scoped_base(self):
        scoped = [pattern for pattern in urlpatterns if "<int:warband_id>" in str(pattern.pattern)]
        # + batch/ per kind (decision 1), henchmen-groups promote/ (decision 9), resources sell/ (BUG-68) and
        # trades/<id>/ (pass 2 decision 5), purchases/ (BUG-07), rarity-rolls/ (decision 9), roster-stats/ (PERF-42) and
        # hirelings hire/ (the bestiary rewrite)
        self.assertEqual(len(scoped), 37)
        for pattern in scoped:
            with self.subTest(route=pattern.name):
                self.assertTrue(issubclass(_view_class(pattern), WarbandScopedView))

    def test_unit_views_keep_the_per_kind_view_names(self):
        names = {
            pattern.name: _view_class(pattern).__name__ for pattern in urlpatterns if pattern.name in UNIT_VIEW_NAMES
        }
        self.assertEqual(names, UNIT_VIEW_NAMES)
        for pattern in urlpatterns:
            if pattern.name in UNIT_VIEW_NAMES:
                self.assertIsNone(_view_class(pattern).__doc__, pattern.name)  # no OPTIONS description, as before
