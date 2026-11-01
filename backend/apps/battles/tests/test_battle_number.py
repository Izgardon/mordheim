"""The campaign battle number (services/numbering.py). William: "campaign battle number will just be greatest games
played between the players": a battle's number is the most games any of its warbands has played, this one included.

A game is a normal battle once it has started (not cancelled) or a reported result once approved; a player who
declined or left before the start didn't play it. The number is set when the battle is made, for the invitation
and the pre-battle, and for good when it starts (a reported result: at its last approval), so later battles never
move it. Every battle snapshot, the battle history and the players' busy battle carry it. The migration
`0008_backfill_battle_number` numbers the battles played before the field existed in the same way.
"""

from datetime import timedelta
from importlib import import_module
from typing import Any

from django.apps import apps as django_apps
from django.utils import timezone

from apps.battles.models import Battle, BattleParticipant
from apps.warbands.models import Warband

from .battle_support import BattleTestCase

number_battles = import_module("apps.battles.migrations.0008_backfill_battle_number").number_battles


class BattleNumberTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.crows = Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows")

    def number(self, battle_id: int) -> int | None:
        return Battle.objects.get(id=battle_id).number

    def played(self, creator: Any, opponent: Any) -> int:
        """A battle `creator` fought against `opponent`, started, ended by the owner and its post-game closed."""
        battle_id = self.create_battle([opponent], creator=creator)
        self.ok(self.post_as(opponent, self.url(battle_id, "join")))
        for user in (creator, opponent):
            self.select(user, battle_id, [])
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))
        self.ok(self.post_as(creator, self.url(battle_id, "start")))
        self.finish(battle_id, [])
        self.ok(self.post_as(self.campaign_owner, self.url(battle_id, "close-postbattle")))
        return battle_id

    def report(self, opponent: Any) -> int:
        body = {"participant_user_ids": [opponent.id], "scenario": "Street Brawl", "battle_date": "2026-10-01"}
        response = self.post_as(self.player, f"{self.battles_url()}report-result/", body | {"winner_warband_ids": []})
        return int(self.ok(response, 201).data["battle"]["id"])

    def test_the_number_is_the_most_games_any_of_its_warbands_has_played_this_one_included(self):
        first = self.played(self.player, self.viewer)  # Monks 1, Rats 1
        second = self.played(self.player, self.viewer)  # Monks 2, Rats 2
        third = self.played(self.manager, self.player)  # the Crows' first, the Monks' third
        fourth = self.create_battle([self.viewer], creator=self.manager)  # the Crows' second, the Rats' third

        self.assertEqual([self.number(battle) for battle in (first, second, third, fourth)], [1, 2, 3, 3])
        state = self.ok(self.get_as(self.viewer, self.url(fourth, "state"))).data
        self.assertEqual(state["battle"]["number"], 3)  # the invitation and the pre-battle show it

    def test_the_number_is_set_again_for_good_when_the_battle_starts(self):
        owls = Warband.objects.create(campaign=self.campaign, user=self.admin, name="Owls")
        self.played(self.manager, self.viewer)
        self.played(self.manager, self.viewer)  # Crows 2, Rats 2; the Monks and the Owls none
        battle_id = self.to_prebattle([self.admin, self.manager])
        self.assertEqual(self.number(battle_id), 3)  # with the Crows

        self.ok(self.post_as(self.manager, self.url(battle_id, "cancel")))  # the Crows leave before the start
        for user in (self.player, self.admin):
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))
        started = self.ok(self.post_as(self.player, self.url(battle_id, "start"))).data

        self.assertEqual(started["battle"]["number"], 1)  # the Monks' and the Owls' first
        self.played(self.admin, self.viewer)
        self.played(self.admin, self.viewer)
        self.assertEqual((self.number(battle_id), owls.battle_participations.count()), (1, 3))

    def test_cancelled_battles_and_players_who_left_are_not_games(self):
        cancelled = self.to_active({self.player: [], self.viewer: []})
        self.ok(self.post_as(self.player, self.url(cancelled, "cancel-battle")))
        left = self.to_prebattle([self.viewer, self.manager])
        self.ok(self.post_as(self.manager, self.url(left, "cancel")))
        for user in (self.player, self.viewer):
            self.ok(self.post_as(user, self.url(left, "ready"), {"ready": True}))
        self.ok(self.post_as(self.player, self.url(left, "start")))  # the Monks' and the Rats' first

        crows = self.create_battle([self.manager], creator=self.viewer)  # the Rats' second; the Crows never played
        self.assertEqual((self.number(left), self.number(crows)), (1, 2))

    def test_a_reported_result_is_numbered_at_its_last_approval(self):
        reported = self.report(self.viewer)
        self.assertEqual(self.number(reported), 1)  # until it is approved
        played = self.played(self.player, self.viewer)  # game 1 for both: the result isn't approved yet
        self.ok(self.post_as(self.viewer, self.url(reported, "approve-result")))

        self.assertEqual((self.number(played), self.number(reported)), (1, 2))
        history = self.ok(self.get_as(self.player, f"/api/campaigns/{self.campaign.id}/battle-history/")).data
        self.assertEqual({entry["id"]: entry["number"] for entry in history}, {played: 1, reported: 2})
        declined = self.report(self.viewer)
        self.ok(self.post_as(self.viewer, self.url(declined, "decline-result")))
        self.assertEqual(self.number(self.create_battle()), 3)  # the declined result is no game

    def test_the_players_busy_battle_carries_its_number(self):
        self.played(self.player, self.viewer)
        battle_id = self.to_active({self.player: [], self.viewer: []})

        players = self.ok(self.get_as(self.viewer, f"/api/campaigns/{self.campaign.id}/players/")).data
        busy = {
            entry["name"]: (entry["battle_busy_battle_id"], entry["battle_busy_battle_number"]) for entry in players
        }
        self.assertEqual((busy["playe"], busy["manag"]), ((battle_id, 2), (None, None)))


