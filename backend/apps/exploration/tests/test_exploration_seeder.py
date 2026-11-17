"""The book's exploration charts, seeded from the catalogue import's sources (apps/exploration/seeding.py)."""

import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase

from apps.campaigns.models import CampaignType
from apps.exploration.models import ExplorationChart, ExplorationPlace
from apps.exploration.seeding import SeedResult, seed_book_charts

MORDHEIM = "Mordheim 1a"


def chart(**changes) -> dict:
    body = {
        "slug": "mordheim",
        "name": "Exploration",
        "setting": MORDHEIM,
        "summary": "",
        "dice_per_hero": 1,
        "dice_for_win": 1,
        "max_dice": 10,
        "max_chosen": 6,
        "income": [{"max_total": 5, "amount": 1}, {"max_total": None, "amount": 7}],
        "income_note": "",
        "places": [{"count": 2, "face": 1, "name": "Well", "rules": "A Toughness test."}],
    }
    return {**body, **changes}


class ExplorationSeederTests(TestCase):
    setting: CampaignType
    result: SeedResult

    @classmethod
    def setUpTestData(cls) -> None:
        cls.setting = CampaignType.objects.create(slug="mordheim", name=MORDHEIM, grade="1a", always_on=True)

    def seed(self, *charts: dict) -> None:
        with TemporaryDirectory() as folder:
            for entry in charts:
                (Path(folder) / f"{entry['slug']}.json").write_text(json.dumps(entry), encoding="utf-8")
            self.result = seed_book_charts(Path(folder))

    def skips(self, out: StringIO) -> list[str]:
        return [line for line in out.getvalue().splitlines() if "is skipped" in line]

    def test_the_book_source_seeds_one_chart_of_thirty_places(self):
        out = StringIO()
        call_command("seed_exploration_charts", stdout=out)
        charts = ExplorationChart.objects.filter(campaign__isnull=True)
        self.assertEqual(charts.count(), 1)
        book = charts.get(slug="mordheim")
        self.assertEqual(book.campaign_type_id, self.setting.pk)
        self.assertEqual(book.places.count(), 30)
        self.assertEqual({place.count for place in book.places.all()}, {2, 3, 4, 5, 6})
        self.assertEqual(book.income[-1], {"max_total": None, "amount": 7})
        self.assertEqual(book.places.get(count=2, face=1).name, "Well")
        self.assertIn("Charts: 1, places: 30", out.getvalue())

    def test_a_second_run_rewrites_the_places_rather_than_adding_them(self):
        self.seed(chart())
        self.seed(chart(places=[{"count": 3, "face": 2, "name": "Smithy", "rules": ""}]))
        book = ExplorationChart.objects.get(slug="mordheim")
        self.assertEqual([(place.count, place.name) for place in book.places.all()], [(3, "Smithy")])
        self.assertEqual(ExplorationPlace.objects.count(), 1)

    def test_a_chart_that_pays_no_shards_keeps_its_empty_income_and_its_note(self):
        # Albion's chart gives a supply source, not wyrdstone: an empty income is a statement, not missing data
        self.seed(chart(slug="albion", income=[], income_note="2-5 Camping Site."))
        book = ExplorationChart.objects.get(slug="albion")
        self.assertEqual((book.income, book.income_note), ([], "2-5 Camping Site."))

    def test_a_chart_whose_setting_we_dont_hold_is_skipped_with_a_warning(self):
        self.seed(chart(), chart(slug="albion", name="Albion exploration", setting="Albion"))
        self.assertEqual([entry.slug for entry in ExplorationChart.objects.all()], ["mordheim"])
        self.assertEqual(len(self.result.skipped), 1)
        self.assertIn("Albion exploration", self.result.skipped[0])
        self.assertIn("'Albion' isn't seeded", self.result.skipped[0])
        self.assertEqual(self.result.charts, 1)

    def test_the_sources_name_karak_eight_peaks_alone_among_settings_we_dont_hold(self):
        # the real sources against the real settings: every chart's setting is seeded but Karak Eight Peaks', which
        # William took out (catalogue_import/overrides.json, 11 Nov 2026)
        call_command("seed_settings", stdout=StringIO())
        out = StringIO()
        call_command("seed_exploration_charts", stdout=out)
        self.assertEqual(len(self.skips(out)), 1)
        self.assertIn("the setting 'Karak Eight Peaks' isn't seeded; the chart is skipped.", self.skips(out)[0])
        self.assertFalse(ExplorationChart.objects.filter(slug="karak-eight-peaks").exists())
        self.assertIn("skipped: 1", out.getvalue())

    def test_albions_chart_seeds_with_its_places_and_its_empty_income(self):
        # its dice total gives a named Supply Source, not shards: the empty income is the statement, and the whole
        # table is the note the post-game shows (the Albion setting, 17 Nov 2026)
        call_command("seed_settings", stdout=StringIO())
        call_command("seed_exploration_charts", stdout=StringIO())
        albion = ExplorationChart.objects.get(slug="albion", campaign__isnull=True)
        self.assertEqual(albion.campaign_type_id, CampaignType.objects.get(slug="albion", name="Albion").pk)
        self.assertEqual(albion.places.count(), 30)
        self.assertEqual({place.count for place in albion.places.all()}, {2, 3, 4, 5, 6})
        self.assertEqual(albion.income, [])
        self.assertIn("Supply Source table", albion.income_note)
        self.assertIsNone(albion.archived_at)

    def test_a_chart_the_sources_drop_is_archived_rather_than_deleted(self):
        self.seed(chart(), chart(slug="karak", name="Karak Azgal exploration"))
        self.seed(chart())
        dropped = ExplorationChart.objects.get(slug="karak")
        self.assertIsNotNone(dropped.archived_at)
        self.assertEqual(self.result.archived, 1)
