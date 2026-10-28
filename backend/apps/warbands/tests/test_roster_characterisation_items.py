"""Characterisation: moving and selling items between units and the stash, per kind (pass 1, PR B step 0).

`POST item-transfers/` and `POST item-sales/` look units up through the per-kind config that the unit
registry replaces in PR B, so these lock their responses (keys and unit payloads) and their effects
for every kind, including today's quirks.
"""

from typing import Any

from django.utils import timezone

from apps.warbands.models import Henchman, LedgerAction, WarbandItem
from apps.warbands.services import ledger

from .roster_support import (
    HENCHMEN,
    HERO,
    HIRELING,
    KINDS,
    ItemMoveHelpers,
    RosterTestCase,
    clear_ledger,
    make_unit,
    trade_rows,
    unit_url,
)
from .test_roster_characterisation_shapes import SHAPES

RESPONSE_KEYS = ["summary", "source", "target", "stash_item", "removed_stash_item_id"]

# decision 3: half the item's current campaign price, rounded up (the Sword lists at 10, the Axe at 5 and 15)
SWORD_SALE = {
    "current_price": 10,
    "suggested_sale_price": 5,
    "sale_price_basis": "campaign_price",
    "beast_kind": None,
}  # beast_kind: step 4
AXE_SALE = {"current_price": 5, "suggested_sale_price": 3, "sale_price_basis": "campaign_price", "beast_kind": None}
# the other kind each kind hands an item to in the cross-kind test
OTHER_KIND = {HERO.key: HENCHMEN, HENCHMEN.key: HIRELING, HIRELING.key: HERO}