class BackfillTests(BattleTestCase):
    """The data migration, on battles made without a number."""

    def setUp(self) -> None:
        super().setUp()
        self.crows = Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows")
        self.start = timezone.now() - timedelta(days=30)

    def old_battle(self, day: int, warbands: list[Warband], **fields: Any) -> Battle:
        fields = {"status": Battle.STATUS_ENDED, "started_at": self.start + timedelta(days=day)} | fields
        battle = Battle.objects.create(campaign=self.campaign, created_by_user=self.player, scenario="Old", **fields)
        for warband in warbands:
            status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
            BattleParticipant.objects.create(battle=battle, user=warband.user, warband=warband, status=status)
        return battle

    def numbers(self, *battles: Battle) -> list[int | None]:
        return [Battle.objects.get(id=battle.id).number for battle in battles]

    def test_battles_are_numbered_in_the_order_they_became_games(self):
        both = [self.warband, self.rival]
        second = self.old_battle(2, both)
        first = self.old_battle(1, both)  # made later, started earlier
        crows = self.old_battle(3, [self.crows, self.rival])  # the Crows' first, the Rats' third
        cancelled = self.old_battle(4, both, status=Battle.STATUS_CANCELED)
        reported = self.old_battle(
            0, both, flow_type=Battle.FLOW_TYPE_REPORTED_RESULT, started_at=None, ended_at=self.start
        )
        BattleParticipant.objects.filter(battle=reported).update(confirmed_at=self.start + timedelta(days=5))
        active = self.old_battle(6, both, status=Battle.STATUS_ACTIVE)
        inviting = self.old_battle(7, [self.crows, self.warband], status=Battle.STATUS_INVITING, started_at=None)
        declined = self.old_battle(8, [self.warband])  # the Rats declined it
        BattleParticipant.objects.create(
            battle=declined, user=self.viewer, warband=self.rival, status=BattleParticipant.STATUS_DECLINED
        )
        battles = (first, second, crows, reported, active, declined, inviting)

        number_battles(django_apps, None)

        # the reported result counts when it was approved (day 5); the invitation as a battle made now would be
        expected = [1, 2, 3, 4, 5, 5, 6]
        self.assertEqual(self.numbers(*battles), expected)
        self.assertEqual(self.numbers(cancelled), [None])
        number_battles(django_apps, None)
        self.assertEqual(self.numbers(*battles), expected)
