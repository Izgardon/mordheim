"""Characterisation: dismissing (DELETE) and death of units; the kill-history endpoint (pass 1)."""

from typing import Any

from apps.battles.models import BattleEvent
from apps.warbands.models import Henchman, Hero, WarbandItem

from .roster_support import (
    HENCHMEN,
    HERO,
    HIRED_SWORD,
    KINDS,
    Kind,
    RosterTestCase,
    log_rows,
    make_unit,
    record_kill,
    trade_rows,
    unit_url,
)

KILLER_TYPE = {HERO.key: "hero", HENCHMEN.key: "henchman", HIRED_SWORD.key: "hired_sword"}


class RosterDismissCharacterisationTests(RosterTestCase):
    def _loaded_unit(self, kind: Kind, **fields: Any) -> Any:
        unit = make_unit(kind, self.warband, **fields)
        getattr(unit, kind.items).create(item=self.sword, cost=10)
        getattr(unit, kind.skills).create(skill=self.skills[0])
        getattr(unit, kind.specials).create(special=self.specials[0])
        if kind.spells:
            getattr(unit, kind.spells).create(spell=self.spells[0])
        return unit

    def test_delete_dismisses_the_unit_keeps_its_rows_logs_it_and_refunds_nothing(self):
        # Decisions 3 and 4: the unit is kept as a dismissed record; its items stay on it (lost to the warband)
        expected_logs = {
            HERO.key: [("personnel", "remove_hero", {"name": "Bert", "type": "Trooper"}, None)],
            HENCHMEN.key: [("personnel", "remove_henchmen_group", {"name": "Bert", "type": "Trooper"}, None)],
            HIRED_SWORD.key: [("personnel", "remove_hired_sword", {"name": "Bert", "type": "Trooper"}, None)],
        }
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=1)
        self.warband.trades.create(action="Recruit", description="Bert the Trooper", price=-25)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.warband.logs.all().delete()
                unit = self._loaded_unit(kind, name="Bert")
                relations = [
                    getattr(unit, name) for name in (kind.items, kind.skills, kind.specials, kind.spells) if name
                ]

                response = self.client.delete(unit_url(kind, self.warband.id, unit.id))

                self.assertEqual((response.status_code, response.content), (204, b""))
                self.assertIsNotNone(kind.model.objects.get(id=unit.id).dismissed_at)
                self.assertTrue(all(relation.exists() for relation in relations))  # items stay on the record
                if kind is HENCHMEN:
                    self.assertEqual(Henchman.objects.filter(group_id=unit.id).count(), 2)
                self.assertEqual(trade_rows(self.warband), [("Recruit", "Bert the Trooper", -25, None)])
                self.assertEqual(list(WarbandItem.objects.values_list("item_id", "quantity")), [(self.axe.id, 1)])
                self.assertEqual(log_rows(self.warband), expected_logs[kind.key])

    def test_delete_log_falls_back_to_placeholder_names(self):
        expected = {
            HERO.key: {"name": "Unknown Hero", "type": "Unknown Type"},
            HENCHMEN.key: {"name": "Unknown", "type": "Unknown"},
            HIRED_SWORD.key: {"name": "Unknown Hired Sword", "type": "Unknown Type"},
        }
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.warband.logs.all().delete()
                unit = make_unit(kind, self.warband, name="", unit_type="")
                self.client.delete(unit_url(kind, self.warband.id, unit.id))
                self.assertEqual(log_rows(self.warband)[0][2], expected[kind.key])

    def test_dead_units_can_be_deleted_but_unknown_or_foreign_ones_are_404(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                dead = make_unit(kind, self.warband, dead=True)
                self.assertEqual(self.client.delete(unit_url(kind, self.warband.id, dead.id)).status_code, 204)
                for unit_id in (make_unit(kind, self.rival).id, 999999):
                    response = self.client.delete(unit_url(kind, self.warband.id, unit_id))
                    self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))

    def test_deleting_the_leader_crowns_the_next_living_hero(self):
        leader = make_unit(HERO, self.warband, is_leader=True)
        make_unit(HERO, self.warband, dead=True)
        heir = make_unit(HERO, self.warband)
        later = make_unit(HERO, self.warband)

        self.client.delete(unit_url(HERO, self.warband.id, leader.id))

        self.assertEqual(list(Hero.objects.filter(is_leader=True).values_list("id", flat=True)), [heir.id])
        self.assertFalse(Hero.objects.get(id=later.id).is_leader)

    def test_a_unit_patched_dead_is_hidden_everywhere_but_kept_with_its_loadout(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = self._loaded_unit(kind)
                response = self.client.patch(unit_url(kind, self.warband.id, unit.id), {"dead": True}, format="json")
                self.assertEqual((response.status_code, response.json()["dead"]), (200, True))

                for suffix in ("", "detail/"):
                    self.assertEqual(self.client.get(unit_url(kind, self.warband.id, suffix=suffix)).json(), [])
                self.assertEqual(self.client.get(unit_url(kind, self.warband.id, unit.id)).status_code, 404)
                self.assertTrue(getattr(unit, kind.items).exists())
                history = self.client.get(unit_url(kind, self.warband.id, unit.id, "kill-history/"))
                self.assertEqual(history.status_code, 200)

    def test_a_dead_unit_cannot_be_patched_back_to_life(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, dead=True)
                response = self.client.patch(unit_url(kind, self.warband.id, unit.id), {"dead": False}, format="json")
                self.assertEqual(response.status_code, 404)


class RosterKillHistoryCharacterisationTests(RosterTestCase):
    def _history(self, kind: Kind, unit_id: int) -> Any:
        return self.client.get(unit_url(kind, self.warband.id, unit_id, "kill-history/"))

    def test_named_kills_newest_first_and_total_from_the_stored_count(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                BattleEvent.objects.all().delete()  # unit ids repeat across kinds; keep each kind's events apart
                if kind is HENCHMEN:
                    unit = make_unit(kind, self.warband, members=())
                    alive = Henchman.objects.create(group=unit, name="Alive", kills=1)
                    fallen = Henchman.objects.create(group=unit, name="Fallen", kills=3, dead=True)
                    killer_ids = [alive.id, fallen.id]  # dead members' kills still count
                else:
                    unit = make_unit(kind, self.warband, kills=4)
                    killer_ids = [unit.id, unit.id]
                killer = KILLER_TYPE[kind.key]
                bridge, tower = self.make_battle("Bridge"), self.make_battle("Tower")
                record_kill(bridge, killer, killer_ids[0], {"name": "Rat One", "warband_id": self.rival.id})
                record_kill(tower, killer, killer_ids[1], {"name": "Rat Two", "warband_id": str(self.rival.id)})
                # skipped: no victim name, unknown or invalid victim warband, another unit, another type
                record_kill(tower, killer, killer_ids[0], {"name": " ", "warband_id": self.rival.id})
                record_kill(tower, killer, killer_ids[0], {"name": "Ghost", "warband_id": 999999})
                record_kill(tower, killer, killer_ids[0], {"name": "Odd", "warband_id": "abc"})
                record_kill(tower, killer, 999999, {"name": "Elsewhere", "warband_id": self.rival.id})
                other_type = "hero" if kind is not HERO else "hired_sword"
                record_kill(tower, other_type, killer_ids[0], {"name": "Mixup", "warband_id": self.rival.id})

                response = self._history(kind, unit.id)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.json(),
                    {
                        "total_kills": 4,
                        "named_kills_count": 2,
                        "named_kills": [
                            {"victim_name": "Rat Two", "victim_warband_name": "Rats", "scenario_name": "Tower"},
                            {"victim_name": "Rat One", "victim_warband_name": "Rats", "scenario_name": "Bridge"},
                        ],
                    },
                )

    def test_units_without_kills(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, members=()) if kind is HENCHMEN else make_unit(kind, self.warband)
                response = self._history(kind, unit.id)
                self.assertEqual(response.json(), {"total_kills": 0, "named_kills_count": 0, "named_kills": []})

    def test_unknown_or_foreign_units_are_404(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                for unit_id in (make_unit(kind, self.rival).id, 999999):
                    response = self._history(kind, unit_id)
                    self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))
