"""Members: removal, Kick, roles and deleting the campaign (CAMP-TEST-05, -11, -12, -28).

Removal closes the player's battles and trades and keeps his warband (decision 1, BUG-50): rejoining reattaches it.
Kick was the frontend calling the warband DELETE, which only the warband's owner may call (BUG-12); it merges into
removal. What removal closes, battle by battle, is in `test_campaign_removal.py`.
"""

from apps.battles.models import Battle, BattleParticipant
from apps.campaigns.models import Campaign, CampaignEncampment
from apps.notifications.models import Notification
from apps.realtime.channel_auth import authorize_private_channel
from apps.trades.models import TradeRequest
from apps.warbands.models import Warband

from .campaign_support import CampaignTestCase


class MemberRemovalTests(CampaignTestCase):
    def remove(self, actor, target):
        return self.delete_as(actor, self.url(f"members/{target.id}/"))

    def test_the_owner_removes_anyone_but_himself_and_admins_remove_players(self):
        # CAMP-TEST-12 as decision 1 has it: admins used to remove nobody, and the owner only players
        self.assertEqual(self.remove(self.rival, self.player).status_code, 403)
        self.assertEqual(self.remove(self.outsider, self.player).status_code, 404)
        self.assertEqual(self.remove(self.owner, self.outsider).status_code, 404)
        owner_body = {"detail": "The campaign owner can't be removed.", "code": "owner_not_removable"}
        for actor in (self.owner, self.admin):
            with self.subTest(actor=actor.first_name):
                refused = self.remove(actor, self.owner)
                self.assertEqual((refused.status_code, refused.data), (400, owner_body))
        self.patch_as(self.owner, self.url(f"members/{self.rival.id}/role/"), {"role": "admin"})
        admin_on_admin = self.remove(self.admin, self.rival)
        self.assertEqual(
            (admin_on_admin.status_code, admin_on_admin.data),
            (403, {"detail": "Admins can only remove players.", "code": "not_allowed"}),
        )

        self.assertEqual(self.remove(self.admin, self.player).status_code, 204)
        self.assertEqual(self.remove(self.owner, self.rival).status_code, 204)  # an admin, without demoting him first

        self.assertEqual(
            [self.is_member(user) for user in (self.owner, self.admin, self.player, self.rival)],
            [True, True, False, False],
        )
        self.assertEqual(self.get_as(self.player, self.url()).status_code, 404)

    def test_removal_closes_his_battles_and_trades_and_keeps_his_warband_and_encampments(self):
        # BUG-50, CAMP-TEST-11 (decision 1): only the membership used to go; the rest stayed open and unanswerable
        self.enable_features()
        battle = self.open_battle(Battle.STATUS_INVITING)
        self.notify(self.player, Notification.TYPE_BATTLE_INVITE, battle.id)
        sent = self.post_as(self.rival, self.url("trade-requests/"), {"target_user_id": self.player.id})
        trade = TradeRequest.objects.get(id=sent.json()["id"])
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside", owner=self.player)

        self.assertEqual(self.remove(self.owner, self.player).status_code, 204)

        self.assertEqual(Battle.objects.get(id=battle.id).status, Battle.STATUS_CANCELED)
        statuses = set(BattleParticipant.objects.filter(battle=battle).values_list("status", flat=True))
        self.assertEqual(statuses, {BattleParticipant.STATUS_CANCELED_PREBATTLE})
        self.assertEqual(TradeRequest.objects.get(id=trade.id).status, TradeRequest.STATUS_DECLINED)
        self.assertEqual(self.listed_notifications(self.player), [])
        listed = self.get_as(self.owner, self.url("encampments/")).data
        owners = [(row["id"], row["owner_id"], row["owner_name"]) for row in listed]
        self.assertEqual(owners, [(camp.id, self.player.id, "Pia")])
        self.assertTrue(Warband.objects.filter(id=self.warband.id).exists())

    def test_a_removed_player_loses_the_campaign_and_battle_channels(self):
        battle = self.open_battle(Battle.STATUS_INVITING)
        self.assertTrue(authorize_private_channel(self.player, f"private-campaign-{self.campaign.id}-chat"))
        self.assertTrue(authorize_private_channel(self.player, f"private-battle-{battle.id}"))

        self.remove(self.owner, self.player)

        self.assertFalse(authorize_private_channel(self.player, f"private-campaign-{self.campaign.id}-chat"))
        self.assertFalse(authorize_private_channel(self.player, f"private-campaign-{self.campaign.id}-pings"))
        # SEC-08's battle half (pass 3): the battle channel also needs the campaign membership
        self.assertFalse(authorize_private_channel(self.player, f"private-battle-{battle.id}"))

    def test_rejoining_with_the_same_code_reattaches_the_warband_and_drops_the_grants(self):
        # Decision 1: the warband is kept on purpose and comes back on rejoin; a new join code keeps him out
        self.grant(self.player, "delete_catalogue")
        self.remove(self.owner, self.player)
        self.assertEqual(self.get_as(self.owner, self.url("players/")).status_code, 200)
        self.assertNotIn(self.player.id, [row["id"] for row in self.get_as(self.owner, self.url("players/")).data])

        rejoined = self.join(self.player)

        self.assertEqual(rejoined.status_code, 201)
        players = {row["id"]: row["warband"] for row in self.get_as(self.owner, self.url("players/")).data}
        self.assertEqual(players[self.player.id]["id"], self.warband.id)
        self.assertEqual(self.codes(self.player), ["edit_catalogue"])
        self.assertEqual(self.membership(self.player).role.slug, "player")


