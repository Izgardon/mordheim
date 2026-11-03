"""Post-battle Explore and the default resource (William, 3 Nov 2026): the shards go to the warband's default resource
when the draft picks none; a resource picked stays."""

from typing import Any

from apps.battles.models import BattleParticipant
from apps.warbands.models import WarbandLog, WarbandResource

from .battle_support import BattleTestCase, draft, unit_result


class ExploreDefaultTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        hero = self.warband.heroes.create(name="Abbess", unit_type="Matriarch", is_leader=True)
        rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.hero_key, self.rat_key = f"hero:{hero.id}", f"hero:{rat.id}"
        self.treasure = WarbandResource.objects.create(warband=self.warband, name="Treasure", amount=1)
        self.default = WarbandResource.objects.create(warband=self.warband, name="Warpstone", is_default=True)

    def finalise(self, resource_id: int | None) -> int:
        battle_id = self.to_postbattle({self.player: [self.hero_key], self.viewer: [self.rat_key]})
        exploration: dict[str, Any] = {"dice_values": [6, 5, 6], "resource_id": resource_id}  # total 17: 3 shards
        results = {self.hero_key: unit_result(self.hero_key)}
        self.ok(self.finalize(self.player, battle_id, draft(results, exploration=exploration)))
        return battle_id

    def amounts(self) -> tuple[int, int]:
        self.treasure.refresh_from_db()
        self.default.refresh_from_db()
        return self.default.amount, self.treasure.amount

    def test_with_no_resource_picked_the_shards_go_to_the_default_resource(self):
        battle_id = self.finalise(None)

        self.assertEqual(self.amounts(), (3, 1))
        log = WarbandLog.objects.get(warband=self.warband, entry_type="exploration")
        self.assertEqual((log.payload["amount"], log.payload["resource"]), (3, "Warpstone"))
        participant = BattleParticipant.objects.get(battle_id=battle_id, warband=self.warband)
        self.assertEqual(participant.postbattle_json["exploration"]["resource_id"], self.default.id)

    def test_a_resource_picked_stays(self):
        self.finalise(self.treasure.id)

        self.assertEqual(self.amounts(), (0, 4))
