"""Characterisation: the stash (items/) and resources (resources/) (pass 2, step 0)."""

from typing import Any

from apps.items.models import Item
from apps.warbands.models import WarbandItem, WarbandResource

from .roster_support import HERO, RosterTestCase, log_rows, make_unit, trade_rows


class StashTests(RosterTestCase):
    def _url(self, item_id: int | None = None) -> str:
        return f"/api/warbands/{self.warband.id}/items/" + (f"{item_id}/" if item_id else "")

    def _add(self, **body: Any) -> Any:
        return self.client.post(self._url(), body, format="json")

    def _rows(self) -> list[tuple[str, int, int | None]]:
        rows = WarbandItem.objects.filter(warband=self.warband).select_related("item").order_by("item__name", "cost")
        return [(row.item.name, row.quantity, row.cost) for row in rows]

    def test_the_stash_lists_one_entry_per_item_by_name_with_each_costs_count(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=9)
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=1)
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=12)
        WarbandItem.objects.create(warband=self.rival, item=self.axe, quantity=5)

        response = self.client.get(self._url())

        # BUG-117: copies of one item at two costs are two rows; the entry's cost is the one that leaves first
        self.assertEqual(
            response.json(),
            [
                {
                    "id": self.axe.id,
                    "name": "Axe",
                    "cost": None,
                    "quantity": 1,
                    "costs": [{"cost": None, "quantity": 1}],
                },
                {
                    "id": self.sword.id,
                    "name": "Sword",
                    "cost": 12,
                    "quantity": 3,
                    "costs": [{"cost": 12, "quantity": 1}, {"cost": 9, "quantity": 2}],
                },
            ],
        )

    def test_adding_defaults_the_cost_only_for_an_item_with_one_availability(self):
        sword = self._add(item_id=self.sword.id)
        axe = self._add(item_id=self.axe.id, quantity=2)
        priced = self._add(item_id=Item.objects.create(name="Club", type="Melee").id, cost=4)

        sword_entry = {"id": self.sword.id, "name": "Sword", "cost": 10, "quantity": 1}
        self.assertEqual(
            (sword.status_code, sword.json()), (201, {**sword_entry, "costs": [{"cost": 10, "quantity": 1}]})
        )
        self.assertEqual(axe.json()["costs"], [{"cost": None, "quantity": 2}])
        self.assertEqual(priced.json()["cost"], 4)
        # ECON-CQ-02 / BUG-07: adding to the stash writes no ledger row and no log; the buy dialog posts them
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))

    def test_adding_copies_never_re_prices_the_ones_held(self):
        # BUG-117: an add without a cost used to give the copies held the single availability's cost, and an add
        # with a cost gave them that cost; each cost now keeps its own row
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=4)
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=1, cost=6)

        sword = self._add(item_id=self.sword.id, quantity=3)  # the single availability's 10, beside the 4s
        axe = self._add(item_id=self.axe.id)  # two availabilities: no default, an unknown cost
        explicit = self._add(item_id=self.axe.id, cost=8)
        again = self._add(item_id=self.axe.id, cost=8)

        self.assertEqual((sword.status_code, sword.json()["quantity"], sword.json()["cost"]), (201, 5, 10))
        self.assertEqual((axe.json()["quantity"], axe.json()["cost"]), (2, None))  # the newest copies leave first
        self.assertEqual((explicit.json()["quantity"], again.json()["quantity"]), (3, 4))
        self.assertEqual(
            self._rows(), [("Axe", 1, 6), ("Axe", 2, 8), ("Axe", 1, None), ("Sword", 2, 4), ("Sword", 3, 10)]
        )

    def test_loose_quantities_and_costs_are_coerced(self):
        for quantity, added in ((0, 1), (-2, 1), ("abc", 1), ("3", 3), (None, 1)):
            with self.subTest(quantity=quantity):
                WarbandItem.objects.all().delete()
                body: dict[str, Any] = (
                    {"item_id": self.sword.id} if quantity is None else {"item_id": self.sword.id, "quantity": quantity}
                )
                self.assertEqual(self._add(**body).json()["quantity"], added)
        WarbandItem.objects.all().delete()
        self.assertEqual(self._add(item_id=self.sword.id, cost="cheap").json()["cost"], 10)

    def test_bad_item_ids(self):
        for body, status_code, detail in (
            ({}, 400, "Invalid item id"),
            ({"item_id": "sword"}, 400, "Invalid item id"),
            ({"item_id": 999999}, 404, "Item not found"),
        ):
            with self.subTest(body=body):
                response = self._add(**body)
                self.assertEqual((response.status_code, response.json()), (status_code, {"detail": detail}))
        self.assertEqual(self._rows(), [])

    def test_another_campaigns_item_is_not_found(self):
        # SEC-07 (stash half): POST items/ and transfers used to accept any campaign's item
        foreign = Item.objects.create(name="Lizard Spear", type="Melee", campaign_id=self.foreign_race.campaign_id)

        response = self._add(item_id=foreign.id)

        self.assertEqual((response.status_code, response.json()), (404, {"detail": "Item not found"}))
        self.assertEqual(self._rows(), [])
        # ... nor can a unit already carrying one move it; it can still sell it, and a stash copy can be discarded
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=foreign, cost=3)
        base = f"/api/warbands/{self.warband.id}/"
        move = {
            "source_type": "hero",
            "source_id": hero.id,
            "target_type": "stash",
            "item_id": foreign.id,
            "quantity": 1,
        }
        moved = self.client.post(f"{base}item-transfers/", move, format="json")
        self.assertEqual((moved.status_code, moved.json()), (404, {"detail": "Item not found"}))
        sale = {"source_type": "hero", "source_id": hero.id, "item_id": foreign.id, "quantity": 1, "price": 2}
        self.assertEqual(self.client.post(f"{base}item-sales/", sale, format="json").status_code, 200)
        WarbandItem.objects.create(warband=self.warband, item=foreign, quantity=1)
        self.assertEqual(self.client.delete(self._url(foreign.id)).status_code, 204)
        self.assertEqual((self._rows(), list(hero.hero_items.all())), ([], []))

    def test_global_and_own_campaign_items_are_added(self):
        own = Item.objects.create(name="House Spear", type="Melee", campaign=self.campaign)

        self.assertEqual(self._add(item_id=own.id).status_code, 201)
        self.assertEqual(self._add(item_id=self.axe.id).status_code, 201)
        self.assertEqual(self._rows(), [("Axe", 1, None), ("House Spear", 1, None)])

    def test_discarding_removes_copies_and_logs_what_went(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=4, cost=9)

        one = self.client.delete(self._url(self.sword.id))
        two = self.client.delete(self._url(self.sword.id), {"quantity": 2}, format="json")
        self.assertEqual((one.status_code, two.status_code), (204, 204))
        self.assertEqual(self._rows(), [("Sword", 1, 9)])

        zero = self.client.delete(self._url(self.sword.id), {"quantity": 0}, format="json")  # at least one
        self.assertEqual((zero.status_code, self._rows()), (204, []))
        missing = self.client.delete(self._url(self.sword.id))
        self.assertEqual((missing.status_code, missing.json()), (404, {"detail": "Item not found in stash"}))
        # ECON-CQ-02: discards used to leave no trace; the server logs each one with the copies that went
        self.assertEqual(trade_rows(self.warband), [])
        self.assertEqual(
            log_rows(self.warband),
            [
                ("items", "discarded", {"item": "Sword", "quantity": 1}, None),
                ("items", "discarded", {"item": "Sword", "quantity": 2}, None),
                ("items", "discarded", {"item": "Sword", "quantity": 1}, None),
            ],
        )

    def test_discarding_more_than_the_stash_holds_deletes_the_row(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2)

        response = self.client.delete(self._url(self.sword.id), {"quantity": 9}, format="json")

        self.assertEqual((response.status_code, self._rows()), (204, []))
        self.assertEqual(log_rows(self.warband), [("items", "discarded", {"item": "Sword", "quantity": 2}, None)])

    def test_members_read_the_stash_and_editors_change_it(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=5)
        for user, read, write, delete in (
            (self.viewer, 200, 403, 403),
            (self.manager, 200, 201, 204),
            (self.outsider, 404, 404, 404),
        ):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user=user)
                self.assertEqual(self.client.get(self._url()).status_code, read)
                self.assertEqual(self._add(item_id=self.sword.id).status_code, write)
                self.assertEqual(self.client.delete(self._url(self.sword.id)).status_code, delete)
        # the manager added one at 10 (its own row) and discarded the newest
        self.assertEqual(self._rows(), [("Sword", 5, None)])


