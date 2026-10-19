"""Close postbattle (decision 3, BUG-09, BATL-TWEAK-02): the creator, or anyone with manage_battles, skips everyone
who hasn't finished and ends the battle, which records the wins and losses once.
"""

from decimal import Decimal

from apps.campaigns.models import CampaignMembership, CampaignMembershipPermission
from apps.campaigns.views import _ensure_permissions
from apps.warbands.models import Hero, HeroItem

from .battle_support import BattleTestCase, catalogue_item, draft, unit_result


class ClosePostbattleTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.potion = catalogue_item("Healing Draught", 10, single_use=True)
        HeroItem.objects.create(hero=self.rat, item=self.potion, cost=10)
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"

    def battle_in_postbattle(self) -> int:
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        self.ok(self.use_item(self.viewer, battle_id, {"unit_key": self.r, "item_id": self.potion.id}), 201)
        self.finish(battle_id, [self.warband])
        self.ok(self.finalize(self.player, battle_id, draft({self.a: unit_result(self.a, xp=2)})))
        return battle_id

    def test_the_creator_closes_postbattle_for_whoever_hasnt_finished(self):
        battle_id = self.battle_in_postbattle()
        draft_body = {"postbattle_json": draft({self.r: unit_result(self.r, xp=5)})}
        self.ok(self.post_as(self.viewer, self.url(battle_id, "postbattle"), draft_body))  # a draft, never applied

        data = self.ok(self.post_as(self.player, self.url(battle_id, "close-postbattle"))).data

        self.assertEqual(data["battle"]["status"], "ended")
        self.assertEqual(self.statuses(battle_id), ["confirmed_postbattle", "confirmed_postbattle"])
        skipped = self.participant(battle_id, self.viewer)
        self.assertEqual((skipped.skipped_postbattle, self.participant(battle_id, self.player).skipped_postbattle), (True, False))  # fmt: skip
        self.assertEqual(
            [(event["type"], event["payload_json"]) for event in data["events"]],
            [
                ("participant_confirmed_postbattle", {"participant_user_id": self.viewer.id, "skipped_postbattle": True, "closed_by_user_id": self.player.id}),
                ("battle_ended", {"winner_warband_ids": [self.warband.id], "closed_by_user_id": self.player.id, "mode": "closed"}),
            ],
        )  # fmt: skip
        self.rat.refresh_from_db()
        self.assertEqual(self.rat.xp, Decimal(0))  # the skipped draft isn't applied
        self.assertFalse(HeroItem.objects.filter(hero=self.rat, item=self.potion).exists())  # what he used is gone
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))
        self.assertEqual(self.ok(self.post_as(self.player, self.url(battle_id, "close-postbattle"))).data["events"], [])
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))  # once

    def test_close_needs_the_creator_or_manage_battles(self):
        battle_id = self.battle_in_postbattle()
        url = self.url(battle_id, "close-postbattle")
        response = self.post_as(self.viewer, url)
        self.assertEqual((response.status_code, response.data["code"]), (403, "not_allowed"))
        self.assertEqual(self.post_as(self.outsider, url).status_code, 404)

        membership = CampaignMembership.objects.get(campaign=self.campaign, user=self.manager)
        _ensure_permissions.cache_clear()
        self.addCleanup(_ensure_permissions.cache_clear)
        CampaignMembershipPermission.objects.create(membership=membership, permission=_ensure_permissions()["manage_battles"])  # fmt: skip
        self.ok(self.post_as(self.manager, url))  # not even in the battle
        self.assertEqual(self.battle(battle_id).status, "ended")

    def test_close_needs_a_battle_in_postbattle(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        response = self.post_as(self.campaign_owner, self.url(battle_id, "close-postbattle"))
        self.assertEqual((response.status_code, response.data), (400, {"detail": "Battle is not in postbattle"}))


class SkipPostbattleTests(BattleTestCase):
    def test_skip_postbattle_and_its_old_path_confirm_skip_alike(self):
        # PR B: confirm/ became skip-postbattle/; the old path stays an alias for older clients
        for action in ("skip-postbattle", "confirm"):
            with self.subTest(path=action):
                battle_id = self.to_postbattle()
                data = self.ok(self.post_as(self.viewer, self.url(battle_id, action))).data
                self.assertEqual(
                    data["events"][0]["payload_json"],
                    {"participant_user_id": self.viewer.id, "skipped_postbattle": True},
                )
                self.assertTrue(self.participant(battle_id, self.viewer).skipped_postbattle)
                self.assertEqual(self.post_as(self.viewer, self.url(battle_id, action)).status_code, 200)  # a repeat
