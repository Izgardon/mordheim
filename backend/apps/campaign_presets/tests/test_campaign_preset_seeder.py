"""The campaign presets, seeded from the catalogue import's sources (apps/campaign_presets/seeding.py)."""

import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.campaign_presets.models import CampaignPreset, CampaignPresetRule
from apps.campaign_presets.seeding import SeedResult, seed_presets
from apps.campaigns.models import CampaignType
from apps.exploration.models import ExplorationChart

MARIENBURG = "Mutiny in Marienburg"


class PresetSeederTests(TestCase):
    result: SeedResult
    mordheim: CampaignType
    setting: CampaignType
    chart: ExplorationChart

    @classmethod
    def setUpTestData(cls) -> None:
        cls.mordheim = CampaignType.objects.create(slug="mordheim", name="Mordheim 1a", grade="1a", always_on=True)
        cls.setting = CampaignType.objects.create(slug="mutiny-in-marienburg", name=MARIENBURG, grade="2b")
        cls.chart = ExplorationChart.objects.create(slug="mutiny-in-marienburg", name="Wasteland Exploration")

    def seed(self, *presets: dict, rules: dict[str, list[dict]] | None = None) -> None:
        with TemporaryDirectory() as presets_folder, TemporaryDirectory() as rules_folder:
            for entry in presets:
                (Path(presets_folder) / f"{entry['slug']}.json").write_text(json.dumps(entry), encoding="utf-8")
            for name, rows in (rules or {}).items():
                (Path(rules_folder) / f"{name}.json").write_text(json.dumps({"rules": rows}), encoding="utf-8")
            self.result = seed_presets(Path(presets_folder), Path(rules_folder))

    def test_the_real_sources_seed_every_published_campaign_and_marienburgs_rules(self) -> None:
        call_command("seed_settings", stdout=StringIO())
        call_command("seed_exploration_charts", stdout=StringIO())
        out = StringIO()
        call_command("seed_campaign_presets", stdout=out)
        self.assertIn("skipped: 0", out.getvalue())
        presets = {preset.slug: preset for preset in CampaignPreset.objects.all()}
        self.assertEqual(len(presets), 16)  # with Mutiny in Marienburg + Annual (23 Nov 2026)
        marienburg = presets["mutiny-in-marienburg"]
        self.assertEqual(
            (
                marienburg.enable_locations,
                marienburg.enable_encampments,
                marienburg.enable_campaign_points,
                marienburg.enable_blood_pacts,
                marienburg.max_heroes,
                marienburg.hero_death_roll,
                marienburg.exploration_chart_id,
            ),
            (True, True, True, True, 6, "d66", ExplorationChart.objects.get(slug="mutiny-in-marienburg").pk),
        )
        # its resources (William, 23 Nov 2026: "treasure and wyrdstone for MiM where treasure is the default")
        self.assertEqual((marienburg.main_resource, marienburg.resources), ("Treasure", ["Wyrdstone"]))
        self.assertEqual((presets["mordheim"].main_resource, presets["mordheim"].resources), ("", []))
        # Marienburg with its Annual (23 Nov 2026): both files' rules, Marienburg's first, and the Annual's Mighty Blow
        annual = presets["mutiny-in-marienburg-annual"]
        both = list(annual.rules.values_list("title", flat=True))
        own = list(marienburg.rules.values_list("title", flat=True))
        self.assertEqual(both[: len(own)], own)
        self.assertIn("Da Waaagh", both)
        self.assertEqual([wording["skill"] for wording in annual.skill_wordings], ["Mighty Blow"])
        self.assertEqual((annual.main_resource, annual.resources), ("Treasure", ["Wyrdstone"]))
        self.assertEqual([setting.name for setting in marienburg.settings.all()], [MARIENBURG])
        # its campaign rules first, then its battle rules, then its charts with their results
        rules = list(marienburg.rules.all())
        self.assertEqual(
            (sum(1 for rule in rules if rule.kind == "campaign"), sum(1 for rule in rules if rule.kind == "battle")),
            # one battle rule more than the book's chapters: the Weather umbrella opens with the roll itself, which
            # nothing told you to make (William, 20 Nov 2026)
            (17, 39),
        )
        self.assertEqual(rules[0].title, "Campaign points")
        charts = list(marienburg.charts.prefetch_related("rows").select_related("row__chart"))
        # a table belonging to a rule or to one result is not a chart of its own (William, 20 Nov 2026)
        self.assertEqual(sum(1 for chart in charts if chart.rule_id is None and chart.row_id is None), 14)
        owned = [chart.rule for chart in charts if chart.rule is not None]
        self.assertEqual(
            sorted(rule.title for rule in owned),
            ["Breaking into buildings", "Setting buildings on fire", "Under arrest"],
        )
        # the sewer and booty tables hang off single results of the charts that send the player to them
        on_results = {
            chart.title: (chart.row.chart.title, chart.row.result) for chart in charts if chart.row is not None
        }
        self.assertEqual(
            on_results,
            {
                "Traps": ("Subterranean events", "7"),
                "Sewer hazards": ("Subterranean events", "3"),
                "Tainted items": ("Booty", "7"),
            },
        )
        seaside = next(chart for chart in charts if chart.title == "Seaside Situations")
        self.assertEqual((seaside.dice, len(seaside.rows.all())), ("D66", 32))

    def test_mordheims_preset_dictates_nothing_and_names_no_settings(self) -> None:
        call_command("seed_settings", stdout=StringIO())
        call_command("seed_exploration_charts", stdout=StringIO())
        call_command("seed_campaign_presets", stdout=StringIO())
        mordheim = CampaignPreset.objects.get(slug="mordheim")
        self.assertEqual(
            [
                mordheim.enable_locations,
                mordheim.enable_encampments,
                mordheim.enable_campaign_points,
                mordheim.enable_blood_pacts,
                mordheim.max_heroes,
                mordheim.exploration_chart_id,
            ],
            [None, None, None, None, None, None],
        )
        self.assertEqual((mordheim.hero_death_roll, mordheim.settings.count(), mordheim.rules.count()), ("", 0, 0))

    def test_the_three_newest_campaigns_dictate_only_what_their_books_state(self) -> None:
        call_command("seed_settings", stdout=StringIO())
        call_command("seed_exploration_charts", stdout=StringIO())
        out = StringIO()
        call_command("seed_campaign_presets", stdout=out)
        self.assertIn("skipped: 0", out.getvalue())
        presets = {preset.slug: preset for preset in CampaignPreset.objects.all()}
        expected = {
            # Border Town Burning: its objectives chapter is campaign points, and its injury chart names a D66 result
            # one battle rule fewer than the book's chapters: its Perilous phenomenon rule only repeated the
            # chart's own trigger, so the chart says it (William, 20 Nov 2026); and one more for the Weather
            # umbrella's opening roll, which nothing told you to make
            "border-town-burning": (None, None, True, None, None, "d66", 23),
            # Khemri dictates its chart and nothing else: it points at the rulebook for everything structural
            "khemri": (None, None, None, None, None, "", 20),
            # Sartosa: its Locales are the campaign's places, and pressganging names a D66 result
            # Locations off (William, 20 Nov 2026): its locales are a document of their own, not the campaign's places
            "sartosa": (False, None, None, None, None, "d66", 35),
        }
        for slug, row in expected.items():
            preset = presets[slug]
            self.assertEqual(
                (
                    preset.enable_locations,
                    preset.enable_encampments,
                    preset.enable_campaign_points,
                    preset.enable_blood_pacts,
                    preset.max_heroes,
                    preset.hero_death_roll,
                    preset.rules.count(),
                ),
                row,
                slug,
            )
            self.assertEqual(preset.exploration_chart_id, ExplorationChart.objects.get(slug=slug).pk, slug)

    def test_a_field_left_out_stays_null_rather_than_taking_the_apps_default(self) -> None:
        self.seed({"slug": "sartosa", "name": "Sartosa", "settings": ["Mutiny in Marienburg"]})
        preset = CampaignPreset.objects.get(slug="sartosa")
        self.assertEqual((preset.enable_locations, preset.max_heroes, preset.hero_death_roll), (None, None, ""))
        self.assertEqual(self.result.presets, 1)

    def test_a_preset_naming_a_setting_we_dont_hold_is_skipped_with_a_warning(self) -> None:
        self.seed({"slug": "albion", "name": "Albion", "settings": ["Albion"]})
        self.assertEqual(CampaignPreset.objects.count(), 0)
        self.assertEqual(self.result.skipped, ["Albion: the setting 'Albion' isn't seeded; the preset is skipped."])

    def test_a_preset_naming_a_chart_we_dont_hold_is_skipped_rather_than_seeded_without_one(self) -> None:
        self.seed({"slug": "lustria", "name": "Lustria", "exploration_chart": "lustria"})
        self.assertEqual(CampaignPreset.objects.count(), 0)
        self.assertIn("the exploration chart 'lustria' isn't seeded", self.result.skipped[0])

    def test_a_preset_whose_rules_file_is_missing_is_skipped_and_the_others_still_seed(self) -> None:
        self.seed(
            {"slug": "mordheim", "name": "Mordheim"},
            {"slug": "sylvania", "name": "Sylvania", "rules": "sylvania"},
        )
        self.assertEqual([preset.slug for preset in CampaignPreset.objects.all()], ["mordheim"])
        self.assertIn("its rules file sylvania.json isn't there", self.result.skipped[0])

    def test_a_second_run_rewrites_the_rules_and_the_settings_rather_than_adding_them(self) -> None:
        body = {"slug": "mim", "name": MARIENBURG, "settings": [MARIENBURG], "rules": "mim"}
        self.seed(body, rules={"mim": [{"title": "Cargo", "text": "Crates."}]})
        self.seed({**body, "settings": []}, rules={"mim": [{"title": "Prisoners", "text": "Ransom."}]})
        preset = CampaignPreset.objects.get(slug="mim")
        self.assertEqual([rule.title for rule in preset.rules.all()], ["Prisoners"])
        self.assertEqual((CampaignPresetRule.objects.count(), preset.settings.count()), (1, 0))

    def test_an_unknown_field_stops_the_run_rather_than_being_ignored(self) -> None:
        with self.assertRaises(CommandError) as refused:
            self.seed({"slug": "mim", "name": MARIENBURG, "starting_gold": 600})
        self.assertIn("unknown fields: starting_gold", str(refused.exception))

    def test_a_death_roll_outside_the_tables_stops_the_run(self) -> None:
        with self.assertRaises(CommandError):
            self.seed({"slug": "mim", "name": MARIENBURG, "hero_death_roll": "d20"})

    # its resources (William, 23 Nov 2026)

    def test_a_preset_seeds_its_main_resource_and_its_others(self) -> None:
        self.seed({"slug": "m", "name": MARIENBURG, "main_resource": " Treasure ", "resources": ["Wyrdstone"]})
        preset = CampaignPreset.objects.get(slug="m")
        self.assertEqual((preset.main_resource, preset.resources), ("Treasure", ["Wyrdstone"]))

    def test_resources_that_are_not_a_list_of_names_stop_the_run(self) -> None:
        for bad in ("Wyrdstone", [""], [3]):
            with self.assertRaises(CommandError):
                self.seed({"slug": "m", "name": MARIENBURG, "resources": bad})

    # several rules files, and its own wording of book skills (William, 23 Nov 2026: MiM + Annual)

    def test_a_preset_reads_several_rules_files_in_order(self) -> None:
        rules = {"mim": [{"title": "Cargo", "text": "Crates."}], "annual": [{"title": "Flying", "text": "Wings."}]}
        self.seed({"slug": "m", "name": MARIENBURG, "rules": ["mim", "annual"]}, rules=rules)
        titles = list(CampaignPresetRule.objects.filter(preset__slug="m").values_list("title", flat=True))
        self.assertEqual(titles, ["Cargo", "Flying"])

    def test_two_files_holding_the_same_title_stop_the_run(self) -> None:
        rules = {"mim": [{"title": "Cargo", "text": "Crates."}], "annual": [{"title": "cargo", "text": "Again."}]}
        with self.assertRaises(CommandError):
            self.seed({"slug": "m", "name": MARIENBURG, "rules": ["mim", "annual"]}, rules=rules)

    def test_a_preset_seeds_its_skill_wordings(self) -> None:
        wording = {"skill": "Mighty Blow", "description": "+1 Strength with any hammer or mace."}
        self.seed({"slug": "m", "name": MARIENBURG, "skill_wordings": [wording]})
        self.assertEqual(CampaignPreset.objects.get(slug="m").skill_wordings, [wording])

    def test_a_skill_wording_without_a_description_stops_the_run(self) -> None:
        with self.assertRaises(CommandError):
            self.seed({"slug": "m", "name": MARIENBURG, "skill_wordings": [{"skill": "Mighty Blow"}]})
