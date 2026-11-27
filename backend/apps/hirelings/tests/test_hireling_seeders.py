"""seed_hired_swords and seed_dramatis_personae on small files (the bestiary rewrite step 2).

Both read the same shape (apps/hirelings/seeding.py): a row's links resolve in the book, its own specials, spells
and special skills are created there under its type ("Hired Sword - <name>", "Dramatis Persona - <name>"), the kit
keeps its quantities, its materials (the Runesmith Journeyman's gromril hammer: weapon materials) and the costs
their formulas, the race is matched by name and its text kept as the label. A
dramatis persona's terms add `stays` and `payment_note`. A run is all or nothing, and a second run updates in place.
The committed data's full run is in apps/items/tests/test_catalogue_characterisation_seeding.py.
"""

import json
from pathlib import Path

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
from apps.spells.models import Spell

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
# the Runesmith Journeyman's shape (hired-swords.json): his hammer is gromril, the only weapon-material kit row in
# the catalogue (weapon materials). "Gromril Hammer" is our Hammer made of gromril.
RUNESMITH = {
    "name": "Runesmith Journeyman",
    **STATS,
    "equipment": [{"item": "Gromril Hammer", "quantity": 1}, "Heavy Armour"],
    "hired_sword": {"hire_cost": 50, "rating": 20, "grade": "1a", "race": "Ogre"},
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
    hammer: Item
    heavy_armour: Item
    sprint: Skill
    fear: Special

    @classmethod
    def setUpTestData(cls) -> None:
        cls.ogre_race = Race.objects.create(name="Ogre", **STATS)
        cls.sword = Item.objects.create(name="Sword", type="Weapon")
        cls.axe = Item.objects.create(name="Axe", type="Weapon")
        cls.hammer = Item.objects.create(name="Hammer", type="Weapon")
        cls.heavy_armour = Item.objects.create(name="Heavy Armour", type="Armour")
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

    def test_his_lores_spells_are_made_in_the_book_and_none_is_one_he_knows(self):
        # William, 27 Nov 2026, of the Dark Maiden, who "starts with two of them, determined at random": her Spells of
        # Wrath are her lore (`lore_spells`, under `spell_lore`), which she casts from, not six spells she knows
        maiden = {
            **OGRE,
            "caster": "Wizard",
            "spell_lore": "Spells of Wrath",
            "lore_spells": [{"name": "1 - Dark Strength", "description": "Difficulty 7. +1 Strength."}],
            "spells": [],
            "spell_types": ["Spells of Wrath"],
        }
        with data_file([maiden]) as path:
            run("seed_hired_swords", json_paths=[path])
        ogre = HiredSword.objects.get()
        self.assertEqual((ogre.available_spell_types, ogre.spell_links.count()), (["Spells of Wrath"], 0))
        strength = Spell.objects.get(name="Dark Strength")
        self.assertEqual((strength.type, strength.roll, strength.dc), ("Spells of Wrath", 1, "7"))

    def test_every_hired_sword_who_casts_names_the_lores_he_casts_from(self):
        # the spells audit (27 Nov 2026): a hire set no lores, so his first spell could be picked from any list
        rows = json.loads(Path("apps/hirelings/data/hired-swords.json").read_text(encoding="utf-8"))
        lores = {row["name"]: row.get("spell_types") for row in rows if row.get("caster") != "No" or row.get("spell_picks")}  # fmt: skip
        self.assertEqual(
            lores,
            {
                "Warlock": ["Lesser Magic"],
                "Elf Mage": ["Spells of the Djedhi"],
                "Norse Shaman": ["Norse Runes"],
                "Priest of Morr": ["Funerary Rites"],
                "Runesmith Journeyman": ["Runes"],
                "Warrior Priest of Sigmar": ["Prayers of Sigmar"],
                "Witch": ["Charms and Hexes"],
                "Wolf Priest of Ulric": ["Prayers of Ulric"],
                "Dark Mage": ["Dark Magic", "Lesser Magic"],
                "The Fallen Sister": ["Lesser Magic"],
                "Dark Elf Sorceress (Dark Elf Corsairs)": ["Dark Elf Magic"],
                "Trancas Quendalmanliye": ["Lesser Magic"],
                "Necromancer": ["Necromancy"],
                "Priest of Morr (Mousillon)": ["Rituals of Morr"],
                "Alchemist": ["Potion Recipes"],
                "Dark Maiden": ["Spells of Wrath"],
                "White Lady": ["Spells of the Lake"],
                "Genie": None,  # the element he rolls at hire: a question for William
                "Warlock Engineer": None,  # Chain Lightning, and no other spell ever
            },
        )

    def test_a_spell_named_in_two_lores_is_the_one_of_his_own_lore(self):
        # the Mousillon Priest of Morr's rites linked the Vampire Hunters' Funerary Rites of their names: by name
        # alone, the last lore holding it won
        ours = Spell.objects.create(name="Hand of Morr", type="Funerary Rites", dc="9")
        Spell.objects.create(name="Hand of Morr", type="Funerary Rites (Vampire Hunters of Sylvania)", dc="7")
        priest = {**OGRE, "caster": "Priest", "spells": ["Hand of Morr"], "spell_types": ["Funerary Rites"]}
        with data_file([priest]) as path:
            run("seed_hired_swords", json_paths=[path])
        self.assertEqual([link.spell_id for link in HiredSword.objects.get().spell_links.all()], [ours.id])

    def test_one_who_starts_with_several_spells_keeps_how_many_he_picks(self):
        with data_file([{**OGRE, "caster": "Wizard", "spell_picks": 2}, RUNESMITH]) as path:
            run("seed_hired_swords", json_paths=[path])
        picks = dict(HiredSword.objects.values_list("name", "spell_picks"))
        self.assertEqual(picks, {"Ogre Bodyguard": 2, "Runesmith Journeyman": None})

    def test_the_hired_swords_who_start_with_several_spells_pick_that_many(self):
        rows = json.loads(Path("apps/hirelings/data/hired-swords.json").read_text(encoding="utf-8"))
        picks = {row["name"]: row["spell_picks"] for row in rows if row.get("spell_picks")}
        self.assertEqual(
            picks,
            {
                "Warlock": 2,  # "two spells generated at random from the Lesser Magic list"
                "Elf Mage": 3,
                "Norse Shaman": 2,  # two Runes
                "Witch": 2,
                "Dark Elf Sorceress (Dark Elf Corsairs)": 2,
                "Trancas Quendalmanliye": 2,
                "Alchemist": 2,  # two potion recipes
                "Dark Maiden": 2,  # "She starts with two of them, determined at random"
                "Priest of Morr (Mousillon)": 2,  # "He begins with two, determined at random"
                "Genie": 1,  # "He starts with one spell", typed no caster (William, 27 Nov 2026: "YES")
            },
        )

    def test_a_kit_line_the_book_makes_of_a_material_keeps_it(self):
        # weapon materials: his gromril hammer used to seed as a plain hammer, so the gromril was lost
        with data_file([RUNESMITH]) as path:
            run("seed_hired_swords", json_paths=[path])

        row = HiredSword.objects.get(name="Runesmith Journeyman", campaign__isnull=True)
        lines = row.item_links.order_by("item__name").values_list("item_id", "quantity", "material")
        self.assertEqual(list(lines), [(self.hammer.id, 1, "gromril"), (self.heavy_armour.id, 1, "")])

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

    def test_a_second_run_rewords_his_own_rules_and_skills_but_never_a_shared_one(self):
        # William, 21 Nov 2026: the Witch's Potions table, put back in the data, never reached a seeded database. His
        # own rules and the special skills only his group holds are the data's; Fear and Sprint aren't his to reword.
        own = {"name": "Thick Skull", "description": "Hard to stun."}
        Skill.objects.filter(id=self.sprint.id).update(description="Runs fast.")
        Special.objects.filter(id=self.fear.id).update(description="Causes fear.")
        first = {**OGRE, "specials": [{"name": "Fear", "description": "Causes fear."}, own]}
        with data_file([first]) as path:
            run("seed_hired_swords", json_paths=[path])
        reworded = {
            **OGRE,
            "skills": [{"name": "Sprint", "description": "His own way."}],
            "specials": [{"name": "Fear", "description": "Other words."}, {**own, "description": "With its table."}],
            "hired_sword": {
                **OGRE["hired_sword"],  # type: ignore[dict-item]
                "available_special_skills": [{"name": "Bully", "description": "Shoves, with its table."}],
            },
        }

        with data_file([reworded]) as path:
            run("seed_hired_swords", json_paths=[path])

        words = dict(Special.objects.values_list("name", "description"))
        self.assertEqual((words["Thick Skull"], words["Fear"]), ("With its table.", "Causes fear."))
        skills = dict(Skill.objects.values_list("name", "description"))
        self.assertEqual((skills["Bully"], skills["Sprint"]), ("Shoves, with its table.", "Runs fast."))

    def test_his_own_skill_group_is_archived_once_he_has_no_special_skills_and_back_when_he_has(self):
        # William, 21 Nov 2026: the Runesmith's Rune Use is his rule and his runes a lore, so his special skills went;
        # his group must not stay on the Skills page holding them
        with data_file([OGRE]) as path:
            run("seed_hired_swords", json_paths=[path])
        bare = {**OGRE, "hired_sword": {**OGRE["hired_sword"], "available_special_skills": []}}  # type: ignore[dict-item]

        with data_file([bare]) as path:
            run("seed_hired_swords", json_paths=[path])

        group = SkillGroup.objects.get(name="Hired Sword - Ogre Bodyguard", campaign__isnull=True)
        self.assertIsNotNone(group.archived_at)
        self.assertEqual(HiredSword.objects.get().available_skill_types, ["Combat"])
        with data_file([OGRE]) as path:
            run("seed_hired_swords", json_paths=[path])
        group.refresh_from_db()
        self.assertIsNone(group.archived_at)

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

    def test_a_spell_line_naming_its_lore_links_that_lores_spell_of_the_name(self):
        # Slave Master Haggard (the Marienburg Annual p. 91) knows spells of Necromancy and the Rituals of Hashut,
        # whose names other lores share: each line names its lore, and one no lore holds is his own
        necromancy = Spell.objects.create(name="Lifestealer", type="Necromancy")
        # the last lore of the name in the book's order, which a bare name would link
        theirs = Spell.objects.create(name="Lifestealer", type="Necromancy (Restless Dead)")
        hashut = Spell.objects.create(name="Lava Flow", type="Rituals of Hashut")
        spells = [
            {"name": "Lifestealer", "lore": "Necromancy"},
            {"name": "Lava Flow", "lore": "Rituals of Hashut"},
            {"name": "Combustion", "description": "Difficulty 8. A zombie explodes."},
        ]
        with data_file([{**AENUR, "spells": spells}]) as path:
            run("seed_dramatis_personae", json_paths=[path])

        linked = set(DramatisPersona.objects.get(name="Aenur").spell_links.values_list("spell", flat=True))
        own = Spell.objects.get(name="Combustion")
        self.assertEqual(linked, {necromancy.id, hashut.id, own.id})
        self.assertNotIn(theirs.id, linked)
        self.assertEqual((own.type, own.dc), ("Dramatis Persona - Aenur", "8"))

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

        self.assertIn("Created: 61, updated: 0.", output)  # the Marienburg Annual's five among them
        aenur = DramatisPersona.objects.get(name="Aenur, the Sword of Twilight")
        self.assertEqual((aenur.hire_fee["gold"], aenur.stays, aenur.weapon_skill), (150, "one_battle", 8))
        self.assertFalse(aenur.for_everyone)
        self.assertIn("Reiklanders", {line.warband_type.name for line in aenur.warband_links.select_related("warband_type") if line.warband_type})  # fmt: skip
        self.assertEqual(aenur.hire_note, "Any warband except Skaven, Undead and the Possessed may hire Aenur.")
        nicodemus = DramatisPersona.objects.get(name="Nicodemus, the Cursed Pilgrim")
        wyrdstone = make_fee(resources=[("Wyrdstone", 1)])
        self.assertEqual((nicodemus.hire_fee, nicodemus.upkeep_fee), (wyrdstone, wyrdstone))  # paid in wyrdstone
        self.assertEqual(nicodemus.caster, "Wizard")
