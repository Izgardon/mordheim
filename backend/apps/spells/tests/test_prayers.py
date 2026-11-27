"""Prayers (William, 26 Nov 2026). Mutiny in Marienburg's prayer lists (the Miracle Workers chapter: "get those
prayers in from the priest section in MiM"): each a book lore of six on its D6 table, in that setting. Its Ulric list
differs from ours, so it stands apart under the book's name; its Taal list is ours (William, 26 Nov 2026: one list,
Tanglefoot worded for any warband); Sigmar's it only points to, so ours serves.

A lore is a prayer list or spells: the book's prayer lists are named in data/prayer-lores.json and every book spell is
marked by its lore (`is_prayer`), a campaign's own spell taking its lore's answer unless its write says."""

import json
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from apps.campaigns.models import CampaignType
from apps.core.book_lookups import BookLookups
from apps.spells.models import Spell
from apps.spells.prayers import PRAYER_LORES_PATH, is_prayer_lore
from apps.warbands.tests.roster_support import RosterTestCase
from apps.warbands.units.catalogue import SpellDetailSerializer

SPELLS = Path(__file__).resolve().parents[1] / "data" / "spells.json"
HIRED_SWORDS = Path(__file__).resolve().parents[2] / "hirelings" / "data" / "hired-swords.json"
MIM_LISTS = (
    "Prayers of Manann",
    "Prayers of Morr",
    "Prayers of Myrmidia",
    "Prayers of Ranald",
    "Prayers of Shallya",
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

    def test_its_taal_list_is_ours_tanglefoot_worded_for_any_warband_and_sigmars_is_not_printed_again(self) -> None:
        rows = book_rows()
        taal = [row for row in rows if row["type"].startswith("Prayers of Taal")]
        self.assertEqual({row["type"] for row in taal}, {"Prayers of Taal"})
        self.assertEqual(sorted(row["roll"] for row in taal), [1, 2, 3, 4, 5, 6])
        tanglefoot = next(row["description"] for row in taal if row["name"] == "Tanglefoot")
        self.assertIn("friendly models who worship Taal", tanglefoot)
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


class PrayerLoreTests(SimpleTestCase):
    def test_every_prayer_list_named_is_a_lore_we_hold(self) -> None:
        lores = {row["type"] for row in book_rows()}
        swords = json.loads(HIRED_SWORDS.read_text(encoding="utf-8"))
        lores |= {
            sword.get("spell_lore") or f"Hired Sword - {sword['name']}"
            for sword in swords
            if sword.get("spells") or sword.get("lore_spells")
        }
        named = json.loads(PRAYER_LORES_PATH.read_text(encoding="utf-8"))
        self.assertEqual([name for name in named if name not in lores], [])
        self.assertTrue(set(MIM_LISTS) <= set(named))

    def test_williams_spell_lists_are_not_prayers(self) -> None:
        for lore in (
            "Prayers of Sigmar",
            "Funerary Rites",
            "Prophetic Rants",
            "Blessings of the Mare",
            " lady's prayers",
        ):
            self.assertTrue(is_prayer_lore(lore), lore)
        spells = ("Rituals of Hashut", "Lore of Light", "Light and Silence", "Werewolf Runes", "Lizardmen Magic")
        for lore in (*spells, "Laws of Construction", "Commands (Mazzalupo)", "Lesser Magic"):
            self.assertFalse(is_prayer_lore(lore), lore)


class PrayerMarkTests(TestCase):
    def test_the_seeder_marks_each_book_spell_by_its_lore(self) -> None:
        stale = Spell.objects.create(name="Wrongly marked", type="Rituals of Hashut", is_prayer=True)
        call_command("seed_spells_and_special", stdout=StringIO())
        book = Spell.objects.filter(campaign=None)
        self.assertTrue(book.filter(type="Prayers of Manann").exists())
        self.assertFalse(book.filter(type="Prayers of Manann", is_prayer=False).exists())
        self.assertFalse(book.filter(type="Lore of Light", is_prayer=True).exists())
        stale.refresh_from_db()
        self.assertFalse(stale.is_prayer)

    def test_a_hired_swords_own_spell_is_made_as_his_lore_is(self) -> None:
        lookups = BookLookups()
        rite = lookups.spell(
            {"name": "5 - Presence of Morr", "description": "Difficulty: 7"},
            "Priest of Morr (Mousillon)",
            "Rituals of Morr",
        )
        mage = lookups.spell({"name": "1 - Shade Step", "description": "Difficulty: 7"}, "Dark Mage")
        assert rite is not None and mage is not None
        self.assertEqual((rite.type, rite.is_prayer), ("Rituals of Morr", True))
        self.assertFalse(mage.is_prayer)


class CampaignPrayerTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.campaign_owner)

    def _write(self, **body: object) -> dict:
        made = self.client.post("/api/spells/", {"campaign_id": self.campaign.id, "dc": "7", **body}, format="json")
        self.assertEqual(made.status_code, 201, made.data)
        found: dict = made.json()
        return found

    def test_a_custom_spell_takes_its_lores_answer_unless_it_says(self) -> None:
        Spell.objects.create(name="Healing Hand", type="Prayers of Sigmar", is_prayer=True)
        self.assertTrue(self._write(name="Sigmar's Wrath", type="prayers of sigmar")["is_prayer"])
        self.assertFalse(self._write(name="Hex", type="House lore")["is_prayer"])
        self.assertTrue(self._write(name="Grungni's Gift", type="Prayers of Grungni", is_prayer=True)["is_prayer"])
        self.assertTrue(self._write(name="Grungni's Hammer", type="Prayers of Grungni")["is_prayer"])

        listed = self.client.get(f"/api/spells/?campaign_id={self.campaign.id}").json()
        self.assertTrue({row["name"]: row["is_prayer"] for row in listed}["Healing Hand"])

    def test_an_edit_moving_a_spell_to_another_lore_takes_that_lores_answer(self) -> None:
        Spell.objects.create(name="Healing Hand", type="Prayers of Sigmar", is_prayer=True)
        made = self._write(name="Hex", type="House lore")
        moved = self.client.patch(
            f"/api/spells/{made['id']}/", {"campaign_id": self.campaign.id, "type": "Prayers of Sigmar"}, format="json"
        )
        self.assertEqual(moved.status_code, 200, moved.data)
        self.assertTrue(moved.json()["is_prayer"])
        renamed = self.client.patch(
            f"/api/spells/{made['id']}/", {"campaign_id": self.campaign.id, "name": "Blessing"}, format="json"
        )
        self.assertTrue(renamed.json()["is_prayer"])

    def test_a_version_keeps_the_kind_it_is_set_to(self) -> None:
        book = Spell.objects.create(name="Healing Hand", type="Prayers of Sigmar", is_prayer=True)
        edited = self.client.patch(
            f"/api/spells/{book.id}/", {"campaign_id": self.campaign.id, "is_prayer": False}, format="json"
        )
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertFalse(Spell.objects.get(campaign=self.campaign, replaces=book).is_prayer)
        book.refresh_from_db()
        self.assertTrue(book.is_prayer)

    def test_a_units_spell_says_whether_it_is_a_prayer(self) -> None:
        prayer = Spell.objects.create(name="Soulfire", type="Prayers of Sigmar", is_prayer=True)
        self.assertTrue(SpellDetailSerializer(prayer).data["is_prayer"])
        self.assertFalse(SpellDetailSerializer(self.spells[0]).data["is_prayer"])
