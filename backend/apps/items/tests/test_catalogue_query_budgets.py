"""Query budgets for the catalogue at today's counts (pass 5; CAT-TEST-07, CAT-TEST-08, PERF-13, PERF-44, PERF-46).

Requests are authenticated with `force_authenticate`, so production adds one JWT user query to each. A count above
its budget fails; a change that makes a request cheaper lowers its budget in the same commit. `apps/core/tests/
test_query_budgets.py` keeps the seven list budgets measured on the reference campaign; these add the item
properties and restrictions lists, the lists with campaign rows, the details and the writes.
"""

from typing import Any
from unittest import mock

from django.core.cache import caches
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.serializers import BaseSerializer

from apps.bestiary.models import BestiaryEntryItem, BestiaryEntrySkill, BestiaryEntrySpecial
from apps.core.models import CatalogueRemoval
from apps.items.models import Item, ItemAvailabilityRestriction, ItemProperty, ItemPropertyLink
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special
from apps.warbands.models import WarbandItem
from apps.warbands.tests.roster_support import HERO, make_unit

from .catalogue_support import (
    BESTIARY,
    HIRED_SWORDS,
    ITEMS,
    KINDS,
    RACES,
    SKILLS,
    CatalogueTestCase,
    catalogue_cache_on,
    make_entry,
)