class KickTests(CampaignTestCase):
    """Kick in Settings sends DELETE /warbands/:id/ for the player's warband (CAMP-TEST-05)."""

    def test_kick_is_refused_to_the_owner_and_the_admin(self):
        # BUG-12, CAMP-TEST-05 (decision 1): Kick is gone, merged into removal; the warband DELETE stays its owner's
        self.grant(self.rival, "manage_warbands")
        for user in (self.owner, self.admin, self.rival):
            with self.subTest(user=user.first_name):
                response = self.delete_as(user, f"/api/warbands/{self.warband.id}/")
                self.assertEqual((response.status_code, response.data), (403, {"detail": "Forbidden"}))
        self.assertTrue(Warband.objects.filter(id=self.warband.id).exists())
        self.assertTrue(self.is_member(self.player))

    def test_a_player_deleting_their_own_warband_takes_its_battle_history_with_it(self):
        # Characterises current behaviour (BUG-12): BattleParticipant.warband cascades, so the battle loses its row
        battle = self.open_battle(Battle.STATUS_ENDED)
        Battle.objects.filter(id=battle.id).update(winner_warband_ids_json=[self.warband.id])

        response = self.delete_as(self.player, f"/api/warbands/{self.warband.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Warband.objects.filter(id=self.warband.id).exists())
        history = self.get_as(self.owner, self.url("battle-history/")).data
        self.assertEqual([[row["warband_name"] for row in entry["participants"]] for entry in history], [["Rats"]])
        self.assertEqual(history[0]["winners"], [])
        self.assertTrue(self.is_member(self.player))


class MemberListTests(CampaignTestCase):
    def test_owners_and_admins_list_members_with_emails_grants_and_warbands(self):
        self.grant(self.player, "delete_catalogue")
        for user, expected in ((self.player, 403), (self.outsider, 404)):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.get_as(user, self.url("members/")).status_code, expected)

        members = self.get_as(self.admin, self.url("members/")).json()

        # ordered by the role's slug, so the admin comes before the owner
        rows = [(row["name"], row["email"], row["role"], sorted(row["permissions"])) for row in members]
        self.assertEqual(
            rows,
            [
                ("Ada", "admin@example.com", "admin", ["edit_catalogue"]),
                ("Olga", "owner@example.com", "owner", []),
                ("Pia", "player@example.com", "player", ["delete_catalogue", "edit_catalogue"]),
                ("Rex", "rival@example.com", "player", ["edit_catalogue"]),
            ],
        )
        warbands = [(row["warband_id"], row["warband_name"]) for row in members]
        self.assertEqual(
            warbands, [(None, None), (None, None), (self.warband.id, "Monks"), (self.rival_warband.id, "Rats")]
        )

    def test_every_member_lists_the_players_by_first_name(self):
        players = self.get_as(self.rival, self.url("players/")).json()

        self.assertEqual(
            [(row["id"], row["name"]) for row in players][:2], [(self.admin.id, "Ada"), (self.owner.id, "Olga")]
        )
        pia = players[2]
        self.assertEqual((pia["warband"]["id"], pia["warband"]["name"]), (self.warband.id, "Monks"))
        self.assertEqual((pia["battle_busy"], pia["battle_busy_status"]), (False, None))
        self.assertIsNone(players[0]["warband"])
        self.assertEqual(self.get_as(self.outsider, self.url("players/")).status_code, 404)

    def test_name_pickers_read_ids_and_names_only(self):
        # PERF-41: Encampments and the trade invite fetched the whole roster (7 queries) for names
        basic = self.get_as(self.rival, self.url("players/?fields=basic")).json()

        self.assertEqual(basic[:3], [{"id": self.admin.id, "name": "Ada"}, {"id": self.owner.id, "name": "Olga"}, {"id": self.player.id, "name": "Pia"}])  # fmt: skip
        self.assertEqual(self.get_as(self.outsider, self.url("players/?fields=basic")).status_code, 404)


