"""Half-rate XP (William: "all XP, including + and −").

A half-rate unit gains half of every point: a battle's XP at finalise, and a manual change the card's − and + send as
`xp_change`. Fractions are kept (XP is a decimal), level-ups count whole XP only, and XP never goes below 0. An `xp`
a PATCH sets (the Edit form's total) is taken as sent.
"""

from decimal import Decimal
from typing import Any

from .roster_support import HENCHMEN, HERO, HIRELING, KINDS, Kind, RosterTestCase, make_unit, unit_url


class XpChangeTests(RosterTestCase):
    def _change(self, kind: Kind, unit: Any, change: Any, **extra: Any) -> dict[str, Any]:
        url = unit_url(kind, self.warband.id, unit.id)
        response = self.client.patch(url, {"xp_change": change, **extra}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return dict(response.json())

    def test_a_manual_change_counts_half_at_half_rate(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, half_rate=True, xp=Decimal("3.0"))
                self.assertEqual(self._change(kind, unit, 1)["xp"], 3.5)
                self.assertEqual(self._change(kind, unit, 1)["xp"], 4.0)
                self.assertEqual(self._change(kind, unit, -1)["xp"], 3.5)
                unit.refresh_from_db()
                self.assertEqual(unit.xp, Decimal("3.5"))

    def test_a_manual_change_counts_in_full_otherwise(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, xp=Decimal("3.0"))
                self.assertEqual(self._change(kind, unit, 1)["xp"], 4.0)
                self.assertEqual(self._change(kind, unit, -2)["xp"], 2.0)

    def test_half_rate_sent_with_the_change_counts(self):
        unit = make_unit(HERO, self.warband, xp=Decimal("1.0"))
        self.assertEqual(self._change(HERO, unit, 1, half_rate=True)["xp"], 1.5)

    def test_xp_never_goes_below_zero(self):
        unit = make_unit(HERO, self.warband, half_rate=True, xp=Decimal("0.5"))
        self.assertEqual(self._change(HERO, unit, -1)["xp"], 0.0)
        self.assertEqual(self._change(HERO, unit, -1)["xp"], 0.0)

    def test_a_threshold_is_reached_only_on_whole_xp(self):
        # default tables: heroes 2, 4, ...; henchmen 2, 5, ...; hired swords as heroes until the campaign sets theirs
        hero = make_unit(HERO, self.warband, half_rate=True, xp=Decimal("1.0"))
        first = self._change(HERO, hero, 1)
        self.assertEqual((first["xp"], first["level_up"]), (1.5, 0))
        second = self._change(HERO, hero, 1)
        self.assertEqual((second["xp"], second["level_up"]), (2.0, 1))
        self.assertEqual(self._change(HERO, hero, -1)["level_up"], 1)  # lowering takes nothing away

    def test_xp_and_xp_change_together_are_refused(self):
        unit = make_unit(HENCHMEN, self.warband)
        url = unit_url(HENCHMEN, self.warband.id, unit.id)
        response = self.client.patch(url, {"xp": 4, "xp_change": 1}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("xp_change", response.json())

    def test_a_set_xp_is_taken_as_sent(self):
        unit = make_unit(HIRELING, self.warband, half_rate=True)
        response = self.client.patch(unit_url(HIRELING, self.warband.id, unit.id), {"xp": 7}, format="json")
        self.assertEqual(response.json()["xp"], 7.0)

    def test_battle_xp_and_manual_changes_both_count_half(self):
        hero = make_unit(HERO, self.warband, half_rate=True)
        group = make_unit(HENCHMEN, self.warband, half_rate=True, members=("Alpha",))

        self.play_battle({f"hero:{hero.id}": 3, f"henchman:{group.henchmen.get().id}": 1})

        hero.refresh_from_db()
        group.refresh_from_db()
        self.assertEqual((hero.xp, group.xp), (Decimal("1.5"), Decimal("0.5")))
        self.assertEqual(self._change(HERO, hero, 1)["xp"], 2.0)
        self.assertEqual(self._change(HENCHMEN, group, -1)["xp"], 0.0)

    def test_the_batch_update_takes_a_change_too(self):
        unit = make_unit(HIRELING, self.warband, half_rate=True, xp=Decimal("2.0"))
        body = {"update": [{"id": unit.id, "xp_change": 3}]}
        response = self.client.post(unit_url(HIRELING, self.warband.id, suffix="batch/"), body, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        unit.refresh_from_db()
        self.assertEqual(unit.xp, Decimal("3.5"))
