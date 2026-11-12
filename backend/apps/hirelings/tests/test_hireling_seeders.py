"""seed_hired_swords and seed_dramatis_personae on small files (the bestiary rewrite step 2).

Both read the same shape (apps/hirelings/seeding.py): a row's links resolve in the book, its own specials, spells
and special skills are created there under its type ("Hired Sword - <name>", "Dramatis Persona - <name>"), the kit
keeps its quantities and the costs their formulas, the race is matched by name and its text kept as the label. A
dramatis persona's terms add `stays` and `payment_note`. A run is all or nothing, and a second run updates in place.
The committed data's full run is in apps/items/tests/test_catalogue_characterisation_seeding.py.
"""

from django.core.management.base import CommandError
from django.test import TestCase

from apps.hirelings.fees import make_fee
from apps.hirelings.models import DramatisPersona, HiredSword
from apps.items.models import Item
from apps.items.tests.catalogue_support import STATS
from apps.items.tests.test_catalogue_characterisation_seeders import data_file, run
from apps.races.models import Race
from apps.skills.models import Skill, SkillGroup
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
# a hired sword mordheimer's list doesn't hold, naming who may hire him himself (the Corsairs' Specialists)
SPECIALIST = {
    "name": "Black Ark Specialist",
    **STATS,
    "hired_sword": {
        "hire_fee": {"kind": "special", "note": "Free before the battle; half the warband's earnings in tax after it."},
        "upkeep_cost": None,
        "rating": 15,
        "grade": "2b",
        "race": "Ogre",
        "unique_to": "Dark Elf Corsairs only",
        "warbands": [{"type": "dark-elf-corsairs"}],
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
    fear: Special

    @classmethod
    def setUpTestData(cls) -> None:
        cls.ogre_race = Race.objects.create(name="Ogre", **STATS)
        cls.sword = Item.objects.create(name="Sword", type="Weapon")
        cls.axe = Item.objects.create(name="Axe", type="Weapon")
        cls.sprint = Skill.objects.create(name="Sprint")
        cls.fear = Special.objects.create(name="Fear", type="Psychology")  # shared: seed_spells_and_special seeds it

    def test_a_hired_sword_is_seeded_with_its_links_kit_fees_race_and_note(self):
        with data_file([OGRE]) as path:
            output = run("seed_hired_swords", json_paths=[path])

        ogre = HiredSword.objects.get(name="Ogre Bodyguard", campaign__isnull=True)
        self.assertIn("Hired sword import complete. Created: 1, updated: 0.", output)
        self.assertEqual((ogre.armour_save, ogre.large, ogre.description), (5, True, "Big."))
        # a row's own gold and formula (no import list for him): the formula is the note
        self.assertEqual((ogre.hire_fee, ogre.rating, ogre.grade), (make_fee(gold=80, note="80+D6"), 25, "1a"))
        self.assertEqual(ogre.upkeep_fee, make_fee(note="1 piece of wyrdstone"))
        self.assertEqual((ogre.race_id, ogre.race_label), (self.ogre_race.id, "Ogre"))
        self.assertEqual(ogre.available_skill_types, ["Combat", "Hired Sword - Ogre Bodyguard"])
        own = SkillGroup.objects.get(name="Hired Sword - Ogre Bodyguard", campaign__isnull=True)
        self.assertEqual(list(own.skill_links.values_list("skill__name", flat=True)), ["Bully"])  # his own group
        self.assertTrue(own.for_everyone)
        self.assertEqual(list(ogre.item_links.order_by("item__name").values_list("item_id", "quantity")), [(self.axe.id, 1), (self.sword.id, 2)])  # fmt: skip
        self.assertEqual(list(ogre.skill_links.values_list("skill_id", flat=True)), [self.sprint.id])
        # his Fear is the shared special (William, 5 Nov 2026), not a copy of his own
        self.assertEqual(list(ogre.special_links.values_list("special_id", flat=True)), [self.fear.id])
        self.assertFalse(Special.objects.filter(type="Hired Sword - Ogre Bodyguard").exists())
        # the warband types aren't seeded: his own fees, everyone may hire him, and his "unique to" is the note
        self.assertEqual((ogre.for_everyone, ogre.hire_note, ogre.warband_links.count()), (True, "Mercenaries only", 0))

    def test_with_the_warband_types_seeded_the_import_says_who_may_hire_and_what_he_costs(self):
        # the items rebuild: mordheimer's list for the Ogre Bodyguard through the Resolver, its fees and its sentence
        run("seed_settings")
        run("seed_warband_types")
        with data_file([OGRE]) as path:
            run("seed_hired_swords", json_paths=[path])

        ogre = HiredSword.objects.get(name="Ogre Bodyguard", campaign__isnull=True)
        lines = list(ogre.warband_links.select_related("warband_type"))
        self.assertEqual((ogre.hire_fee, ogre.upkeep_fee), (make_fee(gold=80), make_fee(gold=30)))
        self.assertFalse(ogre.for_everyone)
        self.assertIn("Reiklanders", {line.warband_type.name for line in lines if line.warband_type})
        self.assertFalse(any(line.excluded for line in lines))
        self.assertEqual(ogre.hire_note, "Any warband except Skaven may hire an Ogre Bodyguard.")

    def test_a_hired_sword_mordheimer_lacks_says_who_may_hire_him_himself(self):
        # William, 11 Nov 2026: "why cant specialists just be hired swords that only that warband can hire?" — a row
        # the import's list lacks carries its own who-can lines, so it is not seeded for everyone
        run("seed_settings")
        run("seed_warband_types")
        with data_file([SPECIALIST]) as path:
            run("seed_hired_swords", json_paths=[path])

        row = HiredSword.objects.get(name="Black Ark Specialist", campaign__isnull=True)
        lines = row.warband_links.values_list("warband_type__slug", "warband_group_id", "excluded")
        self.assertFalse(row.for_everyone)
        self.assertEqual(list(lines), [("dark-elf-corsairs", None, False)])
        self.assertEqual(row.hire_note, "Dark Elf Corsairs only")  # his own sentence, as before
        self.assertEqual(row.hire_fee["kind"], "special")

    def test_a_row_whose_own_lines_only_exclude_stays_for_everyone(self):
        # Mutiny in Marienburg's Specialists: "any warband except Skaven" is everyone with one exclusion, as the
        # import reads mordheimer's excludedWarbands, so who-can says "not usually available" to the Skaven only
        run("seed_settings")
        run("seed_warband_types")
        terms = {
            "hire_cost": 95,
            "upkeep_cost": 40,
            "rating": 35,
            "grade": "2b",
            "race": "Ogre",
            "unique_to": "Any warband except Skaven",
            "warbands": [{"group": "skaven", "excluded": True}],
        }
        row = {**STATS, "name": "Ogre Treasure Hunter", "hired_sword": terms}
        with data_file([row]) as path:
            run("seed_hired_swords", json_paths=[path])

        hired = HiredSword.objects.get(name="Ogre Treasure Hunter", campaign__isnull=True)
        lines = hired.warband_links.values_list("warband_type_id", "warband_group__slug", "excluded")
        self.assertTrue(hired.for_everyone)
        self.assertEqual(list(lines), [(None, "skaven", True)])

    def test_a_second_run_updates_in_place_and_replaces_the_links(self):
        with data_file([OGRE]) as path:
            run("seed_hired_swords", json_paths=[path])
        first = HiredSword.objects.get()
        changed = {**OGRE, "equipment": ["Axe"], "hired_sword": {**OGRE["hired_sword"], "hire_cost": 90}}  # type: ignore[dict-item]

        with data_file([changed]) as path:
            output = run("seed_hired_swords", json_paths=[path])

        again = HiredSword.objects.get()
        self.assertIn("Created: 0, updated: 1.", output)
        self.assertEqual((again.id, again.hire_fee["gold"]), (first.id, 90))
        self.assertEqual(list(again.item_links.values_list("item_id", "quantity")), [(self.axe.id, 1)])

    def test_a_dramatis_persona_keeps_how_long_it_stays_what_it_is_paid_and_an_unmatched_race_as_text(self):
        with data_file([AENUR]) as path:
            output = run("seed_dramatis_personae", json_paths=[path])

        aenur = DramatisPersona.objects.get(name="Aenur")
        self.assertIn("Dramatis persona import complete. Created: 1, updated: 0.", output)
        self.assertEqual(
            (aenur.stays, aenur.payment_note, aenur.hire_fee["gold"]), ("one_battle", "25 gc or 1 shard", 25)
        )
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

    def test_the_imports_dramatis_personae_are_seeded_with_who_may_hire_them_and_their_special_fees(self):
        # mordheimer's and our own pages' dramatis personae, through the catalogue import (out/dramatis-personae.json)
        run("seed_settings")
        run("seed_warband_types")

        output = run("seed_dramatis_personae")

        self.assertIn("Created: 43, updated: 0.", output)
        aenur = DramatisPersona.objects.get(name="Aenur, the Sword of Twilight")
        self.assertEqual((aenur.hire_fee["gold"], aenur.stays, aenur.weapon_skill), (150, "one_battle", 8))
        self.assertFalse(aenur.for_everyone)
        self.assertIn("Reiklanders", {line.warband_type.name for line in aenur.warband_links.select_related("warband_type") if line.warband_type})  # fmt: skip
        self.assertEqual(aenur.hire_note, "Any warband except Skaven, Undead and the Possessed may hire Aenur.")
        nicodemus = DramatisPersona.objects.get(name="Nicodemus, the Cursed Pilgrim")
        wyrdstone = make_fee(resources=[("Wyrdstone", 1)])
        self.assertEqual((nicodemus.hire_fee, nicodemus.upkeep_fee), (wyrdstone, wyrdstone))  # paid in wyrdstone
        self.assertEqual(nicodemus.caster, "Wizard")
