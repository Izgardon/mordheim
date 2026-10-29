"""Deleting your account (pass 6 PR C; AUTH-NEW-05, decision 1).

`GET auth/me/deletion/` says what deleting does, campaign by campaign: one you own with other members blocks it until
you hand it to an admin (`hand_over_first`), one you're alone in is archived (`archived`), and you leave every other
one with removal's clean-up (`left`), your warband kept. It counts the open battles and trades that close.
`POST auth/me/deletion/` takes your current password and does it, in one transaction: you show as "Former player"
everywhere, your warbands, battles and ledger stay as retired records, your notifications go, and the user row stays,
anonymised, inactive and with a new session key, so every device is signed out and the address can sign up again. It
can't be undone. The POST shares the account throttle (5 a minute per user); the preview isn't throttled.
"""

from typing import Any

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.battles.serializers import battle_snapshot
from apps.campaigns.models import Campaign, CampaignMembership, CampaignMessage
from apps.campaigns.tests.campaign_support import CampaignTestCase
from apps.notifications.models import Notification
from apps.trades.models import TradeRequest
from apps.users.models import UserAccount
from apps.warbands.models import Warband

from .auth_support import LOGIN, ME, PASSWORD, REFRESH, REGISTER, AuthTestCase, make_user

DELETION = "/api/auth/me/deletion/"
SIGN_OUT_OTHERS = "/api/auth/sign-out-others/"
HAND_OVER_FIRST = "Hand these campaigns to an admin before you delete your account."


