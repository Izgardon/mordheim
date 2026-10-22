"""Changing your display name (pass 6 PR A; AUTH-NEW-02, decision 2).

`PATCH auth/me/` takes `name` (required, trimmed, 1-40 characters) and answers the user's own payload. The name stored
on the user's chat messages and bulletin notes is rewritten with it, removed posts included, in one transaction;
other users' posts are untouched.
"""

from typing import Any

from django.contrib.auth import get_user_model

from apps.campaigns.models import Campaign, CampaignBulletinEntry, CampaignMessage

from .auth_support import ME, AuthTestCase, make_user


class RenameTests(AuthTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pia_client = self.bearer(self.sign_in()["access"])

    def rename(self, body: dict[str, Any]) -> Any:
        return self.pia_client.patch(ME, body, format="json")

    def test_a_rename_answers_the_new_name_and_is_kept(self):
        response = self.rename({"name": "  Pia the Bold  "})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"id": self.pia.id, "email": "pia@example.com", "name": "Pia the Bold"})
        self.assertEqual(get_user_model().objects.get(id=self.pia.id).first_name, "Pia the Bold")
        self.assertEqual(self.pia_client.get(ME).json()["name"], "Pia the Bold")

    def test_the_users_chat_messages_and_bulletin_notes_take_the_new_name(self):
        rex = make_user("rex@example.com", "Rex")
        shards, ruins = (Campaign.objects.create(name=name, join_code=code) for name, code in (("Shards", "SHARD1"), ("Ruins", "RUINS1")))  # fmt: skip
        pia_messages = [CampaignMessage.objects.create(campaign=c, user=self.pia, username="Pia", body="Hi") for c in (shards, ruins)]  # fmt: skip
        removed = CampaignBulletinEntry.objects.create(campaign=shards, user=self.pia, username="Pia", body="Old note")
        CampaignBulletinEntry.objects.filter(id=removed.id).update(removed_at="2026-10-01T12:00:00Z")
        rex_message = CampaignMessage.objects.create(campaign=shards, user=rex, username="Rex", body="Yo")

        self.assertEqual(self.rename({"name": "Pia the Bold"}).status_code, 200)

        for message in pia_messages:
            message.refresh_from_db()
            self.assertEqual(message.username, "Pia the Bold")
        removed.refresh_from_db()
        self.assertEqual(removed.username, "Pia the Bold")
        rex_message.refresh_from_db()
        self.assertEqual(rex_message.username, "Rex")

    def test_the_name_is_required_and_bounded_and_nothing_changes_when_refused(self):
        cases = {
            "omitted": ({}, "This field is required."),
            "blank": ({"name": ""}, "This field may not be blank."),
            "spaces": ({"name": "   "}, "This field may not be blank."),
            "41 characters": ({"name": "N" * 41}, "Ensure this field has no more than 40 characters."),
        }
        for label, (body, message) in cases.items():
            with self.subTest(case=label):
                response = self.rename(body)

                self.assertEqual((response.status_code, response.json()), (400, {"name": [message]}))
        self.assertEqual(get_user_model().objects.get(id=self.pia.id).first_name, "Pia")

    def test_only_the_name_changes(self):
        # Changing the email is parked (it needs verification)
        response = self.rename({"name": "Pia", "email": "someone@example.com", "id": 999})

        self.assertEqual(response.json(), {"id": self.pia.id, "email": "pia@example.com", "name": "Pia"})

    def test_it_needs_a_signed_in_user(self):
        self.assertEqual(self.client.patch(ME, {"name": "Anyone"}, format="json").status_code, 401)

    def test_a_rename_runs_four_statements_and_a_savepoint_pair(self):
        # The user and account, then in one transaction the name, the messages and the notes
        with self.assertNumQueries(6):
            response = self.rename({"name": "Pia the Bold"})

        self.assertEqual(response.status_code, 200)