class RosterItemTransferCharacterisationTests(ItemMoveHelpers, RosterTestCase):
    def _summary(self) -> Any:
        return self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()

    def test_moving_a_unit_item_to_the_stash_takes_the_newest_copy(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                WarbandItem.objects.all().delete()
                unit = self._armed(kind, race=self.race)  # without a race, race_name is left out of unit payloads

                response = self._transfer(
                    source_type=kind.key, source_id=unit.id, target_type="stash", item_id=self.sword.id, quantity=1
                )

                self.assertEqual(response.status_code, 200)
                body = response.json()
                self.assertEqual(list(body), RESPONSE_KEYS)
                stash_row = {"id": self.sword.id, "name": "Sword", "cost": 12, "quantity": 1}
                stash_row |= {"costs": [{"cost": 12, "quantity": 1}], **SWORD_SALE}
                self.assertEqual(
                    (body["target"], body["stash_item"], body["removed_stash_item_id"]), (stash_row,) * 2 + (None,)
                )
                self.assertEqual(body["source"], self.client.get(unit_url(kind, self.warband.id, unit.id)).json())
                self.assertEqual(set(body["source"]), set(SHAPES[kind.key][1]))  # the detail key set
                self.assertEqual(body["summary"], self._summary())
                self.assertEqual(self._carried(kind, unit), [(self.sword.id, 10), (self.axe.id, 7)])

    def test_moving_a_stash_item_to_a_unit(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                WarbandItem.objects.all().delete()
                WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=9)
                unit = make_unit(kind, self.warband)

                first = self._transfer(
                    source_type="stash", target_type=kind.key, target_id=unit.id, item_id=self.sword.id, quantity=1
                ).json()
                self.assertEqual(list(first), RESPONSE_KEYS)
                self.assertIsNone(first["source"])
                stash_item = {"id": self.sword.id, "name": "Sword", "cost": 9, "quantity": 1}
                self.assertEqual(
                    first["stash_item"], {**stash_item, "costs": [{"cost": 9, "quantity": 1}], **SWORD_SALE}
                )
                self.assertIsNone(first["removed_stash_item_id"])
                self.assertEqual(first["target"], self.client.get(unit_url(kind, self.warband.id, unit.id)).json())

                last = self._transfer(
                    source_type="stash", target_type=kind.key, target_id=unit.id, item_id=self.sword.id, quantity=1
                ).json()
                self.assertEqual((last["stash_item"], last["removed_stash_item_id"]), (None, self.sword.id))
                self.assertEqual([item["cost"] for item in last["target"]["items"]], [9, 9])
                self.assertFalse(WarbandItem.objects.filter(warband=self.warband).exists())

    def test_moving_an_item_to_another_kind_of_unit(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                source = self._armed(kind)
                other = OTHER_KIND[kind.key]
                target = make_unit(other, self.warband)

                body = self._transfer(
                    source_type=kind.key,
                    source_id=source.id,
                    target_type=other.key,
                    target_id=target.id,
                    item_id=self.sword.id,
                    quantity=2,
                ).json()

                self.assertEqual(body["source"], self.client.get(unit_url(kind, self.warband.id, source.id)).json())
                self.assertEqual(body["target"], self.client.get(unit_url(other, self.warband.id, target.id)).json())
                self.assertEqual((body["stash_item"], body["removed_stash_item_id"]), (None, None))
                self.assertEqual(self._carried(other, target), [(self.sword.id, 12), (self.sword.id, 10)])

    def test_moving_two_copies_keeps_each_copys_cost(self):
        # ECON-TEST-03: unit -> unit and stash -> unit, quantity 2
        source = self._armed(HERO)
        target = make_unit(HERO, self.warband)

        body = self._transfer(
            source_type="hero",
            source_id=source.id,
            target_type="hero",
            target_id=target.id,
            item_id=self.sword.id,
            quantity=2,
        ).json()

        self.assertEqual(list(body), RESPONSE_KEYS)
        self.assertEqual(body["target"], self.client.get(unit_url(HERO, self.warband.id, target.id)).json())
        self.assertEqual(self._carried(HERO, source), [(self.axe.id, 7)])
        self.assertEqual(self._carried(HERO, target), [(self.sword.id, 12), (self.sword.id, 10)])

        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=3, cost=6)
        body = self._transfer(
            source_type="stash", target_type="hero", target_id=target.id, item_id=self.axe.id, quantity=2
        ).json()

        stash_item = {"id": self.axe.id, "name": "Axe", "cost": 6, "quantity": 1}
        self.assertEqual(body["stash_item"], {**stash_item, "costs": [{"cost": 6, "quantity": 1}], **AXE_SALE})
        self.assertEqual(self._carried(HERO, target)[2:], [(self.axe.id, 6), (self.axe.id, 6)])

    def test_henchmen_payloads_list_dead_members_too(self):
        # Unlike every other roster response, the transfer and sale payloads include dead members, but not
        # dismissed ones (decision 4: they have left the group, as a deleted member had).
        group = self._armed(HENCHMEN, members=("Alpha",))
        Henchman.objects.create(group=group, name="Fallen", dead=True)
        Henchman.objects.create(group=group, name="Gone", dismissed_at="2026-01-01T00:00:00Z")

        body = self._transfer(
            source_type="henchmen_group", source_id=group.id, target_type="stash", item_id=self.axe.id, quantity=1
        ).json()

        self.assertEqual(
            [(m["name"], m["dead"]) for m in body["source"]["henchmen"]], [("Alpha", False), ("Fallen", True)]
        )

    def test_dead_foreign_or_unknown_sources_are_not_found_and_change_nothing(self):
        for kind in KINDS:
            for source in (self._armed(kind, dead=True), self._armed(kind, self.rival)):
                with self.subTest(kind=kind.key, warband=source.warband_id, dead=source.dead):
                    response = self._transfer(
                        source_type=kind.key,
                        source_id=source.id,
                        target_type="stash",
                        item_id=self.sword.id,
                        quantity=1,
                    )
                    self.assertEqual((response.status_code, response.json()), (404, {"detail": "Source not found"}))
                    self.assertEqual(len(self._carried(kind, source)), 3)
            with self.subTest(kind=kind.key, unit="unknown"):
                response = self._transfer(
                    source_type=kind.key, source_id=999999, target_type="stash", item_id=self.sword.id, quantity=1
                )
                self.assertEqual((response.status_code, response.json()), (404, {"detail": "Source not found"}))

    def test_a_missing_dead_dismissed_or_foreign_target_is_404_and_nothing_moves(self):
        # BUG-06: the target used to be looked up after the source lost its copies, and the 404 committed that
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=9)
        for kind in KINDS:
            off_roster = [
                make_unit(kind, self.warband, dead=True),
                make_unit(kind, self.warband, dismissed_at=timezone.now()),
                make_unit(kind, self.rival),
            ]
            for target_id in [unit.id for unit in off_roster] + [999999]:
                with self.subTest(kind=kind.key, target_id=target_id):
                    source = self._armed(kind)
                    for source_body in ({"source_type": kind.key, "source_id": source.id}, {"source_type": "stash"}):
                        response = self._transfer(
                            **source_body, target_type=kind.key, target_id=target_id, item_id=self.sword.id, quantity=1
                        )
                        self.assertEqual((response.status_code, response.json()), (404, {"detail": "Target not found"}))
                    self.assertEqual(
                        self._carried(kind, source), [(self.sword.id, 10), (self.sword.id, 12), (self.axe.id, 7)]
                    )
            self.assertEqual([self._carried(kind, unit) for unit in off_roster], [[], [], []])
        self.assertEqual(list(WarbandItem.objects.values_list("quantity", flat=True)), [2])

    def test_too_few_items_is_a_400_and_changes_nothing(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=9)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = self._armed(kind)
                too_many = self._transfer(
                    source_type=kind.key, source_id=unit.id, target_type="stash", item_id=self.sword.id, quantity=3
                )
                self.assertEqual((too_many.status_code, too_many.json()), (400, {"detail": "Item not found."}))
                from_stash = self._transfer(
                    source_type="stash", target_type=kind.key, target_id=unit.id, item_id=self.sword.id, quantity=2
                )
                self.assertEqual(
                    (from_stash.status_code, from_stash.json()), (400, {"detail": "Item not found in stash."})
                )
                self.assertEqual(len(self._carried(kind, unit)), 3)
        self.assertEqual(list(WarbandItem.objects.values_list("quantity", flat=True)), [1])

    def test_unknown_items_and_malformed_bodies(self):
        hero = self._armed(HERO)
        unknown = self._transfer(source_type="hero", source_id=hero.id, target_type="stash", item_id=999999, quantity=1)
        self.assertEqual((unknown.status_code, unknown.json()), (404, {"detail": "Item not found"}))

        cases: list[tuple[dict[str, Any], list[str]]] = [
            ({"source_type": "hero", "target_type": "stash", "item_id": self.sword.id, "quantity": 1}, ["source_id"]),
            ({"source_type": "stash", "target_type": "hero", "item_id": self.sword.id, "quantity": 1}, ["target_id"]),
            (
                {"source_type": "stash", "target_type": "stash", "item_id": self.sword.id, "quantity": 1},
                ["non_field_errors"],
            ),
            (
                {"source_type": "dragon", "target_type": "stash", "item_id": self.sword.id, "quantity": 1},
                ["source_type"],
            ),
            (
                {
                    "source_type": "hero",
                    "source_id": hero.id,
                    "target_type": "stash",
                    "item_id": self.sword.id,
                    "quantity": 0,
                },
                ["quantity"],
            ),
        ]
        for body, errors in cases:
            with self.subTest(body=body):
                response = self._transfer(**body)
                self.assertEqual((response.status_code, list(response.json())), (400, errors))
        self.assertEqual(len(self._carried(HERO, hero)), 3)


