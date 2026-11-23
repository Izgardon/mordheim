"""A published campaign's locations (William, 23 Nov 2026): seeded from the `location_groups` of its rules files,
copied into a campaign that takes the preset up, and swapped out with the rest when it changes preset."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from django.core.management.base import CommandError
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaign_presets.models import CampaignPreset, CampaignPresetLocation, CampaignPresetLocationGroup
from apps.campaign_presets.seeding import seed_presets
from apps.campaign_presets.services.locations import copy_locations
from apps.campaigns.models import Campaign, CampaignChart, CampaignLocation, CampaignLocationGroup
from apps.campaigns.tests.campaign_support import CampaignTestCase

HAZARDS = {"title": "Forest Hazards", "dice": "D6", "rows": [{"result": "1", "name": "Bog", "text": "Stuck."}]}
ALTAR = {
    "name": "Altar of the Horned Rat",
    "rules": "Pray. Roll a D6.",
    "min_heroes": 1,
    "max_heroes": "all",
    "trading_action": True,
    "tables": [
        {
            "title": "Altar of the Horned Rat",
            "dice": "D6",
            "rows": [
                {"result": "1-2", "name": "Unworthy!", "text": "-1 T."},
                {
                    "result": "3-6",
                    "name": "Blessed",
                    "chart": {"dice": "D3", "rows": [{"result": "1", "text": "+1 S."}]},
                },
            ],
        }
    ],
    "charts": ["Forest Hazards"],
}
UNDERCITY = {"name": "The Undercity", "description": "Below.", "restrictions": "Skaven only.", "locations": [ALTAR]}
FIRST = {"rules": [], "charts": [HAZARDS], "location_groups": [UNDERCITY]}
# the Annual's file: its Undercity joins the first's, and a group of its own follows
SECOND = {
    "rules": [],
    "location_groups": [
        {"name": "The Undercity", "description": "Ignored.", "locations": [{"name": "Rat Market"}]},
        {"name": "Da Camp", "locations": [{"name": "Grot Pit", "min_heroes": 2, "max_heroes": 2}]},
    ],
}
OTHER = {"rules": [], "location_groups": [{"name": "Wood Elf Glades", "locations": [{"name": "Glade"}]}]}


def seed(presets: dict[str, Any], files: dict[str, Any]) -> Any:
    with TemporaryDirectory() as preset_dir, TemporaryDirectory() as rule_dir:
        for slug, preset in presets.items():
            (Path(preset_dir) / f"{slug}.json").write_text(json.dumps({"slug": slug, **preset}), encoding="utf-8")
        for name, source in files.items():
            (Path(rule_dir) / f"{name}.json").write_text(json.dumps(source), encoding="utf-8")
        return seed_presets(Path(preset_dir), Path(rule_dir))


PRESETS = {
    "mim": {"name": "Mutiny in Marienburg", "rules": ["mim", "annual"]},
    "athel": {"name": "Athel Loren", "rules": "athel"},
}
FILES = {"mim": FIRST, "annual": SECOND, "athel": OTHER}


class PresetLocationSeedTests(CampaignTestCase):
    def test_groups_of_one_name_merge_across_its_files(self):
        result = seed(PRESETS, FILES)

        self.assertEqual(result.locations, 4)
        groups = CampaignPresetLocationGroup.objects.filter(preset__slug="mim").order_by("order")
        self.assertEqual(
            [(group.name, group.description, group.restrictions) for group in groups],
            [("The Undercity", "Below.", "Skaven only."), ("Da Camp", "", "")],
        )
        self.assertEqual(
            [p.name for p in groups[0].locations.order_by("order")], ["Altar of the Horned Rat", "Rat Market"]
        )
        altar = CampaignPresetLocation.objects.get(name="Altar of the Horned Rat")
        self.assertEqual((altar.min_heroes, altar.max_heroes, altar.takes_trading_action), (1, None, True))
        [table] = altar.tables.all()
        self.assertEqual([row.name for row in table.rows.order_by("order")], ["Unworthy!", "Blessed"])
        self.assertEqual(table.rows.get(name="Blessed").charts.get().rows.get().text, "+1 S.")
        self.assertEqual([link.chart.title for link in altar.chart_links.all()], ["Forest Hazards"])
        self.assertEqual(CampaignPreset.objects.get(slug="mim").charts.filter(location=None, rule=None).count(), 2)

    def test_a_reseed_writes_them_afresh(self):
        seed(PRESETS, FILES)
        seed(PRESETS, FILES)

        self.assertEqual(CampaignPresetLocation.objects.count(), 4)

    def test_a_bad_file_stops_the_run(self):
        place = {"name": "Odd"}
        cases = {
            "a die we lack": {**place, "tables": [{"title": "T", "dice": "D7", "rows": [{"result": "1"}]}]},
            "min above max": {**place, "min_heroes": 3, "max_heroes": 2},
            "all below a number": {**place, "min_heroes": "all", "max_heroes": 2},
            "not a count": {**place, "max_heroes": "lots"},
            "a chart it lacks": {**place, "charts": ["Nowhere"]},
            "a table of no results": {**place, "tables": [{"title": "T", "rows": []}]},
        }
        for case, location in cases.items():
            with self.subTest(case), self.assertRaises(CommandError):
                source = {"rules": [], "location_groups": [{"name": "G", "locations": [location]}]}
                seed({"x": {"name": "X", "rules": "x"}}, {"x": source})

    def test_names_must_not_repeat(self):
        twice = {"rules": [], "location_groups": [{"name": "G", "locations": []}, {"name": "g", "locations": []}]}
        with self.assertRaises(CommandError):
            seed({"x": {"name": "X", "rules": "x"}}, {"x": twice})
        again = {"rules": [], "location_groups": [{"name": "H", "locations": [{"name": "Altar of the Horned Rat"}]}]}
        with self.assertRaises(CommandError):
            seed({"x": {"name": "X", "rules": ["mim", "again"]}}, {"mim": FIRST, "again": again})


class PresetLocationCopyTests(CampaignTestCase):
    mim: CampaignPreset
    athel: CampaignPreset

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        seed(PRESETS, FILES)
        cls.mim = CampaignPreset.objects.get(slug="mim")
        cls.athel = CampaignPreset.objects.get(slug="athel")

    def create(self, preset: CampaignPreset) -> int:
        body = {"name": "Ashes", "max_players": 4, "preset_id": preset.pk, "enable_locations": True}
        response = self.post_as(self.owner, "/api/campaigns/", body)
        self.assertEqual(response.status_code, 201, response.data)
        return int(response.data["id"])

    def tree(self, campaign_id: int) -> list[tuple[str, list[str]]]:
        groups = CampaignLocationGroup.objects.filter(campaign_id=campaign_id, removed_at=None).order_by("order")
        return [(g.name, [p.name for p in g.locations.filter(removed_at=None).order_by("order")]) for g in groups]

    def test_creating_with_a_preset_copies_its_groups_locations_tables_and_links(self):
        campaign_id = self.create(self.mim)

        self.assertEqual(
            self.tree(campaign_id),
            [("The Undercity", ["Altar of the Horned Rat", "Rat Market"]), ("Da Camp", ["Grot Pit"])],
        )
        listed = self.get_as(self.owner, f"/api/campaigns/{campaign_id}/location-groups/").json()
        altar = listed[0]["locations"][0]
        hazards = CampaignChart.objects.get(campaign_id=campaign_id, title="Forest Hazards")
        self.assertEqual(altar["charts"], [{"id": hazards.id, "title": "Forest Hazards"}])
        self.assertEqual((altar["min_heroes"], altar["max_heroes"], altar["takes_trading_action"]), (1, "all", True))
        self.assertEqual(altar["tables"][0]["rows"][1]["chart"]["rows"][0]["text"], "+1 S.")
        self.assertEqual(listed[0]["restrictions"], "Skaven only.")

    def test_copying_again_copies_nothing_twice_and_the_queries_do_not_grow(self):
        campaign_id = self.create(self.mim)
        campaign = Campaign.objects.get(id=campaign_id)
        CampaignLocation.objects.filter(campaign_id=campaign_id, name="Rat Market").delete()

        with CaptureQueriesContext(connection) as queries:
            self.assertEqual(copy_locations(campaign, self.mim), 1)

        self.assertLessEqual(len(queries), 16)
        self.assertEqual(copy_locations(campaign, self.mim), 0)
        self.assertEqual(self.tree(campaign_id)[0][1], ["Altar of the Horned Rat", "Rat Market"])

    def test_changing_preset_swaps_the_untouched_locations_and_keeps_the_edited(self):
        campaign_id = self.create(self.mim)
        CampaignLocation.objects.filter(campaign_id=campaign_id, name="Rat Market").update(rules="Our own words.")

        response = self.patch_as(self.owner, f"/api/campaigns/{campaign_id}/", {"preset_id": self.athel.pk})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.tree(campaign_id), [("The Undercity", ["Rat Market"]), ("Wood Elf Glades", ["Glade"])])
        self.assertFalse(
            CampaignChart.objects.filter(campaign_id=campaign_id, title="Altar of the Horned Rat").exists()
        )

    def test_changing_back_brings_them_in_again(self):
        campaign_id = self.create(self.mim)
        self.patch_as(self.owner, f"/api/campaigns/{campaign_id}/", {"preset_id": self.athel.pk})
        self.patch_as(self.owner, f"/api/campaigns/{campaign_id}/", {"preset_id": self.mim.pk})

        self.assertEqual(
            self.tree(campaign_id),
            [("The Undercity", ["Altar of the Horned Rat", "Rat Market"]), ("Da Camp", ["Grot Pit"])],
        )
