"""Archiving and restoring a campaign (decision 5, CAMP-NEW-04).

The owner archives: what is open closes (as removing everyone would), and the campaign becomes read-only for
everyone (403 `campaign_archived`) until he restores it. Reads go on.
"""

from typing import Any

from django.utils import timezone

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.campaigns.errors import ARCHIVED_DETAIL
from apps.campaigns.models import Campaign
from apps.items.models import Item
from apps.notifications.models import Notification
from apps.trades.models import TradeRequest

from .test_campaign_removal import RemovalTestCase

ARCHIVED = {"detail": ARCHIVED_DETAIL, "code": "campaign_archived", "fields": {}}


class ArchiveTestCase(RemovalTestCase):
    def archive(self, user: Any) -> Any:
        with self.captureOnCommitCallbacks(execute=True):
            return self.post_as(user, self.url("archive/"))

    def restore(self, user: Any) -> Any:
        return self.post_as(user, self.url("restore/"))

    def archived_at(self) -> Any:
        return Campaign.objects.values_list("archived_at", flat=True).get(id=self.campaign.id)


class ArchiveRestoreTests(ArchiveTestCase):
    def test_only_the_owner_archives_and_restores(self):
        for actor, status in ((self.admin, 403), (self.player, 403), (self.outsider, 404)):
            with self.subTest(actor=actor.first_name):
                self.assertEqual(self.archive(actor).status_code, status)
        self.assertIsNone(self.archived_at())

        archived = self.archive(self.owner)

        self.assertEqual(archived.status_code, 200)
        body = archived.json()
        self.assertIsNotNone(body["archived_at"])
        self.assertEqual((body["capabilities"]["archive"], body["capabilities"]["restore"]), (False, True))
        self.assertEqual(Campaign.objects.get(id=self.campaign.id).archived_by_id, self.owner.id)
        self.assertEqual((self.archive(self.owner).status_code, self.archive(self.owner).json()), (403, ARCHIVED))
        for actor, status in ((self.admin, 403), (self.player, 403), (self.outsider, 404)):
            with self.subTest(actor=actor.first_name):
                self.assertEqual(self.restore(actor).status_code, status)

        restored = self.restore(self.owner)

        self.assertEqual((restored.status_code, restored.json()["archived_at"]), (200, None))
        self.assertEqual(restored.json()["capabilities"]["archive"], True)
        self.assertIsNone(self.archived_at())
        self.assertEqual(self.restore(self.owner).status_code, 403)  # nothing to restore
        self.assertEqual(self.post_as(self.player, self.url("messages/"), {"body": "Back"}).status_code, 201)

    def test_an_archived_campaign_is_read_only_for_everyone_and_still_readable(self):
        self.enable_features()
        self.archive(self.owner)
        writes: tuple[tuple[Any, str, str, dict[str, Any] | None], ...] = (
            (self.owner, "patch", "", {"max_heroes": 5}),
            (self.admin, "patch", "", {"in_progress": True}),
            (self.admin, "post", "join-code/", {}),
            (self.player, "post", "messages/", {"body": "Hi"}),
            (self.player, "post", "bulletin/", {"body": "WTB"}),
            (self.owner, "post", "encampments/", {"name": "Camp"}),
            (self.owner, "post", "locations/", {"name": "Ruin"}),
            (self.owner, "post", "rules/", {"title": "No running"}),
            (self.owner, "put", f"members/{self.player.id}/permissions/", {"permissions": []}),
            (self.owner, "patch", f"members/{self.player.id}/role/", {"role": "admin"}),
            (self.owner, "delete", f"members/{self.player.id}/", None),
            (self.owner, "post", "ownership/", {"user_id": self.admin.id}),
            (self.player, "post", "leave/", {}),
        )
        for user, method, suffix, body in writes:
            with self.subTest(write=f"{method} {suffix}"):
                self.client.force_authenticate(user=user)
                response = getattr(self.client, method)(self.url(suffix), body, format="json")
                self.assertEqual((response.status_code, response.json()), (403, ARCHIVED))
        self.assertTrue(self.is_member(self.player))
        joined = self.join(self.outsider)
        self.assertEqual((joined.status_code, joined.json()), (403, ARCHIVED))
        for user, suffix in (
            (self.player, ""),
            (self.player, "players/"),
            (self.player, "messages/"),
            (self.player, "bulletin/"),
            (self.player, "encampments/"),
            (self.player, "battle-history/"),
            (self.admin, "members/"),
            (self.admin, f"members/{self.player.id}/removal/"),
        ):
            with self.subTest(read=suffix):
                self.assertEqual(self.get_as(user, self.url(suffix)).status_code, 200)
        listed = {row["id"]: row["archived_at"] for row in self.get_as(self.player, "/api/campaigns/").json()}
        self.assertIsNotNone(listed[self.campaign.id])
        self.assertEqual(self.get_as(self.outsider, self.url()).status_code, 404)

    def test_capabilities_in_an_archived_campaign_are_restore_delete_and_reading_members(self):
        self.archive(self.owner)

        for actor, held in (
            (self.owner, {"restore", "delete", "view_members"}),
            (self.admin, {"view_members"}),
            (self.player, set()),
        ):
            with self.subTest(actor=actor.first_name):
                capabilities = self.get_as(actor, self.url()).json()["capabilities"]
                self.assertEqual({name for name, allowed in capabilities.items() if allowed}, held)


