"""seed_scenarios: the import's 67 scenarios upserted by slug, Mordheim 1a's sixteen at their weights, a book
scenario the import drops archived, and a table naming a setting we don't hold skipped."""

import io
import json
import tempfile
from decimal import Decimal
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from apps.campaigns.models import CampaignType
from apps.scenarios.models import Scenario, SettingScenario
from apps.scenarios.seeding import SCENARIO_OUT
from apps.scenarios.testing import MORDHEIM


class SeederTests(TestCase):
    def setUp(self) -> None:
        self.mordheim, _ = CampaignType.objects.get_or_create(slug=MORDHEIM["slug"], defaults=MORDHEIM)

    def seed(self, source: Path | None = None) -> str:
        out = io.StringIO()
        call_command("seed_scenarios", *(["--source", str(source)] if source else []), stdout=out)
        return out.getvalue()

    def test_the_import_seeds_seventy_scenarios_and_mordheims_sixteen(self) -> None:
        said = self.seed()

        self.assertIn("Scenarios: 67, setting scenarios: 16", said)
        hunt = Scenario.objects.get(slug="wyrdstone-hunt", campaign=None)
        self.assertEqual((hunt.name, hunt.number, hunt.players), ("Wyrdstone Hunt", "3", "1v1"))
        self.assertEqual(hunt.sections[0]["title"], "Terrain")
        weights = dict(SettingScenario.objects.filter(setting=self.mordheim).values_list("scenario__slug", "weight"))
        self.assertEqual((len(weights), weights["skirmish"], weights["ambush-tc5"]), (16, Decimal(6), Decimal(9)))

    def test_a_second_run_upserts_and_archives_what_the_import_drops(self) -> None:
        self.seed()
        data = json.loads(SCENARIO_OUT.read_text(encoding="utf-8"))
        data["scenarios"] = [entry for entry in data["scenarios"] if entry["slug"] != "raid"]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "scenarios.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            said = self.seed(path)

        self.assertIn("archived (no longer in the import): 1", said)
        self.assertEqual(Scenario.objects.filter(campaign=None).count(), 67)
        self.assertIsNotNone(Scenario.objects.get(slug="raid").archived_at)

    def test_a_table_for_a_setting_we_dont_hold_is_skipped(self) -> None:
        self.mordheim.delete()
        said = self.seed()
        self.assertIn("isn't seeded; its scenarios are skipped", said)
        self.assertFalse(SettingScenario.objects.exists())
