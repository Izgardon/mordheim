"""seed_hired_swords and seed_dramatis_personae on small files (the bestiary rewrite step 2).

Both read the same shape (apps/hirelings/seeding.py): a row's links resolve in the book, its own specials, spells
and special skills are created there under its type ("Hired Sword - <name>", "Dramatis Persona - <name>"), the kit
keeps its quantities and the costs their formulas, the race is matched by name and its text kept as the label. A
dramatis persona's terms add `stays` and `payment_note`. A run is all or nothing, and a second run updates in place.
The committed data's full run is in apps/items/tests/test_catalogue_characterisation_seeding.py.
"""

from django.core.management.base import CommandError
from django.test import TestCase

from apps.hirelings.models import DramatisPersona, HiredSword
from apps.items.models import Item
from apps.items.tests.catalogue_support import STATS
from apps.items.tests.test_catalogue_characterisation_seeders import data_file, run
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special

OGRE = {
    "name": "Ogre Bodyguard",
    "description": "Big.",
    **STATS,
    "armour_save": "5+",
    "large": True,
    "skills": ["Sprint"],
    "specials": [{"name": "Fear", "description": "Causes fear."}],
    "equipment": [{"item": "Sword", "quantity": 2}, "Axe"],
    "hired_sword": {
        "hire_cost": 80,
        "hire_cost_expression": "80+D6",
        "upkeep_cost": None,
        "upkeep_cost_expression": "1 piece of wyrdstone",
        "rating": 25,
        "grade": "1a",
        "race": "Ogre",
        "unique_to": "Mercenaries only",
        "available_skill_types": ["Combat"],
        "available_special_skills": [{"name": "Bully", "description": "Shoves."}],
    },
}
AENUR = {
    "name": "Aenur",
    **STATS,
    "dramatis_persona": {"hire_cost": 25, "race": "Elf", "stays": "one_battle", "payment_note": "25 gc or 1 shard"},
}


class HirelingSeederTests(TestCase):
    ogre_race: Race
    sword: Item
    axe: Item
    sprint: Skill

    @classmethod
    def setUpTestData(cls) -> None:
        cls.ogre_race = Race.objects.create(name="Ogre", **STATS)
        cls.sword = Item.objects.create(name="Sword", type="Weapon")
        cls.axe = Item.objects.create(name="Axe", type="Weapon")
        cls.sprint = Skill.objects.create(name="Sprint", type="Speed")

    def test_a_hired_sword_is_seeded_with_its_links_kit_formulas_race_and_restrictions(self):
        with data_file([OGRE]) as path:
            output = run("seed_hired_swords", json_paths=[path])

        ogre = HiredSword.objects.get(name="Ogre Bodyguard", campaign__isnull=True)
        self.assertIn("Hired sword import complete. Created: 1, updated: 0.", output)
        self.assertEqual((ogre.armour_save, ogre.large, ogre.description), (5, True, "Big."))
        self.assertEqual((ogre.hire_cost, ogre.hire_cost_expression, ogre.rating, ogre.grade), (80, "80+D6", 25, "1a"))
        self.assertEqual((ogre.upkeep_cost, ogre.upkeep_cost_expression), (None, "1 piece of wyrdstone"))
        self.assertEqual((ogre.race_id, ogre.race_label), (self.ogre_race.id, "Ogre"))
        self.assertEqual(ogre.available_skill_types, ["Combat", "Hired Sword - Ogre Bodyguard"])
        self.assertEqual(Skill.objects.get(name="Bully").type, "Hired Sword - Ogre Bodyguard")
        self.assertEqual(list(ogre.item_links.order_by("item__name").values_list("item_id", "quantity")), [(self.axe.id, 1), (self.sword.id, 2)])  # fmt: skip
        self.assertEqual(list(ogre.skill_links.values_list("skill_id", flat=True)), [self.sprint.id])
        fear = Special.objects.get(name="Fear")
        self.assertEqual((fear.type, list(ogre.special_links.values_list("special_id", flat=True))), ("Hired Sword - Ogre Bodyguard", [fear.id]))  # fmt: skip
        mercenaries = Restriction.objects.get(restriction="Mercenaries")
        self.assertEqual(list(ogre.restriction_links.values_list("restriction_id", flat=True)), [mercenaries.id])

    def test_a_second_run_updates_in_place_and_replaces_the_links(self):
        with data_file([OGRE]) as path:
            run("seed_hired_swords", json_paths=[path])
        first = HiredSword.objects.get()
        changed = {**OGRE, "equipment": ["Axe"], "hired_sword": {**OGRE["hired_sword"], "hire_cost": 90}}  # type: ignore[dict-item]

        with data_file([changed]) as path:
            output = run("seed_hired_swords", json_paths=[path])

        again = HiredSword.objects.get()
        self.assertIn("Created: 0, updated: 1.", output)
        self.assertEqual((again.id, again.hire_cost), (first.id, 90))
        self.assertEqual(list(again.item_links.values_list("item_id", "quantity")), [(self.axe.id, 1)])

    def test_a_dramatis_persona_keeps_how_long_it_stays_what_it_is_paid_and_an_unmatched_race_as_text(self):
        with data_file([AENUR]) as path:
            output = run("seed_dramatis_personae", json_paths=[path])

        aenur = DramatisPersona.objects.get(name="Aenur")
        self.assertIn("Dramatis persona import complete. Created: 1, updated: 0.", output)
        self.assertEqual((aenur.stays, aenur.payment_note, aenur.hire_cost), ("one_battle", "25 gc or 1 shard", 25))
        self.assertEqual((aenur.race_id, aenur.race_label), (None, "Elf"))
        self.assertFalse(HiredSword.objects.exists())

    def test_a_bad_stays_or_stat_stops_the_run_and_keeps_nothing(self):
        bad_stays = {**AENUR, "dramatis_persona": {"stays": "forever"}}
        bad_stat = {**OGRE, "name": "Second", "movement": "fast"}
        cases = (("seed_dramatis_personae", [AENUR, bad_stays], "stays is 'forever'"), ("seed_hired_swords", [OGRE, bad_stat], "movement is 'fast'"))  # fmt: skip
        for command, rows, message in cases:
            with self.subTest(command=command), data_file(rows) as path:
                with self.assertRaisesMessage(CommandError, message):
                    run(command, json_paths=[path])
        self.assertEqual((HiredSword.objects.count(), DramatisPersona.objects.count()), (0, 0))

    def test_the_committed_dramatis_personae_file_is_empty_until_they_are_scraped(self):
        output = run("seed_dramatis_personae")

        self.assertIn("Created: 0, updated: 0.", output)
        self.assertFalse(DramatisPersona.objects.exists())
