"""A finalise that answers 400 writes nothing (BUG-124).

Each trigger the characterisation report lists fails after the first hero's XP has been written (and, for the
finds triggers, after exploration and upkeep too); the 400 must roll all of it back, so a retry can't apply it
twice. Units that left the warband were triggers too, until BUG-73 left them out with a warning instead.
"""

from collections.abc import Callable
from decimal import Decimal
from typing import Any

from apps.battles.models import Battle, BattleParticipant
from apps.campaigns.models import Campaign
from apps.items.models import Item
from apps.warbands.models import WarbandItem, WarbandResource
from apps.warbands.tests.roster_support import log_rows, trade_rows
from apps.warbands.utils.armour_save import ARMOUR_SAVE_ERROR

from .battle_support import BattleTestCase, build_fixture_warband, catalogue_item, draft, unit_result


class FinaliseRollbackTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.fixture = build_fixture_warband(self.warband, catalogue_item("Rope", 5))
        self.rat = f"hero:{self.rival.heroes.create(name='Rat', unit_type='Assassin').id}"
        self.resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=1)
        self.charm = catalogue_item("Lucky Charm", 10)

    def key(self, kind: str, unit: Any) -> str:
        return f"{kind}:{unit.id}"

    def postbattle_draft(self, finds: list[dict[str, Any]], **changes: dict[str, Any]) -> dict[str, Any]:
        """Every fixture unit; the first hero earns 3 XP, then exploration, upkeep and `finds` follow."""
        changes = {self.key("hero", self.fixture.heroes[0]): {"xp": 3}, **changes}
        sword = self.key("hireling", self.fixture.hirelings[0])
        return draft(
            {key: unit_result(key, **changes.get(key, {})) for key in self.fixture.keys},
            exploration={"dice_values": [3], "resource_id": self.resource.id},
            upkeep={"pay_upkeep": True, "entries": {sword: {"cost": 15}}},
            finds={"gold_crowns": 5, "items": finds},
        )

    def unit_information(self, battle_id: int, info: dict[str, Any]) -> None:
        BattleParticipant.objects.filter(battle_id=battle_id, user=self.player).update(unit_information_json=info)

    def triggers(self) -> list[tuple[str, Callable[[int], dict[str, Any]]]]:
        heroes, henchmen = self.fixture.heroes, self.fixture.henchmen
        other_campaign = Campaign.objects.create(name="Far away", join_code="FAR001")
        foreign = Item.objects.create(name="Foreign Idol", type="Misc", campaign=other_campaign)
        no_price = catalogue_item("Strange Idol", None)

        def overrides(battle_id: int) -> dict[str, Any]:
            first, second = (self.key("henchman", member) for member in henchmen[:2])
            info = {first: {"stats_override": {"strength": 5}}, second: {"stats_override": {"strength": 4}}}
            self.unit_information(battle_id, info)
            return self.postbattle_draft([], **{first: {"keep_stats": True}, second: {"keep_stats": True}})

        def armour_save(battle_id: int) -> dict[str, Any]:
            # stored before BUG-123 parsed saves on entry, and kept (decision 6)
            hero = self.key("hero", heroes[1])
            self.unit_information(battle_id, {hero: {"stats_override": {"armour_save": "7+"}}})
            return self.postbattle_draft([], **{hero: {"keep_stats": True}})

        group_xp = {self.key("henchman", henchmen[0]): {"xp": 1}}
        return [
            ("All henchmen in a group must share the same stat overrides", overrides),
            ("All henchmen in a group must share the same xp_earned value", lambda _: self.postbattle_draft([], **group_xp)),
            (f"unit information armour_save: {ARMOUR_SAVE_ERROR}", armour_save),
            ("One or more found items are no longer available", lambda _: self.postbattle_draft([{"item_id": foreign.id}])),
            ("One or more found items no longer have an available cost", lambda _: self.postbattle_draft([{"item_id": no_price.id}])),
        ]  # fmt: skip

    def test_every_late_refusal_rolls_the_whole_finalise_back(self):
        for detail, arrange in self.triggers():
            with self.subTest(detail=detail):
                battle_id = self.to_postbattle({self.player: self.fixture.keys, self.viewer: [self.rat]})
                postbattle = arrange(battle_id)

                response = self.finalize(self.player, battle_id, postbattle)

                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
                self.assert_nothing_applied(battle_id)
                Battle.objects.filter(id=battle_id).update(status=Battle.STATUS_ENDED)  # free the players

    def assert_nothing_applied(self, battle_id: int) -> None:
        hero = self.fixture.heroes[0]
        hero.refresh_from_db()
        self.resource.refresh_from_db()
        self.assertEqual((hero.xp, self.resource.amount), (Decimal(0), 1))
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))
        self.assertFalse(WarbandItem.objects.filter(warband=self.warband).exists())
        self.assertEqual(self.participant(battle_id, self.player).status, "finished_battle")
        self.assertNotIn("participant_confirmed_postbattle", self.event_types(battle_id))
