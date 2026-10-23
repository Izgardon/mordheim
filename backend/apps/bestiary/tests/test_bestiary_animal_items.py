"""One Animal item per beast (the bestiary rewrite step 3).

Every bestiary write keeps its beast's item in step: in the beast's campaign, named after it, its subtype the kind's
label (Mount, Pet, Creature), its description the beast's, listed in the shop exactly when the beast is sold, with
the grade and prices the write sends under `item`. A beast that isn't sold keeps its item and its prices, so kits,
trades and owned copies always resolve. The items routes read Animal items but never write them: the bestiary does.
"""

from typing import Any

from django.db import IntegrityError, transaction

from apps.bestiary.models import BestiaryEntry
from apps.items.models import Item
from apps.items.tests.catalogue_support import BESTIARY, ITEMS, CatalogueTestCase, make_beast, make_entry


def prices(item: Item) -> list[tuple[int, int, str | None, list[tuple[int, str]]]]:
    return [
        (
            row.cost,
            row.rarity,
            row.variable_cost,
            list(row.restriction_links.values_list("restriction_id", "additional_note")),
        )  # fmt: skip
        for row in item.availabilities.order_by("cost")
    ]


class AnimalItemWriteTests(CatalogueTestCase):
    def sold(self, **item: Any) -> dict[str, Any]:
        return {"kind": "mount", "description": "Fast.", "available_in_shop": True, "item": item}

    def test_a_create_makes_the_beasts_item_with_its_grade_and_prices(self):
        restricted = [{"restriction_id": self.mercenaries.id, "additional_note": "only"}]
        price = {"cost": 80, "rarity": 11, "variable_cost": "+D6", "restrictions": restricted}

        created = self.create_as(self.owner, BESTIARY, "Destrier", **self.sold(grade="1b", availabilities=[price]))

        self.assertEqual(created.status_code, 201, created.data)
        item = Item.objects.get(bestiary_entry_id=created.data["id"])
        self.assertEqual(
            (item.campaign_id, item.name, item.type, item.subtype, item.grade, item.description, item.listed),
            (self.campaign.id, "Destrier", "Animal", "Mount", "1b", "Fast.", True),
        )
        self.assertEqual(prices(item), [(80, 11, "+D6", [(self.mercenaries.id, "only")])])
        answer = created.data["item"]
        self.assertEqual((answer["id"], answer["grade"], len(answer["availabilities"])), (item.id, "1b", 1))
        self.assertEqual(answer["availabilities"][0]["restrictions"][0]["additional_note"], "only")

    def test_a_beast_not_sold_still_has_its_item_unlisted(self):
        created = self.create_as(self.owner, BESTIARY, "Wyvern", kind="creature")

        item = Item.objects.get(bestiary_entry_id=created.data["id"])
        self.assertEqual((item.listed, item.subtype, prices(item)), (False, "Creature", []))
        self.assertEqual(created.data["item"], {"id": item.id, "grade": "", "availabilities": []})

    def test_an_edit_keeps_the_item_in_step_and_unticking_keeps_the_prices(self):
        created = self.create_as(self.owner, BESTIARY, "Destrier", **self.sold(availabilities=[{"cost": 80}]))
        url = BESTIARY.detail_url(created.data["id"])

        unticked = self.patch_as(self.owner, url, {"name": "Charger", "kind": "creature", "description": "Big.", "available_in_shop": False})  # fmt: skip
        priced = self.patch_as(self.owner, url, {"item": {"grade": "2a", "availabilities": [{"cost": 95}]}})
        ticked = self.patch_as(self.owner, url, {"available_in_shop": True})

        self.assertEqual([r.status_code for r in (unticked, priced, ticked)], [200, 200, 200])
        item = Item.objects.get(bestiary_entry_id=created.data["id"])
        self.assertEqual((item.name, item.subtype, item.description, item.grade, item.listed), ("Charger", "Creature", "Big.", "2a", True))  # fmt: skip
        self.assertEqual(prices(item), [(95, 2, None, [])])
        self.assertEqual([a["cost"] for a in unticked.data["item"]["availabilities"]], [80])  # kept while unticked
        self.assertEqual(Item.objects.filter(type="Animal", campaign=self.campaign).count(), 1)

    def test_prices_sent_with_the_beast_unticked_are_kept_for_later(self):
        created = self.create_as(self.owner, BESTIARY, "Mule", kind="mount", item={"availabilities": [{"cost": 30}]})

        item = Item.objects.get(bestiary_entry_id=created.data["id"])
        self.assertEqual((item.listed, prices(item)), (False, [(30, 2, None, [])]))

    def test_an_unknown_restriction_in_the_prices_writes_nothing(self):
        price = {"cost": 80, "restrictions": [{"restriction_id": 999999}]}
        theirs = self.create_as(self.owner, BESTIARY, "Destrier", **self.sold(availabilities=[price]))

        self.assertEqual((theirs.status_code, list(theirs.data)), (400, ["item"]))
        self.assertFalse(BestiaryEntry.objects.filter(name="Destrier").exists())
        self.assertFalse(Item.objects.filter(name="Destrier").exists())

    def test_an_edit_gives_a_beast_without_an_item_its_item(self):
        beast = make_entry(BESTIARY, "Polecat", campaign=self.campaign, kind="pet", available_in_shop=True)

        response = self.patch_as(self.owner, BESTIARY.detail_url(beast.id), {"description": "Sly."})

        item = Item.objects.get(bestiary_entry=beast)
        self.assertEqual((response.data["item"]["id"], item.subtype, item.listed), (item.id, "Pet", True))


