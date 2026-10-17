"""Characterisation: XP edits and the level-up counter, per kind (pass 1).

A PATCH that sends `xp` without `level_up` adds one level-up per threshold crossed in
(previous XP, new XP], using the campaign's table for that kind. Nothing else about XP is
derived: lowering XP removes nothing and raising it again re-awards (BUG-27).
"""

from decimal import Decimal
from typing import Any

from django.test import SimpleTestCase

from apps.warbands.utils.henchmen_level import count_new_henchmen_level_ups
from apps.warbands.utils.hero_level import count_new_level_ups

from .roster_support import HENCHMEN, HERO, HIRED_SWORD, KINDS, Kind, RosterTestCase, make_unit, unit_url


class RosterXpCharacterisationTests(RosterTestCase):
    def _set_xp(self, kind: Kind, unit: Any, xp: Any, **extra: Any) -> Any:
        response = self.client.patch(unit_url(kind, self.warband.id, unit.id), {"xp": xp, **extra}, format="json")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_xp_gain_counts_default_thresholds_crossed(self):
        # hero table 2, 4, 6, ...; henchmen and hired swords share 2, 5, 9, 14
        expected = {HERO.key: 3, HENCHMEN.key: 2, HIRED_SWORD.key: 2}
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1)
                body = self._set_xp(kind, unit, 6)
                self.assertEqual((body["xp"], body["level_up"]), (6.0, 1 + expected[kind.key]))
                unit.refresh_from_db()
                self.assertEqual(unit.level_up, 1 + expected[kind.key])

    def test_each_kind_reads_its_own_campaign_thresholds(self):
        self.set_thresholds(
            hero_level_thresholds=[3, 7],
            henchmen_level_thresholds=[1, 3, 7],
            hired_sword_level_thresholds=[7],
        )
        expected = {HERO.key: 2, HENCHMEN.key: 3, HIRED_SWORD.key: 1}
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                self.assertEqual(self._set_xp(kind, unit, 7)["level_up"], expected[kind.key])

    def test_unusable_custom_thresholds_fall_back_to_the_defaults(self):
        self.set_thresholds(
            hero_level_thresholds=["x"], henchmen_level_thresholds=[], hired_sword_level_thresholds=[0, 3]
        )
        expected = {HERO.key: 3, HENCHMEN.key: 2, HIRED_SWORD.key: 2}
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                self.assertEqual(self._set_xp(kind, unit, 6)["level_up"], expected[kind.key])

    def test_whole_number_floats_in_thresholds_parse_differently_per_kind(self):
        # The hero parser accepts 3.0; the henchmen parser (also used for hired swords) rejects
        # it and falls back to its defaults. A shared counter must keep or deliberately fix this.
        self.set_thresholds(
            hero_level_thresholds=[3.0, 7.0],
            henchmen_level_thresholds=[3.0, 7.0],
            hired_sword_level_thresholds=[3.0, 7.0],
        )
        # XP 0 -> 5: heroes cross 3 of [3, 7]; the others cross 2 and 5 of the default table
        expected = {HERO.key: 1, HENCHMEN.key: 2, HIRED_SWORD.key: 2}
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                self.assertEqual(self._set_xp(kind, unit, 5)["level_up"], expected[kind.key])

    def test_sending_level_up_with_xp_sets_it_instead_of_counting(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1)
                self.assertEqual(self._set_xp(kind, unit, 14, level_up=0)["level_up"], 0)
                self.assertEqual(self._set_xp(kind, unit, 14, level_up=4)["level_up"], 4)

    def test_level_up_can_be_set_directly(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                response = self.client.patch(unit_url(kind, self.warband.id, unit.id), {"level_up": 3}, format="json")
                self.assertEqual(response.json()["level_up"], 3)

    def test_lowering_xp_keeps_level_ups(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, xp=10, level_up=2)
                self.assertEqual(self._set_xp(kind, unit, 0)["level_up"], 2)

    def test_xp_lowered_and_raised_again_awards_the_same_level_ups_twice(self):
        # Characterises current behaviour (BUG-27); update when fixed
        per_climb = {HERO.key: 3, HENCHMEN.key: 2, HIRED_SWORD.key: 2}  # thresholds crossed from 1 to 6
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, xp=1)
                self._set_xp(kind, unit, 6)
                self._set_xp(kind, unit, 1)
                self.assertEqual(self._set_xp(kind, unit, 6)["level_up"], 2 * per_climb[kind.key])

    def test_half_rate_does_not_change_the_count(self):
        # Half-rate is display-only on the server today (decision 6 is pending; see BUG-03/BUG-33).
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                normal = make_unit(kind, self.warband)
                halved = make_unit(kind, self.warband, half_rate=True)
                self.assertEqual(self._set_xp(kind, normal, 6)["level_up"], self._set_xp(kind, halved, 6)["level_up"])

    def test_half_steps_count_a_threshold_once_reached(self):
        expected = {HERO.key: 2, HENCHMEN.key: 1, HIRED_SWORD.key: 1}  # (1.5, 4.5]: 2 and 4, or just 2
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, xp=Decimal("1.5"))
                body = self._set_xp(kind, unit, "4.5")
                self.assertEqual((body["xp"], body["level_up"]), (4.5, expected[kind.key]))

    def test_no_level_ups_suppresses_counting_except_for_heroes(self):
        # Heroes have no no_level_ups field; the key is ignored and the hero still levels.
        expected = {HERO.key: 3, HENCHMEN.key: 0, HIRED_SWORD.key: 0}
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                body = self._set_xp(kind, unit, 6, no_level_ups=True)
                self.assertEqual(body["level_up"], expected[kind.key])
                self.assertEqual(body.get("no_level_ups"), None if kind is HERO else True)


class LevelCounterCharacterisationTests(SimpleTestCase):
    """ROST-TEST-26: the two counters agree on Decimals; they differ on string input."""

    def test_counters_agree_on_decimal_input(self):
        cases = [
            (Decimal("1.5"), Decimal("4.5"), [2, 5], 1),
            (Decimal("0"), Decimal("2.0"), [2, 5], 1),
            (Decimal("1.9"), Decimal("2.0"), [2], 1),
            (Decimal("2.0"), Decimal("1.0"), [2], 0),
            (None, Decimal("3"), [2], 1),
        ]
        for previous, new, thresholds, expected in cases:
            with self.subTest(previous=previous, new=new):
                self.assertEqual(count_new_level_ups(previous, new, thresholds), expected)
                self.assertEqual(count_new_henchmen_level_ups(previous, new, thresholds), expected)

    def test_default_tables(self):
        self.assertEqual(count_new_level_ups(0, 90), 21)
        self.assertEqual(count_new_henchmen_level_ups(0, 90), 4)

    def test_henchmen_counter_rejects_decimal_strings(self):
        self.assertEqual(count_new_level_ups("1.5", "4.5", [2, 5]), 1)
        with self.assertRaises(ValueError):
            count_new_henchmen_level_ups("1.5", "4.5", [2, 5])
