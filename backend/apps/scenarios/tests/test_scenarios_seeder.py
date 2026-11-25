"""seed_scenarios: the import's 194 scenarios upserted by slug, Mordheim 1a's sixteen and the other settings' at their
weights, a book scenario the import drops archived, and a table naming a setting we don't hold skipped."""

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

    def test_the_import_seeds_every_scenario_and_mordheims_sixteen(self) -> None:
        said = self.seed()

        self.assertIn("Scenarios: 194, setting scenarios: 16", said)  # the settings not seeded here are skipped
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
        self.assertEqual(Scenario.objects.filter(campaign=None).count(), 194)
        self.assertIsNotNone(Scenario.objects.get(slug="raid").archived_at)

    def test_a_table_for_a_setting_we_dont_hold_is_skipped(self) -> None:
        self.mordheim.delete()
        said = self.seed()
        self.assertIn("isn't seeded; its scenarios are skipped", said)
        self.assertFalse(SettingScenario.objects.exists())

    def test_each_setting_seeded_adds_its_own_at_their_weights(self) -> None:
        settings = {
            name: CampaignType.objects.create(slug=slug, name=name, grade="2b")
            for slug, name in (("sartosa", "Sartosa"), ("border-town-burning", "Border Town Burning"))
        }
        self.seed()

        def weights(name: str) -> dict[str, Decimal]:
            rows = SettingScenario.objects.filter(setting=settings[name]).values_list("scenario__slug", "weight")
            return dict(rows)

        sartosa, burning = weights("Sartosa"), weights("Border Town Burning")
        self.assertEqual(len(sartosa), 32)
        self.assertEqual(sartosa["heavy-load-wyrdstone-hunt"], Decimal("2.67"))  # 4 in 36 for a 5, then 1-4 on a D6
        self.assertEqual(sartosa["down-at-the-docks"], Decimal(0))  # recommended, never drawn
        self.assertEqual((len(burning), burning["tainted-copse"], burning["siege"]), (17, Decimal(6), Decimal(0)))
        drink = Scenario.objects.get(slug="in-the-drink", campaign=None)
        self.assertEqual(drink.sections[0]["title"], "In the Drink! (Sartosa)")
        self.assertEqual(drink.sections[1:], Scenario.objects.get(slug="street-fight", campaign=None).sections)
