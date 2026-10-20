"""Handing ownership to an admin (decision 4, CAMP-NEW-02, CAMP-TEST-13)."""

from typing import Any

from .campaign_support import CampaignTestCase


class HandOverTests(CampaignTestCase):
    def hand_over(self, actor: Any, target: Any) -> Any:
        return self.post_as(actor, self.url("ownership/"), {"user_id": target.id})

    def roles(self) -> list[str]:
        return [self.membership(user).role.slug for user in (self.owner, self.admin, self.player)]

    def test_the_owner_hands_ownership_to_an_admin_and_becomes_an_admin(self):
        response = self.hand_over(self.owner, self.admin)

        self.assertEqual(
            (response.status_code, response.json()),
            (200, {"owner_id": self.admin.id, "previous_owner_id": self.owner.id}),
        )
        self.assertEqual(self.roles(), ["admin", "owner", "player"])
        self.assertEqual(self.patch_as(self.admin, self.url(), {"max_heroes": 5}).status_code, 200)
        self.assertEqual(self.patch_as(self.owner, self.url(), {"max_heroes": 4}).status_code, 403)
        old, new = (self.get_as(user, self.url()).json()["capabilities"] for user in (self.owner, self.admin))
        self.assertEqual((old["hand_over"], old["edit_settings"], old["start"]), (False, False, True))
        self.assertEqual((new["hand_over"], new["edit_settings"]), (True, True))

    def test_only_the_owner_hands_over_and_only_to_an_admin(self):
        not_admin = "Ownership can only go to an admin. Make them an admin first."
        for actor, target, status, code in (
            (self.owner, self.player, 400, "not_an_admin"),
            (self.owner, self.owner, 400, "not_an_admin"),
            (self.owner, self.outsider, 404, "not_found"),
        ):
            with self.subTest(target=target.first_name):
                response = self.hand_over(actor, target)
                self.assertEqual((response.status_code, response.json()["code"]), (status, code))
        self.assertEqual(self.hand_over(self.owner, self.player).json()["fields"], {"user_id": [not_admin]})
        for actor, status in ((self.admin, 403), (self.player, 403), (self.outsider, 404)):
            with self.subTest(actor=actor.first_name):
                self.assertEqual(self.hand_over(actor, self.admin).status_code, status)
        self.assertEqual(self.post_as(self.owner, self.url("ownership/"), {}).status_code, 400)

        self.assertEqual(self.roles(), ["owner", "admin", "player"])

    def test_a_second_hand_over_by_the_old_owner_is_refused(self):
        self.patch_as(self.owner, self.url(f"members/{self.player.id}/role/"), {"role": "admin"})
        self.assertEqual(self.hand_over(self.owner, self.admin).status_code, 200)

        self.assertEqual(self.hand_over(self.owner, self.player).status_code, 403)  # an admin now

        self.assertEqual(self.roles(), ["admin", "owner", "admin"])
