"""Mutiny in Marienburg's prayer lists (the Miracle Workers chapter, William, 26 Nov 2026: "get those prayers in from
the priest section in MiM"): each a book lore of six on its D6 table, in that setting. Its Taal and Ulric lists differ
from ours, so they stand apart under the book's name; Sigmar's it only points to, so ours serves."""

import json
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from apps.campaigns.models import CampaignType
from apps.spells.models import Spell

SPELLS = Path(__file__).resolve().parents[1] / "data" / "spells.json"
MIM_LISTS = (
    "Prayers of Manann",
    "Prayers of Morr",
    "Prayers of Myrmidia",
    "Prayers of Ranald",
    "Prayers of Shallya",
    "Prayers of Taal (Mutiny in Marienburg)",
    "Prayers of Ulric (Mutiny in Marienburg)",
    "Prayers of Verena",
)


def book_rows() -> list[dict]:
    rows: list[dict] = json.loads(SPELLS.read_text(encoding="utf-8"))
    return rows


class MimPrayerDataTests(SimpleTestCase):
    def test_each_list_is_six_prayers_on_the_d6_in_mutiny_in_marienburg(self) -> None:
        rows = book_rows()
        for lore in MIM_LISTS:
            prayers = [row for row in rows if row["type"] == lore]
            with self.subTest(lore=lore):
                self.assertEqual(sorted(row["roll"] for row in prayers), [1, 2, 3, 4, 5, 6])
                self.assertEqual({row["setting"] for row in prayers}, {"mutiny-in-marienburg"})
                self.assertTrue(all(row["dc"].isdigit() and row["description"] for row in prayers))

    def test_its_taal_list_is_ours_but_for_tanglefoot_and_sigmars_is_not_printed_again(self) -> None:
        rows = book_rows()
        ours = {row["name"]: row for row in rows if row["type"] == "Prayers of Taal"}
        mim = {row["name"]: row for row in rows if row["type"] == "Prayers of Taal (Mutiny in Marienburg)"}
        self.assertEqual(set(mim), set(ours))
        differ = [name for name in mim if mim[name]["description"] != ours[name]["description"]]
        self.assertEqual(differ, ["Tanglefoot"])
        self.assertIn("friendly Taalites", mim["Tanglefoot"]["description"])
        self.assertFalse([row for row in rows if row["type"].startswith("Prayers of Sigmar (")])


class MimPrayerSeedTests(TestCase):
    def test_the_seeder_puts_the_lists_in_mutiny_in_marienburg(self) -> None:
        mim = CampaignType.objects.create(slug="mutiny-in-marienburg", name="Mutiny in Marienburg")
        call_command("seed_spells_and_special", stdout=StringIO())
        verena = Spell.objects.filter(campaign=None, type="Prayers of Verena")
        self.assertEqual(verena.count(), 6)
        self.assertEqual(set(verena.values_list("campaign_type_id", flat=True)), {mim.id})
        trial = verena.get(name="Trial by Fire")
        self.assertEqual((trial.dc, trial.roll), ("10", 6))
