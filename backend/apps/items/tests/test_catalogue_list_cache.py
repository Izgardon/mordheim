"""Catalogue lists are cached per kind, campaign, catalogue version and query (PERF-13, CAT-TEST-06).

A list answered from the cache is the body and headers it was first sent with, and costs one query: the membership,
which carries the campaign's catalogue version (without a campaign, the book's version). Every write that changes
what a list shows bumps a version in its transaction: the catalogue's create, edit and delete of every kind, adding
an item property, a house rule switched on or off, an injury's new campaign special, and each seeder (the book's
version and every campaign's).
"""

import io
from typing import Any

from django.core.cache import caches
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.services.injuries import InjuryOutcome, apply_stat_and_special
from apps.campaigns.models import CampaignSettings
from apps.core.catalogue.cache import book_version
from apps.items.services import HALF_PRICE_ARMOUR_EFFECT_KEY
from apps.restrictions.models import Restriction
from apps.warbands.tests.roster_support import HERO, make_unit

from .catalogue_support import (
    ITEMS,
    KINDS,
    SKILLS,
    SPECIALS,
    STATS,
    CatalogueKind,
    CatalogueTestCase,
    catalogue_cache_on,
)
from .test_catalogue_characterisation_seeders import data_file, run

HEADERS = ("Content-Type", "ETag", "Cache-Control", "Vary", "Allow")
LISTS = (*(kind.path for kind in KINDS), "restrictions", "item-properties")


@catalogue_cache_on()
class CatalogueListCacheTestCase(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        caches["catalogue"].clear()
        self.client.force_authenticate(user=self.owner)

    def read(self, url: str) -> tuple[Any, int]:
        """The list's answer and the queries it cost."""
        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        return response, len(captured)

    def names(self, kind: CatalogueKind) -> list[str]:
        return [kind.row_name(row) for row in self.read(kind.list_url(self.campaign))[0].json()]


class CachedListTests(CatalogueListCacheTestCase):
    def test_a_cached_list_is_the_body_and_headers_it_was_first_sent_with(self):
        for path in LISTS:
            for url in (f"/api/{path}/?campaign_id={self.campaign.id}", f"/api/{path}/"):
                with self.subTest(url=url):
                    fresh, _ = self.read(url)
                    cached, queries = self.read(url)
                    self.assertEqual(cached.content, fresh.content)
                    self.assertEqual([cached.get(h) for h in HEADERS], [fresh.get(h) for h in HEADERS])
                    self.assertEqual(queries, 1)  # the membership (with the campaign's version), or the book's version

    def test_each_query_is_cached_apart(self):
        weapons = self.read(f"{ITEMS.list_url(self.campaign)}&type=weapon")[0].json()
        searched = self.read(f"{ITEMS.list_url(self.campaign)}&search=axe")[0].json()

        self.assertEqual([row["name"] for row in weapons], ["Axe", "Sword"])
        self.assertEqual([row["name"] for row in searched], ["Axe"])

    def test_the_browsable_api_is_never_served_from_the_cache(self):
        url = SKILLS.list_url(self.campaign)
        self.read(url)

        html = self.client.get(url, HTTP_ACCEPT="text/html")

        self.assertTrue(html["Content-Type"].startswith("text/html"))
        self.assertEqual(self.read(url)[0]["Content-Type"], "application/json")

    def test_another_campaigns_write_leaves_this_campaigns_lists_cached(self):
        self.read(SKILLS.list_url(self.campaign))
        self.post_as(self.outsider, SKILLS.list_url(), SKILLS.body("Their trick", self.elsewhere))

        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.read(SKILLS.list_url(self.campaign))[1], 1)  # the membership: still cached


