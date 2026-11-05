"""Shared specials (William, 5 Nov 2026; special/shared.py): one general Fear, Stupidity, Immune to Psychology and
Immune to Poison, and one of each mutation, which seed_spells_and_special seeds from the catalogue import's
out/shared-specials.json, archiving the copies seeded before; the hireling and bestiary seeders' book lookups link an
owner's rule of a shared name or alias to it, or keep his own where William's list keeps it apart.
"""

from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.core.book_lookups import BookLookups
from apps.special.categories import AURA, BODY, MUTATION
from apps.special.kinds import BANE, BOON, DRAMATIS_PERSONA, GENERAL, WARBAND
from apps.special.models import Special

BELANDYSH = "Belandysh, Condemned Champion of Chen"


def seed() -> str:
    output = StringIO()
    call_command("seed_spells_and_special", stdout=output)
    return output.getvalue()


class SharedSeedTests(TestCase):
    def test_each_is_a_general_special_with_its_wording_kind_and_category(self):
        seed()
        rows = {row.name: row for row in Special.objects.filter(type__in=("Psychology", "Trait", "Mutation"))}
        fear, poison, immune = rows["Fear"], rows["Immune to Poison"], rows["Immune to Psychology"]
        self.assertTrue(fear.description.startswith("This model causes fear.\n\nFear is a natural reaction"))
        charged = "\n\na) If the model is charged by a warrior or a creature which causes fear.\n\n"  # no markdown
        self.assertIn(charged, fear.description)
        self.assertEqual((fear.type, fear.owner_kind, fear.kind, fear.category), ("Psychology", GENERAL, BOON, AURA))
        self.assertEqual((rows["Stupidity"].kind, poison.type, poison.kind), (BANE, "Trait", BOON))
        self.assertEqual((poison.category, poison.description), (BODY, "Not affected by any poison."))
        self.assertEqual(immune.description, "Not affected by psychology (such as fear) and never leaves combat.")
        claw, flies, rot = rows["Great Claw"], rows["Cloud of Flies"], rows["Nurgle's Rot"]
        self.assertEqual((claw.owner_kind, claw.kind, claw.category), (GENERAL, BOON, MUTATION))
        self.assertTrue(flies.description.startswith("The model is surrounded by a cloud of flies"))
        self.assertIn("In addition, the model is immune to all poisons.", rot.description)
        mutations = Special.objects.filter(type="Mutation")
        self.assertEqual(set(mutations.values_list("kind", "category")), {(BOON, MUTATION)})
        self.assertEqual(mutations.count(), 14)
        self.assertFalse(mutations.filter(description__icontains="Tainted One").exists())  # a general subject

    def test_the_copies_seeded_before_are_archived_and_a_second_run_finds_none(self):
        copies = [
            Special.objects.create(name="Fear", type="Animal"),  # a mount's, from special.json
            Special.objects.create(name="Cause Fear", type="Warband - Undead", owner_kind=WARBAND),
            Special.objects.create(name="Immune to psychology", type=f"Dramatis Persona - {BELANDYSH}"),
            Special.objects.create(name="Immune to Psychology (Mount)", type="Animal"),  # the Nightmare's kept apart
        ]
        frenzy = Special.objects.create(name="Frenzy", type="Animal")

        self.assertIn("Shared specials - Created: 18, Updated: 0, copies archived: 4.", seed())

        archived = Special.objects.filter(archived_at__isnull=False)
        self.assertEqual(set(archived.values_list("id", flat=True)), {copy.id for copy in copies})
        frenzy.refresh_from_db()
        self.assertIsNone(frenzy.archived_at)
        self.assertIn("Shared specials - Created: 0, Updated: 18, copies archived: 0.", seed())


class SharedLookupTests(TestCase):
    fear: Special
    poison: Special

    @classmethod
    def setUpTestData(cls) -> None:
        seed()
        cls.fear = Special.objects.get(name="Fear", type="Psychology")
        cls.poison = Special.objects.get(name="Immune to Poison", type="Trait")

    def test_a_shared_name_or_alias_is_the_shared_special_held_once(self):
        lookups = BookLookups("Hired Sword")
        data = {"specials": [{"name": "Cause Fear", "description": "Causes fear."}, "Fear", "Immune To Poison"]}

        links = lookups.links(data, "Bone Goliath")

        self.assertEqual(links.specials, [self.fear, self.poison])
        self.assertFalse(Special.objects.filter(type="Hired Sword - Bone Goliath").exists())
        self.assertEqual(lookups.warnings, [])

    def test_a_rule_kept_apart_is_the_owners_own_under_its_name_and_the_rest_share(self):
        lookups = BookLookups("Dramatis Persona")
        text = "Belandysh is immune to psychology and automatically passes all Leadership tests."

        own = lookups.special({"name": "Immune to psychology", "description": text}, BELANDYSH)
        theirs = lookups.special("Immune to Psychology", "Countess Marianna Chevaux, Vampire Assassin")

        assert own is not None and theirs is not None
        self.assertEqual(
            (own.name, own.type, own.owner_kind, own.kind, own.description),
            ("Immune to Psychology (Belandysh)", f"Dramatis Persona - {BELANDYSH}", DRAMATIS_PERSONA, BOON, text),
        )
        self.assertEqual((theirs.type, theirs.owner_kind), ("Psychology", GENERAL))
        mount = lookups.special("Immune to Psychology (Mount)", "Nightmare")  # the book's Animal rule of its name
        assert mount is not None
        self.assertEqual((mount.name, mount.type), ("Immune to Psychology (Nightmare)", "Animal"))


class SharedNotSeededTests(TestCase):
    def test_a_shared_special_not_seeded_yet_is_left_out_with_a_warning(self):
        lookups = BookLookups("Hired Sword")

        self.assertIsNone(lookups.special({"name": "Fear", "description": "Causes fear."}, "Ogre Bodyguard"))
        self.assertEqual(lookups.warnings, ["  Special 'Fear' not found for 'Ogre Bodyguard': Fear isn't seeded yet"])
        self.assertFalse(Special.objects.exists())
