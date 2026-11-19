"""A preset's battle rules and charts (William, 19 Nov 2026).

The campaign rules and the battle rules are one table told apart by their `kind`, so a preset's source file lists
them under `rules` and `battle_rules` and the seeder gives each its kind. Its charts are the dice tables a player
looks up, each with its results in the file's order.

Applying a preset copies both onto the campaign, and never twice: a rule or a chart whose title the campaign already
holds is left alone, so a campaign that changes preset, or asks for its content again, gets only what it lacks.
"""

import json
from pathlib import Path
from tempfile import TemporaryDirectory

from django.test import TestCase

from apps.campaign_presets.models import CampaignPreset, CampaignPresetChart, CampaignPresetRule
from apps.campaign_presets.seeding import seed_presets
from apps.campaign_presets.services.charts import copy_charts
from apps.campaign_presets.services.rules import copy_rules
from apps.campaigns.models import Campaign, CampaignChart, CampaignChartRow, CampaignRule, CampaignType

SOURCE = {
    "rules": [{"title": "Campaign points", "text": "Score them."}],
    "battle_rules": [
        {"title": "Fire", "text": "It spreads.", "umbrella": "Weather"},
        {"title": "Fog", "text": "It hides.", "umbrella": "Weather"},
    ],
    "charts": [
        {
            "title": "Seaside Situations",
            "description": "Roll at the start of each turn.",
            "dice": "D66",
            "note": "Re-roll what the ground doesn't allow.",
            "rows": [
                {"result": "11-15", "name": "What is that!?", "text": "Roll on the monster table."},
                {"result": "16", "name": "Mutiny!", "text": "1-2 The crew turns.\n3-6 Nothing."},
            ],
        }
    ],
}


class PresetChartSeedTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        CampaignType.objects.create(slug="mordheim", name="Mordheim 1a", grade="1a", always_on=True)

    def seed(self, source: dict) -> None:
        with TemporaryDirectory() as presets, TemporaryDirectory() as rules:
            (Path(presets) / "test.json").write_text(
                json.dumps({"slug": "test", "name": "Test", "rules": "test"}), encoding="utf-8"
            )
            (Path(rules) / "test.json").write_text(json.dumps(source), encoding="utf-8")
            self.result = seed_presets(Path(presets), Path(rules))

    def test_the_rules_keep_their_kind_and_their_umbrella_in_the_files_order(self) -> None:
        self.seed(SOURCE)

        rows = list(CampaignPresetRule.objects.order_by("order"))
        self.assertEqual(
            [(row.kind, row.title, row.umbrella) for row in rows],
            [
                ("campaign", "Campaign points", ""),
                ("battle", "Fire", "Weather"),
                ("battle", "Fog", "Weather"),
            ],
        )

    def test_a_chart_keeps_its_dice_its_note_and_its_results_in_order(self) -> None:
        self.seed(SOURCE)

        chart = CampaignPresetChart.objects.get()
        self.assertEqual(
            (chart.title, chart.dice, chart.note, chart.description),
            ("Seaside Situations", "D66", "Re-roll what the ground doesn't allow.", "Roll at the start of each turn."),
        )
        self.assertEqual(
            [(row.result, row.name) for row in chart.rows.order_by("order")],
            [("11-15", "What is that!?"), ("16", "Mutiny!")],
        )
        self.assertEqual((self.result.rules, self.result.charts), (3, 1))

    def test_a_file_with_no_charts_seeds_none(self) -> None:
        self.seed({"rules": SOURCE["rules"]})

        self.assertEqual((self.result.rules, self.result.charts), (1, 0))
        self.assertFalse(CampaignPresetChart.objects.exists())

    def test_a_chart_that_rolls_a_die_we_do_not_hold_is_refused(self) -> None:
        with self.assertRaises(Exception) as caught:
            self.seed({"rules": [], "charts": [{"title": "Odd", "dice": "D7", "rows": [{"result": "1"}]}]})

        self.assertIn("D7", str(caught.exception))

    def test_a_chart_with_no_results_is_refused(self) -> None:
        with self.assertRaises(Exception) as caught:
            self.seed({"rules": [], "charts": [{"title": "Empty", "dice": "D6", "rows": []}]})

        self.assertIn("Empty", str(caught.exception))

    def test_seeding_again_writes_the_charts_afresh(self) -> None:
        self.seed(SOURCE)
        self.seed(SOURCE)

        self.assertEqual(CampaignPresetChart.objects.count(), 1)
        self.assertEqual(CampaignChartRow.objects.count(), 0)  # a preset's rows are its own, not a campaign's
        self.assertEqual(CampaignPresetChart.objects.get().rows.count(), 2)


class PresetContentCopyTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.preset = CampaignPreset.objects.create(slug="test", name="Test")
        CampaignPresetRule.objects.create(preset=cls.preset, order=0, kind="campaign", title="Points", text="Score.")
        CampaignPresetRule.objects.create(
            preset=cls.preset, order=1, kind="battle", title="Fog", text="It hides.", umbrella="Weather"
        )
        chart = CampaignPresetChart.objects.create(preset=cls.preset, order=0, title="Monsters", dice="2D6")
        chart.rows.create(order=0, result="2", name="Squig")
        chart.rows.create(order=1, result="3-4", name="Cultists")

    def setUp(self) -> None:
        self.campaign = Campaign.objects.create(name="Ours", join_code="ABC123", preset=self.preset)
        self.loaded = CampaignPreset.objects.prefetch_related("rules", "charts__rows").get(pk=self.preset.pk)

    def test_applying_the_preset_copies_its_rules_with_their_kind_and_umbrella(self) -> None:
        copied = copy_rules(self.campaign, self.loaded)

        rows = list(CampaignRule.objects.filter(campaign=self.campaign).order_by("order"))
        self.assertEqual(copied, 2)
        self.assertEqual(
            [(row.kind, row.title, row.body, row.umbrella) for row in rows],
            [("campaign", "Points", "Score.", ""), ("battle", "Fog", "It hides.", "Weather")],
        )

    def test_applying_the_preset_copies_its_charts_with_their_results(self) -> None:
        copied = copy_charts(self.campaign, self.loaded)

        chart = CampaignChart.objects.get(campaign=self.campaign)
        self.assertEqual(copied, 1)
        self.assertEqual((chart.title, chart.dice), ("Monsters", "2D6"))
        self.assertEqual(
            [(row.result, row.name) for row in chart.rows.order_by("order")], [("2", "Squig"), ("3-4", "Cultists")]
        )

    def test_a_chart_the_campaign_already_holds_by_title_is_left_alone(self) -> None:
        CampaignChart.objects.create(campaign=self.campaign, title="  monsters ", dice="D6", note="Mine.")

        self.assertEqual(copy_charts(self.campaign, self.loaded), 0)
        self.assertEqual(CampaignChart.objects.filter(campaign=self.campaign).count(), 1)
        self.assertEqual(CampaignChart.objects.get(campaign=self.campaign).note, "Mine.")

    def test_asking_twice_copies_nothing_the_second_time(self) -> None:
        copy_charts(self.campaign, self.loaded)
        copy_rules(self.campaign, self.loaded)

        self.assertEqual((copy_charts(self.campaign, self.loaded), copy_rules(self.campaign, self.loaded)), (0, 0))
        self.assertEqual(CampaignChart.objects.filter(campaign=self.campaign).count(), 1)
        self.assertEqual(CampaignRule.objects.filter(campaign=self.campaign).count(), 2)

    def test_a_campaign_with_no_preset_copies_nothing(self) -> None:
        self.assertEqual((copy_charts(self.campaign, None), copy_rules(self.campaign, None)), (0, 0))

    def test_copies_go_after_what_the_campaign_already_has(self) -> None:
        CampaignChart.objects.create(campaign=self.campaign, title="Mine", order=4)

        copy_charts(self.campaign, self.loaded)

        self.assertEqual(
            [
                (chart.title, chart.order)
                for chart in CampaignChart.objects.filter(campaign=self.campaign).order_by("order")
            ],
            [("Mine", 4), ("Monsters", 5)],
        )
