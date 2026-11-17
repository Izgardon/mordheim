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
RUNGS = (5, 10, 15, 20, 25, 35, 40)  # every book plot's ladder: there is no 30


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
    result: SeedResult

    @classmethod
    def setUpTestData(cls) -> None:
        cls.setting = CampaignType.objects.create(slug="mutiny-in-marienburg", name=MARIENBURG, grade="2b")

    def seed(self, *plots: dict, wrapped: bool = False) -> None:
        with TemporaryDirectory() as folder:
            body = {"setting": MARIENBURG, "plots": list(plots)} if wrapped else list(plots)
            (Path(folder) / "setting.json").write_text(json.dumps(body), encoding="utf-8")
            self.result = seed_book_plots(Path(folder))

    def test_the_book_source_seeds_marienburgs_ten_plots_with_their_ladders(self):
        out = StringIO()
        call_command("seed_plots", stdout=out)
        plots = Plot.objects.filter(campaign__isnull=True)
        self.assertEqual(plots.count(), 10)
        self.assertEqual(len({row.name for row in plots}), 10)  # every plot is distinctly named
        for row in plots:
            self.assertEqual(row.campaign_type_id, self.setting.pk)
            self.assertEqual(tuple(row.achievements.values_list("points", flat=True)), RUNGS)
        self.assertIn("Plots: 10", out.getvalue())

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
        self.seed(plot(), plot(slug="the-shards", name="The Shards", setting="Border Town Burning"))
        self.assertEqual([row.slug for row in Plot.objects.all()], ["drowning-the-witch"])
        self.assertEqual(len(self.result.skipped), 1)
        self.assertIn("The Shards", self.result.skipped[0])
        self.assertIn("'Border Town Burning' isn't seeded", self.result.skipped[0])
        self.assertEqual(self.result.plots, 1)

    def test_a_plot_the_sources_drop_is_archived_rather_than_deleted(self):
        self.seed(plot(), plot(slug="gaze-of-the-gods", name="Gaze of the Gods"))
        self.seed(plot())
        self.assertIsNotNone(Plot.objects.get(slug="gaze-of-the-gods").archived_at)
        self.assertEqual(self.result.archived, 1)