class ArchiveClosingTests(ArchiveTestCase):
    def test_open_battles_close_finished_ones_stay_and_trades_and_notifications_close(self):
        invited, finished = BattleParticipant.STATUS_INVITED, BattleParticipant.STATUS_FINISHED_BATTLE
        inviting = self.battle_in(Battle.STATUS_INVITING, {self.player: invited, self.rival: invited})
        postbattle = self.battle_in(
            Battle.STATUS_POSTBATTLE, {self.player: finished, self.rival: finished}, winner_warband_ids_json=[]
        )
        ended = self.battle_in(Battle.STATUS_ENDED, {self.player: BattleParticipant.STATUS_CONFIRMED_POSTBATTLE})
        sent = self.post_as(self.rival, self.url("trade-requests/"), {"target_user_id": self.player.id})
        self.notify(self.player, Notification.TYPE_BATTLE_INVITE, inviting.id)
        elsewhere = self.notify(self.outsider, Notification.TYPE_BATTLE_INVITE, 9, campaign=self.elsewhere)

        self.assertEqual(self.archive(self.owner).status_code, 200)

        self.assertEqual(self.status_of(inviting), Battle.STATUS_CANCELED)
        cancel = BattleEvent.objects.get(battle=inviting, type=BattleEvent.TYPE_BATTLE_CANCELED)
        self.assertEqual(cancel.payload_json, {"canceled_by_user_id": self.owner.id, "mode": "campaign_archived"})
        self.assertEqual(self.status_of(postbattle), Battle.STATUS_ENDED)
        self.assertEqual(set(self.statuses(postbattle).values()), {BattleParticipant.STATUS_CONFIRMED_POSTBATTLE})
        self.assertEqual(self.status_of(ended), Battle.STATUS_ENDED)
        self.assertEqual(TradeRequest.objects.get(id=sent.json()["id"]).status, TradeRequest.STATUS_CANCELLED)
        self.assertFalse(Notification.objects.filter(campaign_id=self.campaign.id, is_resolved=False).exists())
        self.assertFalse(Notification.objects.get(id=elsewhere.id).is_resolved)

    def test_an_active_battle_someone_applied_a_postbattle_in_ends_with_the_declared_winners(self):
        battle = self.battle_in(
            Battle.STATUS_ACTIVE,
            {
                self.player: BattleParticipant.STATUS_IN_BATTLE,
                self.rival: BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            },
        )
        BattleParticipant.objects.filter(battle=battle, user=self.rival).update(declared_result="won")

        self.archive(self.owner)

        battle.refresh_from_db()
        self.assertEqual(
            (battle.status, battle.winner_warband_ids_json), (Battle.STATUS_ENDED, [self.rival_warband.id])
        )
        mine = BattleParticipant.objects.get(battle=battle, user=self.player)
        self.assertEqual((mine.status, mine.skipped_postbattle), (BattleParticipant.STATUS_CONFIRMED_POSTBATTLE, True))


class ArchivedEverywhereTests(ArchiveTestCase):
    """Warbands, battles, trades and the campaign's custom catalogue are read-only too (decision 5)."""

    def test_writes_outside_the_campaign_routes_are_refused_and_reads_go_on(self):
        battle = self.battle_in(Battle.STATUS_INVITING, {self.player: "invited", self.rival: "invited"})
        item = Item.objects.create(campaign=self.campaign, name="Lucky Charm", type="Miscellaneous")
        Campaign.objects.filter(id=self.campaign.id).update(archived_at=timezone.now())  # battle left open on purpose
        campaign = self.campaign.id
        warband = f"/api/warbands/{self.warband.id}/"
        writes: tuple[tuple[Any, str, str, dict[str, Any] | None], ...] = (
            (self.player, "patch", warband, {"name": "Friars"}),
            (self.player, "delete", warband, None),
            (self.player, "post", f"{warband}purchases/", {"items": []}),
            (self.admin, "post", "/api/warbands/", {"name": "Late", "faction": "Mercenaries", "campaign_id": campaign}),
            (self.player, "post", self.url("battles/"), {}),
            (self.player, "post", self.url("battles/report-result/"), {}),
            (self.player, "post", self.url(f"battles/{battle.id}/decline/"), {}),
            (self.rival, "post", self.url("trade-requests/"), {"target_user_id": self.player.id}),
            (self.player, "post", "/api/skills/", {"campaign_id": campaign, "name": "Dodge", "type": "Speed"}),
            (self.owner, "patch", f"/api/items/{item.id}/", {"name": "Charm"}),
            (self.owner, "delete", f"/api/items/{item.id}/", None),
            (self.owner, "post", "/api/bestiary/", {"campaign_id": campaign, "name": "Rat Ogre", "type": "Monster"}),
            (self.owner, "post", "/api/races/", {"campaign_id": campaign, "name": "Ogre"}),
        )
        for user, method, url, body in writes:
            with self.subTest(write=f"{method} {url}"):
                self.client.force_authenticate(user=user)
                response = getattr(self.client, method)(url, body, format="json")
                self.assertEqual((response.status_code, response.json()), (403, ARCHIVED))
        self.assertEqual(self.status_of(battle), Battle.STATUS_INVITING)
        for user, url in (
            (self.player, warband),
            (self.player, f"{warband}sheet/"),
            (self.player, self.url("battles/")),
            (self.player, self.url("trade-requests/")),
            (self.player, f"/api/skills/?campaign_id={campaign}"),
        ):
            with self.subTest(read=url):
                self.assertEqual(self.get_as(user, url).status_code, 200)
        capabilities = self.get_as(self.player, f"{warband}sheet/").json()["capabilities"]
        self.assertEqual(set(capabilities.values()), {False})
