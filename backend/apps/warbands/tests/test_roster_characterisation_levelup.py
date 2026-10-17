"""Characterisation: spending a level-up through POST .../level-up/, per kind (pass 1)."""

import unittest
from datetime import datetime
from typing import Any

from apps.skills.models import Skill
from apps.special.models import Special
from apps.warbands.models import Henchman

from .roster_support import (
    HENCHMEN,
    HERO,
    HIRED_SWORD,
    KINDS,
    STAT_FIELD_BY_ADVANCE,
    Kind,
    RosterTestCase,
    log_rows,
    make_unit,
    related_ids,
    unit_url,
)

STAT_LABELS = {
    "M": "Movement",
    "WS": "Weapon Skill",
    "BS": "Ballistic Skill",
    "S": "Strength",
    "T": "Toughness",
    "W": "Wound",
    "I": "Initiative",
    "A": "Attack",
    "Ld": "Leadership",
}


def advance(code: str | None, label: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {} if code is None else {"id": code}
    if label is not None:
        body["label"] = label
    return {"payload": {"advance": body}}


class RosterLevelUpCharacterisationTests(RosterTestCase):
    def _level_up(self, kind: Kind, unit: Any, body: Any) -> Any:
        return self.client.post(unit_url(kind, self.warband.id, unit.id, "level-up/"), body, format="json")

    def test_stat_advance_raises_the_stat_spends_one_level_up_and_records_it(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.warband.logs.all().delete()
                unit = make_unit(kind, self.warband, level_up=2, weapon_skill=3)
                body = advance("WS", "Weapon Skill")

                response = self._level_up(kind, unit, body)

                self.assertEqual(response.status_code, 200)
                self.assertEqual((response.json()["weapon_skill"], response.json()["level_up"]), (4, 1))
                unit.refresh_from_db()
                self.assertEqual((unit.weapon_skill, unit.level_up), (4, 1))
                [entry] = unit.level_up_history
                self.assertEqual((entry["code"], entry["label"]), ("WS", "Weapon Skill"))
                datetime.fromisoformat(entry["timestamp"])
                self.assertEqual(log_rows(self.warband), [("advance", kind.log_advance, body["payload"], None)])

    def test_each_kind_accepts_its_own_stat_advances_with_default_labels(self):
        for kind in KINDS:
            for code, field in STAT_FIELD_BY_ADVANCE.items():
                with self.subTest(kind=kind.key, advance=code):
                    fields: dict[str, Any] = {"level_up": 1, field: 2}
                    unit = make_unit(kind, self.warband, **fields)
                    response = self._level_up(kind, unit, advance(code))
                    unit.refresh_from_db()
                    if code in kind.stat_advances:
                        self.assertEqual(response.status_code, 200)
                        self.assertEqual((getattr(unit, field), unit.level_up), (3, 0))
                        self.assertEqual(unit.level_up_history[0]["label"], STAT_LABELS[code])
                    else:  # henchmen can't take M, T or W
                        self.assertEqual((response.status_code, response.json()), (400, {"detail": "Invalid advance"}))
                        self.assertEqual((getattr(unit, field), unit.level_up, unit.level_up_history), (2, 1, []))

    def test_a_blank_label_falls_back_to_the_default(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1)
                self._level_up(kind, unit, advance("A", "  "))
                unit.refresh_from_db()
                self.assertEqual(unit.level_up_history[0]["label"], "Attack")

    def test_stats_stop_at_ten_but_the_level_up_is_still_spent(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1, leadership=10)
                self.assertEqual(self._level_up(kind, unit, advance("Ld")).status_code, 200)
                unit.refresh_from_db()
                self.assertEqual((unit.leadership, unit.level_up, len(unit.level_up_history)), (10, 0, 1))

    def test_race_maximums_are_not_enforced(self):
        # Characterises current behaviour (BUG-32); update when fixed
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, race=self.race, level_up=1, strength=4)  # Human max S is 4
                self.assertEqual(self._level_up(kind, unit, advance("S")).json()["strength"], 5)

    def test_no_level_ups_left_is_a_400(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=0, weapon_skill=3)
                response = self._level_up(kind, unit, advance("WS"))
                self.assertEqual((response.status_code, response.json()), (400, {"detail": "No level ups available"}))
                unit.refresh_from_db()
                self.assertEqual((unit.weapon_skill, unit.level_up_history), (3, []))

    def test_no_level_ups_flag_blocks_spending_except_for_heroes(self):
        for kind in (HENCHMEN, HIRED_SWORD):
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=2, no_level_ups=True)
                response = self._level_up(kind, unit, advance("WS"))
                self.assertEqual((response.status_code, response.json()), (400, {"detail": "No level ups available"}))

    def test_unknown_or_missing_advances_spend_a_level_up_except_for_henchmen(self):
        # Characterises current behaviour (BUG-62); update when fixed
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unknown = make_unit(kind, self.warband, level_up=1)
                missing = make_unit(kind, self.warband, level_up=1)
                unknown_response = self._level_up(kind, unknown, advance("Foo"))
                missing_response = self._level_up(kind, missing, {})
                unknown.refresh_from_db()
                missing.refresh_from_db()
                if kind is HENCHMEN:
                    for response in (unknown_response, missing_response):
                        self.assertEqual((response.status_code, response.json()), (400, {"detail": "Invalid advance"}))
                    self.assertEqual((unknown.level_up, missing.level_up), (1, 1))
                else:
                    self.assertEqual((unknown_response.status_code, missing_response.status_code), (200, 200))
                    self.assertEqual((unknown.level_up, missing.level_up), (0, 0))
                    self.assertEqual([(e["code"], e["label"]) for e in unknown.level_up_history], [("Foo", "Foo")])
                    self.assertEqual(missing.level_up_history, [])  # spent without a trace in the history

    def test_skill_spell_and_special_advances_add_pending_placeholders(self):
        for kind in (HERO, HIRED_SWORD):
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=3)
                for code in ("Skill", "Spell", "Special"):
                    self.assertEqual(self._level_up(kind, unit, advance(code)).status_code, 200)
                unit.refresh_from_db()

                new_special = Special.objects.get(name="New Special", type="Pending")  # created on first use
                self.assertEqual(related_ids(unit, kind.skills, "skill"), [self.new_skill.id])
                self.assertEqual(related_ids(unit, kind.spells, "spell"), [self.new_spell.id])
                self.assertEqual(related_ids(unit, kind.specials, "special"), [new_special.id])
                self.assertEqual([e["label"] for e in unit.level_up_history], ["Skill", "Spell", "Special"])
                self.assertEqual(unit.level_up, 0)

    def test_placeholder_advances_are_invalid_for_henchmen(self):
        group = make_unit(HENCHMEN, self.warband, level_up=3)
        for code in ("Skill", "Spell", "Special"):
            with self.subTest(advance=code):
                response = self._level_up(HENCHMEN, group, advance(code))
                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Invalid advance"}))

    def test_a_missing_skill_placeholder_spends_the_level_up_silently(self):
        # Characterises current behaviour (BUG-62); update when fixed
        Skill.objects.filter(name="New Skill").delete()
        for kind in (HERO, HIRED_SWORD):
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1)
                self.assertEqual(self._level_up(kind, unit, advance("Skill")).status_code, 200)
                unit.refresh_from_db()
                self.assertEqual((related_ids(unit, kind.skills, "skill"), unit.level_up), ([], 0))
                self.assertEqual(unit.level_up_history[0]["code"], "Skill")

    def test_dead_units_can_still_level_up(self):
        # Unlike GET and PATCH, the level-up lookup doesn't filter out dead units.
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1, dead=True)
                self.assertEqual(self._level_up(kind, unit, advance("WS")).status_code, 200)

    def test_unknown_or_foreign_units_are_404(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                foreign = make_unit(kind, self.rival, level_up=1)
                for unit_id in (foreign.id, 999999):
                    response = self.client.post(
                        unit_url(kind, self.warband.id, unit_id, "level-up/"), advance("WS"), format="json"
                    )
                    self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))

    def test_henchmen_level_up_response_includes_dead_members(self):
        group = make_unit(HENCHMEN, self.warband, level_up=1, members=("Alpha",))
        Henchman.objects.create(group=group, name="Fallen", dead=True)
        response = self._level_up(HENCHMEN, group, advance("WS"))
        self.assertEqual(sorted(m["name"] for m in response.json()["henchmen"]), ["Alpha", "Fallen"])


class LevelUpPayloadCrashTests(RosterTestCase):
    """Bug: a `payload` that isn't a JSON object reaches `payload.get(...)` and raises
    AttributeError (500) once the unit has a level-up to spend. Expected: 400."""

    def _post_string_payload(self, kind: Kind) -> Any:
        unit = make_unit(kind, self.warband, level_up=1)
        return self.client.post(unit_url(kind, self.warband.id, unit.id, "level-up/"), {"payload": "WS"}, format="json")

    @unittest.expectedFailure
    def test_hero(self):
        self.assertEqual(self._post_string_payload(HERO).status_code, 400)

    @unittest.expectedFailure
    def test_henchmen_group(self):
        self.assertEqual(self._post_string_payload(HENCHMEN).status_code, 400)

    @unittest.expectedFailure
    def test_hired_sword(self):
        self.assertEqual(self._post_string_payload(HIRED_SWORD).status_code, 400)
