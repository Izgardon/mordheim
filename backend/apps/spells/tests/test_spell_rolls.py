"""A lore has one spell on each roll (William, 2 Nov 2026; spells/rolls.py).

The book's seeders keep the first spell on each roll and give a later one none. In a campaign, a custom spell or a
version whose roll another spell of its lore holds there (the book's it hasn't replaced or removed, its own that aren't
archived) is saved with no roll, and the answer warns: a guide, not a gatekeeper.
"""

import json
import tempfile
from io import StringIO
from pathlib import Path
from typing import Any
from unittest import mock

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.core.book_lookups import BookLookups
from apps.core.models import CatalogueRemoval
from apps.spells.models import Spell
from apps.spells.rolls import first_on_each_roll
from apps.warbands.tests.roster_support import RosterTestCase


class BookRollTests(TestCase):
    def test_a_lore_keeps_the_first_spell_on_each_roll(self):
        entries: list[dict[str, Any]] = [
            {"name": "Deathly Visage", "type": "Necromancy", "roll": 6},
            {"name": "Living Horror", "type": " necromancy ", "roll": 6},
            {"name": "Doombolt", "type": "Dark Elf Magic", "roll": 6},
            {"name": "Spell of Awakening", "type": "Necromancy", "roll": None},
        ]
        kept, cleared = first_on_each_roll(entries)
        self.assertEqual([entry["roll"] for entry in kept], [6, None, 6, None])
        self.assertEqual(len(cleared), 1)
        self.assertIn("Living Horror", cleared[0])

    def test_the_seeder_saves_a_later_spell_on_a_taken_roll_with_none(self):
        rows = [
            {"name": "Deathly Visage", "type": "Restless Dead", "dc": "6", "roll": 6, "description": "Fear."},
            {"name": "Living Horror", "type": "Restless Dead", "dc": "8", "roll": 6, "description": "Horror."},
        ]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "spells.json"
            path.write_text(json.dumps(rows), encoding="utf-8")
            target = "apps.spells.management.commands.seed_spells_and_special.SPELLS_JSON_PATH"
            out = StringIO()
            with mock.patch(target, path):
                call_command("seed_spells_and_special", stdout=out)
        rolls = dict(Spell.objects.filter(type="Restless Dead").values_list("name", "roll"))
        self.assertEqual(rolls, {"Deathly Visage": 6, "Living Horror": None})
        self.assertIn("Living Horror", out.getvalue())

    def test_the_book_data_has_one_spell_on_each_roll_of_a_lore(self):
        call_command("seed_spells_and_special", stdout=StringIO())
        rolls = list(Spell.objects.filter(campaign=None, roll__isnull=False).values_list("type", "roll"))
        self.assertEqual(len(rolls), len(set(rolls)))
        # the Restless Dead's Living Horror; the Night Haint's Necromancy has one of its own, on a 6
        self.assertIsNone(Spell.objects.get(name="Living Horror", type="Necromancy (Restless Dead)").roll)

    def test_a_hired_swords_own_spell_on_a_taken_roll_has_none(self):
        lookups = BookLookups("Hired Sword")
        first = lookups.spell("1 - Banishment", "Dark Mage")
        second = lookups.spell({"name": "1 - Second Sight", "description": "Difficulty 7"}, "Dark Mage")
        assert first is not None and second is not None
        self.assertEqual((first.roll, second.roll, second.dc), (1, None, "7"))
        self.assertTrue(any("Second Sight" in line for line in lookups.warnings))


class CampaignRollTests(RosterTestCase):
    fires: Spell
    flight: Spell

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.fires = Spell.objects.create(name="Fires of U'Zhul", type="Lesser Magic", dc="7", roll=1)
        cls.flight = Spell.objects.create(name="Flight of Zimmeran", type="Lesser Magic", dc="7", roll=2)

    def setUp(self) -> None:
        self.client.force_authenticate(user=self.campaign_owner)

    def create(self, **fields: Any) -> Any:
        body = {"campaign_id": self.campaign.id, "name": "Ember", "type": "Lesser Magic", "description": "Hot."}
        response = self.client.post("/api/spells/", {**body, **fields}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.json()

    def edit(self, spell: Spell, **fields: Any) -> Any:
        body = {"campaign_id": self.campaign.id, **fields}
        response = self.client.patch(f"/api/spells/{spell.id}/", body, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return response.json()

    def test_a_custom_spell_on_a_free_roll_keeps_it(self):
        answer = self.create(roll=3)
        self.assertEqual(answer["roll"], 3)
        self.assertNotIn("warnings", answer)

    def test_a_custom_spell_on_a_taken_roll_is_saved_with_none_and_a_warning(self):
        answer = self.create(roll=1, type=" lesser magic ")
        self.assertIsNone(answer["roll"])
        self.assertIsNone(Spell.objects.get(pk=answer["id"]).roll)
        warning = "Fires of U'Zhul already has the roll of 1 in Lesser Magic: saved with no roll"
        self.assertEqual(answer["warnings"], [warning])

    def test_another_lore_or_another_campaigns_spell_takes_nothing(self):
        Spell.objects.create(name="Elsewhere", type="Chaos Rituals", roll=4, campaign_id=self.foreign_race.campaign_id)
        self.assertEqual(self.create(roll=4)["roll"], 4)
        self.assertEqual(self.create(name="Hex", type="Chaos Rituals", roll=4)["roll"], 4)

    def test_a_removed_book_spell_and_an_archived_own_spell_free_their_rolls(self):
        CatalogueRemoval.objects.create(campaign=self.campaign, kind="spells", entry_id=self.fires.id)
        Spell.objects.create(
            name="Old", type="Lesser Magic", roll=2, campaign=self.campaign, archived_at=timezone.now()
        )
        self.assertEqual(self.create(roll=1)["roll"], 1)
        self.flight.delete()
        self.assertEqual(self.create(name="Other", roll=2)["roll"], 2)

    def test_editing_a_book_spell_keeps_its_own_roll(self):
        answer = self.edit(self.fires, description="Hotter.", roll=1)
        self.assertEqual((answer["roll"], answer["description"]), (1, "Hotter."))
        self.assertNotIn("warnings", answer)

    def test_an_edit_onto_a_taken_roll_is_saved_with_none_and_a_warning(self):
        version = self.edit(self.fires, roll=2)
        self.assertIsNone(version["roll"])
        self.assertIn("Flight of Zimmeran already has the roll of 2", version["warnings"][0])
        own = Spell.objects.create(name="Mine", type="Other Lore", roll=2, campaign=self.campaign)
        moved = self.edit(own, type="Lesser Magic")
        self.assertIsNone(moved["roll"])
        self.assertEqual(len(moved["warnings"]), 1)

    def test_a_lists_rows_carry_no_warnings(self):
        self.create(roll=1)
        rows = self.client.get(f"/api/spells/?campaign_id={self.campaign.id}").json()
        self.assertFalse(any("warnings" in row for row in rows))
