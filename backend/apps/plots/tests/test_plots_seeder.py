"""The book's plots, seeded from the catalogue import's sources (apps/plots/seeding.py)."""

import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase

from apps.campaigns.models import CampaignType
from apps.plots.models import Plot, PlotAchievement, PlotScoringLine
from apps.plots.seeding import SeedResult, seed_book_plots

MARIENBURG = "Mutiny in Marienburg"
BORDER_TOWN = "Border Town Burning"
SEALED_CITY = "The Sealed City"
ANNUAL = "Marienburg Annual"
RUNGS = (5, 10, 15, 20, 25, 35, 40)  # every book plot's ladder: there is no 30
FROM_THE_START = {"purge-the-intruders": (0, *RUNGS)}  # the Sealed City prints a 0 rung, held from the start


def plot(**changes) -> dict:
    body = {
        "slug": "drowning-the-witch",
        "name": "Drowning the Witch",
        "setting": MARIENBURG,
        "summary": "",
        "variant_of": "",
        "no_alliance_with": [],
        "who_text": "Witch Hunters, Sisters of Sigmar.",
        "scoring": [
            {"points": 1, "text": "Playing a scenario."},
            {"points": None, "dice": "D3", "text": "A Chaos leader taken out of action."},
            {"points": -1, "text": "A lawman killed by the warband."},
        ],
        "achievements": [{"points": points, "name": f"Rung {points}", "text": "…"} for points in RUNGS],
    }
    return {**body, **changes}


