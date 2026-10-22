"""Characterisation: spending a level-up through POST .../level-up/, per kind (pass 1)."""

from datetime import datetime
from typing import Any
from unittest import mock

from apps.skills.models import Skill
from apps.special.models import Special
from apps.warbands.models import Henchman
from apps.warbands.units.serializers import UnitLevelUpSerializer

from .roster_support import (
    HENCHMEN,
    HERO,
    HIRELING,
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
        for kind in (HENCHMEN, HIRELING):
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=2, no_level_ups=True)
                response = self._level_up(kind, unit, advance("WS"))
                self.assertEqual((response.status_code, response.json()), (400, {"detail": "No level ups available"}))

    def test_unknown_missing_or_malformed_advances_are_a_400_and_spend_nothing(self):
        # BUG-62: heroes and hired swords used to spend a level-up on any advance id, or none
        for kind in KINDS:
            for body in (advance("Foo"), advance(None), {}, {"payload": {"advance": {"id": ["WS"]}}}):
                with self.subTest(kind=kind.key, body=body):
                    unit = make_unit(kind, self.warband, level_up=1)
                    response = self._level_up(kind, unit, body)
                    self.assertEqual((response.status_code, response.json()), (400, {"detail": "Invalid advance"}))
                    unit.refresh_from_db()
                    self.assertEqual((unit.level_up, unit.level_up_history), (1, []))

    def test_skill_spell_and_special_advances_add_pending_placeholders(self):
        for kind in (HERO, HIRELING):
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

    def test_a_missing_placeholder_is_created_as_a_global_entry(self):
        # BUG-62: a missing "New Skill" or "New Spell" used to spend the level-up and add nothing
        Skill.objects.filter(name="New Skill").delete()
        for kind in (HERO, HIRELING):
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1)
                self.assertEqual(self._level_up(kind, unit, advance("Skill")).status_code, 200)
                unit.refresh_from_db()
                placeholder = Skill.objects.get(name="New Skill", type="Pending")
                self.assertEqual((related_ids(unit, kind.skills, "skill"), unit.level_up), ([placeholder.id], 0))
                self.assertIsNone(placeholder.campaign_id)

    def test_placeholders_never_come_from_another_campaign(self):
        # The Special placeholder used to fall back to any campaign's "New Special" (SEC-07)
        foreign = Special.objects.create(name="New Special", type="Pending", campaign=self.foreign_race.campaign)
        for kind in (HERO, HIRELING):
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1)
                self.assertEqual(self._level_up(kind, unit, advance("Special")).status_code, 200)
                [special_id] = related_ids(unit, kind.specials, "special")
                self.assertNotEqual(special_id, foreign.id)
                self.assertIsNone(Special.objects.get(id=special_id).campaign_id)

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

    def test_henchmen_level_up_response_lists_living_members_like_get(self):
        # PERF-23: the response used to include dead members, which GET hides
        group = make_unit(HENCHMEN, self.warband, level_up=1, members=("Alpha",))
        Henchman.objects.create(group=group, name="Fallen", dead=True)
        response = self._level_up(HENCHMEN, group, advance("WS"))
        self.assertEqual([m["name"] for m in response.json()["henchmen"]], ["Alpha"])


class LevelUpPayloadValidationTests(RosterTestCase):
    """BUG-89: a `payload` that isn't a JSON object used to reach `payload.get(...)` and return 500."""

    def test_a_non_object_payload_is_a_400_and_spends_nothing(self):
        for kind in KINDS:
            for payload in ("WS", ["WS"], 3, None):
                with self.subTest(kind=kind.key, payload=payload):
                    unit = make_unit(kind, self.warband, level_up=1)
                    response = self.client.post(
                        unit_url(kind, self.warband.id, unit.id, "level-up/"), {"payload": payload}, format="json"
                    )
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(list(response.json()), ["payload"])
                    unit.refresh_from_db()
                    self.assertEqual((unit.level_up, unit.level_up_history), (1, []))


class LevelUpConcurrencyTests(RosterTestCase):
    """BUG-62: two requests that both saw the last level-up must not both spend it."""

    PAYLOAD_SERIALIZERS = {
        HERO.key: UnitLevelUpSerializer,  # one payload serializer for every kind (PR B)
        HENCHMEN.key: UnitLevelUpSerializer,
        HIRELING.key: UnitLevelUpSerializer,
    }

    def test_a_level_up_spent_by_another_request_meanwhile_is_a_400(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, level_up=1, weapon_skill=3)

                def spend_it_meanwhile(serializer: Any, attrs: dict[str, Any], unit: Any = unit) -> dict[str, Any]:
                    # Runs after the view loaded the unit (level_up=1) and before it spends the level-up.
                    type(unit).objects.filter(pk=unit.pk).update(level_up=0)
                    return attrs

                serializer_class = self.PAYLOAD_SERIALIZERS[kind.key]
                with mock.patch.object(serializer_class, "validate", autospec=True, side_effect=spend_it_meanwhile):
                    response = self.client.post(
                        unit_url(kind, self.warband.id, unit.id, "level-up/"), advance("WS"), format="json"
                    )

                self.assertEqual((response.status_code, response.json()), (400, {"detail": "No level ups available"}))
                unit.refresh_from_db()
                self.assertEqual((unit.level_up, unit.weapon_skill, unit.level_up_history), (0, 3, []))
