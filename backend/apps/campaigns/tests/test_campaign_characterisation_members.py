"""Members: removal, Kick, roles and deleting the campaign (CAMP-TEST-05, -11, -12, -28).

Removal deletes only the membership row (BUG-50): what the player was part of stays behind, and rejoining with the
same code reattaches their warband. Kick is the frontend calling the warband DELETE, which only the warband's
owner may call (BUG-12).
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

    def test_only_the_owner_removes_and_only_players(self):
        # CAMP-TEST-12: admins can't remove anyone, and nobody can remove an admin or the owner
        self.assertEqual(self.remove(self.admin, self.player).status_code, 403)
        self.assertEqual(self.remove(self.rival, self.player).status_code, 403)
        self.assertEqual(self.remove(self.outsider, self.player).status_code, 404)

        refused = self.remove(self.owner, self.admin)
        self.assertEqual((refused.status_code, refused.data), (400, {"detail": "Only players can be removed."}))
        self.assertEqual(self.remove(self.owner, self.owner).status_code, 400)
        self.assertEqual(self.remove(self.owner, self.outsider).status_code, 404)
        self.assertTrue(all(self.is_member(user) for user in (self.owner, self.admin, self.player)))

        removed = self.remove(self.owner, self.player)

        self.assertEqual(removed.status_code, 204)
        self.assertFalse(self.is_member(self.player))
        self.assertEqual(self.get_as(self.player, self.url()).status_code, 404)

    def test_removal_leaves_the_players_battles_trades_notifications_and_encampments(self):
        # Characterises current behaviour (BUG-50, CAMP-TEST-11, pinned; flips in PR A): only the membership goes
        self.enable_features()
        battle = self.open_battle(Battle.STATUS_INVITING)
        self.notify(self.player, Notification.TYPE_BATTLE_INVITE, battle.id)
        sent = self.post_as(self.rival, self.url("trade-requests/"), {"target_user_id": self.player.id})
        trade = TradeRequest.objects.get(id=sent.json()["id"])
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside", owner=self.player)

        self.assertEqual(self.remove(self.owner, self.player).status_code, 204)

        self.assertEqual(Battle.objects.get(id=battle.id).status, Battle.STATUS_INVITING)
        participant = BattleParticipant.objects.get(battle=battle, user=self.player)
        self.assertEqual(participant.status, BattleParticipant.STATUS_INVITED)
        self.assertEqual(TradeRequest.objects.get(id=trade.id).status, TradeRequest.STATUS_PENDING)
        self.assertEqual(  # the list doesn't check membership (notifications/views.py:31-37)
            self.listed_notifications(self.player),
            [
                (Notification.TYPE_BATTLE_INVITE, str(battle.id), self.campaign.id),
                (Notification.TYPE_TRADE_REQUEST, str(trade.id), self.campaign.id),
            ],
        )
        accepted = self.post_as(self.player, self.url(f"trade-requests/{trade.id}/accept/"))
        self.assertEqual(accepted.status_code, 404)  # listed, but no longer answerable (SEC-08)
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
        # Characterises current behaviour (BUG-50, pinned; decision 1 keeps the warband and adds a new join code)
        self.grant(self.player, "manage_items")
        self.remove(self.owner, self.player)
        self.assertEqual(self.get_as(self.owner, self.url("players/")).status_code, 200)
        self.assertNotIn(self.player.id, [row["id"] for row in self.get_as(self.owner, self.url("players/")).data])

        rejoined = self.join(self.player)

        self.assertEqual(rejoined.status_code, 201)
        players = {row["id"]: row["warband"] for row in self.get_as(self.owner, self.url("players/")).data}
        self.assertEqual(players[self.player.id]["id"], self.warband.id)
        self.assertEqual(self.codes(self.player), ["add_custom"])
        self.assertEqual(self.membership(self.player).role.slug, "player")


class KickTests(CampaignTestCase):
    """Kick in Settings sends DELETE /warbands/:id/ for the player's warband (CAMP-TEST-05)."""

    def test_kick_is_refused_to_the_owner_and_the_admin(self):
        # Characterises current behaviour (BUG-12, pinned; flips in PR A, where Kick merges into removal)
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
        self.grant(self.player, "manage_items")
        for user, expected in ((self.player, 403), (self.outsider, 404)):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.get_as(user, self.url("members/")).status_code, expected)

        members = self.get_as(self.admin, self.url("members/")).json()

        # ordered by the role's slug, so the admin comes before the owner
        rows = [(row["name"], row["email"], row["role"], sorted(row["permissions"])) for row in members]
        self.assertEqual(
            rows,
            [
                ("Ada", "admin@example.com", "admin", ["add_custom"]),
                ("Olga", "owner@example.com", "owner", []),
                ("Pia", "player@example.com", "player", ["add_custom", "manage_items"]),
                ("Rex", "rival@example.com", "player", ["add_custom"]),
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
        # CAMP-TEST-12; CAMP-UX-02: no hand-over (roles are admin and player only)
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
        self.grant(self.player, "manage_items")
        self.set_role(self.owner, self.player, "admin")
        self.assertEqual(self.codes(self.player), ["add_custom", "manage_items"])  # stored, but admins hold every code

        self.set_role(self.owner, self.player, "player")

        self.assertEqual(self.get_as(self.player, self.url()).data["permissions"], ["add_custom", "manage_items"])


class CampaignDeleteTests(CampaignTestCase):
    def test_only_the_owner_deletes(self):
        for user, expected in ((self.admin, 403), (self.player, 403), (self.outsider, 404)):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.delete_as(user, self.url()).status_code, expected)
        self.assertTrue(Campaign.objects.filter(id=self.campaign.id).exists())

        self.assertEqual(self.delete_as(self.owner, self.url()).status_code, 204)

        self.assertFalse(Campaign.objects.filter(id=self.campaign.id).exists())
        self.assertFalse(Warband.objects.filter(id__in=(self.warband.id, self.rival_warband.id)).exists())

    def test_deleting_the_campaign_leaves_its_notifications(self):
        # Characterises current behaviour (BUG-50, CAMP-TEST-28, pinned; flips in PR C): campaign_id is a plain integer
        battle = self.open_battle(Battle.STATUS_INVITING)
        self.notify(self.rival, Notification.TYPE_BATTLE_INVITE, battle.id)
        trade = self.post_as(self.player, self.url("trade-requests/"), {"target_user_id": self.rival.id}).json()

        self.delete_as(self.owner, self.url())

        self.assertEqual(Notification.objects.filter(campaign_id=self.campaign.id, is_resolved=False).count(), 2)
        # the trade went with the campaign, so its notification drops out of the list; the invite stays listed
        self.assertFalse(TradeRequest.objects.filter(id=trade["id"]).exists())
        self.assertEqual(
            self.listed_notifications(self.rival),
            [(Notification.TYPE_BATTLE_INVITE, str(battle.id), self.campaign.id)],
        )