class PlotSeederTests(TestCase):
    setting: CampaignType
    border_town: CampaignType
    sealed_city: CampaignType
    annual: CampaignType
    result: SeedResult

    @classmethod
    def setUpTestData(cls) -> None:
        cls.setting = CampaignType.objects.create(slug="mutiny-in-marienburg", name=MARIENBURG, grade="2b")
        cls.border_town = CampaignType.objects.create(slug="border-town-burning", name=BORDER_TOWN, grade="1c")
        cls.sealed_city = CampaignType.objects.create(slug="sealed-city", name=SEALED_CITY, grade="2b")
        cls.annual = CampaignType.objects.create(slug="marienburg-annual", name=ANNUAL, grade="2b")

    def seed(self, *plots: dict, wrapped: bool = False) -> None:
        with TemporaryDirectory() as folder:
            body = {"setting": MARIENBURG, "plots": list(plots)} if wrapped else list(plots)
            (Path(folder) / "setting.json").write_text(json.dumps(body), encoding="utf-8")
            self.result = seed_book_plots(Path(folder))

    def test_the_book_source_seeds_every_settings_plots_with_their_ladders(self):
        out = StringIO()
        call_command("seed_plots", stdout=out)
        plots = Plot.objects.filter(campaign__isnull=True)
        # the Sealed City's six ambitions joined as plots (21 Nov 2026), and the Marienburg Annual's Da Waaagh (23 Nov)
        self.assertEqual(plots.count(), 25)
        self.assertEqual(len({row.name for row in plots}), 25)  # every plot is distinctly named
        for row in plots:
            self.assertEqual(tuple(row.achievements.values_list("points", flat=True)), FROM_THE_START.get(row.slug, RUNGS))  # fmt: skip
        self.assertEqual(plots.filter(campaign_type=self.setting).count(), 10)
        self.assertEqual(plots.filter(campaign_type=self.border_town).count(), 8)
        self.assertEqual(plots.filter(campaign_type=self.sealed_city).count(), 6)
        self.assertEqual(plots.filter(campaign_type=self.annual).count(), 1)
        self.assertIn("Plots: 25", out.getvalue())
        self.assertIn("skipped: 0", out.getvalue())

    def test_border_town_burnings_variants_name_the_plot_they_are_a_variant_of(self):
        call_command("seed_plots", stdout=StringIO())
        variants = Plot.objects.filter(campaign__isnull=True).exclude(variant_of="")
        parents = dict(Plot.objects.filter(campaign__isnull=True).values_list("slug", "pk"))
        self.assertEqual(
            sorted(variants.values_list("slug", "variant_of")),
            [
                ("the-black-dwarfs", "the-lure-of-fortune"),
                ("the-strangest-tribes", "the-damned-shall-burn"),
            ],
        )
        for row in variants:
            self.assertIn(row.variant_of, parents)

    def test_border_town_burnings_alliance_bans_name_plots_of_the_same_setting(self):
        call_command("seed_plots", stdout=StringIO())
        slugs = set(Plot.objects.filter(campaign__isnull=True, campaign_type=self.border_town).values_list("slug", flat=True))  # fmt: skip
        banned = {
            row.slug: row.no_alliance_with
            for row in Plot.objects.filter(campaign__isnull=True, campaign_type=self.border_town)
            if row.no_alliance_with
        }
        self.assertEqual(len(banned), 4)
        for slug, others in banned.items():
            for other in others:
                self.assertIn(other, slugs)
                self.assertNotEqual(other, slug)

    def test_a_plot_keeps_its_scoring_lines_in_the_books_order_with_dice_and_negatives(self):
        self.seed(plot())
        lines = Plot.objects.get(slug="drowning-the-witch").scoring_lines.all()
        self.assertEqual([(line.position, line.points, line.dice) for line in lines], [(1, 1, ""), (2, None, "D3"), (3, -1, "")])  # fmt: skip

    def test_a_file_that_wraps_its_plots_in_an_object_seeds_the_same(self):
        self.seed(plot(), wrapped=True)
        self.assertEqual(Plot.objects.count(), 1)

    def test_a_second_run_rewrites_the_lines_rather_than_adding_them(self):
        self.seed(plot())
        self.seed(plot(scoring=[{"points": 3, "text": "A relic found."}], achievements=[{"points": 40, "name": "Won"}]))
        book = Plot.objects.get(slug="drowning-the-witch")
        self.assertEqual([(line.points, line.text) for line in book.scoring_lines.all()], [(3, "A relic found.")])
        self.assertEqual(PlotScoringLine.objects.count(), 1)
        self.assertEqual(PlotAchievement.objects.count(), 1)

    def test_a_plot_whose_setting_we_dont_hold_is_skipped_with_a_warning(self):
        self.seed(plot(), plot(slug="the-shards", name="The Shards", setting="Albion"))
        self.assertEqual([row.slug for row in Plot.objects.all()], ["drowning-the-witch"])
        self.assertEqual(len(self.result.skipped), 1)
        self.assertIn("The Shards", self.result.skipped[0])
        self.assertIn("'Albion' isn't seeded", self.result.skipped[0])
        self.assertEqual(self.result.plots, 1)

    def test_a_plot_the_sources_drop_is_archived_rather_than_deleted(self):
        self.seed(plot(), plot(slug="gaze-of-the-gods", name="Gaze of the Gods"))
        self.seed(plot())
        self.assertIsNotNone(Plot.objects.get(slug="gaze-of-the-gods").archived_at)
        self.assertEqual(self.result.archived, 1)

    def test_da_waaagh_scores_a_line_whose_text_beats_its_heading_and_carries_its_dice_signed(self):
        # the Marienburg Annual (p43): "+D3 Three Victories in a row" reads "it gains a CP", and the text wins
        call_command("seed_plots", stdout=StringIO())
        waaagh = Plot.objects.get(slug="da-waaagh", campaign__isnull=True)
        lines = list(waaagh.scoring_lines.values_list("points", "dice"))
        self.assertEqual(len(lines), 14)
        self.assertEqual(lines[7], (1, ""))
        self.assertIn((None, "-D3"), lines)
        self.assertEqual(
            sorted(points for points, _dice in lines if points is not None and points < 0), [-5, -1, -1, -1]
        )
