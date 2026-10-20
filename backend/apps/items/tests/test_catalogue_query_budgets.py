"""Query budgets for the catalogue at today's counts (pass 5; CAT-TEST-07, CAT-TEST-08, PERF-13, PERF-44, PERF-46).

Requests are authenticated with `force_authenticate`, so production adds one JWT user query to each. A count above
its budget fails; a change that makes a request cheaper lowers its budget in the same commit. `apps/core/tests/
test_query_budgets.py` keeps the seven list budgets measured on the reference campaign; these add the item
properties and restrictions lists, the lists with campaign rows, the details and the writes.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.bestiary.models import BestiaryEntryItem, BestiaryEntrySkill, BestiaryEntrySpecial
from apps.items.models import Item, ItemAvailabilityRestriction, ItemProperty, ItemPropertyLink
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, KINDS, RACES, SKILLS, CatalogueTestCase, make_entry

# list -> (url, budget with book rows only, budget with campaign rows as well). The book rows include a Sword with
# a property and a restricted availability, and each campaign item has both, so every prefetch runs.
LIST_BUDGETS: dict[str, tuple[str, int, int]] = {
    # membership, exists(), then each half with its own 5-query prefetch chain (PERF-49; PR B: <= 7 either way)
    "items": ("/api/items/?campaign_id={campaign}", 9, 14),
    "skills": ("/api/skills/?campaign_id={campaign}", 4, 4),  # membership, exists(), campaign rows, book rows
    "spells": ("/api/spells/?campaign_id={campaign}", 4, 4),
    "specials": ("/api/special/?campaign_id={campaign}", 4, 4),
    "races": ("/api/races/?campaign_id={campaign}", 4, 4),
    "bestiary": ("/api/bestiary/?campaign_id={campaign}", 4, 4),
    "hired_swords": ("/api/hired-swords/?campaign_id={campaign}", 5, 6),  # + the restrictions of each half
    "restrictions": ("/api/restrictions/?campaign_id={campaign}", 4, 4),
    "item_properties": ("/api/item-properties/?campaign_id={campaign}", 2, 2),  # one filtered list
    "items_book": ("/api/items/", 6, 6),  # no campaign: the book list and its prefetch chain
}


class CatalogueQueryBudgetTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.owner)

    def count(self, method: str, url: str, body: dict[str, Any] | None = None, status: int = 200, **extra: Any) -> int:
        with CaptureQueriesContext(connection) as captured:
            if method == "get":
                response = self.client.get(url, **extra)
            else:
                response = getattr(self.client, method)(url, body or {}, format="json")
        self.assertEqual(response.status_code, status, getattr(response, "data", None))
        return len(captured)

    def budget_url(self, template: str) -> str:
        return template.format(campaign=self.campaign.id)

    def add_campaign_rows(self, label: str, count: int = 1) -> None:
        """`count` campaign rows of each kind; each item with a restricted availability and a property."""
        for index in range(count):
            for kind in KINDS:
                make_entry(kind, f"{label} {kind.key} {index}", campaign=self.campaign)
            restriction = Restriction.objects.create(restriction=f"{label} {index}", campaign=self.campaign)
            prop = ItemProperty.objects.create(name=f"{label} {index}", campaign=self.campaign)
            item = Item.objects.get(name=f"{label} items {index}")
            ItemAvailabilityRestriction.objects.create(item_availability=item.availabilities.get(), restriction=restriction)  # fmt: skip
            ItemPropertyLink.objects.create(item=item, property=prop)

    def add_book_rows(self, label: str, count: int) -> None:
        restriction = Restriction.objects.create(restriction=f"{label} only")
        for index in range(count):
            for kind in KINDS:
                make_entry(kind, f"{label} {kind.key} {index}")
            item = Item.objects.get(name=f"{label} items {index}")
            ItemAvailabilityRestriction.objects.create(item_availability=item.availabilities.get(), restriction=restriction)  # fmt: skip
            ItemPropertyLink.objects.create(item=item, property=self.parry)

    def test_lists_stay_within_budget_without_and_with_campaign_rows(self):
        for name, (template, book_only, _) in LIST_BUDGETS.items():
            with self.subTest(list=name, campaign_rows=False):
                self.assertLessEqual(self.count("get", self.budget_url(template)), book_only)
        self.add_campaign_rows("House")
        for name, (template, _, with_campaign) in LIST_BUDGETS.items():
            with self.subTest(list=name, campaign_rows=True):
                self.assertLessEqual(self.count("get", self.budget_url(template)), with_campaign)

    def test_list_queries_do_not_grow_with_rows(self):
        # CAT-TEST-07: book and campaign rows, each item with a restricted availability and a property
        self.add_campaign_rows("House")
        self.add_book_rows("Seed", 1)
        before = {name: self.count("get", self.budget_url(template)) for name, (template, _, _) in LIST_BUDGETS.items()}

        self.add_campaign_rows("More", count=5)
        self.add_book_rows("Extra", 10)

        for name, (template, _, _) in LIST_BUDGETS.items():
            with self.subTest(list=name):
                self.assertEqual(self.count("get", self.budget_url(template)), before[name])

    def test_a_revalidated_list_runs_every_query_to_answer_304(self):
        # Characterises current behaviour (PERF-13's server half, pinned; flips in PR B: at most 3 queries)
        url = self.budget_url(LIST_BUDGETS["items"][0])
        etag = self.client.get(url)["ETag"]

        self.assertEqual(self.count("get", url, status=304, HTTP_IF_NONE_MATCH=etag), self.count("get", url))

    def test_simple_details_cost_one_query_and_a_campaign_entry_two(self):
        for kind in KINDS:
            if kind in (RACES, BESTIARY, HIRED_SWORDS):
                continue  # races have no detail read; the bestiary details are below
            with self.subTest(kind=kind.key):
                book = make_entry(kind, f"Book {kind.key}")
                house = make_entry(kind, f"House {kind.key}", campaign=self.campaign)
                # an item's property links, availabilities and their restrictions (no property or animal links here)
                prefetches = 3 if kind is ITEMS else 0
                self.assertLessEqual(self.count("get", kind.detail_url(book.id)), 1 + prefetches)
                self.assertLessEqual(self.count("get", kind.detail_url(house.id)), 2 + prefetches)


class BestiaryDetailBudgetTests(CatalogueTestCase):
    """CAT-TEST-08, PERF-46: a hired sword like the Bounty Hunter (8 items, 2 skills, 2 specials)."""

    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.owner)
        self.profile = make_entry(HIRED_SWORDS, "Bounty Hunter", hire_cost=40)
        self.entry = self.profile.bestiary_entry
        self.restriction = Restriction.objects.create(restriction="Mordheim only")
        for skill in self.infiltration[:2]:
            BestiaryEntrySkill.objects.create(bestiary_entry=self.entry, skill=skill)
        for name in ("Dead shot", "Tracker"):
            BestiaryEntrySpecial.objects.create(bestiary_entry=self.entry, special=Special.objects.create(name=name, type="Ability"))  # fmt: skip
        self.equip(8)

    def equip(self, count: int) -> None:
        start = BestiaryEntryItem.objects.filter(bestiary_entry=self.entry).count()
        for index in range(start, start + count):
            item = make_entry(ITEMS, f"Gear {index}")
            ItemPropertyLink.objects.create(item=item, property=self.parry)
            ItemAvailabilityRestriction.objects.create(item_availability=item.availabilities.get(), restriction=self.restriction)  # fmt: skip
            BestiaryEntryItem.objects.create(bestiary_entry=self.entry, item=item)

    def count(self, url: str) -> int:
        with CaptureQueriesContext(connection) as captured:
            self.assertEqual(self.client.get(url).status_code, 200)
        return len(captured)

    def test_the_bestiary_and_hired_sword_details_cost_8_and_9_queries(self):
        # PERF-46, CAT-TEST-08 (was pinned: 51 and 52 here, 43 and 45 for the seeded Bounty Hunter; flipped in PR A):
        # the entry, its skills, specials and spells, its equipment with the items, and the items' properties,
        # availabilities and restrictions; the hired sword adds its restrictions. A campaign entry adds the
        # membership read.
        self.assertEqual(self.count(BESTIARY.detail_url(self.entry.id)), 8)
        self.assertEqual(self.count(HIRED_SWORDS.detail_url(self.profile.id)), 9)

    def test_the_details_stay_constant_as_equipment_grows(self):
        # PERF-46 (was pinned: 5 more queries per item; flipped in PR A)
        before = (self.count(BESTIARY.detail_url(self.entry.id)), self.count(HIRED_SWORDS.detail_url(self.profile.id)))

        self.equip(2)

        after = (self.count(BESTIARY.detail_url(self.entry.id)), self.count(HIRED_SWORDS.detail_url(self.profile.id)))
        self.assertEqual(after, before)

    def test_an_edit_answers_with_the_same_reads_whatever_the_equipment(self):
        # PERF-46: the PATCH answers read through the details' prefetch
        profile = make_entry(HIRED_SWORDS, "Duellist", campaign=self.campaign)
        entry = profile.bestiary_entry
        BestiaryEntryItem.objects.create(bestiary_entry=entry, item=make_entry(ITEMS, "Dagger"))

        def edits() -> tuple[int, int]:
            counts = []
            for url in (BESTIARY.detail_url(entry.id), HIRED_SWORDS.detail_url(profile.id)):
                with CaptureQueriesContext(connection) as captured:
                    self.assertEqual(self.client.patch(url, {"description": "Sharp"}, format="json").status_code, 200)
                counts.append(len(captured))
            return counts[0], counts[1]

        before = edits()
        for index in range(3):
            BestiaryEntryItem.objects.create(bestiary_entry=entry, item=make_entry(ITEMS, f"Blade {index}"))

        self.assertEqual(edits(), before)


class CatalogueWriteBudgetTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.owner)

    def count(self, url: str, body: dict[str, Any]) -> int:
        with CaptureQueriesContext(connection) as captured:
            response = self.client.post(url, body, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return len(captured)

    def test_creates_cost_queries_per_row_they_link(self):
        # Characterises current behaviour (PERF-44, pinned; flips in PR A: links by bulk_create, hired sword <= 10)
        restricted = {"restrictions": [{"restriction_id": self.mercenaries.id}]}
        properties = [self.parry.id, ItemProperty.objects.create(name="Cleave", type="Weapon").id]
        item = ITEMS.body("Halberd", self.campaign, availabilities=[{"cost": 10, **restricted}, {"cost": 20, **restricted}], property_ids=properties)  # fmt: skip
        skills = [Skill.objects.create(name=f"Trick {n}", type="Combat").id for n in range(6)]
        specials = [Special.objects.create(name=f"Gift {n}", type="Ability").id for n in range(3)]
        gear = [{"item_id": make_entry(ITEMS, f"Kit {n}").id, "quantity": 1} for n in range(6)]
        sword = HIRED_SWORDS.body("Mercenary", self.campaign, skill_ids=skills, special_ids=specials, item_entries=gear)

        # 2 availabilities: an INSERT and a restriction read and INSERT each; 2 properties: a get_or_create each;
        # +2 since BUG-17: the duplicate guard's savepoint around the INSERT (a test runs inside a transaction; in
        # production the guard's BEGIN and COMMIT are no queries)
        self.assertLessEqual(self.count(ITEMS.list_url(), item), 27)
        # 15 links: a get_or_create each (SELECT, SAVEPOINT, INSERT, RELEASE); the answer reads through the details'
        # prefetch (PERF-46: 98 -> 78)
        self.assertLessEqual(self.count(HIRED_SWORDS.list_url(), sword), 78)
        # membership, INSERT and the guard's savepoint (+2 since BUG-17, tests only)
        self.assertLessEqual(self.count(SKILLS.list_url(), SKILLS.body("Feint", self.campaign)), 5)
