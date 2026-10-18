"""Battles past their deadline are settled without a scheduler (decision 2, BUG-10, BATL-TEST-12/13).

Reading the campaign's battle list or Settings > Active Battles settles a few overdue battles; a write to an overdue
battle settles it first; reading one battle only reports `overdue`. `manage.py expire_battles` does it by hand.
"""

from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.battles.models import Battle
from apps.battles.views import expiry
from apps.warbands.models import HeroItem, Warband

from .battle_support import BattleTestCase, catalogue_item, draft


class BattleExpiryTests(BattleTestCase):
    def overdue(self, battle_id: int) -> None:
        Battle.objects.filter(id=battle_id).update(closes_at=timezone.now() - timedelta(minutes=1))

    def read_list(self, user=None, query: str = "") -> list:
        return list(self.ok(self.get_as(user or self.player, f"{self.battles_url()}{query}")).data)

    def test_reading_the_list_declines_an_unanswered_invitation(self):
        battle_id = self.create_battle()
        self.overdue(battle_id)

        listed = self.read_list(query="?open=1")

        self.assertEqual(listed, [])  # cancelled: one player left
        self.assertEqual(self.battle(battle_id).status, "canceled")
        self.assertEqual(self.statuses(battle_id), ["canceled_prebattle", "declined"])
        self.assertEqual(self.event_types(battle_id)[-2:], ["participant_declined", "battle_canceled"])
        self.assertEqual(self.sent()[-2:], ["participant_declined", "battle_canceled"])
        self.assertIn((self.player.id, "battle_invite_declined"), self.notified())

    def test_with_two_left_who_accepted_prebattle_opens(self):
        Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows", faction="X")
        battle_id = self.create_battle([self.viewer, self.manager])
        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        self.overdue(battle_id)

        (entry,) = self.read_list(self.viewer)

        self.assertEqual((entry["battle"]["status"], entry["battle"]["closes_at"]), ("prebattle", None))
        self.assertEqual(self.statuses(battle_id), ["joined_prebattle", "declined", "joined_prebattle"])

    def test_reading_settings_closes_an_overdue_postbattle(self):
        potion = catalogue_item("Healing Draught", 10, single_use=True)
        rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        HeroItem.objects.create(hero=rat, item=potion, cost=10)
        battle_id = self.to_active({self.player: [], self.viewer: [f"hero:{rat.id}"]})
        self.ok(self.use_item(self.viewer, battle_id, {"unit_key": f"hero:{rat.id}", "item_id": potion.id}), 201)
        self.finish(battle_id, [self.warband])
        self.ok(self.finalize(self.player, battle_id, draft({})))
        self.overdue(battle_id)

        self.ok(self.get_as(self.campaign_owner, f"/api/campaigns/{self.campaign.id}/active-battles/"))

        self.assertEqual(self.battle(battle_id).status, "ended")
        viewer = self.participant(battle_id, self.viewer)
        self.assertEqual((viewer.status, viewer.skipped_postbattle), ("confirmed_postbattle", True))
        self.assertFalse(HeroItem.objects.filter(hero=rat, item=potion).exists())
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))
        ended = self.event_types(battle_id)[-1]
        self.assertEqual(ended, "battle_ended")
        last = self.battle(battle_id).events.order_by("id").last()
        assert last is not None
        self.assertEqual(last.payload_json, {"winner_warband_ids": [self.warband.id], "closed_by_user_id": None, "mode": "expired"})  # fmt: skip

    def test_a_write_settles_an_overdue_battle_first(self):
        battle_id = self.to_postbattle()
        self.overdue(battle_id)

        response = self.finalize(self.viewer, battle_id, draft({}))

        self.assertEqual((response.status_code, response.data["code"]), (400, "postbattle_skipped"))
        self.assertEqual(self.battle(battle_id).status, "ended")  # kept, though the write was refused

        invite = self.create_battle()
        self.overdue(invite)
        response = self.post_as(self.viewer, self.url(invite, "join"))
        self.assertEqual((response.status_code, response.data["detail"]), (400, "Battle is closed"))
        self.assertEqual(self.statuses(invite), ["canceled_prebattle", "declined"])

    def test_reading_one_battle_never_settles_it(self):
        battle_id = self.create_battle()
        self.overdue(battle_id)
        for action in ("state", "rosters"):
            self.ok(self.get_as(self.player, self.url(battle_id, action)))
        self.assertEqual(self.battle(battle_id).status, "inviting")

    def test_one_read_settles_a_few_and_costs_nothing_when_none_is_due(self):
        battles = [self.create_battle() for _ in range(2)]
        self.client.force_authenticate(user=self.player)
        with CaptureQueriesContext(connection) as captured:
            self.ok(self.client.get(f"{self.battles_url()}?open=1"))
        nothing_due = len(captured)  # read now: the next request clears the connection's log
        for battle_id in battles:
            self.overdue(battle_id)

        with mock.patch.object(expiry, "EXPIRY_BATCH", 1):
            self.read_list()
            self.assertEqual([self.battle(battle_id).status for battle_id in battles], ["inviting", "canceled"])
            self.read_list()
        self.assertEqual([self.battle(battle_id).status for battle_id in battles], ["canceled", "canceled"])
        self.assertEqual(nothing_due, 3)  # membership, battles, participants: no extra query


class ExpireBattlesCommandTests(BattleTestCase):
    def test_the_command_settles_every_overdue_battle(self):
        battle_id = self.create_battle()
        Battle.objects.filter(id=battle_id).update(closes_at=timezone.now() - timedelta(hours=1))

        out = StringIO()
        call_command("expire_battles", "--dry-run", stdout=out)
        self.assertEqual(self.battle(battle_id).status, "inviting")
        self.assertIn(f"battle {battle_id}: inviting, overdue", out.getvalue())

        call_command("expire_battles", stdout=out)
        self.assertEqual(self.battle(battle_id).status, "canceled")
        self.assertIn("1 battle(s) settled", out.getvalue())