class ResourceTests(RosterTestCase):
    def _url(self, resource_id: int | None = None) -> str:
        return f"/api/warbands/{self.warband.id}/resources/" + (f"{resource_id}/" if resource_id else "")

    def test_resources_list_by_name(self):
        shards = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=3)
        gold = WarbandResource.objects.create(warband=self.warband, name="Gold Crowns", amount=7)
        WarbandResource.objects.create(warband=self.rival, name="Warpstone", amount=1)

        response = self.client.get(self._url())

        self.assertEqual(
            response.json(),
            [
                {"id": gold.id, "warband_id": self.warband.id, "name": "Gold Crowns", "amount": 7},
                {"id": shards.id, "warband_id": self.warband.id, "name": "Wyrdstone", "amount": 3},
            ],
        )

    def test_a_new_resource_starts_at_zero_and_names_are_unique_ignoring_case(self):
        created = self.client.post(self._url(), {"name": "  Wyrdstone ", "amount": 5}, format="json")
        duplicate = self.client.post(self._url(), {"name": "wyrdstone"}, format="json")
        blank = self.client.post(self._url(), {"name": " "}, format="json")

        self.assertEqual(created.status_code, 201)
        resource = WarbandResource.objects.get(warband=self.warband)
        self.assertEqual(
            created.json(), {"id": resource.id, "warband_id": self.warband.id, "name": "Wyrdstone", "amount": 0}
        )
        self.assertEqual((duplicate.status_code, duplicate.json()), (400, {"detail": "Resource already exists"}))
        self.assertEqual((blank.status_code, list(blank.json())), (400, ["name"]))

    def test_an_update_sets_the_amount_outright(self):
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=3)

        first = self.client.patch(self._url(resource.id), {"amount": 5}, format="json")
        second = self.client.patch(self._url(resource.id), {"amount": 4, "name": "Renamed"}, format="json")

        self.assertEqual((first.json()["amount"], second.json()["amount"], second.json()["name"]), (5, 4, "Wyrdstone"))

    def test_a_negative_amount_is_refused(self):
        # BUG-68: the API used to store a negative amount (only the UI clamped)
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=1)

        response = self.client.patch(self._url(resource.id), {"amount": -4}, format="json")

        self.assertEqual((response.status_code, list(response.json())), (400, ["amount"]))
        resource.refresh_from_db()
        self.assertEqual(resource.amount, 1)

    def test_a_delta_changes_the_stored_amount_and_stops_at_zero(self):
        # BUG-68: +/- clicks send a delta, added to what is stored, so another tab's change isn't overwritten
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=3)
        WarbandResource.objects.filter(id=resource.id).update(amount=5)  # changed elsewhere since it was read

        up = self.client.patch(self._url(resource.id), {"delta": 2}, format="json")
        down = self.client.patch(self._url(resource.id), {"delta": -10}, format="json")
        huge = self.client.patch(self._url(resource.id), {"delta": 2_147_483_647}, format="json")
        again = self.client.patch(self._url(resource.id), {"delta": 2_147_483_647}, format="json")

        self.assertEqual((up.status_code, up.json()["amount"]), (200, 7))
        self.assertEqual(
            down.json(), {"id": resource.id, "warband_id": self.warband.id, "name": "Wyrdstone", "amount": 0}
        )
        self.assertEqual((huge.json()["amount"], again.json()["amount"]), (2_147_483_647, 2_147_483_647))

    def test_amount_and_delta_together_or_malformed_are_400(self):
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=3)
        for body, errors in (
            ({"amount": 2, "delta": 1}, ["non_field_errors"]),
            ({"delta": "lots"}, ["delta"]),
            ({"delta": 1.5}, ["delta"]),
        ):
            with self.subTest(body=body):
                response = self.client.patch(self._url(resource.id), body, format="json")
                self.assertEqual((response.status_code, list(response.json())), (400, errors))
        unchanged = self.client.patch(self._url(resource.id), {}, format="json")
        self.assertEqual((unchanged.status_code, unchanged.json()["amount"]), (200, 3))

    def test_bad_updates_and_unknown_resources(self):
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=1)
        theirs = WarbandResource.objects.create(warband=self.rival, name="Warpstone", amount=1)

        invalid = self.client.patch(self._url(resource.id), {"amount": "lots"}, format="json")
        self.assertEqual((invalid.status_code, list(invalid.json())), (400, ["amount"]))
        for resource_id in (theirs.id, 999999):
            with self.subTest(resource_id=resource_id):
                for method in ("patch", "delete"):
                    response = getattr(self.client, method)(self._url(resource_id), {"amount": 2}, format="json")
                    self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))
        self.assertEqual(list(WarbandResource.objects.order_by("id").values_list("amount", flat=True)), [1, 1])

    def test_deleting_a_resource(self):
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=1)

        response = self.client.delete(self._url(resource.id))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(WarbandResource.objects.filter(warband=self.warband).exists())

    def test_members_read_resources_and_editors_change_them(self):
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=1)
        for user, read, write in ((self.viewer, 200, 403), (self.manager, 200, 200), (self.outsider, 404, 404)):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user=user)
                self.assertEqual(self.client.get(self._url()).status_code, read)
                self.assertEqual(
                    self.client.patch(self._url(resource.id), {"amount": 2}, format="json").status_code, write
                )
