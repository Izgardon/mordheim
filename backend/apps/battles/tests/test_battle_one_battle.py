"""One battle at a time (William, 3 Nov 2026: "shouldnt be able to be invited or invite to a battle when in one for
real, only muliple pre battles. as soon as you accept one all other pre battles are cancelled").

A player fighting a battle (active, still in_battle) can't be put in another: a new battle with him in it is refused,
and so is his joining another (accepting, or coming back to a pre-battle or a fight he left), with `player_in_battle`.
Several pre-battles (and a post-game) stay allowed, with decision 1's warning. Accepting an invitation, or a start for
everyone in it, clears the players' other pre-battles at once: their own are cancelled, in the others they decline or
leave (services/one_battle.py).
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.models import Battle, BattleParticipant
from apps.battles.services.locks import lock_rank
from apps.notifications.models import Notification
from apps.warbands.models import Warband

from .battle_support import BattleTestCase
from .test_battle_lock_order import locks_per_transaction

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

    def invite_resolved(self, user: Any, battle_id: int) -> bool:
        invite = Notification.objects.get(user=user, notification_type=Notification.TYPE_BATTLE_INVITE, reference_id=str(battle_id))  # fmt: skip
        return invite.is_resolved

    def broadcast_to(self, battle_id: int) -> list[str]:
        return [call.args[1] for call in self.battle_events.call_args_list if call.args[0] == battle_id]


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


class AcceptClearsTests(OneBattleCase):
    def setUp(self) -> None:
        super().setUp()
        Warband.objects.create(campaign=self.campaign, user=self.campaign_owner, name="Kites")
        # the viewer had accepted the owner's battle (W), then was asked to the player's (X) and the manager's (Z),
        # and called his own (Y)
        self.joined = self.create_battle([self.viewer], creator=self.campaign_owner)
        self.ok(self.post_as(self.viewer, self.url(self.joined, "join")))
        self.accepting = self.create_battle([self.viewer])
        self.own = self.create_battle([self.admin], creator=self.viewer)
        self.invited = self.create_battle([self.viewer, self.admin], creator=self.manager)

    def test_the_list_says_what_accepting_each_invitation_clears(self):
        rows = self.ok(self.get_as(self.viewer, self.battles_url() + "?open=1")).data
        clears = {row["battle"]["id"]: row["viewer"]["accepting_clears"] for row in rows}

        others = lambda battle_id: [  # noqa: E731
            {"battle_id": other, "outcome": "cancel" if other == self.own else "withdraw"}
            for other in (self.invited, self.own, self.accepting, self.joined)
            if other != battle_id
        ]  # newest first, as the list comes
        self.assertEqual(
            clears,
            {self.invited: others(self.invited), self.own: [], self.accepting: others(self.accepting), self.joined: []},
        )

    def test_accepting_cancels_his_own_and_withdraws_him_from_the_others(self):
        versions = {battle.id: battle.state_version for battle in Battle.objects.all()}
        self.user_events.reset_mock()
        self.battle_events.reset_mock()

        data = self.ok(self.post_as(self.viewer, self.url(self.accepting, "join"))).data

        self.assertEqual((data["battle"]["status"], self.statuses(self.accepting)), ("prebattle", ["joined_prebattle"] * 2))  # fmt: skip
        own = self.battle(self.own)  # his own: cancelled for everyone, as a cancel tells them
        self.assertEqual((own.status, self.statuses(self.own)), ("canceled", ["canceled_prebattle"] * 2))
        self.assertEqual(
            own.events.last().payload_json,  # type: ignore[union-attr]
            {"canceled_by_user_id": self.viewer.id, "mode": "another_battle"},
        )
        self.assertIn((self.admin.id, "battle_canceled"), self.notified())
        self.assertTrue(self.invite_resolved(self.admin, self.own))
        invited = self.battle(self.invited)  # invited: he declines, and the other two go on
        self.assertEqual((invited.status, self.statuses(self.invited)), ("inviting", ["invited", "accepted", "declined"]))  # fmt: skip
        self.assertEqual(
            (invited.events.last().type, invited.events.last().payload_json),  # type: ignore[union-attr]
            ("participant_declined", {"participant_user_id": self.viewer.id, "reason": "another_battle"}),
        )
        self.assertIn((self.manager.id, "battle_invite_declined"), self.notified())
        self.assertTrue(self.invite_resolved(self.viewer, self.invited))
        joined = self.battle(self.joined)  # accepted: he leaves, and with one player left it is cancelled
        self.assertEqual((joined.status, self.statuses(self.joined)), ("canceled", ["canceled_prebattle"] * 2))
        self.assertEqual(joined.events.last().payload_json["mode"], "participants_left")  # type: ignore[union-attr]
        for battle_id in (self.own, self.invited, self.joined):  # each its own write, to its own channel
            with self.subTest(battle=battle_id):
                self.assertEqual(self.battle(battle_id).state_version, versions[battle_id] + 1)
                self.assertTrue(self.broadcast_to(battle_id))

    def test_accepting_locks_every_battle_it_changes_first(self):
        with CaptureQueriesContext(connection) as captured:
            self.ok(self.post_as(self.viewer, self.url(self.accepting, "join")))

        locks = locks_per_transaction(captured)[0]
        ranks = [lock_rank(table) for table in locks]
        self.assertEqual(locks[:2], ["battle", "battle"])  # them all in id order, then this one with the membership
        self.assertEqual(ranks, sorted(ranks), locks)


class StartClearsTests(OneBattleCase):
    def test_the_start_clears_every_players_other_pre_battles(self):
        battle_id = self.to_prebattle()  # the player's, with the viewer
        own = self.create_battle([self.admin])  # the player's own
        invited = self.create_battle([self.viewer, self.admin], creator=self.manager)  # the viewer's invitation
        for user in (self.player, self.viewer):
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))

        with CaptureQueriesContext(connection) as captured:
            self.ok(self.post_as(self.viewer, self.url(battle_id, "start")))

        self.assertEqual(self.battle(battle_id).status, "active")
        self.assertEqual((self.battle(own).status, self.statuses(own)), ("canceled", ["canceled_prebattle"] * 2))
        self.assertEqual(
            self.battle(own).events.last().payload_json,  # type: ignore[union-attr]
            {"canceled_by_user_id": self.player.id, "mode": "another_battle"},  # his, though the viewer started it
        )
        self.assertIn((self.admin.id, "battle_canceled"), self.notified())
        self.assertEqual(
            (self.battle(invited).status, self.statuses(invited)), ("inviting", ["invited", "accepted", "declined"])
        )
        self.assertIn((self.manager.id, "battle_invite_declined"), self.notified())
        locks = locks_per_transaction(captured)[0]
        ranks = [lock_rank(table) for table in locks]
        self.assertEqual((locks[:2], ranks), (["battle", "battle"], sorted(ranks)))
