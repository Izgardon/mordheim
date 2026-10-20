"""What other members see of a player who has no first name (SEC-13, CAMP-TEST-27).

Registration makes the username the email, and every "first name, else username" fallback used to show it to the
whole campaign. One `display_name(user)` (first name, else "Player {id}") replaced them. Admins still see emails in
the members list (its `email` field).
"""

from typing import Any
from unittest import mock

from django.test import override_settings
from rest_framework.test import APIClient

from apps.battles.models import Battle
from apps.campaigns.models import CampaignBulletinEntry, CampaignEncampment, CampaignMessage
from apps.realtime.services import build_ping_payload
from apps.warbands.models import Warband

from .campaign_support import CampaignTestCase, make_user

EMAIL = "nameless@example.com"


class DisplayNameTests(CampaignTestCase):
    """The shared campaign plus `nameless`, a player with no first name and a warband, "Ghosts"."""

    nameless: Any
    nameless_warband: Warband
    shown: str  # what everyone sees instead of his email

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.nameless = make_user(EMAIL)
        client = APIClient()
        client.force_authenticate(user=cls.nameless)
        joined = client.post("/api/campaigns/join/", {"join_code": cls.campaign.join_code}, format="json")
        assert joined.status_code == 201, joined.data
        cls.nameless_warband = cls._create_warband(client, cls.nameless, "Ghosts")
        cls.shown = f"Player {cls.nameless.id}"

    def test_players_and_members_name_him_player_and_id(self):
        players = {row["id"]: row["name"] for row in self.get_as(self.player, self.url("players/")).data}
        members = {row["id"]: row for row in self.get_as(self.admin, self.url("members/")).data}

        self.assertEqual(players[self.nameless.id], self.shown)
        self.assertEqual(players[self.player.id], "Pia")
        self.assertEqual((members[self.nameless.id]["name"], members[self.nameless.id]["email"]), (self.shown, EMAIL))

    def test_chat_and_bulletin_store_player_and_id_as_the_username(self):
        message = self.post_as(self.nameless, self.url("messages/"), {"body": "Who goes there?"})
        note = self.post_as(self.nameless, self.url("bulletin/"), {"body": "WTB rope"})

        self.assertEqual(message.json()["username"], self.shown)
        self.assertEqual(CampaignMessage.objects.get(id=message.json()["id"]).username, self.shown)
        self.assertEqual(note.data["username"], self.shown)
        self.assertEqual(CampaignBulletinEntry.objects.get(id=note.data["id"]).username, self.shown)
        self.assertEqual(self.get_as(self.rival, self.url("messages/")).json()[0]["username"], self.shown)

    def test_an_encampment_owner_is_named_player_and_id(self):
        self.enable_features()
        CampaignEncampment.objects.create(campaign=self.campaign, name="Crypt", owner=self.nameless)

        listed = self.get_as(self.rival, self.url("encampments/")).data

        self.assertEqual([row["owner_name"] for row in listed], [self.shown])

    def test_battle_participants_are_labelled_player_and_id(self):
        battle = self.open_battle(Battle.STATUS_PREBATTLE, users=(self.nameless, self.player))

        listed = self.get_as(self.owner, self.url("active-battles/")).json()

        self.assertEqual([entry["battle"]["id"] for entry in listed], [battle.id])
        labels = sorted(row["user"]["label"] for row in listed[0]["participants"])
        self.assertEqual(labels, ["Pia", self.shown])

    def test_trade_players_are_labelled_player_and_id(self):
        response = self.post_as(self.nameless, self.url("trade-requests/"), {"target_user_id": self.player.id})

        self.assertEqual(response.status_code, 201, response.data)
        payload = response.json()
        self.assertEqual((payload["from_user"]["label"], payload["to_user"]["label"]), (self.shown, "Pia"))

    def test_ping_labels_are_display_names(self):
        # The pings route has no caller (IMP-68: PR B deletes it); its label was the username, even beside a first name
        self.assertEqual(build_ping_payload(self.campaign.id, self.player, None)["from"]["label"], "Pia")
        self.assertEqual(build_ping_payload(self.campaign.id, self.nameless, None)["from"]["label"], self.shown)

        unconfigured = self.post_as(self.player, self.url("pings/"), {"payload": {"any": "thing"}})
        self.assertEqual((unconfigured.status_code, unconfigured.data), (503, {"detail": "Realtime not configured"}))

        client = mock.Mock()
        with (
            override_settings(EXTERNAL_DISPATCH_SYNC=True),
            mock.patch("apps.realtime.services.get_pusher_client", return_value=client),
            self.captureOnCommitCallbacks(execute=True),
        ):
            relayed = self.post_as(self.player, self.url("pings/"), {"payload": {"any": "thing"}})
        self.assertEqual(relayed.data, {"status": "ok"})
        channel, event, data = client.trigger.call_args.args
        self.assertEqual((channel, event), (f"private-campaign-{self.campaign.id}-pings", "ping"))
        self.assertEqual(data["payload"], {"any": "thing"})  # relayed as sent, to every member
        self.assertEqual(self.post_as(self.outsider, self.url("pings/"), {}).status_code, 404)
