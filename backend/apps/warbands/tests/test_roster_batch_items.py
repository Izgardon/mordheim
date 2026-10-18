"""A roster Save's purchases, stash takes and versions (decision 1, BUG-07, BUG-108): POST <kind>/batch/.

The roster Save used to save the units (bought copies inside their item lists), then post a "Group" header, a
"Bought" row and a log per purchase one by one, and take stash copies with a DELETE after the batch: a failure
half way left copies unpaid, in two places, or charged twice on Retry. A unit edited in another tab was
overwritten with the stale form.
"""

from typing import Any

from apps.warbands.models import HenchmenGroup, Hero, WarbandItem, WarbandTrade

from .roster_support import (
    HENCHMEN,
    HERO,
    Kind,
    RosterTestCase,
    create_payload,
    log_rows,
    make_unit,
    trade_rows,
    unit_url,
)


class RosterBatchItemTests(RosterTestCase):
    def _batch(self, kind: Kind, body: Any, status: int = 200) -> Any:
        response = self.client.post(unit_url(kind, self.warband.id, suffix="batch/"), body, format="json")
        self.assertEqual(response.status_code, status, response.content)
        return response.json()

    def _items(self, unit: Any) -> list[tuple[str, int | None]]:
        return [(row.item.name, row.cost) for row in unit.hero_items.select_related("item").order_by("id")]

    def test_purchases_land_with_the_creates_and_updates_under_one_header(self):
        kept = make_unit(HERO, self.warband, name="Kept")
        kept.hero_items.create(item=self.sword, cost=10)
        body = {
            "create": [create_payload(HERO, name="New", price=30)],
            "update": [{"id": kept.id, "name": "Kept", "items": [{"id": self.sword.id, "cost": 10}]}],
            "purchases": [
                {"unit_id": kept.id, "item_id": self.axe.id, "price": 5},
                {"create_index": 0, "item_id": self.sword.id, "quantity": 2},  # the current price: 10 each
            ],
        }

        answer = self._batch(HERO, body)

        new = Hero.objects.get(warband=self.warband, name="New")
        self.assertEqual(self._items(kept), [("Sword", 10), ("Axe", 5)])  # appended after the update's list
        self.assertEqual(self._items(new), [("Sword", 10), ("Sword", 10)])
        header = "Equipped Kept, New (2 items, 25 gc)"
        self.assertEqual(
            trade_rows(self.warband),
            [
                ("Recruit", "New the Trooper", -30, None),
                ("Group", header, 0, None),
                ("Buy", "Axe", -5, header),
                ("Buy", "Sword x 2", -20, header),
            ],
        )
        logged = [(feature, entry) for feature, entry, _payload, _parent in log_rows(self.warband)]
        self.assertEqual(logged[-2:], [("loadout", "hero_item"), ("loadout", "hero_item")])
        self.assertEqual(
            answer["warnings"],
            [{"code": "gold_negative", "message": "This leaves the warband at -55 gc.", "gold": -55}],
        )
        self.assertEqual([len(unit["items"]) for unit in answer["units"]], [2, 2])

    def test_a_stash_take_moves_the_copies_with_their_cost_in_the_same_save(self):
        # BUG-108: the copy for a new henchman left the stash by a DELETE after the batch
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=3, cost=7)
        body = {
            "create": [create_payload(HENCHMEN, name="Zealots", price=0)],
            "stash_takes": [{"create_index": 0, "item_id": self.sword.id, "quantity": 2}],
        }

        self._batch(HENCHMEN, body)

        group = HenchmenGroup.objects.get(warband=self.warband, name="Zealots")
        carried = list(group.henchmen_group_items.order_by("id").values_list("item__name", "cost"))
        self.assertEqual(carried, [("Sword", 7), ("Sword", 7)])
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 1)
        moved = {"item": "Sword", "quantity": 2, "source_type": "stash", "source_name": None}
        moved |= {"target_type": "henchmen_group", "target_name": "Zealots"}
        self.assertEqual(log_rows(self.warband)[-1], ("items", "moved", moved, None))

    def test_a_refused_line_saves_nothing(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=7)
        body = {
            "create": [create_payload(HERO, name="New", price=30)],
            "stash_takes": [{"create_index": 0, "item_id": self.sword.id, "quantity": 2}],
        }

        answer = self._batch(HERO, body, status=400)

        self.assertEqual(
            (answer["code"], answer["fields"]),
            ("not_enough_in_stash", {"stash_takes.0.quantity": ["The stash holds 1 of these."]}),
        )
        self.assertFalse(Hero.objects.filter(warband=self.warband).exists())
        self.assertEqual((trade_rows(self.warband), WarbandItem.objects.get(warband=self.warband).quantity), ([], 1))

    def test_invalid_lines_are_reported_with_the_other_errors(self):
        dismissed = make_unit(HERO, self.warband)
        theirs = make_unit(HERO, self.rival)
        body = {
            "dismiss": [dismissed.id],
            "purchases": [
                {"unit_id": dismissed.id, "item_id": self.sword.id},
                {"unit_id": theirs.id, "item_id": self.sword.id},
                {"create_index": 0, "item_id": self.sword.id},
                {"item_id": self.sword.id},
                {"unit_id": dismissed.id, "create_index": 0, "item_id": self.sword.id},
            ],
            "stash_takes": [{"unit_id": theirs.id, "item_id": 999999, "quantity": 0}],
        }

        answer = self._batch(HERO, body, status=400)

        self.assertEqual(
            sorted(answer["fields"]),
            [f"purchases.{index}.unit_id" for index in range(5)] + ["stash_takes.0.quantity"],
        )
        self.assertIsNone(Hero.objects.get(id=dismissed.id).dismissed_at)

    def test_a_purchase_without_a_known_price_is_refused_before_anything_is_saved(self):
        hero = make_unit(HERO, self.warband)
        relic = self.sword.__class__.objects.create(name="Relic", type="Misc")

        answer = self._batch(HERO, {"purchases": [{"unit_id": hero.id, "item_id": relic.id}]}, status=400)

        self.assertEqual(answer["fields"], {"purchases.0.price": ["No price is known for this item; send one."]})
        self.assertFalse(WarbandTrade.objects.exists())


