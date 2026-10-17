"""Only the warband's owner can change its backstory (decision 13, ROST-TWEAK-06, BUG-31's backstory half).

Campaign owners, admins and managers can still edit the rest of the warband. A PATCH that would change
the backstory is refused as a whole (403, nothing saved); resending it unchanged is fine.
"""

from typing import Any

from apps.warbands.models import Warband

from .roster_support import RosterTestCase

REFUSED = {
    "detail": "Only the warband's owner can change its backstory.",
    "code": "backstory_owner_only",
    "fields": {"backstory": ["Only the warband's owner can change its backstory."]},
}


class WarbandBackstoryTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        Warband.objects.filter(id=self.warband.id).update(backstory="Born in the ruins.", name="Monks")

    def _patch(self, user: Any, body: dict[str, Any]) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.patch(f"/api/warbands/{self.warband.id}/", body, format="json")

    def _stored(self) -> tuple[str | None, str]:
        warband = Warband.objects.get(id=self.warband.id)
        return warband.backstory, warband.name

    def test_the_owner_can_change_it(self):
        response = self._patch(self.player, {"backstory": "Raised by monks."})
        self.assertEqual((response.status_code, response.json()["backstory"]), (200, "Raised by monks."))

    def test_editors_who_dont_own_the_warband_cannot_change_it_and_nothing_is_saved(self):
        for user in (self.campaign_owner, self.admin, self.manager):
            with self.subTest(user=user.email):
                for backstory in ("Rewritten.", "", None):
                    response = self._patch(user, {"backstory": backstory, "name": "Renamed"})
                    self.assertEqual((response.status_code, response.json()), (403, REFUSED))
                self.assertEqual(self._stored(), ("Born in the ruins.", "Monks"))

    def test_editors_can_still_edit_the_rest_and_resend_the_backstory_unchanged(self):
        response = self._patch(self.admin, {"name": "Renamed", "backstory": "Born in the ruins."})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._stored(), ("Born in the ruins.", "Renamed"))

    def test_empty_and_null_are_the_same_unchanged_backstory(self):
        Warband.objects.filter(id=self.warband.id).update(backstory=None)
        for backstory in ("", None):
            with self.subTest(backstory=backstory):
                self.assertEqual(self._patch(self.manager, {"backstory": backstory}).status_code, 200)

    def test_a_viewer_still_cannot_edit_anything(self):
        response = self._patch(self.viewer, {"backstory": "Mine now."})
        self.assertEqual((response.status_code, response.json()), (403, {"detail": "Forbidden"}))