class AnimalItemDatabaseTests(CatalogueTestCase):
    def test_an_animal_item_has_one_beast_and_a_beast_one_item(self):
        beast = make_beast("Mule", kind="mount")
        cases = (
            {"name": "Stray", "type": "Animal"},
            {"name": "Saddle", "type": "Equipment", "bestiary_entry": make_entry(BESTIARY, "Pony", kind="mount")},
            {"name": "Mule", "type": "Animal", "campaign": self.campaign, "bestiary_entry": beast},
        )
        for fields in cases:
            with self.subTest(name=fields["name"]), self.assertRaises(IntegrityError), transaction.atomic():
                Item.objects.create(**fields)

    def test_deleting_a_beast_takes_its_item(self):
        beast = make_beast("Mule", campaign=self.campaign, kind="mount", cost=30)

        beast.delete()

        self.assertFalse(Item.objects.filter(name="Mule").exists())


class AnimalItemThroughTheItemsRoutesTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.book = make_beast("Warhorse", kind="mount", available_in_shop=True, cost=80).animal_item
        self.house = make_beast("Mule", campaign=self.campaign, kind="mount", cost=30).animal_item

    def test_the_items_routes_create_no_animal_item(self):
        created = self.create_as(self.owner, ITEMS, "Hound", type="Animal")
        changed = self.patch_as(self.owner, ITEMS.detail_url(self.book_axe.id), {"campaign_id": self.campaign.id, "type": "animal"})  # fmt: skip

        self.assertEqual((created.status_code, list(created.data)), (400, ["type"]))
        self.assertEqual((changed.status_code, list(changed.data)), (400, ["type"]))

    def test_the_items_routes_never_write_a_beasts_item(self):
        campaign = {"campaign_id": self.campaign.id}
        for item in (self.book, self.house):
            url = ITEMS.detail_url(item.id)
            calls = (
                ("patch", url, {**campaign, "name": "Nag"}),
                ("delete", f"{url}?campaign_id={self.campaign.id}", None),
                ("post", f"{url}revert/", campaign),
                ("post", f"{url}restore/", campaign),
            )
            for method, path, body in calls:
                with self.subTest(item=item.name, method=method, path=path):
                    self.client.force_authenticate(self.owner)
                    response = getattr(self.client, method)(path, body, format="json")
                    self.assertEqual((response.status_code, response.data["code"]), (403, "animal_item"))
        self.assertEqual(self.get_as(self.owner, f"{ITEMS.detail_url(self.book.id)}usage/?campaign_id={self.campaign.id}").status_code, 200)  # fmt: skip
        self.assertEqual(Item.objects.get(pk=self.book.id).name, "Warhorse")

    def test_the_items_list_says_whether_each_item_is_sold_and_each_animals_kind(self):
        make_beast("Wyvern", kind="creature", has_profile=False, cost=0)
        rows = {row["name"]: row for row in self.get_as(self.player, ITEMS.list_url(self.campaign)).json()}

        self.assertEqual(
            {name: rows[name]["listed"] for name in ("Axe", "Warhorse", "Mule", "Wyvern")},
            {"Axe": True, "Warhorse": True, "Mule": False, "Wyvern": False},
        )
        self.assertEqual(
            {
                name: (
                    rows[name]["subtype"],
                    rows[name]["bestiary_entry"]["kind"],
                    rows[name]["bestiary_entry"]["has_profile"],
                )
                for name in ("Warhorse", "Wyvern")
            },  # fmt: skip
            {"Warhorse": ("Mount", "mount", True), "Wyvern": ("Creature", "creature", False)},
        )

    def test_the_shop_lists_only_what_is_sold(self):
        listed = [row["name"] for row in self.get_as(self.player, f"{ITEMS.list_url(self.campaign)}&listed=1").json()]
        animals = [row["name"] for row in self.get_as(self.player, f"{ITEMS.list_url(self.campaign)}&type=Animal").json()]  # fmt: skip

        self.assertIn("Warhorse", listed)
        self.assertNotIn("Mule", listed)
        self.assertEqual(sorted(animals), ["Mule", "Warhorse"])  # the Animals tab shows both
