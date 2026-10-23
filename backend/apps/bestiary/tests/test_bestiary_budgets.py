"""Query budgets for the bestiary by kind and its Animal items (the bestiary rewrite step 3).

A list row carries its beast's item and prices: two queries for any number of rows (none in the pickers' summary
view). A write costs the same however many links and prices it sends, and a book beast's first edit and Revert,
which version its item too, the same however many copies hold the item. Counts include the write's savepoint pair;
production adds the JWT user query.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.bestiary.models import BestiaryEntryItem, WarbandBestiaryFavourite
from apps.items.models import ItemAvailabilityRestriction
from apps.items.tests.catalogue_support import BESTIARY, ITEMS, CatalogueTestCase, make_beast, make_entry
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.warbands.models import WarbandItem
from apps.warbands.tests.roster_support import HERO, make_unit


class BestiaryBudgetTestCase(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.owner)
        self.restriction = Restriction.objects.create(restriction="Humans only")

    def count(self, call: Any, status: int = 200) -> int:
        with CaptureQueriesContext(connection) as captured:
            response = call()
        self.assertEqual(response.status_code, status, getattr(response, "data", None))
        return len(captured)

    def beasts(self, label: str, count: int, campaign: Any = None) -> list[Any]:
        """`count` sold beasts, each item with a restricted price."""
        made = []
        for index in range(count):
            beast = make_beast(f"{label} {index}", campaign=campaign, kind="mount", available_in_shop=True, cost=40)
            ItemAvailabilityRestriction.objects.create(item_availability=beast.animal_item.availabilities.get(), restriction=self.restriction)  # fmt: skip
            made.append(beast)
        return made


class BestiaryReadBudgetTests(BestiaryBudgetTestCase):
    def test_the_list_costs_4_queries_whatever_the_rows_and_the_summary_2(self):
        # membership, the merged rows with their items joined, the items' prices, their restrictions; the pickers'
        # summary view reads no item
        self.beasts("Book", 1)
        self.beasts("House", 1, self.campaign)
        url = BESTIARY.list_url(self.campaign)
        before = (self.count(lambda: self.client.get(url)), self.count(lambda: self.client.get(f"{url}&view=summary")))

        self.beasts("More book", 4)
        self.beasts("More house", 4, self.campaign)

        self.assertEqual(before, (4, 2))
        self.assertEqual((self.count(lambda: self.client.get(url)), self.count(lambda: self.client.get(f"{url}&view=summary"))), before)  # fmt: skip

    def test_the_detail_costs_10_queries_whatever_its_prices_and_equipment(self):
        # the entry with its item joined, the item's prices and their restrictions, then PERF-46's reads: skills,
        # specials, spells, the equipment with its items, and their properties, prices and restrictions
        [beast] = self.beasts("Destrier", 1)
        BestiaryEntryItem.objects.create(bestiary_entry=beast, item=make_entry(ITEMS, "Saddle"))
        url = BESTIARY.detail_url(beast.id)
        before = self.count(lambda: self.client.get(url))

        beast.animal_item.availabilities.create(cost=60, rarity=9)
        for index in range(3):
            BestiaryEntryItem.objects.create(bestiary_entry=beast, item=make_entry(ITEMS, f"Barding {index}"))

        self.assertEqual((before, self.count(lambda: self.client.get(url))), (10, 10))

    def test_a_warbands_favourites_cost_5_queries_whatever_their_number(self):
        # the warband, the membership, the favourites with their beasts and items joined, the prices, their
        # restrictions
        url = f"/api/warbands/{self.warband.id}/bestiary-favourites/"
        for beast in self.beasts("Fond", 1):
            WarbandBestiaryFavourite.objects.create(warband=self.warband, bestiary_entry=beast)
        before = self.count(lambda: self.client.get(url))

        for beast in self.beasts("Fonder", 4):
            WarbandBestiaryFavourite.objects.create(warband=self.warband, bestiary_entry=beast)

        self.assertEqual((before, self.count(lambda: self.client.get(url))), (5, 5))


class BestiaryWriteBudgetTests(BestiaryBudgetTestCase):
    def body(self, name: str, links: int) -> dict[str, Any]:
        skills = [Skill.objects.create(name=f"{name} trick {n}", type="Animal").id for n in range(links)]
        gear = [make_entry(ITEMS, f"{name} gear {n}").id for n in range(links)]
        restricted = [{"restriction_id": self.restriction.id, "additional_note": f"note {n}"} for n in range(links)]
        prices = [{"cost": 10 * (n + 1), "restrictions": restricted} for n in range(links)]
        return BESTIARY.body(
            name, self.campaign, kind="mount", available_in_shop=True, skill_ids=skills, item_entries=gear,
            item={"grade": "1a", "availabilities": prices},
        )  # fmt: skip

    def test_a_create_costs_24_queries_however_many_links_and_prices_it_sends(self):
        # membership, the scope checks (restrictions, skills, items), the name check, the savepoint pair, the beast,
        # its skills and equipment, its item, the item's prices and their restrictions in one INSERT each, the
        # catalogue version, then the answer: the detail's 10 reads
        pony, destrier = self.body("Pony", 1), self.body("Destrier", 5)

        small = self.count(lambda: self.client.post(BESTIARY.list_url(), pony, format="json"), 201)
        large = self.count(lambda: self.client.post(BESTIARY.list_url(), destrier, format="json"), 201)

        self.assertEqual((small, large), (24, 24))

    def test_an_edit_costs_31_queries_however_many_links_and_prices_it_sends(self):
        # as a create, with the entry read first, each sent list's old links deleted, and the item read, updated and
        # its old prices (with their restrictions) deleted
        [beast] = self.beasts("Mule", 1, self.campaign)

        def edit(body: dict[str, Any]) -> int:
            body = {key: value for key, value in body.items() if key != "campaign_id"}
            return self.count(lambda: self.client.patch(BESTIARY.detail_url(beast.id), body, format="json"))

        pony, destrier = self.body("Pony", 1), self.body("Destrier", 5)
        self.assertEqual((edit(pony), edit(destrier)), (31, 31))


class BestiaryVersionBudgetTests(BestiaryBudgetTestCase):
    def hold(self, item: Any, copies: int) -> None:
        for index in range(copies):
            make_unit(HERO, self.warband, name=f"Rider {item.id} {index}").hero_items.create(item=item, cost=40)
            WarbandItem.objects.create(warband=self.rival_warband, item=item, quantity=1, cost=40 + index)

    def first_edit_and_revert(self, beast: Any) -> tuple[int, int]:
        version: dict[str, int] = {}
        body = {"campaign_id": self.campaign.id, "name": f"{beast.name} II", "item": {"availabilities": [{"cost": 50}]}}

        def edit() -> Any:
            response = self.client.patch(BESTIARY.detail_url(beast.id), body, format="json")
            version["id"] = response.data["id"]
            return response

        edited = self.count(edit)
        return edited, self.count(lambda: self.client.post(f"{BESTIARY.detail_url(version['id'])}revert/"))

    def test_a_first_edit_costs_45_queries_and_its_revert_51_however_many_copies_hold_the_item(self):
        # first edit: pass 5's beast version (the book row locked, its version looked for, the copy and its four link
        # tables, the favourites moved), then the item's (the book item found and locked, its version looked for, the
        # copy pointed at the beast's version, its prices, restrictions and properties copied, one UPDATE per table
        # of copies), the edit with its item, the catalogue version and the answer. Revert: the item's version goes
        # first (copies moved back or merged, the reverted id recorded, Django's reads before its delete), then the
        # beast's (favourites, the reverted id, its delete), the catalogue version and the answer
        few, many = self.beasts("Horse", 2)
        self.hold(few.animal_item, 1)
        self.hold(many.animal_item, 4)

        self.assertEqual((self.first_edit_and_revert(few), self.first_edit_and_revert(many)), ((45, 51), (45, 51)))
