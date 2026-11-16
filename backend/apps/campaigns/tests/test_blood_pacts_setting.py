"""Blood pacts as a campaign setting (William, 16 Nov 2026: Mutiny in Marienburg's Blood Pact rule "is generic", so
any campaign may switch it on). Off at first; only whoever edits the settings switches it, as with encampments and
locations."""

from typing import Any

from apps.campaigns.models import CampaignSettings

from .campaign_support import CampaignTestCase


class BloodPactSettingTests(CampaignTestCase):
    def switch(self, on: bool, user: Any = None) -> Any:
        return self.patch_as(user or self.owner, self.url(), {"enable_blood_pacts": on})

    def row(self) -> CampaignSettings:
        return CampaignSettings.objects.get(campaign=self.campaign)

    def test_it_is_off_at_first(self):
        self.assertFalse(self.get_as(self.player, self.url()).json()["enable_blood_pacts"])
        self.assertFalse(self.row().enable_blood_pacts)

    def test_only_those_who_edit_the_settings_switch_it(self):
        refused = [self.switch(True, user).status_code for user in (self.player, self.admin)]

        self.assertEqual(refused, [403, 403])
        self.assertFalse(self.row().enable_blood_pacts)

    def test_the_owner_switches_it_on_and_off_again(self):
        on = self.switch(True)

        self.assertEqual((on.status_code, on.json()["enable_blood_pacts"]), (200, True))
        self.assertTrue(self.row().enable_blood_pacts)

        off = self.switch(False)

        self.assertEqual((off.status_code, off.json()["enable_blood_pacts"]), (200, False))
        self.assertFalse(self.row().enable_blood_pacts)
