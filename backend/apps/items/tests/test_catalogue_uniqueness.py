"""The base uniqueness constraints of the catalogue tables (BUG-17, IMP-83, CAT-TEST-12).

One row per name (and type) in the book, in an add-on and in a campaign, NULLs not distinct: items, skills, spells
and specials on name and type, races on name, the bestiary, hired swords and dramatis personae on name (as their
seeders upsert them). A campaign version keeps its book entry's name, since the campaign is part of the key.
House-rule clones are left out of the item constraint (a custom "Heavy Armour" written before PR C and the
half-price clone of the book's may live side by side). The API's wider name rule (CAT-TWEAK-02) is
test_catalogue_names.py's; the constraint backs it when two writes take one name at once.
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

from .catalogue_support import ITEMS, CatalogueTestCase, make_entry


class BookUniquenessTests(CatalogueTestCase):
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
        # a custom entry of a book armour's name (written before PR C's name rule) stays, the rule still clones the
        # book armour, and the API refuses another one, naming the book armour and the clone
        custom = make_entry(ITEMS, "Heavy Armour", campaign=self.campaign, type="Armour", subtype="Armour")
        rule = self.post_as(self.owner, self.url("rules/"), {"title": "Half price", "effect_key": HALF_PRICE_ARMOUR_EFFECT_KEY})  # fmt: skip
        refused = self.create_as(self.player, ITEMS, "heavy armour ", type="Armour", subtype="Armour")

        self.assertEqual(rule.status_code, 201, rule.data)
        rows = Item.objects.filter(campaign=self.campaign, name="Heavy Armour", type="Armour")
        self.assertEqual(
            sorted((row.generated_effect_key or "", row.replaces_id or 0) for row in rows),
            [("", 0), (HALF_PRICE_ARMOUR_EFFECT_KEY, self.heavy_armour.id)],
        )
        self.assertEqual(
            (refused.status_code, refused.json()["code"], len(refused.json()["matches"])), (400, "name_taken", 3)
        )
        self.assertEqual(self.delete_as(self.owner, self.url(f"rules/{rule.data['id']}/")).status_code, 204)
        self.assertEqual(list(rows.values_list("id", flat=True)), [custom.id])


class PlaceholderTests(CatalogueTestCase):
    def test_a_level_up_placeholder_is_the_one_book_row_whatever_a_campaign_holds(self):
        Skill.objects.create(name="New Skill", type="Pending", campaign=self.campaign)
        book = Skill.objects.get(name="New Skill", type="Pending", campaign__isnull=True)

        self.assertEqual(pending_placeholder(Skill, "New Skill"), book)
        created = pending_placeholder(Spell, "New Spell")
        self.assertEqual(pending_placeholder(Spell, "New Spell"), created)
        self.assertEqual(Spell.objects.filter(name="New Spell", campaign__isnull=True).count(), 1)
