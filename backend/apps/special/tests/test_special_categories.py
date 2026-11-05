"""Every special is an injury, a mutation, an aura or the body (special/categories.py), which picks its icon.

The book's are set by `book_category`, which every seeder of a book special calls: typed Injury, typed Mutation (the
shared mutations) or an upgrade the editor writes in a group of mutations, the name's in data/special-categories.json,
typed Animal (body), else aura. A custom special picks its own, an aura when it doesn't; a campaign's version of a
book special keeps it.
"""

import json
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.battles.services.injuries import injury_special
from apps.core.book_lookups import BookLookups
from apps.special.categories import (
    AURA,
    BODY,
    CATEGORIES_PATH,
    CATEGORY_CHOICES,
    INJURY,
    MUTATION,
    MUTATION_TYPE,
    book_category,
)
from apps.special.kinds import INJURY as INJURY_TYPE
from apps.special.kinds import WARBAND
from apps.special.models import Special
from apps.warband_templates.seeding import BookRows
from apps.warbands.models import HeroSpecial
from apps.warbands.tests.roster_support import HERO, RosterTestCase, make_unit, unit_url

CULT = "Warband - Cult of the Possessed"


class BookCategoryTests(TestCase):
    def test_the_review_file_names_only_known_categories(self):
        with CATEGORIES_PATH.open(encoding="utf-8") as handle:
            data = json.load(handle)
        self.assertGreater(len(data), 50)
        self.assertEqual(set(data.values()) - set(dict(CATEGORY_CHOICES)), set())
        # the default needs a line only to keep an Animal-typed rule an aura (a mount's Fear)
        call_command("seed_spells_and_special", stdout=StringIO())
        animal = set(Special.objects.filter(type="Animal").values_list("name", flat=True))
        self.assertEqual({name for name, category in data.items() if category == AURA} - animal, set())

    def test_the_rules_apply_in_order(self):
        self.assertEqual(book_category("Regeneration", INJURY_TYPE), INJURY)  # the type before the name
        self.assertEqual(book_category("Tentacle", MUTATION_TYPE), MUTATION)  # the shared mutations
        self.assertEqual(book_category("Immune to Poison", MUTATION_TYPE), MUTATION)  # the type before the name
        self.assertEqual(book_category("Tentacle", CULT, "Mutations"), MUTATION)  # one the editor writes
        self.assertEqual(book_category("Tentacle", CULT), AURA)  # a fighter's rule of the name isn't bought
        self.assertEqual(book_category("Thick Skinned", "Animal"), BODY)  # the Animal type's rules
        self.assertEqual(book_category("Stubborn", "Animal"), AURA)  # a mount's mental rule, by its line
        self.assertEqual(book_category("Fear", "Warband - Skaven"), AURA)
        self.assertEqual(book_category(" large ", "Trait"), BODY)  # the review file, read loosely
        self.assertEqual(book_category("Bloated Foulness", "Warband - Carnival of Chaos", "Blessings of Nurgle"), MUTATION)  # fmt: skip
        self.assertEqual(book_category("Mark of Tchar the Eagle", "Warband - Marauders of Chaos", "Mark of the Dark Gods"), AURA)  # fmt: skip
        self.assertEqual(book_category("Not in the book"), AURA)

    def test_seeding_the_book_sets_each_category(self):
        call_command("seed_spells_and_special", stdout=StringIO())
        book = Special.objects.filter(campaign=None)
        names = ("Large", "Wizard", "Bicker", "Thick Skinned")
        categories = dict(book.filter(name__in=names).values_list("name", "category"))
        self.assertEqual(categories, {"Large": BODY, "Wizard": AURA, "Bicker": AURA, "Thick Skinned": BODY})
        self.assertEqual(set(book.filter(type=INJURY_TYPE).values_list("category", flat=True)), {INJURY})

    def test_a_hired_swords_own_special_takes_its_category(self):
        own = BookLookups("Hired Sword").special({"name": "Hard to Kill", "description": "Tough."}, "Ogre Bodyguard")
        assert own is not None
        self.assertEqual((own.type, own.category), ("Hired Sword - Ogre Bodyguard", BODY))
        stale = Special.objects.create(name="Regeneration", type="Monster")  # seeded before it had one: an aura
        found = BookLookups().special("Regeneration", "Troll")
        assert found is not None
        stale.refresh_from_db()
        self.assertEqual((found.id, stale.category), (stale.id, BODY))

    def test_a_templates_mutations_are_bought_as_mutations(self):
        book = BookRows()
        tentacle = {"name": "Tentacle", "type": CULT, "description": "A tentacle."}
        bought = Special.objects.get(pk=book.special(tentacle, "Cult of the Possessed", "Mutations"))
        crazed = {"name": "Crazed", "type": CULT, "description": "Knows no fear."}
        rule = Special.objects.get(pk=book.special(crazed, "Cult of the Possessed"))
        self.assertEqual((bought.category, bought.owner_kind, rule.category), (MUTATION, WARBAND, AURA))


class InjuryAndCustomCategoryTests(RosterTestCase):
    def test_a_campaigns_own_injury_special_is_an_injury(self):
        made = injury_special("A New Scar", self.campaign.id)
        self.assertEqual((made.campaign_id, made.type, made.category), (self.campaign.id, INJURY_TYPE, INJURY))

    def test_a_custom_special_picks_its_category_and_is_an_aura_otherwise(self):
        self.client.force_authenticate(user=self.campaign_owner)
        body = {"campaign_id": self.campaign.id, "name": "Third Eye", "type": "House rule"}
        picked = self.client.post("/api/special/", {**body, "category": "mutation"}, format="json")
        self.assertEqual(picked.status_code, 201, picked.data)
        self.assertEqual(picked.json()["category"], MUTATION)
        plain = self.client.post("/api/special/", {**body, "name": "Banner"}, format="json")
        self.assertEqual(plain.json()["category"], AURA)
        wrong = self.client.post("/api/special/", {**body, "name": "Odd", "category": "curse"}, format="json")
        self.assertEqual(wrong.status_code, 400)

    def test_a_campaigns_version_of_a_book_special_keeps_its_category(self):
        book = Special.objects.create(name="Scaly Skin", type="Lizardmen", category=BODY)
        self.client.force_authenticate(user=self.campaign_owner)
        edited = self.client.patch(
            f"/api/special/{book.id}/", {"campaign_id": self.campaign.id, "description": "Tough."}, format="json"
        )
        self.assertEqual(edited.status_code, 200, edited.data)
        version = Special.objects.get(campaign=self.campaign, replaces=book)
        self.assertEqual((version.description, version.category), ("Tough.", BODY))

    def test_a_units_specials_carry_their_category(self):
        hero = make_unit(HERO, self.warband)
        scar = Special.objects.create(name="Old Scar", type=INJURY_TYPE, category=INJURY)
        HeroSpecial.objects.create(hero=hero, special=scar)
        listed = self.client.get(unit_url(HERO, self.warband.id)).json()[0]["specials"]
        detail = self.client.get(unit_url(HERO, self.warband.id, hero.id)).json()["specials"]
        self.assertEqual([entry["category"] for entry in (*listed, *detail)], [INJURY, INJURY])
