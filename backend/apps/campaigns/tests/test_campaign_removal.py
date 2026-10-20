"""Removing a member: what closes, what stays, who hears (decision 1, BUG-12, BUG-50; CAMP-TEST-11, CAMP-TWEAK-01).

Removal used to delete only the membership. Now it cancels his battles up to active (unless someone has applied a
postbattle), skips him in postbattle, closes his pending and accepted trades and resolves his notifications for
the campaign, in one transaction; his warband, ledger and encampments stay.
"""

from typing import Any
from unittest import mock

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.notifications.models import Notification
from apps.trades.models import TradeRequest
from apps.warbands.models import Warband

from .campaign_support import CampaignTestCase, make_user

LEFT = BattleParticipant.STATUS_CANCELED_PREBATTLE


class RemovalTestCase(CampaignTestCase):
    """The shared campaign plus `third` ("Tia", warband "Crows")."""

    third: Any
    third_warband: Warband

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.third = make_user("third@example.com", "Tia")
        client = APIClient()
        client.force_authenticate(user=cls.third)
        joined = client.post("/api/campaigns/join/", {"join_code": cls.campaign.join_code}, format="json")
        assert joined.status_code == 201, joined.data
        cls.third_warband = cls._create_warband(client, cls.third, "Crows")

    def remove(self, actor: Any, target: Any) -> Any:
        with self.captureOnCommitCallbacks(execute=True):
            return self.delete_as(actor, self.url(f"members/{target.id}/"))

    def battle_in(self, status: str, statuses: dict[Any, str], **fields: Any) -> Battle:
        """A battle of the given status created by `player`, with these players at these statuses."""
        battle = Battle.objects.create(
            campaign=self.campaign, created_by_user=self.player, scenario="Ford", status=status, **fields
        )
        for user, participant_status in statuses.items():
            warband = Warband.objects.get(campaign=self.campaign, user=user)
            BattleParticipant.objects.create(battle=battle, user=user, warband=warband, status=participant_status)
        return battle

    def statuses(self, battle: Battle) -> dict[str, str]:
        rows = BattleParticipant.objects.filter(battle=battle).select_related("user")
        return {row.user.first_name: row.status for row in rows}

    def status_of(self, battle: Battle) -> str:
        return Battle.objects.values_list("status", flat=True).get(id=battle.id)


