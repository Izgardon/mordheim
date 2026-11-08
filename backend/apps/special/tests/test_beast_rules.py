"""Beasts' own rules (William, 7 Nov 2026: "keep bestiary rules from displaying on the boons and banes page, show on
beast for sure"; special/owners.py): a book special only bestiary entries hold is a beast's, owner kind beast, set by
the seeders that link book specials; one a hired sword, a dramatis persona or a warband template holds too stays
general. A beast's card still shows its rules.
"""

import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase

from apps.bestiary.models import BestiaryEntry
from apps.hirelings.models import HiredSword
from apps.special.kinds import BEAST, GENERAL
from apps.special.models import Special
from apps.special.owners import mark_beast_rules

STATS = {"movement": 4, "weapon_skill": 3, "ballistic_skill": 3, "strength": 3, "toughness": 3, "wounds": 1}
STATS |= {"initiative": 3, "attacks": 1, "leadership": 7}


def seed_beasts(rows: list[dict]) -> None:
    with TemporaryDirectory() as folder:
        path = Path(folder, "beasts.json")
        path.write_text(json.dumps(rows), encoding="utf-8")
        call_command("seed_bestiary", json_paths=[str(path)], stdout=StringIO())


class BeastRuleTests(TestCase):
    def test_a_rule_only_beasts_hold_is_the_beasts_and_one_others_hold_too_stays_general(self):
        attacks = Special.objects.create(name="Attacks (Giant)", type="Animal", description="Grab-it!")
        fly = Special.objects.create(name="Fly", type="Animal", description="The model flies.")
        Special.objects.create(name="Wizard", type="Trait")  # nobody's: stays general
        seed_beasts(
            [
                {"name": "Giant", "kind": "creature", **STATS, "specials": ["Attacks (Giant)", "Fly"]},
                {"name": "Raven", "kind": "pet", **STATS, "specials": ["Fly"]},
            ]
        )
        HiredSword.objects.create(name="Gyrocopter Pilot", **STATS).special_links.create(special=fly)
        mark_beast_rules()  # as the hired swords' seeder ends

        kinds = dict(Special.objects.values_list("name", "owner_kind"))
        self.assertEqual(kinds, {"Attacks (Giant)": BEAST, "Fly": GENERAL, "Wizard": GENERAL})
        # the beast keeps showing it
        giant = BestiaryEntry.objects.get(name="Giant")
        self.assertEqual(set(giant.specials.values_list("name", flat=True)), {"Attacks (Giant)", "Fly"})

        # the hired sword gives it up: only beasts hold it again; another owner takes the Giant's
        HiredSword.objects.get().special_links.all().delete()
        HiredSword.objects.create(name="Ogre", **STATS).special_links.create(special=attacks)
        self.assertEqual(mark_beast_rules(), 2)
        kinds = dict(Special.objects.values_list("name", "owner_kind"))
        self.assertEqual((kinds["Attacks (Giant)"], kinds["Fly"]), (GENERAL, BEAST))

    def test_the_book_seeding_marks_the_beasts_rules_and_leaves_the_shared_ones_general(self):
        call_command("seed_spells_and_special", stdout=StringIO())
        call_command("seed_bestiary", stdout=StringIO())

        rows = Special.objects.filter(campaign__isnull=True)
        beasts = set(rows.filter(owner_kind=BEAST).values_list("name", flat=True))
        self.assertTrue({"Attacks (Giant)", "Aura of Slaanesh (Daemonette)"} <= beasts)
        self.assertEqual(rows.get(name="Fear", type="Psychology").owner_kind, GENERAL)  # shared, beasts hold it too
        self.assertEqual(set(rows.filter(type="Injury").values_list("owner_kind", flat=True)), {GENERAL})  # no beast's
        held = rows.filter(owner_kind=BEAST, bestiary_entry_specials__isnull=True)
        self.assertFalse(held.exists())  # every one a beast holds
