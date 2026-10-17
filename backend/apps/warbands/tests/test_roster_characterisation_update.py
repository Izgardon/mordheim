"""Characterisation: PATCHing a unit's fields, loadout and traits; the hero leader rule (pass 1)."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.warbands.models import Henchman, Hero

from .roster_support import (
    HENCHMEN,
    HERO,
    HIRED_SWORD,
    KINDS,
    Kind,
    RosterTestCase,
    log_rows,
    make_unit,
    related_ids,
    trade_rows,
    unit_url,
)


class RosterUpdateCharacterisationTests(RosterTestCase):
    def _patch(self, kind: Kind, unit: Any, payload: dict[str, Any]) -> Any:
        return self.client.patch(unit_url(kind, self.warband.id, unit.id), payload, format="json")

    def test_patch_updates_scalar_fields(self):
        payload = {
            "name": "Renamed",
            "unit_type": "Veteran",
            "price": 35,
            "deeds": "Slew a troll",
            "weapon_skill": 5,
            "armour_save": "4",  # strings are accepted, "4+" too (the frontend sends strings for 2 kinds, BUG-87)
        }
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, race=self.race)
                response = self._patch(kind, unit, {**payload, "race": self.other_race.id})

                self.assertEqual(response.status_code, 200)
                body = response.json()
                self.assertEqual({key: body[key] for key in payload}, {**payload, "armour_save": 4})
                self.assertEqual((body["race_id"], body["race_name"]), (self.other_race.id, "Dwarf"))
                unit.refresh_from_db()
                self.assertEqual((unit.name, unit.armour_save, unit.race_id), ("Renamed", 4, self.other_race.id))

    def test_patch_writes_no_trade_or_log_for_plain_edits(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                self._patch(kind, unit, {"name": "Renamed", "price": 99, "xp": 1})
                self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))

    def test_patch_clears_armour_save_with_null(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, armour_save=5)
                self.assertIsNone(self._patch(kind, unit, {"armour_save": None}).json()["armour_save"])

    def test_invalid_patches_are_rejected_and_change_nothing(self):
        cases: list[dict[str, Any]] = [
            {"weapon_skill": 11},
            {"armour_save": "7+"},  # "4+" is a save now (decision 11); 7+ is past the worst
            {"xp": "1.25"},
            {"race": 999999},
            {"name": ""},
        ]
        for kind in KINDS:
            unit = make_unit(kind, self.warband, weapon_skill=3)
            for payload in cases:
                with self.subTest(kind=kind.key, payload=payload):
                    response = self._patch(kind, unit, {**payload, "unit_type": "Changed"})
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(list(response.json()), list(payload))
            unit.refresh_from_db()
            self.assertEqual((unit.weapon_skill, unit.unit_type), (3, "Trooper"))

    def test_patch_on_a_dead_or_foreign_unit_is_404(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                for unit in (make_unit(kind, self.warband, dead=True), make_unit(kind, self.rival)):
                    response = self._patch(kind, unit, {"name": "x"})
                    self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))

    def test_items_list_replaces_the_whole_item_loadout(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                getattr(unit, kind.items).create(item=self.sword, cost=10)

                untouched = self._patch(kind, unit, {"name": "No items key"})
                self.assertEqual([item["id"] for item in untouched.json()["items"]], [self.sword.id])

                replaced = self._patch(kind, unit, {"items": [{"id": self.axe.id, "cost": 7}, {"id": 999999}]})
                self.assertEqual([(i["id"], i["cost"]) for i in replaced.json()["items"]], [(self.axe.id, 7)])

                cleared = self._patch(kind, unit, {"items": []})
                self.assertEqual(cleared.json()["items"], [])
                self.assertFalse(getattr(unit, kind.items).exists())

    def test_id_lists_replace_skills_specials_and_spells(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                getattr(unit, kind.skills).create(skill=self.skills[0])
                getattr(unit, kind.specials).create(special=self.specials[0])
                payload = {
                    "skill_ids": [self.skills[1].id, 999999],
                    "special_ids": [self.specials[1].id],
                    "spell_ids": [self.spells[1].id],
                }
                response = self._patch(kind, unit, payload)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(related_ids(unit, kind.skills, "skill"), [self.skills[1].id])
                self.assertEqual(related_ids(unit, kind.specials, "special"), [self.specials[1].id])
                # henchmen groups have no spells: spell_ids is ignored without an error
                self.assertEqual(related_ids(unit, kind.spells, "spell"), [self.spells[1].id] if kind.spells else [])
                self.assertEqual([skill["name"] for skill in response.json()["skills"]], ["Skill 1"])

                self._patch(kind, unit, {"skill_ids": [], "special_ids": []})
                self.assertEqual(related_ids(unit, kind.skills, "skill"), [])
                self.assertEqual(related_ids(unit, kind.specials, "special"), [])

    def test_added_skills_specials_and_spells_are_logged_for_heroes_and_hired_swords_only(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.warband.logs.all().delete()
                unit = make_unit(kind, self.warband, name="Ulli")
                getattr(unit, kind.skills).create(skill=self.skills[0])
                payload = {
                    "skill_ids": [self.skills[0].id, self.skills[1].id],
                    "special_ids": [self.specials[0].id],
                    "spell_ids": [self.spells[0].id],
                }
                self._patch(kind, unit, payload)
                self._patch(kind, unit, {"skill_ids": []})  # removals are never logged

                prefix = kind.loadout_log_prefix
                expected = (
                    []
                    if prefix is None
                    else [
                        ("loadout", f"{prefix}_skill", {"hero": "Ulli", "skill": "Skill 1", "skill_type": "Combat"}),
                        (
                            "loadout",
                            f"{prefix}_special",
                            {"hero": "Ulli", "special": "Special 0", "special_type": "Ability"},
                        ),
                        (
                            "loadout",
                            f"{prefix}_spell",
                            {"hero": "Ulli", "spell": "Spell 0", "spell_type": "Lesser Magic"},
                        ),
                    ]
                )
                # the payload key is "hero" for hired swords too
                self.assertEqual([row[:3] for row in log_rows(self.warband)], expected)

    def test_trait_flags_sync_the_special_ids_sent_with_them(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                payload: dict[str, Any] = {"large": True, "special_ids": [self.specials[0].id, self.priest.id]}
                if kind is not HENCHMEN:
                    payload["caster"] = "Wizard"
                response = self._patch(kind, unit, payload)

                # henchmen have no caster: their Priest entry is kept as sent
                expected = (
                    [self.specials[0].id, self.priest.id, self.large.id]
                    if kind is HENCHMEN
                    else [self.specials[0].id, self.large.id, self.wizard.id]
                )
                self.assertEqual(related_ids(unit, kind.specials, "special"), expected)
                self.assertTrue(response.json()["large"])

    def test_trait_flags_sync_their_specials_when_no_special_ids_are_sent(self):
        # BUG-88: henchmen and hired swords used to reach a hero-only helper here and return 500
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                getattr(unit, kind.specials).create(special=self.specials[0])
                on: dict[str, Any] = {"large": True}
                off: dict[str, Any] = {"large": False}
                if kind is not HENCHMEN:  # henchmen have no caster
                    on["caster"], off["caster"] = "Priest", "No"

                response = self._patch(kind, unit, on)
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json()["large"])
                traits = [self.large.id] if kind is HENCHMEN else [self.large.id, self.priest.id]
                self.assertEqual(related_ids(unit, kind.specials, "special"), [self.specials[0].id, *traits])

                response = self._patch(kind, unit, off)
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.json()["large"])
                self.assertEqual(related_ids(unit, kind.specials, "special"), [self.specials[0].id])

    def test_caster_alone_swaps_the_caster_special(self):
        for kind in (HERO, HIRED_SWORD):
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                self.assertEqual(self._patch(kind, unit, {"caster": "Wizard"}).status_code, 200)
                self.assertEqual(related_ids(unit, kind.specials, "special"), [self.wizard.id])

                response = self._patch(kind, unit, {"caster": "Priest"})
                self.assertEqual((response.status_code, response.json()["caster"]), (200, "Priest"))
                self.assertEqual(related_ids(unit, kind.specials, "special"), [self.priest.id])

    def test_large_special_in_special_ids_sets_the_flag(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                self.assertTrue(self._patch(kind, unit, {"special_ids": [self.large.id]}).json()["large"])
                self.assertFalse(self._patch(kind, unit, {"special_ids": []}).json()["large"])

    def test_hero_accepts_and_discards_the_item_trade_fields(self):
        hero = make_unit(HERO, self.warband)
        payload = {"item_reason": "found it", "item_action": "Buy", "item_price": 12.5, "name": "Kept"}
        response = self._patch(HERO, hero, payload)
        self.assertEqual((response.status_code, response.json()["name"]), (200, "Kept"))
        self.assertEqual(trade_rows(self.warband), [])


class HeroLeaderCharacterisationTests(RosterTestCase):
    def _leaders(self) -> list[int]:
        return list(Hero.objects.filter(warband=self.warband, is_leader=True).values_list("id", flat=True))

    def _patch(self, hero: Hero, payload: dict[str, Any]) -> Any:
        return self.client.patch(unit_url(HERO, self.warband.id, hero.id), payload, format="json")

    def test_marking_a_hero_leader_moves_the_crown(self):
        old = make_unit(HERO, self.warband, is_leader=True)
        new = make_unit(HERO, self.warband)
        response = self._patch(new, {"is_leader": True})
        self.assertTrue(response.json()["is_leader"])
        self.assertEqual(self._leaders(), [new.id])
        old.refresh_from_db()
        self.assertFalse(old.is_leader)

    def test_unticking_the_only_leader_gives_the_crown_to_the_first_living_hero(self):
        first = make_unit(HERO, self.warband)
        leader = make_unit(HERO, self.warband, is_leader=True)
        self._patch(leader, {"is_leader": False})
        self.assertEqual(self._leaders(), [first.id])

    def test_a_leader_patched_dead_hands_the_crown_on_and_disappears(self):
        make_unit(HERO, self.warband, dead=True)
        leader = make_unit(HERO, self.warband, is_leader=True)
        heir = make_unit(HERO, self.warband)

        response = self._patch(leader, {"dead": True})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._leaders(), [heir.id])
        self.assertEqual(self.client.get(unit_url(HERO, self.warband.id, leader.id)).status_code, 404)

    def test_stale_xp_save_that_resends_is_leader_moves_the_crown_back(self):
        # Characterises current behaviour (BUG-63, frontend half: the XP saver resends is_leader); update when fixed
        stale = make_unit(HERO, self.warband)
        current = make_unit(HERO, self.warband, is_leader=True)
        self._patch(stale, {"xp": 1, "is_leader": True, "name": "Stale name"})
        self.assertEqual(self._leaders(), [stale.id])
        current.refresh_from_db()
        self.assertFalse(current.is_leader)

    def test_a_save_naming_neither_is_leader_nor_dead_leaves_the_crown_alone(self):
        # BUG-63: the leader sync used to run on every hero save
        first = make_unit(HERO, self.warband, is_leader=True)
        second = make_unit(HERO, self.warband, is_leader=True)  # two crowns, e.g. left over from before the fix
        self.assertEqual(self._patch(second, {"xp": 1, "name": "Renamed"}).status_code, 200)
        self.assertEqual(self._leaders(), [first.id, second.id])

        self._patch(second, {"is_leader": True})
        self.assertEqual(self._leaders(), [second.id])

    def test_writes_that_can_move_the_crown_lock_the_warband_before_touching_a_hero(self):
        # BUG-63: leader changes now run one at a time per warband
        url = unit_url(HERO, self.warband.id)
        requests = {
            "patch is_leader": lambda hero: self._patch(hero, {"is_leader": True}),
            "patch dead": lambda hero: self._patch(hero, {"dead": True}),
            "delete": lambda hero: self.client.delete(unit_url(HERO, self.warband.id, hero.id)),
            "create": lambda hero: self.client.post(url, {"name": "New", "is_leader": True}, format="json"),
        }
        for name, send in requests.items():
            with self.subTest(request=name):
                hero = make_unit(HERO, self.warband)
                with CaptureQueriesContext(connection) as captured:
                    self.assertIn(send(hero).status_code, (200, 201, 204))
                statements = [query["sql"] for query in captured]
                lock = next(i for i, sql in enumerate(statements) if 'FROM "warband"' in sql and "FOR UPDATE" in sql)
                if name != "create":  # a new hero's INSERT can't conflict with anyone
                    first_hero_write = next(
                        i for i, sql in enumerate(statements) if sql.startswith(('UPDATE "hero"', 'DELETE FROM "hero"'))
                    )
                    self.assertLess(lock, first_hero_write)

    def test_an_xp_save_takes_no_lock(self):
        hero = make_unit(HERO, self.warband, is_leader=True)
        with CaptureQueriesContext(connection) as captured:
            self._patch(hero, {"xp": 1})
        self.assertFalse([query["sql"] for query in captured if "FOR UPDATE" in query["sql"]])


class UnitWriteResponseTests(RosterTestCase):
    """PERF-23: PATCH and level-up responses are one fresh read of the unit, the same body GET returns."""

    def test_patch_and_level_up_responses_equal_a_fresh_get(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, race=self.race, level_up=1)
                if kind is HENCHMEN:
                    Henchman.objects.create(group=unit, name="Fallen", dead=True)
                url = unit_url(kind, self.warband.id, unit.id)
                loadout = {"xp": 2, "items": [{"id": self.sword.id}], "skill_ids": [self.skills[0].id], "large": True}

                patched = self.client.patch(url, loadout, format="json")
                self.assertEqual(patched.status_code, 200)
                self.assertEqual(patched.json(), self.client.get(url).json())

                levelled = self.client.post(f"{url}level-up/", {"payload": {"advance": {"id": "WS"}}}, format="json")
                self.assertEqual(levelled.status_code, 200)
                self.assertEqual(levelled.json(), self.client.get(url).json())