class RemovalBattleTests(RemovalTestCase):
    def test_battles_before_postbattle_are_cancelled_for_everyone(self):
        invited, accepted = BattleParticipant.STATUS_INVITED, BattleParticipant.STATUS_ACCEPTED
        fighting = BattleParticipant.STATUS_IN_BATTLE
        inviting = self.battle_in(Battle.STATUS_INVITING, {self.player: accepted, self.rival: invited})
        prebattle = self.battle_in(
            Battle.STATUS_PREBATTLE, {self.player: BattleParticipant.STATUS_READY, self.third: accepted}
        )
        active = self.battle_in(
            Battle.STATUS_ACTIVE, {self.player: fighting, self.rival: fighting, self.third: fighting}
        )
        self.notify(self.rival, Notification.TYPE_BATTLE_INVITE, inviting.id)

        self.assertEqual(self.remove(self.owner, self.player).status_code, 204)

        for battle in (inviting, prebattle, active):
            with self.subTest(status=battle.status):
                self.assertEqual(self.status_of(battle), Battle.STATUS_CANCELED)
                self.assertEqual(set(self.statuses(battle).values()), {LEFT})
                event = BattleEvent.objects.filter(battle=battle, type=BattleEvent.TYPE_BATTLE_CANCELED).get()
                self.assertEqual(event.payload_json, {"canceled_by_user_id": self.owner.id, "mode": "member_removed"})
        self.assertTrue(Notification.objects.get(user=self.rival, reference_id=str(inviting.id)).is_resolved)

    def test_a_reported_result_waiting_for_him_is_declined_for_everyone(self):
        reported = self.battle_in(
            Battle.STATUS_REPORTED_RESULT_PENDING,
            {
                self.rival: BattleParticipant.STATUS_REPORTED_RESULT_APPROVED,
                self.player: BattleParticipant.STATUS_REPORTED_RESULT_PENDING,
            },
            flow_type=Battle.FLOW_TYPE_REPORTED_RESULT,
        )

        self.remove(self.owner, self.player)

        self.assertEqual(self.status_of(reported), Battle.STATUS_CANCELED)
        self.assertEqual(set(self.statuses(reported).values()), {BattleParticipant.STATUS_REPORTED_RESULT_DECLINED})

    def test_in_postbattle_only_he_is_skipped_and_the_battle_ends_when_the_others_finish(self):
        finished = BattleParticipant.STATUS_FINISHED_BATTLE
        battle = self.battle_in(
            Battle.STATUS_POSTBATTLE,
            {self.player: finished, self.rival: finished},
            winner_warband_ids_json=[self.warband.id],
        )

        self.remove(self.owner, self.player)

        self.assertEqual(self.status_of(battle), Battle.STATUS_POSTBATTLE)
        mine = BattleParticipant.objects.get(battle=battle, user=self.player)
        self.assertEqual((mine.status, mine.skipped_postbattle), (BattleParticipant.STATUS_CONFIRMED_POSTBATTLE, True))
        self.assertEqual(self.statuses(battle)["Rex"], finished)

        self.post_as(self.rival, self.url(f"battles/{battle.id}/skip-postbattle/"))

        self.assertEqual(self.status_of(battle), Battle.STATUS_ENDED)
        self.assertEqual(Warband.objects.get(id=self.warband.id).wins, 1)  # a skipped player's result still counts

    def test_an_active_battle_someone_applied_a_postbattle_in_skips_him_after_finishing_his_fight(self):
        # decision 4: a player may apply his postbattle before the fight ends; the battle can't be cancelled then
        applied = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
        battle = self.battle_in(
            Battle.STATUS_ACTIVE, {self.player: BattleParticipant.STATUS_IN_BATTLE, self.rival: applied}
        )

        self.remove(self.owner, self.player)

        battle.refresh_from_db()
        self.assertEqual(
            (battle.status, battle.results_pending, battle.results_confirmer_id), ("postbattle", True, self.owner.id)
        )
        mine = BattleParticipant.objects.get(battle=battle, user=self.player)
        self.assertEqual((mine.status, mine.skipped_postbattle, mine.declared_result), (applied, True, "undecided"))

    def test_battles_he_has_left_or_finished_are_untouched(self):
        ended = self.battle_in(Battle.STATUS_ENDED, {self.player: BattleParticipant.STATUS_CONFIRMED_POSTBATTLE})
        declined = self.battle_in(
            Battle.STATUS_INVITING,
            {
                self.rival: BattleParticipant.STATUS_ACCEPTED,
                self.player: BattleParticipant.STATUS_DECLINED,
                self.third: "invited",
            },
        )
        done = self.battle_in(
            Battle.STATUS_POSTBATTLE,
            {
                self.player: BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
                self.rival: BattleParticipant.STATUS_FINISHED_BATTLE,
            },
        )

        self.remove(self.owner, self.player)

        self.assertEqual(
            [self.status_of(battle) for battle in (ended, declined, done)], ["ended", "inviting", "postbattle"]
        )
        self.assertFalse(BattleEvent.objects.filter(battle__in=(ended, declined, done)).exists())

    def test_the_players_hear_the_battle_change_and_he_hears_he_was_removed_after_commit(self):
        battle = self.battle_in(Battle.STATUS_INVITING, {self.player: "accepted", self.rival: "invited"})
        with (
            mock.patch("apps.battles.services.broadcast.send_battle_event") as battle_events,
            mock.patch("apps.campaigns.services.removal.send_user_notification") as user_events,
        ):
            self.remove(self.admin, self.player)

        channel_events = [(call.args[0], call.args[1]) for call in battle_events.call_args_list]
        self.assertIn((battle.id, BattleEvent.TYPE_BATTLE_CANCELED), channel_events)
        user_events.assert_called_once_with(
            self.player.id,
            "membership_removed",
            {"campaign_id": self.campaign.id, "campaign_name": "Shards", "removed_by": "Ada"},
        )