class RosterBatchVersionTests(RosterTestCase):
    """An update entry may send the `updated_at` it was read with: a unit saved since is a 409, nothing saved."""

    def _batch(self, body: Any, status: int) -> Any:
        response = self.client.post(unit_url(HERO, self.warband.id, suffix="batch/"), body, format="json")
        self.assertEqual(response.status_code, status, response.content)
        return response.json()

    def _read(self, hero: Hero) -> str:
        return str(self.client.get(unit_url(HERO, self.warband.id, hero.id)).json()["updated_at"])

    def test_the_version_read_saves(self):
        hero = make_unit(HERO, self.warband, name="Ana")

        self._batch({"update": [{"id": hero.id, "name": "Anna", "updated_at": self._read(hero)}]}, 200)

        self.assertEqual(Hero.objects.get(id=hero.id).name, "Anna")

    def test_a_unit_changed_in_another_tab_is_a_409(self):
        hero = make_unit(HERO, self.warband, name="Ana")
        read = self._read(hero)
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=7)
        move = {
            "source_type": "stash",
            "target_type": "hero",
            "target_id": hero.id,
            "item_id": self.sword.id,
            "quantity": 1,
        }
        self.client.post(f"/api/warbands/{self.warband.id}/item-transfers/", move, format="json")  # the other tab

        answer = self._batch({"update": [{"id": hero.id, "name": "Anna", "items": [], "updated_at": read}]}, 409)

        self.assertEqual(answer["code"], "unit_changed")
        self.assertEqual(list(answer["fields"]), ["update.0.updated_at"])
        hero.refresh_from_db()
        self.assertEqual((hero.name, hero.hero_items.count()), ("Ana", 1))  # the moved copy is still there

    def test_a_malformed_version_is_a_400(self):
        hero = make_unit(HERO, self.warband)

        answer = self._batch({"update": [{"id": hero.id, "updated_at": "yesterday"}]}, 400)

        self.assertEqual(answer["fields"], {"update.0.updated_at": ["Send the updated_at the unit was read with."]})
