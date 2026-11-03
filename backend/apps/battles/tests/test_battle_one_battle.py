"""One battle at a time (William, 3 Nov 2026: "shouldnt be able to be invited or invite to a battle when in one for
real, only muliple pre battles. as soon as you accept one all other pre battles are cancelled").

A player fighting a battle (active, still in_battle) can't be put in another: a new battle with him in it is refused,
and so is his joining another (accepting, or coming back to a pre-battle or a fight he left), with `player_in_battle`.
Several pre-battles (and a post-game) stay allowed, with decision 1's warning (services/one_battle.py).
"""

from typing import Any

from apps.battles.models import Battle, BattleParticipant
from apps.warbands.models import Warband

from .battle_support import BattleTestCase

FORD = "Ford"


class OneBattleCase(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.crows = Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows")
        self.owls = Warband.objects.create(campaign=self.campaign, user=self.admin, name="Owls")

    def new_battle(self, creator: Any, invited: list[Any]) -> Any:
        return self.post_as(creator, self.battles_url(), {"participant_user_ids": [user.id for user in invited], "scenario": FORD})  # fmt: skip

    def fight(self, creator: Any, opponent: Any) -> int:
        """A battle `creator` started against `opponent`."""
        battle_id = self.create_battle([opponent], creator=creator)
        self.ok(self.post_as(opponent, self.url(battle_id, "join")))
        for user in (creator, opponent):
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))
        self.ok(self.post_as(creator, self.url(battle_id, "start")))
        return battle_id

    def refused(self, response: Any, detail: str) -> dict[str, Any]:
        self.assertEqual((response.status_code, response.data["code"]), (400, "player_in_battle"), response.data)
        self.assertEqual(response.data["detail"], detail)
        return dict(response.data)


class FightingRefusalTests(OneBattleCase):
    def test_a_new_battle_with_a_player_in_a_fight_is_refused(self):
        fight = self.to_active()  # the player and the viewer, Battle 1

        self.refused(self.new_battle(self.manager, [self.viewer]), "viewe is already fighting in Battle 1.")
        self.refused(self.new_battle(self.player, [self.manager]), "You are already fighting in Battle 1.")
        both = self.refused(
            self.new_battle(self.manager, [self.player, self.viewer]),
            "Already fighting: playe (Battle 1), viewe (Battle 1).",
        )
        self.assertEqual(
            both["players"],
            [
                {"user_id": self.player.id, "battle_id": fight, "battle_number": 1},
                {"user_id": self.viewer.id, "battle_id": fight, "battle_number": 1},
            ],
        )
        self.assertEqual(Battle.objects.count(), 1)

        self.ok(self.finish_mine(self.viewer, fight, "lost"))  # his post-game only warns (decision 1)
        data = self.ok(self.new_battle(self.manager, [self.viewer]), 201).data
        self.assertEqual([(warning["code"], warning["user_id"]) for warning in data["warnings"]], [("player_busy", self.viewer.id)])  # fmt: skip

    def test_joining_another_battle_while_fighting_is_refused(self):
        three = self.create_battle([self.viewer, self.manager])
        for user in (self.viewer, self.manager):
            self.ok(self.post_as(user, self.url(three, "join")))
        self.ok(self.post_as(self.viewer, self.url(three, "cancel")))  # he leaves; the other two play on
        self.fight(self.admin, self.viewer)  # Battle 1 for the Owls and the Rats
        # an invitation his start didn't clear (one made before this rule, say)
        stale = Battle.objects.create(campaign=self.campaign, created_by_user=self.manager, scenario="Old", number=1)
        BattleParticipant.objects.create(battle=stale, user=self.manager, warband=self.crows, status="accepted")
        BattleParticipant.objects.create(battle=stale, user=self.viewer, warband=self.rival, status="invited")
        fighting = "You are already fighting in Battle 1."

        self.refused(self.post_as(self.viewer, self.url(three, "join")), fighting)  # back to a pre-battle he left
        self.refused(self.post_as(self.viewer, self.url(stale.id, "join")), fighting)  # an invitation from before
        response = self.post_as(self.viewer, self.url(three, "ready"), {"ready": True})  # ready/ isn't a way back
        self.assertEqual((response.status_code, response.data["code"]), (400, "not_in_battle"))
        self.assertEqual(self.statuses(three), ["joined_prebattle", "joined_prebattle", "canceled_prebattle"])

        for user in (self.player, self.manager):
            self.ok(self.post_as(user, self.url(three, "ready"), {"ready": True}))
        self.ok(self.post_as(self.player, self.url(three, "start")))
        self.refused(self.post_as(self.viewer, self.url(three, "join")), fighting)  # nor a fight he left
        self.assertEqual(self.participant(three, self.viewer).status, "canceled_prebattle")

    def test_a_player_who_left_cannot_ready_up(self):
        # ready/ put a player who had declined or left back in the battle, past join/'s rules
        battle_id = self.to_prebattle([self.viewer, self.manager])
        self.ok(self.post_as(self.viewer, self.url(battle_id, "cancel")))

        response = self.post_as(self.viewer, self.url(battle_id, "ready"), {"ready": True})

        self.assertEqual((response.status_code, response.data["code"]), (400, "not_in_battle"))
        self.assertEqual(self.participant(battle_id, self.viewer).status, "canceled_prebattle")

    def test_several_pre_battles_stay_allowed(self):
        first = self.create_battle([self.viewer])
        second = self.ok(self.new_battle(self.manager, [self.viewer]), 201).data
        own = self.ok(self.new_battle(self.viewer, [self.admin]), 201).data  # his own, while invited to two

        self.assertEqual([warning["code"] for warning in second["warnings"]], ["player_busy"])
        self.assertEqual([warning["code"] for warning in own["warnings"]], ["player_busy"])
        places = BattleParticipant.objects.filter(user=self.viewer).order_by("battle_id")
        self.assertEqual(list(places.values_list("battle_id", "status")), [(first, "invited"), (second["battle"]["id"], "invited"), (own["battle"]["id"], "accepted")])  # fmt: skip

    def test_the_players_list_says_who_is_fighting(self):
        fight = self.to_active()
        self.create_battle([self.admin], creator=self.manager)
        self.ok(self.finish_mine(self.player, fight, "won"))

        players = self.ok(self.get_as(self.viewer, f"/api/campaigns/{self.campaign.id}/players/")).data
        fighting = {entry["name"]: (entry["battle_fighting"], entry["battle_busy_battle_number"]) for entry in players}
        self.assertEqual(
            (fighting["viewe"], fighting["playe"], fighting["admin"], fighting["owner"]),
            ((True, 1), (False, 1), (False, 1), (False, None)),
        )