class RemovalTradeAndNotificationTests(RemovalTestCase):
    def send_trade(self, sender: Any, recipient: Any) -> TradeRequest:
        response = self.post_as(sender, self.url("trade-requests/"), {"target_user_id": recipient.id})
        self.assertEqual(response.status_code, 201, response.data)
        return TradeRequest.objects.get(id=response.json()["id"])

    def test_his_pending_and_accepted_trades_close_and_others_stay(self):
        sent = self.send_trade(self.player, self.rival)
        accepted = self.send_trade(self.third, self.player)
        self.post_as(self.player, self.url(f"trade-requests/{accepted.id}/accept/"))
        others = self.send_trade(self.rival, self.third)

        self.remove(self.owner, self.player)

        statuses = {trade.id: TradeRequest.objects.get(id=trade.id).status for trade in (sent, accepted, others)}
        self.assertEqual(
            statuses,
            {sent.id: "cancelled", accepted.id: "declined", others.id: "pending"},  # as if he had closed them
        )
        unresolved = Notification.objects.filter(notification_type=Notification.TYPE_TRADE_REQUEST, is_resolved=False)
        self.assertEqual(list(unresolved.values_list("reference_id", flat=True)), [str(others.id)])

    def test_his_notifications_for_the_campaign_are_resolved_and_the_rest_kept(self):
        here = self.notify(self.player, Notification.TYPE_BATTLE_NUDGE, 7)
        elsewhere = self.notify(self.player, Notification.TYPE_BATTLE_INVITE, 8, campaign=self.elsewhere)
        theirs = self.notify(self.rival, Notification.TYPE_BATTLE_NUDGE, 7)

        self.remove(self.owner, self.player)

        resolved = {
            row.id: row.is_resolved for row in Notification.objects.filter(id__in=(here.id, elsewhere.id, theirs.id))
        }
        self.assertEqual(resolved, {here.id: True, elsewhere.id: False, theirs.id: False})


class RemovalPreviewTests(RemovalTestCase):
    def preview(self, actor: Any, target: Any) -> Any:
        return self.get_as(actor, self.url(f"members/{target.id}/removal/"))

    def test_the_preview_lists_what_removal_will_close_and_changes_nothing(self):
        cancelled = self.battle_in(Battle.STATUS_INVITING, {self.player: "accepted", self.rival: "invited"})
        skipped = self.battle_in(
            Battle.STATUS_POSTBATTLE, {self.player: "finished_battle", self.third: "finished_battle"}
        )
        sent = self.post_as(self.rival, self.url("trade-requests/"), {"target_user_id": self.player.id}).json()

        with CaptureQueriesContext(connection) as captured:
            response = self.preview(self.admin, self.player)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "member": {"id": self.player.id, "name": "Pia", "role": "player"},
                "warband": {"id": self.warband.id, "name": "Monks"},
                "battles": [
                    {"id": cancelled.id, "scenario": "Ford", "status": "inviting", "outcome": "cancelled"},
                    {"id": skipped.id, "scenario": "Ford", "status": "postbattle", "outcome": "skipped"},
                ],
                "trades": [{"id": sent["id"], "status": "pending", "with": {"id": self.rival.id, "name": "Rex"}}],
                "notifications": 1,
            },
        )
        self.assertEqual(len(captured), 7)  # membership, target, warband, battles, their players, trades, count
        self.assertEqual(self.status_of(cancelled), "inviting")
        self.assertTrue(self.is_member(self.player))

    def test_the_preview_follows_the_removal_rules(self):
        self.assertEqual(self.preview(self.rival, self.player).status_code, 403)
        self.assertEqual(self.preview(self.outsider, self.player).status_code, 404)
        self.assertEqual(self.preview(self.owner, self.outsider).status_code, 404)
        self.assertEqual(self.preview(self.owner, self.owner).json()["code"], "owner_not_removable")
        self.assertEqual(self.preview(self.owner, self.admin).json()["warband"], None)
        self.assertEqual(self.preview(self.admin, self.owner).status_code, 400)
