"""Grading phase 1: the settings list with its presets, and the campaign's settings in play, chosen at creation (a
preset, Up to 1c by default) and changed by its owner (which retires its cached catalogue lists)."""

from io import StringIO
from typing import Any

from django.core.management import call_command

from apps.campaigns.in_play import preset_ids
from apps.campaigns.models import CampaignSettings, CampaignType

from .campaign_support import CampaignTestCase


def slugs(ids: list[int]) -> set[str]:
    return set(CampaignType.objects.filter(id__in=ids).values_list("slug", flat=True))


class SettingsInPlayTests(CampaignTestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        call_command("seed_settings", stdout=StringIO())
        call_command("seed_warband_types", stdout=StringIO())
        super().setUpTestData()

    def create(self, **body: object) -> Any:
        response = self.post_as(self.owner, "/api/campaigns/", {"name": "Ashes", "max_players": 4, **body})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_the_settings_list_holds_each_setting_its_types_and_the_presets(self) -> None:
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(1):
            data = self.client.get("/api/settings/").data
        rows = {row["slug"]: row for row in data["settings"]}
        self.assertEqual(len(rows), 19)
        self.assertEqual(
            {key: rows["mordheim"][key] for key in ("grade", "grade_label", "always_on", "warband_types")},
            {"grade": "1a", "grade_label": "Official", "always_on": True, "warband_types": 13},
        )
        self.assertEqual(rows["lustria"]["warband_types"], 12)
        self.assertEqual([preset["grade"] for preset in data["presets"]], ["1a", "1b", "1c", "2a", "2b", "3"])
        self.assertEqual(data["presets"][2]["setting_ids"], preset_ids("1c"))
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/settings/").status_code, 401)

    def test_a_new_campaign_starts_on_up_to_1c(self) -> None:
        self.assertEqual(self.create()["setting_ids"], sorted(preset_ids("1c")))
        detail = self.get_as(self.owner, self.url()).data
        self.assertEqual(detail["setting_ids"], sorted(preset_ids("1c")))
        self.assertNotIn("item_settings", detail)

    def test_creation_takes_a_preset_or_the_settings_with_mordheim_always_on(self) -> None:
        self.assertEqual(self.create(preset="2b")["setting_ids"], sorted(preset_ids("2b")))
        lustria = CampaignType.objects.get(slug="lustria")
        self.assertEqual(slugs(self.create(setting_ids=[lustria.id])["setting_ids"]), {"mordheim", "lustria"})
        self.assertEqual(slugs(self.create(setting_ids=[])["setting_ids"]), {"mordheim"})
        refused = self.post_as(
            self.owner, "/api/campaigns/", {"name": "Odd", "max_players": 4, "setting_ids": [999999]}
        )
        self.assertEqual(refused.status_code, 400)
        self.assertIn("setting_ids", refused.data)

    def test_the_owner_changes_them_and_the_catalogue_version_moves(self) -> None:
        before = CampaignSettings.objects.get(campaign=self.campaign).catalogue_version
        sylvania = CampaignType.objects.get(slug="sylvania")
        changed = self.patch_as(self.owner, self.url(), {"setting_ids": [sylvania.id]})
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(slugs(changed.data["setting_ids"]), {"mordheim", "sylvania"})
        self.assertNotEqual(CampaignSettings.objects.get(campaign=self.campaign).catalogue_version, before)
        for user in (self.admin, self.player):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.patch_as(user, self.url(), {"setting_ids": []}).status_code, 403)
        self.assertEqual(self.patch_as(self.owner, self.url(), {"setting_ids": [0]}).status_code, 400)

    def test_switching_pages_on_at_creation_replaces_the_marienburg_type(self) -> None:
        data = self.create(enable_encampments=True)
        self.assertEqual((data["enable_encampments"], data["enable_locations"]), (True, False))
        self.assertEqual(self.create(campaign_type="marienburg")["enable_encampments"], False)  # ignored now