class CacheInvalidationTests(CatalogueListCacheTestCase):
    def test_every_catalogue_create_edit_and_delete_retires_the_campaigns_list(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.names(kind)
                created = self.create_as(self.owner, kind, f"Fresh {kind.key}")
                self.assertIn(f"Fresh {kind.key}", self.names(kind))

                self.patch_as(self.owner, kind.detail_url(created.data["id"]), {"name": f"Renamed {kind.key}"})
                self.assertIn(f"Renamed {kind.key}", self.names(kind))

                self.delete_as(self.owner, kind.detail_url(created.data["id"]))
                self.assertNotIn(f"Renamed {kind.key}", self.names(kind))

    def test_adding_an_item_property_retires_the_property_list(self):
        url = f"/api/item-properties/?campaign_id={self.campaign.id}"
        self.read(url)

        self.post_as(self.owner, "/api/item-properties/", {"campaign_id": self.campaign.id, "name": "Cleave"})

        self.assertIn("Cleave", [row["name"] for row in self.read(url)[0].json()])

    def test_switching_a_house_rule_on_and_off_retires_the_items_list(self):
        def armour() -> list[tuple[int | None, int]]:
            rows = self.read(ITEMS.list_url(self.campaign))[0].json()
            return [(row["campaign_id"], row["availabilities"][0]["cost"]) for row in rows if row["name"] == "Heavy Armour"]  # fmt: skip

        self.assertEqual(armour(), [(None, 50)])
        rule = self.post_as(
            self.owner, self.url("rules/"), {"title": "Cheap", "effect_key": HALF_PRICE_ARMOUR_EFFECT_KEY}
        )
        self.assertEqual(armour(), [(self.campaign.id, 25)])

        self.delete_as(self.owner, self.url(f"rules/{rule.data['id']}/"))
        self.assertEqual(armour(), [(None, 50)])

    def test_a_seed_retires_the_book_list_and_every_campaigns_list(self):
        book, campaign = "/api/restrictions/", f"/api/restrictions/?campaign_id={self.campaign.id}"
        before = (len(self.read(book)[0].json()), len(self.read(campaign)[0].json()))

        call_command("seed_restrictions", stdout=io.StringIO())

        after = (len(self.read(book)[0].json()), len(self.read(campaign)[0].json()))
        self.assertEqual(before, (1, 1))
        self.assertEqual(after[0], Restriction.objects.filter(campaign__isnull=True).count())
        self.assertGreater(after[0], 50)
        self.assertEqual(after[1], after[0])

    def test_every_seeder_moves_the_books_version_and_every_campaigns(self):
        def moved(command: str, **options: Any) -> bool:
            def versions() -> list[Any]:
                return [
                    book_version(),
                    *CampaignSettings.objects.order_by("id").values_list("catalogue_version", flat=True),
                ]

            before = versions()
            run(command, **options)
            return all(new != old for new, old in zip(versions(), before, strict=True))

        rows: dict[str, list[dict[str, Any]]] = {
            "seed_races": [{"name": "Gnome", **STATS}],
            "seed_restrictions": [{"restriction": "Gnomes", "type": "Warband"}],
            "seed_items": [{"name": "Gnome hammer", "type": "Weapon", "cost": 5}],
            "seed_skills": [{"name": "Tinker", "type": "Gnome", "description": "Fixes things."}],
            "seed_bestiary": [{"name": "Gnome", "kind": "creature", **STATS}],
        }
        with data_file([]) as no_properties:
            for command, data in rows.items():
                with self.subTest(command=command), data_file(data) as path:
                    options: dict[str, Any] = (
                        {"json_paths": [path]} if command == "seed_bestiary" else {"json_path": path}
                    )
                    if command == "seed_items":
                        options["properties_path"] = no_properties
                    self.assertTrue(moved(command, **options))
        self.assertTrue(moved("seed_spells_and_special"))  # the committed spells and specials

    def test_an_injurys_new_campaign_special_retires_the_specials_list(self):
        self.assertNotIn("Hand Injury", self.names(SPECIALS))
        hero = make_unit(HERO, self.warband, name="Brute")

        apply_stat_and_special(hero, InjuryOutcome(special="Hand Injury"), self.campaign.id)

        self.assertIn("Hand Injury", self.names(SPECIALS))
