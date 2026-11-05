"""Shared specials (William, 5 Nov 2026; special/shared.py): one general Fear, Stupidity, Immune to Psychology and
Immune to Poison, and one of each mutation, which seed_spells_and_special seeds from the catalogue import's
out/shared-specials.json, archiving the copies seeded before; the hireling and bestiary seeders' book lookups link an
owner's rule of a shared name or alias to it, or keep his own where William's list keeps it apart.
"""

from collections import Counter
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.campaigns.models import CampaignType
from apps.core.book_lookups import BookLookups
from apps.special.categories import AURA, BODY, MUTATION
from apps.special.kinds import BANE, BOON, DRAMATIS_PERSONA, GENERAL, TRAIT, WARBAND
from apps.special.models import Special

BELANDYSH = "Belandysh, Condemned Champion of Chen"


def seed() -> str:
    output = StringIO()
    call_command("seed_spells_and_special", stdout=output)
    return output.getvalue()


class SharedSeedTests(TestCase):
    def test_each_is_a_general_special_with_its_wording_kind_and_category(self):
        seed()
        families = ("Mutation", "Blessing of Nurgle", "Favour of Tchar", "Bounty of Arkhar")
        rows = {row.name: row for row in Special.objects.filter(type__in=("Psychology", "Trait", *families))}
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
        self.assertIn("successful to wound roll of 6", rot.description)  # William, 5 Nov 2026: "Use the to wound rot"
        mutations = Special.objects.filter(type__in=families)
        self.assertEqual({row.category for row in mutations}, {MUTATION})
        bought = mutations.filter(cost__isnull=False)  # every priced one helps him; the random table's may not
        self.assertEqual(set(bought.values_list("kind", flat=True)), {BOON})
        kinds = dict(mutations.filter(name__in=("Atrophy", "Warts", "Horns")).values_list("name", "kind"))
        self.assertEqual(kinds, {"Atrophy": BANE, "Warts": TRAIT, "Horns": BOON})
        counted = Counter(mutations.values_list("type", flat=True))
        # the generic list's 15 and the random table's 12 of its own; the Nurgle family 7, Tchar's 6 and Arkhar's 6
        self.assertEqual(
            counted, {"Mutation": 27, "Blessing of Nurgle": 7, "Favour of Tchar": 6, "Bounty of Arkhar": 6}
        )
        self.assertFalse(mutations.filter(description__icontains="Tainted One").exists())  # a general subject
        self.assertEqual((claw.cost, rot.cost, rows["Mark of Nurgle"].cost, fear.cost), (50, 50, 35, None))
        self.assertEqual({row.campaign_type_id for row in mutations}, {None})  # no settings seeded: Mordheim's

    def test_mutiny_in_marienburgs_own_are_its_settings_and_the_rest_mordheim_1as(self):
        # William, 5 Nov 2026: the generic list and the Nurgle family are 1a's, and every special the random table
        # gives (Tchar's Beak and Burning Body and Arkhar's Fangs among them); the rest of the Favours of Tchar and the
        # Bounties of Arkhar are Mutiny in Marienburg's
        mim = CampaignType.objects.create(slug="mutiny-in-marienburg", name="Mutiny in Marienburg")
        seed()
        theirs = Special.objects.filter(campaign_type=mim).values_list("name", flat=True)
        self.assertEqual(
            set(theirs), {"Electrical Touch", "Eye of Tchar", "Mer-creature", "Telekinesis"} | {"Centauroid"}
        )
        tchar = Special.objects.filter(type="Favour of Tchar", campaign_type__isnull=True)
        self.assertEqual(set(tchar.values_list("name", flat=True)), {"Beak", "Burning Body"})
        arkhar = Special.objects.filter(type="Bounty of Arkhar", campaign_type__isnull=True)
        self.assertEqual(set(arkhar.values_list("name", flat=True)), {"Iron-hard Skin", "Spiked Tail", "Regeneration", "Spit Acid", "Fangs"})  # fmt: skip

    def test_the_copies_seeded_before_are_archived_and_a_second_run_finds_none(self):
        copies = [
            Special.objects.create(name="Fear", type="Animal"),  # a mount's, from special.json
            Special.objects.create(name="Cause Fear", type="Warband - Undead", owner_kind=WARBAND),
            Special.objects.create(name="Immune to psychology", type=f"Dramatis Persona - {BELANDYSH}"),
            Special.objects.create(name="Immune to Psychology (Mount)", type="Animal"),  # the Nightmare's kept apart
            # a Troll's rule seeded under the mutation's name: the template seeding names it Regeneration (Troll) now
            Special.objects.create(name="Regeneration", type="Warband - Orc Mob", owner_kind=WARBAND),
        ]
        frenzy = Special.objects.create(name="Frenzy", type="Animal")

        self.assertIn("Shared specials - Created: 52, Updated: 0, copies archived: 5.", seed())

        archived = Special.objects.filter(archived_at__isnull=False)
        self.assertEqual(set(archived.values_list("id", flat=True)), {copy.id for copy in copies})
        frenzy.refresh_from_db()
        self.assertIsNone(frenzy.archived_at)
        self.assertIn("Shared specials - Created: 0, Updated: 52, copies archived: 0.", seed())


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

    def test_no_pain_is_one_rule_for_the_model_but_sigmunds_and_veskits_ignore_knocked_down_too(self):
        goliath = BookLookups("Hired Sword").special({"name": "No Pain", "description": "Bone Goliaths treat ..."}, "Bone Goliath")  # fmt: skip
        sigmund = "Sigmund Spindle, the Harvester of Flesh"
        own = BookLookups("Dramatis Persona").special({"name": "No Pain", "description": "Ignores both."}, sigmund)

        assert goliath is not None and own is not None
        self.assertEqual((goliath.type, goliath.owner_kind, goliath.category), ("Trait", GENERAL, BODY))
        self.assertEqual(goliath.description, "The model treats a stunned result on the Injury chart as knocked down.")
        self.assertEqual((own.name, own.type, own.category), ("No Pain (Sigmund)", f"Dramatis Persona - {sigmund}", BODY))  # fmt: skip

    def test_the_rat_ogre_and_the_bone_goliath_share_one_may_not_run_worded_for_the_model(self):
        # the Bone Goliath showed the Clan Skryre Rat Ogre's text: one hired sword's row, found by name
        lookups = BookLookups("Hired Sword")
        rat = lookups.special({"name": "May not run", "description": "It may not run."}, "Clan Skryre Rat Ogre")
        goliath = lookups.special({"name": "May not run", "description": "Slow undead."}, "Bone Goliath")

        assert rat is not None
        self.assertEqual((rat, rat.type, rat.owner_kind), (goliath, "Trait", GENERAL))
        self.assertEqual(rat.description, "The model may not run, but may charge normally.")
        self.assertFalse(Special.objects.filter(type__startswith="Hired Sword - ", name__iexact="May not run").exists())

    def test_an_owners_rule_of_a_mutations_name_that_does_otherwise_is_kept_his(self):
        # the mutation heals him once; Belandysh ignores each wound on a 4+, and the Chameleon Skink's is a Skink's 6+
        own = BookLookups("Dramatis Persona").special({"name": "Regeneration", "description": "4+."}, BELANDYSH)
        skink = BookLookups("Hired Sword").special({"name": "Scaly Skin", "description": "6+."}, "Chameleon Skink")
        rot = BookLookups("Hired Sword").special("Neiglish Rot", "Anyone")  # MiM's name for Nurgle's Rot
        skill = BookLookups("Hired Sword").special({"name": "Resilient", "description": "The skill."}, "Old Prospector")

        assert own is not None and skink is not None and rot is not None and skill is not None
        self.assertEqual((skill.name, skill.type), ("Resilient (Old Prospector)", "Hired Sword - Old Prospector"))
        self.assertEqual((own.name, own.category), ("Regeneration (Belandysh)", BODY))
        self.assertEqual((skink.name, skink.type), ("Scaly Skin (Chameleon Skink)", "Hired Sword - Chameleon Skink"))
        self.assertEqual((rot.name, rot.type, rot.category), ("Nurgle's Rot", "Blessing of Nurgle", MUTATION))


class SharedNotSeededTests(TestCase):
    def test_a_shared_special_not_seeded_yet_is_left_out_with_a_warning(self):
        lookups = BookLookups("Hired Sword")

        self.assertIsNone(lookups.special({"name": "Fear", "description": "Causes fear."}, "Ogre Bodyguard"))
        self.assertEqual(lookups.warnings, ["  Special 'Fear' not found for 'Ogre Bodyguard': Fear isn't seeded yet"])
        self.assertFalse(Special.objects.exists())