class RosterItemSaleCharacterisationTests(RosterTestCase):
    def _sell(self, **body: Any) -> Any:
        return self.client.post(f"/api/warbands/{self.warband.id}/item-sales/", body, format="json")

    def test_selling_a_unit_item_writes_a_sold_trade(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                clear_ledger(self.warband)
                unit = make_unit(kind, self.warband)
                for cost in (10, 12):
                    getattr(unit, kind.items).create(item=self.sword, cost=cost)

                response = self._sell(
                    source_type=kind.key, source_id=unit.id, item_id=self.sword.id, quantity=2, price=15
                )

                self.assertEqual(response.status_code, 200)
                body = response.json()
                self.assertEqual(list(body), RESPONSE_KEYS)
                self.assertEqual(body["source"], self.client.get(unit_url(kind, self.warband.id, unit.id)).json())
                self.assertEqual(body["source"]["items"], [])
                self.assertEqual(
                    (body["target"], body["stash_item"], body["removed_stash_item_id"]), (None, None, None)
                )
                self.assertEqual(trade_rows(self.warband), [("Sell", "Sword x 2", 15, None)])
                self.assertEqual(
                    (body["summary"]["gold"], body["summary"]),
                    (15, self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()),
                )

    def test_selling_from_the_stash(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=9)

        first = self._sell(source_type="stash", item_id=self.sword.id, quantity=1, price=4).json()
        last = self._sell(source_type="stash", item_id=self.sword.id, quantity=1, price=4).json()

        stash_row = {
            "id": self.sword.id,
            "name": "Sword",
            "cost": 9,
            "quantity": 1,
            "costs": [{"cost": 9, "quantity": 1}],
            **SWORD_SALE,
        }
        self.assertEqual(
            (first["source"], first["stash_item"], first["removed_stash_item_id"]), (stash_row, stash_row, None)
        )
        self.assertEqual(
            (last["source"], last["stash_item"], last["removed_stash_item_id"]), (None, None, self.sword.id)
        )
        self.assertEqual(trade_rows(self.warband), [("Sell", "Sword", 4, None), ("Sell", "Sword", 4, None)])

    def test_a_sale_adds_exactly_its_price_to_the_gold(self):
        # ECON-TEST-04: from the stash and from a unit, starting from a warband that already has gold
        ledger.record(self.warband, LedgerAction.STARTING_GOLD, 100, "Starting Gold")
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=9)
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.axe, cost=7)
        gold = 100
        sales: list[tuple[int, dict[str, Any]]] = [
            (3, {"source_type": "stash", "item_id": self.sword.id, "quantity": 1}),
            (30, {"source_type": "hero", "source_id": hero.id, "item_id": self.axe.id, "quantity": 1}),
        ]
        for price, body in sales:
            with self.subTest(source=body["source_type"]):
                response = self._sell(**body, price=price)
                gold += price
                self.assertEqual(response.json()["summary"]["gold"], gold)
        # any price is accepted, above the cost included (decision 3); one "Sell" row per sale
        self.assertEqual(trade_rows(self.warband)[1:], [("Sell", "Sword", 3, None), ("Sell", "Axe", 30, None)])
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 1)

    def test_a_sale_price_is_zero_or_more(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=9)
        for price in (-1, "free"):
            with self.subTest(price=price):
                response = self._sell(source_type="stash", item_id=self.sword.id, quantity=1, price=price)
                self.assertEqual((response.status_code, list(response.json())), (400, ["price"]))
        free = self._sell(source_type="stash", item_id=self.sword.id, quantity=1, price=0)
        self.assertEqual((free.status_code, trade_rows(self.warband)), (200, [("Sell", "Sword", 0, None)]))

    def test_dead_or_foreign_sources_and_missing_items(self):
        for kind in KINDS:
            for unit in (make_unit(kind, self.warband, dead=True), make_unit(kind, self.rival)):
                getattr(unit, kind.items).create(item=self.sword, cost=10)
                with self.subTest(kind=kind.key, warband=unit.warband_id):
                    response = self._sell(
                        source_type=kind.key, source_id=unit.id, item_id=self.sword.id, quantity=1, price=1
                    )
                    self.assertEqual((response.status_code, response.json()), (404, {"detail": "Source not found"}))
            with self.subTest(kind=kind.key, unit="carries none"):
                bare = make_unit(kind, self.warband)
                response = self._sell(
                    source_type=kind.key, source_id=bare.id, item_id=self.sword.id, quantity=1, price=1
                )
                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Item not found."}))
        self.assertEqual(trade_rows(self.warband), [])


class RosterItemPermissionCharacterisationTests(RosterTestCase):
    def test_only_editors_may_move_or_sell_items(self):
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=self.sword, cost=10)
        base = f"/api/warbands/{self.warband.id}/"
        move = {
            "source_type": "hero",
            "source_id": hero.id,
            "target_type": "stash",
            "item_id": self.sword.id,
            "quantity": 1,
        }
        sell = {"source_type": "hero", "source_id": hero.id, "item_id": self.sword.id, "quantity": 1, "price": 1}
        for user, expected in (
            (self.viewer, (403, {"detail": "Forbidden"})),
            (self.outsider, (404, {"detail": "Not found"})),
        ):
            self.client.force_authenticate(user=user)
            for path, body in (("item-transfers/", move), ("item-sales/", sell)):
                with self.subTest(user=user.email, path=path):
                    response = self.client.post(f"{base}{path}", body, format="json")
                    self.assertEqual((response.status_code, response.json()), expected)
        self.assertEqual(hero.hero_items.count(), 1)
