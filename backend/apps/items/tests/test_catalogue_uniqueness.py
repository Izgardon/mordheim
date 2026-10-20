"""The base uniqueness constraints of the catalogue tables (BUG-17, IMP-83, CAT-TEST-12).

One row per name (and type) in the book, in an add-on and in a campaign, NULLs not distinct: items, skills, spells
and specials on name and type, races on name, the bestiary on name (an animal and a hired sword share the names, as
seed_bestiary upserts them). A campaign entry may share a book entry's name, another campaign's or (for typed kinds)
the name of an entry of another type; an exact duplicate in the campaign answers 400 `duplicate_entry` with nothing
written. House-rule clones are left out of the item constraint (a custom "Heavy Armour" and the half-price clone of
the book's may live side by side). CAT-TWEAK-02's wider name rule is PR C's.
"""

from typing import Any

from django.db import IntegrityError, transaction

from apps.bestiary.models import BestiaryEntry
from apps.items.models import Item
from apps.items.services import HALF_PRICE_ARMOUR_EFFECT_KEY
from apps.races.models import Race
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.units.services.level_up import pending_placeholder

from .catalogue_support import (
    BESTIARY,
    HIRED_SWORDS,
    ITEMS,
    KINDS,
    RACES,
    SKILLS,
    SPECIALS,
    SPELLS,
    CatalogueKind,
    CatalogueTestCase,
    make_entry,
)

DUPLICATE_WHAT = {
    ITEMS: "an item with this name and type",
    SKILLS: "a skill with this name and type",
    SPELLS: "a spell with this name and type",
    SPECIALS: "a special with this name and type",
    RACES: "a race with this name",
    BESTIARY: "a bestiary entry or hired sword with this name",
    HIRED_SWORDS: "a bestiary entry or hired sword with this name",
}
OTHER_TYPE = {ITEMS: "Miscellaneous", SKILLS: "Speed", SPELLS: "Necromancy", SPECIALS: "Trait"}


def duplicate_body(kind: CatalogueKind) -> dict[str, Any]:
    detail = f"This campaign already has {DUPLICATE_WHAT[kind]}."
    return {"detail": detail, "code": "duplicate_entry", "fields": {"name": [detail]}}


class DuplicateEntryTests(CatalogueTestCase):
    def count(self, kind: CatalogueKind, name: str) -> int:
        rows = kind.model._default_manager
        if kind is HIRED_SWORDS:
            return int(rows.filter(bestiary_entry__name=name).count())
        return int(rows.filter(name=name).count())

    def test_an_exact_duplicate_in_the_campaign_is_refused_and_writes_nothing(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.assertEqual(self.create_as(self.owner, kind, f"Twin {kind.key}").status_code, 201)

                again = self.create_as(self.owner, kind, f"Twin {kind.key}")

                self.assertEqual((again.status_code, again.json()), (400, duplicate_body(kind)))
                self.assertEqual(self.count(kind, f"Twin {kind.key}"), 1)

    def test_a_book_name_another_campaigns_name_and_another_type_are_all_allowed(self):
        books = {ITEMS: "Axe", SKILLS: "Infiltration", SPELLS: "Lifestealer", SPECIALS: "Large", RACES: "Human"}
        books.update({BESTIARY: "Warhound", HIRED_SWORDS: "Ogre Bodyguard"})
        for kind, name in books.items():
            with self.subTest(kind=kind.key):
                make_entry(kind, name, campaign=self.elsewhere)

                created = self.create_as(self.owner, kind, name)

                self.assertEqual(created.status_code, 201, created.data)
                if kind in OTHER_TYPE:
                    other = self.create_as(self.owner, kind, name, type=OTHER_TYPE[kind])
                    self.assertEqual(other.status_code, 201, other.data)

    def test_an_animal_and_a_hired_sword_of_one_name_are_one_bestiary_name(self):
        self.assertEqual(self.create_as(self.owner, BESTIARY, "Wolf").status_code, 201)

        response = self.create_as(self.owner, HIRED_SWORDS, "Wolf")

        self.assertEqual((response.status_code, response.json()), (400, duplicate_body(HIRED_SWORDS)))
        self.assertEqual(BestiaryEntry.objects.filter(name="Wolf").count(), 1)

    def test_renaming_onto_another_campaign_entry_is_refused(self):
        for kind in (ITEMS, SKILLS, SPELLS, SPECIALS, RACES, BESTIARY, HIRED_SWORDS):
            with self.subTest(kind=kind.key):
                make_entry(kind, f"Taken {kind.key}", campaign=self.campaign)
                entry = make_entry(kind, f"Free {kind.key}", campaign=self.campaign)

                response = self.patch_as(self.owner, kind.detail_url(entry.id), {"name": f"Taken {kind.key}"})

                self.assertEqual((response.status_code, response.json()), (400, duplicate_body(kind)))
                self.assertEqual(self.count(kind, f"Free {kind.key}"), 1)

    def test_the_book_holds_one_row_per_name_and_type(self):
        cases: list[tuple[Any, dict[str, Any]]] = [
            (Item, {"name": "Axe", "type": "Weapon"}),
            (Skill, {"name": "Sprint", "type": "Speed"}),
            (Spell, {"name": "Lifestealer", "type": "Necromancy"}),
            (Special, {"name": "Large", "type": "Trait"}),
            (Race, {"name": "Human"}),
            (BestiaryEntry, {"name": "Warhound", "type": "Monster"}),  # the bestiary: on name alone
        ]
        for model, fields in cases:
            with self.subTest(model=model.__name__):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    model.objects.create(**fields)


class HouseRuleCloneTests(CatalogueTestCase):
    def test_a_custom_heavy_armour_and_the_half_price_clone_live_side_by_side(self):
        # the custom entry of a book armour's name is still allowed, and the rule still clones the book armour
        custom = self.create_as(self.player, ITEMS, "Heavy Armour", type="Armour", subtype="Armour")
        rule = self.post_as(self.owner, self.url("rules/"), {"title": "Half price", "effect_key": HALF_PRICE_ARMOUR_EFFECT_KEY})  # fmt: skip

        self.assertEqual((custom.status_code, rule.status_code), (201, 201), rule.data)
        rows = Item.objects.filter(campaign=self.campaign, name="Heavy Armour", type="Armour")
        self.assertEqual(
            sorted((row.generated_effect_key or "", row.source_item_id or 0) for row in rows),
            [("", 0), (HALF_PRICE_ARMOUR_EFFECT_KEY, self.heavy_armour.id)],
        )
        self.assertEqual(self.delete_as(self.owner, self.url(f"rules/{rule.data['id']}/")).status_code, 204)
        self.assertEqual(list(rows.values_list("id", flat=True)), [custom.data["id"]])


class PlaceholderTests(CatalogueTestCase):
    def test_a_level_up_placeholder_is_the_one_book_row_whatever_a_campaign_holds(self):
        Skill.objects.create(name="New Skill", type="Pending", campaign=self.campaign)
        book = Skill.objects.get(name="New Skill", type="Pending", campaign__isnull=True)

        self.assertEqual(pending_placeholder(Skill, "New Skill"), book)
        created = pending_placeholder(Spell, "New Spell")
        self.assertEqual(pending_placeholder(Spell, "New Spell"), created)
        self.assertEqual(Spell.objects.filter(name="New Spell", campaign__isnull=True).count(), 1)
