"""A user's own payload, and the name other players see (pass 6; SEC-13 leftovers, decision 2).

`/auth/me` and register's `user` are `{id, email, name}`, `name` being the raw `first_name`: the email goes only to
its owner. Pass 4 moved players, members, chat, bulletin, encampments, battles and trades onto `display_name`
("Player N" when the name is blank); PR A moved the ledger author too.
"""

from typing import Any

from .auth_support import AuthTestCase, make_user


class NamesTests(AuthTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.rex = make_user("rex@example.com")  # signed up without a name
        self.rex_client = self.bearer(self.sign_in("rex@example.com")["access"])

    def campaign_and_warband(self) -> tuple[int, int]:
        campaign = self.rex_client.post("/api/campaigns/", {"name": "Shards"}, format="json")
        body = {"name": "Rats", "faction": "Mercenaries", "campaign_id": campaign.json()["id"]}
        warband = self.rex_client.post("/api/warbands/", body, format="json")
        assert warband.status_code == 201, warband.data
        return campaign.json()["id"], warband.json()["id"]

    def test_a_nameless_user_sees_their_own_blank_name_and_email(self):
        # No prompt for existing users (decision 2, 2026-10-19), so this stays after PR A
        response = self.rex_client.get("/api/auth/me/")

        self.assertEqual(response.json(), {"id": self.rex.id, "email": "rex@example.com", "name": ""})

    def test_a_nameless_authors_hand_entered_ledger_row_shows_player_n(self):
        # SEC-13 leftover, AUTH-TWEAK-02 (was pinned: a blank name, since LedgerAuthorSerializer read first_name;
        # flipped in PR A: display_name)
        _, warband_id = self.campaign_and_warband()
        url = f"/api/warbands/{warband_id}/trades/"

        entered = self.rex_client.post(url, {"action": "Reward", "description": "Found a purse", "price": 5}, format="json")  # fmt: skip

        self.assertEqual(entered.status_code, 201, entered.data)
        author: dict[str, Any] = {"id": self.rex.id, "name": f"Player {self.rex.id}"}
        self.assertEqual(entered.json()["created_by"], author)
        listed = {row["description"]: row["created_by"] for row in self.rex_client.get(url).json()}
        self.assertEqual(listed["Found a purse"], author)

    def test_chat_already_shows_player_n_for_the_same_user(self):
        # Pass 4's display_name (SEC-13): the contrast with the ledger above
        campaign_id, _ = self.campaign_and_warband()

        posted = self.rex_client.post(f"/api/campaigns/{campaign_id}/messages/", {"body": "Who has the shard?"}, format="json")  # fmt: skip

        self.assertEqual(posted.status_code, 201, posted.data)
        self.assertEqual(posted.json()["username"], f"Player {self.rex.id}")
