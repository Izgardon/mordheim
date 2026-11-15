"""The places a warband found are kept with its draft and logged at finalise (BUG-NEW-03).

They used to live only in the browser: the draft kept the dice, the re-rolls, the resource and the amount, so a
closed tab lost them and no one else ever saw them. The server works them out from the chosen dice and its own
chart (services/exploration.py) and keeps them beside the amount, which is why a client can't send its own.
"""

from typing import Any

from apps.battles.models import BattleParticipant
from apps.warbands.models import WarbandLog, WarbandResource

from .battle_support import BattleTestCase, draft, unit_result

# 3, 3, 3 is a triple of threes (Prisoners) and 1, 1 a double of ones (Well): two places in one roll
DICE = [3, 3, 3, 1, 1]
FOUND = [
    {"face": 3, "count": 3, "label": "Triples", "place": "Prisoners"},
    {"face": 1, "count": 2, "label": "Doubles", "place": "Well"},
]


class ExplorePlacesTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        hero = self.warband.heroes.create(name="Abbess", unit_type="Matriarch", is_leader=True)
        rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.hero_key, self.rat_key = f"hero:{hero.id}", f"hero:{rat.id}"
        self.shards = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", is_default=True)
        self.battle_id = self.to_postbattle({self.player: [self.hero_key], self.viewer: [self.rat_key]})

    def body(self, dice: list[int]) -> dict[str, Any]:
        exploration = {"dice_values": dice, "resource_id": self.shards.id}
        return draft({self.hero_key: unit_result(self.hero_key)}, exploration=exploration)

    def save(self, dice: list[int]) -> dict[str, Any]:
        url = self.url(self.battle_id, "postbattle")
        self.ok(self.post_as(self.player, url, {"postbattle_json": self.body(dice)}))
        participant = BattleParticipant.objects.get(battle_id=self.battle_id, warband=self.warband)
        exploration: dict[str, Any] = participant.postbattle_json["exploration"]
        return exploration

    def test_the_draft_keeps_the_places_the_multiples_found(self):
        self.assertEqual(self.save(DICE)["places"], FOUND)

    def test_a_reload_reads_them_back_from_the_server(self):
        self.save(DICE)
        url = f"{self.url(self.battle_id, 'state')}?view=postbattle"
        data = self.ok(self.get_as(self.player, url)).data
        mine = next(entry for entry in data["participants"] if entry["warband"]["id"] == self.warband.id)
        self.assertEqual(mine["postbattle_json"]["exploration"]["places"], FOUND)

    def test_a_re_roll_keeps_only_the_places_of_the_dice_that_stand(self):
        self.save(DICE)
        self.assertEqual(self.save([2, 2, 2, 2, 5])["places"], [{"face": 2, "count": 4, "label": "Four of a kind", "place": "Shrine"}])  # fmt: skip

    def test_dice_with_no_multiple_find_nowhere(self):
        self.assertEqual(self.save([1, 2, 3])["places"], [])

    def test_finalise_logs_the_places(self):
        self.ok(self.finalize(self.player, self.battle_id, self.body(DICE)))

        log = WarbandLog.objects.get(warband=self.warband, entry_type="exploration")
        self.assertEqual(log.payload["places"], ["Prisoners", "Well"])
        participant = BattleParticipant.objects.get(battle_id=self.battle_id, warband=self.warband)
        self.assertEqual(participant.postbattle_json["exploration"]["places"], FOUND)

    def test_the_places_are_the_servers_whatever_a_client_sends(self):
        body = self.body(DICE)
        body["exploration"]["places"] = [{"face": 6, "count": 6, "label": "Six of a kind", "place": "The Pit"}]
        url = self.url(self.battle_id, "postbattle")
        self.ok(self.post_as(self.player, url, {"postbattle_json": body}))
        participant = BattleParticipant.objects.get(battle_id=self.battle_id, warband=self.warband)
        self.assertEqual(participant.postbattle_json["exploration"]["places"], FOUND)