# list -> (url, budget with book rows only, budget with campaign rows as well). The book rows include a Sword with
# a property and a restricted availability, and each campaign item has both, so every prefetch runs.
LIST_BUDGETS: dict[str, tuple[str, int, int]] = {
    # PERF-49 (were 9 and 14: exists(), then each half with its own prefetch chain): membership, the merged rows (an
    # animal's entry joined), their property links, availabilities and restriction links; + an animal's specials
    "items": ("/api/items/?campaign_id={campaign}", 5, 5),
    "skills": ("/api/skills/?campaign_id={campaign}", 2, 2),  # membership, the merged rows (were 4)
    "spells": ("/api/spells/?campaign_id={campaign}", 2, 2),
    "specials": ("/api/special/?campaign_id={campaign}", 2, 2),
    "races": ("/api/races/?campaign_id={campaign}", 2, 2),
    "bestiary": ("/api/bestiary/?campaign_id={campaign}", 2, 2),
    "hired_swords": ("/api/hired-swords/?campaign_id={campaign}", 3, 3),  # + their restrictions (were 5 and 6)
    "restrictions": ("/api/restrictions/?campaign_id={campaign}", 2, 2),
    "item_properties": ("/api/item-properties/?campaign_id={campaign}", 2, 2),  # one filtered list
    "items_book": ("/api/items/", 5, 5),  # no campaign: the book's version (PERF-13), its rows and their chain (was 6)
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

    def add_versions_archives_and_removals(self, label: str) -> None:
        """For each kind, a campaign version of a new book entry, an archived campaign entry and a removed book entry
        (PR C: what the lists hide, and show with ?archived=1)."""
        for kind in KINDS:
            book = make_entry(kind, f"{label} book {kind.key}")
            entry = book.bestiary_entry if kind is HIRED_SWORDS else book
            make_entry(kind, f"{label} version {kind.key}", campaign=self.campaign, replaces=entry)
            make_entry(kind, f"{label} archived {kind.key}", campaign=self.campaign, archived_at=timezone.now())
            removed = make_entry(kind, f"{label} removed {kind.key}")
            table = "bestiary" if kind is HIRED_SWORDS else kind.key
            entry_id = removed.bestiary_entry_id if kind is HIRED_SWORDS else removed.id
            CatalogueRemoval.objects.create(campaign=self.campaign, kind=table, entry_id=entry_id)

    def test_lists_keep_their_budgets_with_versions_archives_and_removals(self):
        # CAT-TWEAK-03, -04, CAT-NEW-03: the version and removal rules are EXISTS in the list's own query, and the
        # badges read joins and one annotation, so nothing is added, with or without ?archived=1, as rows grow
        self.add_campaign_rows("House")
        self.add_versions_archives_and_removals("First")
        before = {name: self.count("get", self.budget_url(template)) for name, (template, _, _) in LIST_BUDGETS.items()}
        self.add_versions_archives_and_removals("Second")
        for name, (template, _, with_campaign) in LIST_BUDGETS.items():
            url = self.budget_url(template)
            archived = f"{url}{'&' if '?' in url else '?'}archived=1"
            with self.subTest(list=name):
                self.assertEqual((self.count("get", url), self.count("get", archived)), (before[name], before[name]))
                self.assertLessEqual(before[name], with_campaign)

    def test_the_items_list_costs_6_queries_with_campaign_rows_and_an_animal(self):
        # PERF-49, CAT-TEST-07 (at most 7 either way): an Animal item adds its entry's specials, in one query
        self.add_campaign_rows("House")
        make_entry(ITEMS, "Hound", type="Animal", subtype="", bestiary_entry=self.warhound)

        self.assertEqual(self.count("get", self.budget_url(LIST_BUDGETS["items"][0])), 6)

    def test_a_revalidated_list_costs_one_query_and_no_serialisation(self):
        # PERF-13, CAT-TEST-06 (was pinned: a 304 ran every query of the list and its serialisation; flipped in PR B):
        # the membership, which carries the campaign's catalogue version (without a campaign, the book's version); the
        # body comes from the cache
        with catalogue_cache_on():
            caches["catalogue"].clear()
            for name, (template, _, _) in LIST_BUDGETS.items():
                url = self.budget_url(template)
                etag = self.client.get(url)["ETag"]
                serialised = mock.patch.object(
                    BaseSerializer, "data", new_callable=mock.PropertyMock, side_effect=AssertionError
                )
                with self.subTest(list=name), serialised:
                    self.assertEqual(self.count("get", url, status=304, HTTP_IF_NONE_MATCH=etag), 1)

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
    """PERF-44: a write costs the same however many rows it links (they were a get_or_create each). Counts include
    the write's savepoint pair: a test runs inside a transaction, where production has a BEGIN and a COMMIT."""

    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.owner)

    def count(self, url: str, body: dict[str, Any]) -> int:
        with CaptureQueriesContext(connection) as captured:
            response = self.client.post(url, body, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return len(captured)

    def item_body(self, name: str, links: int) -> dict[str, Any]:
        restricted = {"restrictions": [{"restriction_id": self.mercenaries.id}]}
        properties = [ItemProperty.objects.create(name=f"{name} rule {n}", type="Weapon").id for n in range(links)]
        availabilities = [{"cost": 10 * (n + 1), **restricted} for n in range(links)]
        return ITEMS.body(name, self.campaign, availabilities=availabilities, property_ids=properties)

    def test_an_item_create_costs_15_queries_however_many_rows_it_links(self):
        # PERF-44, BUG-53 (was pinned at 25: an INSERT and a restriction read per availability, a get_or_create per
        # property; flipped in PR A). Membership, a scope check for the properties and one for the restrictions, the
        # savepoint pair, the item, its availabilities, their restrictions and its properties in one INSERT each,
        # then the answer: the item and its three prefetches (15 with five, before PERF-49 joined the properties and
        # restrictions to their links), the campaign's catalogue version bumped with the write (PERF-13), and the name
        # check (CAT-TWEAK-02, PR C: 14 before)
        self.assertEqual(self.count(ITEMS.list_url(), self.item_body("Halberd", 2)), 15)
        self.assertEqual(self.count(ITEMS.list_url(), self.item_body("Glaive", 6)), 15)

    def test_a_hired_sword_create_costs_22_queries_however_many_rows_it_links(self):
        # PERF-44, BUG-53 (was pinned at 96: a get_or_create per link, then the answer's N+1; flipped in PR A). The
        # write: membership, a scope check per table sent (skills, specials, items), the savepoint pair, the entry,
        # one INSERT per kind of link, the profile, the campaign's catalogue version (PERF-13) and the name check
        # (13; CAT-TWEAK-02, PR C: 21 before). The answer: the hired sword detail's 9 prefetched reads, spells and
        # restrictions included though none were sent. The brief's 10 would need the answer built from what was
        # written instead of read back.
        skills = [Skill.objects.create(name=f"Trick {n}", type="Combat").id for n in range(6)]
        specials = [Special.objects.create(name=f"Gift {n}", type="Ability").id for n in range(3)]
        gear = [{"item_id": make_entry(ITEMS, f"Kit {n}").id, "quantity": 1} for n in range(6)]
        sword = HIRED_SWORDS.body("Mercenary", self.campaign, skill_ids=skills, special_ids=specials, item_entries=gear)
        small = HIRED_SWORDS.body("Squire", self.campaign, skill_ids=skills[:1], special_ids=specials[:1], item_entries=gear[:1])  # fmt: skip

        self.assertEqual(self.count(HIRED_SWORDS.list_url(), sword), 22)
        self.assertEqual(self.count(HIRED_SWORDS.list_url(), small), 22)

    def test_a_skill_create_costs_6_queries(self):
        # membership, the name check (CAT-TWEAK-02, PR C), the savepoint pair, the INSERT and the campaign's catalogue
        # version (PERF-13). It was 5 before the name check, 5 with the campaign read by the serializer's campaign field
        # instead of the version (IMP-79 dropped it), 3 before the duplicate guard's savepoint (BUG-17)
        self.assertEqual(self.count(SKILLS.list_url(), SKILLS.body("Feint", self.campaign)), 6)


class VersionWriteBudgetTests(CatalogueTestCase):
    """CAT-TEST-23 and decision 5's writes: a first edit, a Revert, an archive and the usage cost these counts whatever
    the number of copies (test_catalogue_versions.py proves them constant in copies). Counts include the write's
    savepoint pair; production adds the JWT user query."""

    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(user=self.owner)
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.book_sword, cost=10)
        WarbandItem.objects.create(warband=self.warband, item=self.book_sword, quantity=1, cost=10)
        self.hero = hero

    def count(self, call: Any, status: int = 200) -> int:
        with CaptureQueriesContext(connection) as captured:
            response = call()
        self.assertEqual(response.status_code, status, getattr(response, "data", None))
        return len(captured)

    def test_an_items_first_edit_costs_28_queries_and_its_revert_31(self):
        # first edit: membership, the entry, the name check, the savepoint pair, the book row locked and its version
        # looked for, the copy (the item, then a read and an INSERT each for its availabilities, their restrictions
        # and its properties), one UPDATE per table of copies (three kinds of unit, the stash, bestiary links), the
        # edit (the copied availabilities deleted with their restrictions, the new ones written), the catalogue
        # version, and the answer (the item and its three prefetches). Revert: membership, the
        # entry, the savepoint pair, the version locked, the units' copies moved back (one UPDATE each), the stash
        # and bestiary links read with the rows they may meet and merged, the reverted id recorded, the version's
        # delete (Django's reads of every table that references an item, then its children), the catalogue version,
        # and the answer
        body = {"campaign_id": self.campaign.id, "availabilities": [{"cost": 15}]}
        version: dict[str, int] = {}

        def edit() -> Any:
            response = self.client.patch(ITEMS.detail_url(self.book_sword.id), body, format="json")
            version["id"] = response.data["id"]
            return response

        self.assertEqual(self.count(edit), 28)
        self.assertEqual(self.count(lambda: self.client.post(f"{ITEMS.detail_url(version['id'])}revert/")), 31)

    def test_an_items_usage_costs_7_queries_and_archiving_it_21(self):
        # usage: membership, the entry, one read per table of copies; archive: the delete refused by RESTRICT inside
        # a savepoint, the archive UPDATE, the catalogue version, then the usage counts
        charm = make_entry(ITEMS, "Charm", campaign=self.campaign)
        self.hero.hero_items.create(item=charm, cost=1)

        self.assertEqual(self.count(lambda: self.client.get(f"{ITEMS.detail_url(charm.id)}usage/")), 7)
        self.assertEqual(self.count(lambda: self.client.delete(ITEMS.detail_url(charm.id))), 21)
