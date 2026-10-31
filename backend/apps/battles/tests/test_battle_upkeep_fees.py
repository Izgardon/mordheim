"""Upkeep in camp with structured fees (the fees and skill lists step): Ready charges each hired sword's gold and his
resources, each line from the counter it names, else from the counter of its name, never below 0, noted on the
Upkeep row; a line set not to be paid is noted, a short or missing counter warns, and an upkeep of none has no row."""

from typing import Any

from apps.hirelings.fees import make_fee
from apps.warbands.models import Hireling, WarbandResource, WarbandTrade

from .battle_support import BattleTestCase, build_fixture_warband, catalogue_item, draft, unit_result


class UpkeepFeeTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.fixture = build_fixture_warband(self.warband, catalogue_item("Rope", 5))
        self.ogre, self.rat_ogre = self.fixture.hirelings
        self.rat = f"hero:{self.rival.heroes.create(name='Rat', unit_type='Assassin').id}"
        self.shards = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone shards", amount=2)
        self.treasure = WarbandResource.objects.create(warband=self.warband, name="Treasure", amount=1)

    def ready(self, entries: dict[str, dict[str, Any]]) -> dict[str, Any]:
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.rat]})
        self.finish(battle_id, [self.warband])
        results = {key: unit_result(key) for key in self.fixture.keys}
        postbattle = draft(results, upkeep={"pay_upkeep": True, "entries": entries})
        answer: dict[str, Any] = self.ok(self.finalize(self.player, battle_id, postbattle)).data
        return answer

    def upkeep_row(self) -> tuple[int, str]:
        row = WarbandTrade.objects.get(warband=self.warband, action="Upkeep")
        return row.price, row.notes

    def amounts(self) -> tuple[int, int]:
        self.shards.refresh_from_db()
        self.treasure.refresh_from_db()
        return self.shards.amount, self.treasure.amount

    def test_resources_are_paid_from_the_counter_of_their_name_unless_the_entry_names_one(self):
        entries = {
            f"hireling:{self.ogre.id}": {"unit_name": "Grukk", "cost": 20},
            f"hireling:{self.rat_ogre.id}": {
                "unit_name": "Rat Ogre",
                "cost": 0,
                "resources": [
                    {"resource": "Wyrdstone", "amount": 1},  # the counter of its name
                    {"resource": "Campaign points", "amount": 1, "resource_id": self.treasure.id},  # picked
                ],
            },
        }

        answer = self.ready(entries)

        self.assertEqual(self.amounts(), (1, 0))
        self.assertEqual(
            self.upkeep_row(),
            (
                -20,
                "Grukk: 20 gc\nRat Ogre: 0 gc; Paid 1 Wyrdstone from Wyrdstone shards, 1 Campaign points from Treasure.",
            ),  # fmt: skip
        )
        self.assertNotIn("resource_short", [warning["code"] for warning in answer.get("warnings", [])])

    def test_a_short_counter_pays_what_it_holds_and_a_line_not_paid_is_noted(self):
        lines = [
            {"resource": "Wyrdstone", "amount": 5},
            {"resource": "Treasure", "amount": 1, "resource_id": None},  # "Don't pay this"
            {"resource": "Gromril", "amount": 1},  # no counter of that name
        ]
        entries = {f"hireling:{self.rat_ogre.id}": {"unit_name": "Rat Ogre", "cost": None, "resources": lines}}

        answer = self.ready(entries)

        self.assertEqual(self.amounts(), (0, 1))
        self.assertEqual(
            self.upkeep_row(),
            (
                0,
                "Rat Ogre: 0 gc; Paid 2 of 5 Wyrdstone from Wyrdstone shards. Not paid: 1 Treasure, 1 Gromril.",
            ),  # fmt: skip
        )
        warned = [warning["code"] for warning in answer.get("warnings", [])]
        self.assertEqual(sorted(code for code in warned if code.startswith("resource")), ["resource_short", "resource_unpaid"])  # fmt: skip

    def test_an_upkeep_of_none_is_suggested_no_row_and_resources_are_suggested_with_their_names(self):
        Hireling.objects.filter(id=self.ogre.id).update(upkeep_fee=make_fee("none"))
        Hireling.objects.filter(id=self.rat_ogre.id).update(upkeep_fee=make_fee(gold=5, resources=[("Wyrdstone", 1)], note="15 gc*"))  # fmt: skip
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.rat]})
        self.finish(battle_id, [self.warband])

        state = self.ok(self.get_as(self.player, self.url(battle_id, "state") + "?view=postbattle")).data
        upkeep = state["suggested_postbattle"]["upkeep"]["entries"]

        self.assertNotIn(f"hireling:{self.ogre.id}", upkeep)
        self.assertEqual(
            upkeep[f"hireling:{self.rat_ogre.id}"],
            {
                "unit_name": self.rat_ogre.name,
                "cost": 5,
                "resources": [{"resource": "Wyrdstone", "amount": 1}],
                "note": "15 gc*",
            },  # fmt: skip
        )

    def test_a_draft_keeps_its_upkeep_resources_and_refuses_a_bad_line(self):
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.rat]})
        self.finish(battle_id, [self.warband])
        key = f"hireling:{self.rat_ogre.id}"
        lines = [{"resource": "Wyrdstone", "amount": 1, "resource_id": self.shards.id}, {"resource": "Treasure", "amount": 2}]  # fmt: skip
        results = {unit_key: unit_result(unit_key) for unit_key in self.fixture.keys}

        saved = self.post_as(self.player, self.url(battle_id, "postbattle"), {"postbattle_json": draft(results, upkeep={"pay_upkeep": True, "entries": {key: {"unit_name": "R", "cost": 0, "resources": lines}}})})  # fmt: skip
        bad = self.post_as(self.player, self.url(battle_id, "postbattle"), {"postbattle_json": draft(results, upkeep={"pay_upkeep": True, "entries": {key: {"unit_name": "R", "cost": 0, "resources": [{"resource": "", "amount": 1}]}}})})  # fmt: skip

        self.assertEqual(saved.status_code, 200, saved.data)
        stored = self.participant(battle_id, self.player).postbattle_json["upkeep"]["entries"][key]
        self.assertEqual(stored["resources"], lines)
        self.assertEqual(bad.status_code, 400)