class MemberRoleTests(CampaignTestCase):
    def set_role(self, actor, target, role):
        return self.patch_as(actor, self.url(f"members/{target.id}/role/"), {"role": role})

    def test_the_owner_promotes_and_demotes(self):
        promoted = self.set_role(self.owner, self.player, "admin")

        self.assertEqual((promoted.status_code, promoted.data), (200, {"id": self.player.id, "role": "admin"}))
        self.assertEqual(self.membership(self.player).role.slug, "admin")
        self.assertEqual(self.get_as(self.player, self.url("members/")).status_code, 200)

        demoted = self.set_role(self.owner, self.player, "player")

        self.assertEqual(demoted.data, {"id": self.player.id, "role": "player"})
        self.assertEqual(self.get_as(self.player, self.url("members/")).status_code, 403)

    def test_only_the_owner_changes_roles_and_the_owner_stays_owner(self):
        # CAMP-TEST-12; a role change never makes an owner: ownership is handed over through ownership/ (decision 4)
        self.assertEqual(self.set_role(self.admin, self.player, "admin").status_code, 403)
        self.assertEqual(self.set_role(self.player, self.player, "admin").status_code, 403)
        self.assertEqual(self.set_role(self.outsider, self.player, "admin").status_code, 404)
        self.assertEqual(self.set_role(self.owner, self.outsider, "admin").status_code, 404)

        refused = self.set_role(self.owner, self.owner, "player")
        self.assertEqual((refused.status_code, refused.data), (400, {"detail": "Owner role cannot be changed."}))
        handover = self.set_role(self.owner, self.admin, "owner")
        self.assertEqual(handover.status_code, 400)
        self.assertIn("role", handover.data)
        self.assertEqual(self.membership(self.admin).role.slug, "admin")
        self.assertEqual(self.membership(self.owner).role.slug, "owner")

    def test_grants_survive_a_promotion_and_count_again_after_a_demotion(self):
        self.grant(self.player, "delete_catalogue")
        self.set_role(self.owner, self.player, "admin")
        self.assertEqual(
            self.codes(self.player), ["delete_catalogue", "edit_catalogue"]
        )  # stored, but admins hold every code

        self.set_role(self.owner, self.player, "player")

        self.assertEqual(
            self.get_as(self.player, self.url()).data["permissions"], ["delete_catalogue", "edit_catalogue"]
        )


class CampaignDeleteTests(CampaignTestCase):
    def delete_for_good(self, user):
        self.client.force_authenticate(user=user)
        return self.client.delete(self.url(), {"name": "Shards"}, format="json")

    def test_only_the_owner_deletes_and_only_an_archived_campaign(self):
        # decision 5, CAMP-TWEAK-04: archive first, then delete for good with the campaign's name
        self.assertEqual(self.delete_for_good(self.owner).status_code, 403)
        self.post_as(self.owner, self.url("archive/"))
        for user, expected in ((self.admin, 403), (self.player, 403), (self.outsider, 404)):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.delete_for_good(user).status_code, expected)
        self.assertTrue(Campaign.objects.filter(id=self.campaign.id).exists())

        self.assertEqual(self.delete_for_good(self.owner).status_code, 204)

        self.assertFalse(Campaign.objects.filter(id=self.campaign.id).exists())
        self.assertFalse(Warband.objects.filter(id__in=(self.warband.id, self.rival_warband.id)).exists())

    def test_deleting_the_campaign_removes_its_notifications(self):
        # BUG-50, CAMP-TEST-28 (CAMP-TWEAK-04): campaign_id is a plain integer, so they used to stay listed
        battle = self.open_battle(Battle.STATUS_INVITING)
        self.notify(self.rival, Notification.TYPE_BATTLE_INVITE, battle.id)
        trade = self.post_as(self.player, self.url("trade-requests/"), {"target_user_id": self.rival.id}).json()
        kept = self.notify(self.outsider, Notification.TYPE_BATTLE_INVITE, 7, campaign=self.elsewhere)
        self.post_as(self.owner, self.url("archive/"))

        self.assertEqual(self.delete_for_good(self.owner).status_code, 204)

        self.assertFalse(Notification.objects.filter(campaign_id=self.campaign.id).exists())
        self.assertFalse(TradeRequest.objects.filter(id=trade["id"]).exists())
        self.assertEqual(self.listed_notifications(self.rival), [])
        self.assertTrue(Notification.objects.filter(id=kept.id).exists())

    def test_the_name_must_match(self):
        self.post_as(self.owner, self.url("archive/"))
        detail = "Type the campaign's name to delete it for good."
        for body in ({"name": "shards"}, {"name": ""}, {}, {"name": 7}):
            with self.subTest(body=body):
                self.client.force_authenticate(user=self.owner)
                response = self.client.delete(self.url(), body, format="json")
                self.assertEqual(
                    (response.status_code, response.json()),
                    (400, {"detail": detail, "code": "name_mismatch", "fields": {"name": [detail]}}),
                )
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.delete(self.url(), {"name": " Shards "}, format="json").status_code, 204)