class DeletionTestCase(CampaignTestCase):
    """The shared campaign "Shards" (owner Olga with company; Pia and Rex players with warbands), and "Elsewhere",
    where Otto is alone. Olga, Pia and Otto have the password `PASSWORD`."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        for user in (cls.owner, cls.player, cls.outsider):
            user.set_password(PASSWORD)
            user.save(update_fields=["password"])

    def preview(self, user: Any) -> Any:
        return self.get_as(user, DELETION)

    def delete_account(self, user: Any, password: str = PASSWORD) -> Any:
        with self.captureOnCommitCallbacks(execute=True):
            return self.post_as(user, DELETION, {"current_password": password})

    def campaign_alone(self, user: Any, name: str) -> Campaign:
        """A campaign `user` creates through the API and stays alone in."""
        created = self.post_as(user, "/api/campaigns/", {"name": name, "max_players": 4})
        assert created.status_code == 201, created.data
        return Campaign.objects.get(id=created.data["id"])

    def offer_trade(self, sender: Any, target: Any) -> str:
        response = self.post_as(sender, self.url("trade-requests/"), {"target_user_id": target.id})
        assert response.status_code == 201, response.data
        return str(response.json()["id"])

    def user_row(self, user: Any) -> Any:
        return get_user_model().objects.get(id=user.id)


class DeletionPreviewTests(DeletionTestCase):
    def test_a_player_leaves_each_campaign_keeping_his_warband_and_sees_what_closes(self):
        self.open_battle(Battle.STATUS_INVITING)
        self.offer_trade(self.rival, self.player)

        response = self.preview(self.player)

        self.assertEqual(response.status_code, 200)
        shards = {"id": self.campaign.id, "name": "Shards", "role": "player", "archived": False, "outcome": "left"}
        self.assertEqual(
            response.json(),
            {
                "campaigns": [{**shards, "warband": {"id": self.warband.id, "name": "Monks"}}],
                "battles": 1,
                "trades": 1,
                "can_delete": True,
            },
        )

    def test_an_owner_with_company_hands_over_first_and_a_campaign_he_is_alone_in_is_archived(self):
        lonely = self.campaign_alone(self.owner, "Lonely Tower")

        body = self.preview(self.owner).json()

        rows = [
            (row["name"], row["role"], row["archived"], row["outcome"], row["warband"]) for row in body["campaigns"]
        ]
        self.assertEqual(
            rows,
            [("Lonely Tower", "owner", False, "archived", None), ("Shards", "owner", False, "hand_over_first", None)],
        )
        self.assertEqual(body["campaigns"][0]["id"], lonely.id)
        self.assertEqual((body["battles"], body["trades"], body["can_delete"]), (0, 0, False))

    def test_a_campaign_already_archived_is_listed_as_archived(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.post_as(self.outsider, self.url("archive/", self.elsewhere))

        row = self.preview(self.outsider).json()["campaigns"][0]

        self.assertEqual((row["name"], row["archived"], row["outcome"]), ("Elsewhere", True, "archived"))

    def test_a_user_in_no_campaign_can_delete(self):
        loner = make_user("loner@example.com", "Lone")

        self.assertEqual(self.preview(loner).json(), {"campaigns": [], "battles": 0, "trades": 0, "can_delete": True})

    def test_it_needs_a_signed_in_user(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(self.client.get(DELETION).status_code, 401)
        self.assertEqual(self.client.post(DELETION, {"current_password": PASSWORD}).status_code, 401)

    def test_it_costs_four_queries_however_many_campaigns(self):
        # Memberships with their campaigns, roles and member counts; warbands; open battles; open trades
        for name in ("Ash", "Bone"):
            self.campaign_alone(self.outsider, name)
        self.join(self.outsider)
        self.client.force_authenticate(user=self.outsider)

        with self.assertNumQueries(4):
            response = self.client.get(DELETION)

        self.assertEqual(len(response.json()["campaigns"]), 4)


class AccountDeletionTests(DeletionTestCase):
    def test_a_wrong_or_missing_password_deletes_nothing(self):
        cases = {
            "wrong": ({"current_password": "not-my-password"}, ["That isn't your current password."]),
            "missing": ({}, ["This field is required."]),
        }
        for label, (body, errors) in cases.items():
            with self.subTest(case=label):
                response = self.post_as(self.player, DELETION, body)

                self.assertEqual((response.status_code, response.json()), (400, {"current_password": errors}))
        self.assertTrue(self.user_row(self.player).is_active)
        self.assertTrue(self.is_member(self.player))

    def test_an_owner_with_company_is_told_to_hand_over_first_and_nothing_changes(self):
        self.campaign_alone(self.owner, "Lonely Tower")

        response = self.delete_account(self.owner)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {
                "detail": HAND_OVER_FIRST,
                "code": "hand_over_first",
                "fields": {},
                "campaigns": [{"id": self.campaign.id, "name": "Shards"}],
            },
        )
        owner = self.user_row(self.owner)
        self.assertEqual((owner.first_name, owner.is_active), ("Olga", True))
        self.assertEqual(self.membership(self.owner).role.slug, "owner")
        self.assertFalse(Campaign.objects.filter(archived_at__isnull=False).exists())  # Lonely Tower wasn't archived

    def test_a_player_is_anonymised_and_leaves_with_the_clean_up_of_a_removal(self):
        battle = self.open_battle(Battle.STATUS_INVITING)
        trade_id = self.offer_trade(self.rival, self.player)
        self.notify(self.player, Notification.TYPE_BATTLE_INVITE, battle.id)
        self.notify(self.player, Notification.TYPE_BATTLE_INVITE, 999, campaign=self.elsewhere)
        message = CampaignMessage.objects.create(campaign=self.campaign, user=self.player, username="Pia", body="Hi")

        response = self.delete_account(self.player)

        self.assertEqual(response.status_code, 204)
        user = self.user_row(self.player)
        anonymised = (user.first_name, user.username, user.email, user.is_active, user.has_usable_password())
        self.assertEqual(anonymised, ("Former player", f"deleted-{user.id}", "", False, False))
        self.assertFalse(self.is_member(self.player))
        self.assertEqual(Warband.objects.get(id=self.warband.id).user_id, self.player.id)  # a retired record
        self.assertEqual(Battle.objects.get(id=battle.id).status, Battle.STATUS_CANCELED)
        cancel = BattleEvent.objects.get(battle=battle, type=BattleEvent.TYPE_BATTLE_CANCELED)
        self.assertEqual(cancel.payload_json["mode"], "member_left")
        self.assertEqual(TradeRequest.objects.get(id=trade_id).status, TradeRequest.STATUS_DECLINED)
        self.assertFalse(Notification.objects.filter(user_id=self.player.id).exists())
        message.refresh_from_db()
        self.assertEqual(message.username, "Former player")

    def test_others_see_former_player_on_what_stays(self):
        battle = self.open_battle(Battle.STATUS_ENDED)

        self.delete_account(self.player)

        labels = {row["user"]["id"]: row["user"]["label"] for row in battle_snapshot(battle.id)["participants"]}
        self.assertEqual(labels, {self.player.id: "Former player", self.rival.id: "Rex"})
        self.assertEqual(BattleParticipant.objects.filter(battle=battle).count(), 2)

    def test_every_session_ends_the_password_no_longer_signs_in_and_the_address_can_sign_up_again(self):
        self.client.force_authenticate(user=None)
        login = self.client.post(LOGIN, {"email": "player@example.com", "password": PASSWORD}, format="json")
        tokens = login.json()
        key = UserAccount.objects.get(user=self.player).session_key
        device = APIClient()
        device.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

        with self.captureOnCommitCallbacks(execute=True):
            response = device.post(DELETION, {"current_password": PASSWORD}, format="json")

        self.assertEqual(response.status_code, 204)
        self.assertNotEqual(UserAccount.objects.get(user=self.player).session_key, key)
        self.assertEqual(device.get(ME).status_code, 401)
        self.assertEqual(self.client.post(REFRESH, {"refresh": tokens["refresh"]}, format="json").status_code, 401)
        login_again = self.client.post(LOGIN, {"email": "player@example.com", "password": PASSWORD}, format="json")
        self.assertEqual(login_again.status_code, 400)
        body = {"email": "player@example.com", "password": PASSWORD, "name": "Pia Again"}
        signed_up = self.client.post(REGISTER, body, format="json")
        self.assertEqual(signed_up.status_code, 201, signed_up.json())
        self.assertNotEqual(signed_up.json()["user"]["id"], self.player.id)

    def test_an_owner_alone_archives_the_campaign_and_stays_its_owner(self):
        response = self.delete_account(self.outsider)

        self.assertEqual(response.status_code, 204)
        self.elsewhere.refresh_from_db()
        self.assertIsNotNone(self.elsewhere.archived_at)
        self.assertEqual(self.membership(self.outsider, self.elsewhere).role.slug, "owner")
        self.assertEqual(self.user_row(self.outsider).first_name, "Former player")

    def test_a_campaign_already_archived_stays_as_it_was(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.post_as(self.outsider, self.url("archive/", self.elsewhere))
        archived_at = Campaign.objects.get(id=self.elsewhere.id).archived_at

        response = self.delete_account(self.outsider)

        self.assertEqual(response.status_code, 204)
        self.assertEqual(Campaign.objects.get(id=self.elsewhere.id).archived_at, archived_at)
        self.assertTrue(CampaignMembership.objects.filter(campaign=self.elsewhere, user=self.outsider).exists())

    def test_an_admin_or_a_player_in_an_archived_campaign_leaves_it_too(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.post_as(self.owner, self.url("archive/"))

        response = self.delete_account(self.player)

        self.assertEqual(response.status_code, 204)
        self.assertFalse(self.is_member(self.player))
        self.assertTrue(Warband.objects.filter(id=self.warband.id).exists())


class AccountDeletionThrottleTests(AuthTestCase):
    def test_the_delete_shares_the_account_budget_and_the_preview_is_not_counted(self):
        # The Calls: password change, sign out others and delete, 5 a minute per user
        client = self.bearer(self.sign_in()["access"])
        for _ in range(3):
            self.assertEqual(client.get(DELETION).status_code, 200)
        for _ in range(4):
            wrong = client.post(DELETION, {"current_password": "not-my-password"}, format="json")
            self.assertEqual(wrong.status_code, 400)
        tokens = client.post(SIGN_OUT_OTHERS).json()  # the fifth in the budget
        client = self.bearer(tokens["access"])

        throttled = client.post(DELETION, {"current_password": PASSWORD}, format="json")

        self.assertEqual(throttled.status_code, 429)
        self.assertTrue(self.user_row_active())

    def user_row_active(self) -> bool:
        return get_user_model().objects.get(id=self.pia.id).is_active


@override_settings(RATE_LIMIT_ENABLED=False)
class DeletionWithoutAccountRowTests(AuthTestCase):
    def test_a_user_made_without_an_account_row_can_delete_too(self):
        # createsuperuser and the seeders make users without one (the first sign-in creates it); with no row, no token
        # carries a key that could match, so there is no session to end
        rex = make_user("rex@example.com", "Rex", account=False)
        client = APIClient()
        client.force_authenticate(user=rex)

        response = client.post(DELETION, {"current_password": PASSWORD}, format="json")

        self.assertEqual(response.status_code, 204)
        rex.refresh_from_db()
        self.assertEqual((rex.first_name, rex.is_active), ("Former player", False))
