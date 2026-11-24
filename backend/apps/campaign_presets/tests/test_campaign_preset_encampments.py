"""A published campaign's encampments (William, 24 Nov 2026): seeded from the `encampment_rules` and
`encampment_groups` of its rules files, copied into a campaign that takes the preset up, and swapped out with the
rest when it changes preset, unless a warband holds one or it was razed."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from django.core.management.base import CommandError
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaign_presets.models import CampaignPreset, CampaignPresetEncampment, CampaignPresetEncampmentGroup
from apps.campaign_presets.seeding import seed_presets
from apps.campaign_presets.services.encampments import copy_encampments
from apps.campaigns.models import Campaign, CampaignEncampment, CampaignEncampmentGroup, CampaignRule
from apps.campaigns.tests.campaign_support import CampaignTestCase

TAVERN = {
    "name": "Tavern",
    "gained_by": "Seaside Situations 53",
    "fortified": False,
    "text": "Roll a D6.\n\nOn a 6, +5 gc.",
}
FORT = {"name": "Old Fort", "gained_by": "Exploration 11111", "fortified": True, "text": "+1 to the Stockade."}
FIRST = {
    "rules": [{"title": "Plots", "text": "Choose one."}],
    "encampment_rules": [{"title": "Encampments", "text": "Hold them."}],
    "encampment_groups": [{"name": "Marienburg city", "description": "Inside the walls.", "encampments": [TAVERN]}],
}
# the Annual's file: its city joins the first's, and a group of its own follows
SECOND = {
    "rules": [],
    "encampment_groups": [
        {"name": "marienburg city", "description": "Ignored.", "encampments": [FORT]},
        {"name": "Outside the city", "encampments": [{**FORT, "name": "Windmill", "fortified": False}]},
    ],
}
OTHER = {
    "rules": [],
    "encampment_rules": [{"title": "Locales", "text": "Held by hand."}],
    "encampment_groups": [{"name": "Port towns", "encampments": [{**TAVERN, "name": "Port Royale"}]}],
}
PRESETS = {
    "mim": {"name": "Mutiny in Marienburg", "rules": ["mim", "annual"]},
    "sartosa": {"name": "Sartosa", "rules": "sartosa"},
}
FILES = {"mim": FIRST, "annual": SECOND, "sartosa": OTHER}


def seed(presets: dict[str, Any], files: dict[str, Any]) -> Any:
    with TemporaryDirectory() as preset_dir, TemporaryDirectory() as rule_dir:
        for slug, preset in presets.items():
            (Path(preset_dir) / f"{slug}.json").write_text(json.dumps({"slug": slug, **preset}), encoding="utf-8")
        for name, source in files.items():
            (Path(rule_dir) / f"{name}.json").write_text(json.dumps(source), encoding="utf-8")
        return seed_presets(Path(preset_dir), Path(rule_dir))


def one_file(source: dict[str, Any]) -> Any:
    return seed({"x": {"name": "X", "rules": "x"}}, {"x": {"rules": [], **source}})


class PresetEncampmentSeedTests(CampaignTestCase):
    def test_groups_of_one_name_merge_and_the_holding_rules_are_rules_of_their_own_kind(self):
        result = seed(PRESETS, FILES)

        self.assertEqual(result.encampments, 4)
        groups = CampaignPresetEncampmentGroup.objects.filter(preset__slug="mim").order_by("order")
        self.assertEqual(
            [(group.name, group.description) for group in groups],
            [("Marienburg city", "Inside the walls."), ("Outside the city", "")],
        )
        self.assertEqual([p.name for p in groups[0].encampments.order_by("order")], ["Tavern", "Old Fort"])
        tavern = CampaignPresetEncampment.objects.get(name="Tavern")
        self.assertEqual(
            (tavern.gained_by, tavern.fortified, tavern.text),
            ("Seaside Situations 53", False, "Roll a D6.\n\nOn a 6, +5 gc."),
        )
        self.assertTrue(CampaignPresetEncampment.objects.get(name="Old Fort").fortified)
        rules = CampaignPreset.objects.get(slug="mim").rules.order_by("order")
        self.assertEqual(
            [(rule.kind, rule.title) for rule in rules], [("campaign", "Plots"), ("encampment", "Encampments")]
        )

    def test_a_reseed_writes_them_afresh(self):
        seed(PRESETS, FILES)
        seed(PRESETS, FILES)

        self.assertEqual(CampaignPresetEncampment.objects.count(), 4)

    def test_the_dropdown_counts_its_locations_and_encampments(self):
        seed(PRESETS, FILES)

        listed = {row["slug"]: row for row in self.get_as(self.owner, "/api/campaign-presets/").json()}

        self.assertEqual(
            {key: listed["mim"][key] for key in ("rule_count", "location_count", "encampment_count")},
            {"rule_count": 2, "location_count": 0, "encampment_count": 3},
        )

    def test_a_bad_shape_stops_the_run(self):
        cases: dict[str, dict[str, Any]] = {
            "no name": {"encampment_groups": [{"name": "G", "encampments": [{**TAVERN, "name": ""}]}]},
            "no gained_by": {"encampment_groups": [{"name": "G", "encampments": [{**TAVERN, "gained_by": ""}]}]},
            "no text": {"encampment_groups": [{"name": "G", "encampments": [{**TAVERN, "text": None}]}]},
            "fortified not a bool": {"encampment_groups": [{"name": "G", "encampments": [{**TAVERN, "fortified": 1}]}]},
            "gained_by not text": {"encampment_groups": [{"name": "G", "encampments": [{**TAVERN, "gained_by": 5}]}]},
            "a group with no name": {"encampment_groups": [{"encampments": []}]},
            "encampments not a list": {"encampment_groups": [{"name": "G", "encampments": {}}]},
            "groups not a list": {"encampment_groups": {"name": "G"}},
            "two groups of a name": {"encampment_groups": [{"name": "G"}, {"name": "g"}]},
            "two of a name": {
                "encampment_groups": [{"name": "G", "encampments": [TAVERN, {**FORT, "name": "tavern"}]}]
            },
            "rules not a list": {"encampment_rules": {"title": "Encampments"}},
            "a rule with no title": {"encampment_rules": [{"text": "Hold them."}]},
            "a rule's title twice": {
                "rules": [{"title": "Encampments"}],
                "encampment_rules": [{"title": "Encampments"}],
            },
        }
        for case, source in cases.items():
            with self.subTest(case), self.assertRaises(CommandError):
                one_file(source)

    def test_names_must_not_repeat_across_its_files(self):
        again = {"rules": [], "encampment_groups": [{"name": "Docks", "encampments": [TAVERN]}]}
        with self.assertRaises(CommandError):
            seed({"x": {"name": "X", "rules": ["mim", "again"]}}, {"mim": FIRST, "again": again})


class PresetEncampmentCopyTests(CampaignTestCase):
    mim: CampaignPreset
    sartosa: CampaignPreset

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        seed(PRESETS, FILES)
        cls.mim = CampaignPreset.objects.get(slug="mim")
        cls.sartosa = CampaignPreset.objects.get(slug="sartosa")

    def create(self, preset: CampaignPreset) -> int:
        body = {"name": "Ashes", "max_players": 4, "preset_id": preset.pk, "enable_encampments": True}
        response = self.post_as(self.owner, "/api/campaigns/", body)
        self.assertEqual(response.status_code, 201, response.data)
        return int(response.data["id"])

    def tree(self, campaign_id: int) -> list[tuple[str, list[str]]]:
        groups = CampaignEncampmentGroup.objects.filter(campaign_id=campaign_id, removed_at=None).order_by("order")
        return [(g.name, [p.name for p in g.encampments.filter(removed_at=None).order_by("order")]) for g in groups]

    def holding_rules(self, campaign_id: int) -> list[str]:
        rules = CampaignRule.objects.filter(campaign_id=campaign_id, kind="encampment").order_by("order")
        return list(rules.values_list("title", flat=True))

    def test_creating_with_a_preset_copies_its_groups_encampments_and_holding_rules(self):
        campaign_id = self.create(self.mim)

        self.assertEqual(
            self.tree(campaign_id), [("Marienburg city", ["Tavern", "Old Fort"]), ("Outside the city", ["Windmill"])]
        )
        self.assertEqual(self.holding_rules(campaign_id), ["Encampments"])
        listed = self.get_as(self.owner, f"/api/campaigns/{campaign_id}/encampment-groups/").json()
        self.assertEqual([rule["title"] for rule in listed["rules"]], ["Encampments"])
        fort = listed["groups"][0]["encampments"][1]
        self.assertEqual(
            {key: fort[key] for key in ("name", "gained_by", "fortified", "holder", "razed")},
            {"name": "Old Fort", "gained_by": "Exploration 11111", "fortified": True, "holder": None, "razed": False},
        )
        self.assertEqual(listed["groups"][0]["description"], "Inside the walls.")
        rules_page = self.get_as(self.owner, f"/api/campaigns/{campaign_id}/campaign-rules/").json()
        self.assertEqual([rule["title"] for rule in rules_page], ["Plots"])

    def test_copying_again_copies_nothing_twice_and_the_queries_do_not_grow(self):
        campaign_id = self.create(self.mim)
        campaign = Campaign.objects.get(id=campaign_id)
        CampaignEncampment.objects.filter(campaign_id=campaign_id, name="Windmill").delete()

        with CaptureQueriesContext(connection) as queries:
            self.assertEqual(copy_encampments(campaign, self.mim), 1)

        self.assertLessEqual(len(queries), 6)
        self.assertEqual(copy_encampments(campaign, self.mim), 0)
        self.assertEqual(self.tree(campaign_id)[1], ("Outside the city", ["Windmill"]))

    def test_changing_preset_swaps_the_untouched_and_keeps_the_edited_the_held_and_the_razed(self):
        campaign_id = self.create(self.mim)
        rows = CampaignEncampment.objects.filter(campaign_id=campaign_id)
        rows.filter(name="Windmill").update(text="Our own words.")
        rows.filter(name="Old Fort").update(razed=True)
        rows.filter(name="Tavern").update(holder=self.warband)

        response = self.patch_as(self.owner, f"/api/campaigns/{campaign_id}/", {"preset_id": self.sartosa.pk})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            self.tree(campaign_id),
            [
                ("Marienburg city", ["Tavern", "Old Fort"]),
                ("Outside the city", ["Windmill"]),
                ("Port towns", ["Port Royale"]),
            ],
        )
        self.assertEqual(self.holding_rules(campaign_id), ["Locales"])

    def test_changing_back_brings_them_in_again(self):
        campaign_id = self.create(self.mim)
        self.patch_as(self.owner, f"/api/campaigns/{campaign_id}/", {"preset_id": self.sartosa.pk})
        self.assertEqual(self.tree(campaign_id), [("Port towns", ["Port Royale"])])

        self.patch_as(self.owner, f"/api/campaigns/{campaign_id}/", {"preset_id": self.mim.pk})

        self.assertEqual(
            self.tree(campaign_id), [("Marienburg city", ["Tavern", "Old Fort"]), ("Outside the city", ["Windmill"])]
        )
        self.assertEqual(self.holding_rules(campaign_id), ["Encampments"])
