"""The XP high-water mark (decision 5 option A, BUG-27).

Level-ups are awarded only for thresholds crossed above the most XP a unit has had, by the unit PATCH and
by postbattle alike. Lowering XP never removes level-ups; raising it back never awards them again. An
explicit `level_up` in a PATCH (the pending level-ups editor) still sets the count as sent.
"""

from decimal import Decimal
from importlib import import_module
from typing import Any

from django.apps import apps as django_apps

from .roster_support import (
    HENCHMEN,
    HERO,
    HIRELING,
    KINDS,
    Kind,
    RosterTestCase,
    create_payload,
    make_unit,
    unit_url,
)


class _AppsAsOf0025:
    """The live models under the names migration 0025 knew them by: the hired sword is the hireling since 0036."""

    def get_model(self, app_label: str, model_name: str) -> Any:
        return django_apps.get_model(app_label, {"HiredSword": "Hireling"}.get(model_name, model_name))


class XpHighWaterTests(RosterTestCase):
    def _set_xp(self, kind: Kind, unit: Any, xp: Any, **extra: Any) -> int:
        response = self.client.patch(unit_url(kind, self.warband.id, unit.id), {"xp": xp, **extra}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return int(response.json()["level_up"])

    def test_only_thresholds_above_the_mark_are_awarded(self):
        # hero table 2, 4, 6, 8, ...; henchmen table 2, 5, 9, 14 (hired swords too, until decision 8)
        above_six = {HERO.key: 1, HENCHMEN.key: 1, HIRELING.key: 1}  # (6, 9]: 8, or 9
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                climbed = self._set_xp(kind, unit, 6)
                self.assertEqual(self._set_xp(kind, unit, 0), climbed)  # lowering removes nothing
                self.assertEqual(self._set_xp(kind, unit, 6), climbed)  # back to the mark: nothing new
                self.assertEqual(self._set_xp(kind, unit, 9), climbed + above_six[kind.key])
                unit.refresh_from_db()
                self.assertEqual(unit.xp_high_water, 9)

    def test_an_explicit_level_up_sets_the_count_and_still_moves_the_mark(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1)
                self.assertEqual(self._set_xp(kind, unit, 14, level_up=0), 0)
                self._set_xp(kind, unit, 0)
                self.assertEqual(self._set_xp(kind, unit, 14), 0)

    def test_seeded_xp_counts_as_reached(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                created = self.client.post(unit_url(kind, self.warband.id), create_payload(kind, xp=6), format="json")
                self.assertEqual(created.status_code, 201, created.data)
                unit = kind.model.objects.get(id=created.json()["id"])
                self.assertEqual((unit.level_up, unit.xp_high_water), (0, 6))
                self._set_xp(kind, unit, 1)
                self.assertEqual(self._set_xp(kind, unit, 6), 0)

    def test_units_saved_before_the_mark_existed_count_their_xp_as_reached(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, xp=10, level_up=2)  # high-water mark left at 0
                self._set_xp(kind, unit, 0)
                self.assertEqual(self._set_xp(kind, unit, 10), 2)

    def test_no_level_ups_still_moves_the_mark(self):
        for kind in (HENCHMEN, HIRELING):
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, no_level_ups=True)
                self.assertEqual(self._set_xp(kind, unit, 6), 0)
                self.assertEqual(self._set_xp(kind, unit, 6, no_level_ups=False), 0)
                self.assertEqual(self._set_xp(kind, unit, 9), 1)  # only 9 is above the mark

    def test_postbattle_awards_only_above_the_mark(self):
        hero = make_unit(HERO, self.warband, xp=6, level_up=3)
        sword = make_unit(HIRELING, self.warband, xp=6, level_up=2, half_rate=True)
        self._set_xp(HERO, hero, 1)
        self._set_xp(HIRELING, sword, 1)

        self.play_battle({f"hero:{hero.id}": 5, f"hireling:{sword.id}": 10})  # back to 6 for both
        hero.refresh_from_db()
        sword.refresh_from_db()
        self.assertEqual([(hero.xp, hero.level_up), (sword.xp, sword.level_up)], [(6, 3), (6, 2)])

        self.play_battle({f"hero:{hero.id}": 3, f"hireling:{sword.id}": 7})  # 9 and 9.5
        hero.refresh_from_db()
        sword.refresh_from_db()
        self.assertEqual([(hero.xp, hero.level_up), (sword.xp, sword.level_up)], [(9, 4), (Decimal("9.5"), 3)])
        self.assertEqual([hero.xp_high_water, sword.xp_high_water], [9, Decimal("9.5")])

    def test_the_migration_backfills_the_mark_with_current_xp(self):
        migration = import_module("apps.warbands.migrations.0025_unit_xp_high_water")
        units = [make_unit(kind, self.warband, xp=Decimal("7.5"), dead=kind is HERO) for kind in KINDS]
        for unit in units:
            type(unit).objects.filter(id=unit.id).update(xp_high_water=0)

        migration.backfill_high_water(_AppsAsOf0025(), None)

        for unit in units:
            unit.refresh_from_db()
            self.assertEqual(unit.xp_high_water, Decimal("7.5"))
