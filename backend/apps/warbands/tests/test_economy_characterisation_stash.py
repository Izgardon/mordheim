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
        rows = WarbandItem.objects.filter(warband=self.warband).select_related("item").order_by("item__name")
        return [(row.item.name, row.quantity, row.cost) for row in rows]

    def test_the_stash_lists_rows_by_item_name(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=9)
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=1)
        WarbandItem.objects.create(warband=self.rival, item=self.axe, quantity=5)

        response = self.client.get(self._url())

        self.assertEqual(
            response.json(),
            [
                {"id": self.axe.id, "name": "Axe", "cost": None, "quantity": 1},
                {"id": self.sword.id, "name": "Sword", "cost": 9, "quantity": 2},
            ],
        )

    def test_adding_defaults_the_cost_only_for_an_item_with_one_availability(self):
        sword = self._add(item_id=self.sword.id)
        axe = self._add(item_id=self.axe.id, quantity=2)
        priced = self._add(item_id=Item.objects.create(name="Club", type="Melee").id, cost=4)

        self.assertEqual(
            (sword.status_code, sword.json()), (201, {"id": self.sword.id, "name": "Sword", "cost": 10, "quantity": 1})
        )
        self.assertEqual(axe.json(), {"id": self.axe.id, "name": "Axe", "cost": None, "quantity": 2})
        self.assertEqual(priced.json()["cost"], 4)
        # ECON-CQ-02 / BUG-07: adding to the stash writes no ledger row and no log; the buy dialog posts them
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))

    def test_adding_to_an_existing_row_adds_copies_and_may_replace_its_cost(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=4)
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=1, cost=6)

        sword = self._add(item_id=self.sword.id, quantity=3)  # the single availability's 10 replaces 4
        axe = self._add(item_id=self.axe.id)  # two availabilities: no default, the cost stays
        explicit = self._add(item_id=self.axe.id, cost=8)

        self.assertEqual((sword.status_code, sword.json()["quantity"], sword.json()["cost"]), (201, 5, 10))
        self.assertEqual((axe.json()["quantity"], axe.json()["cost"]), (2, 6))
        self.assertEqual((explicit.json()["quantity"], explicit.json()["cost"]), (3, 8))
        self.assertEqual(self._rows(), [("Axe", 3, 8), ("Sword", 5, 10)])

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

    def test_another_campaigns_item_is_accepted(self):
        # Characterises current behaviour (SEC-07, stash half, pinned; flips in PR A)
        foreign = Item.objects.create(name="Lizard Spear", type="Melee", campaign_id=self.foreign_race.campaign_id)

        response = self._add(item_id=foreign.id)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(self._rows(), [("Lizard Spear", 1, None)])
        # ... and a unit carrying one can move it into the stash
        hero = make_unit(HERO, self.warband)
        hero.hero_items.create(item=foreign, cost=3)
        move = {
            "source_type": "hero",
            "source_id": hero.id,
            "target_type": "stash",
            "item_id": foreign.id,
            "quantity": 1,
        }
        moved = self.client.post(f"/api/warbands/{self.warband.id}/item-transfers/", move, format="json")
        self.assertEqual(moved.status_code, 200)
        self.assertEqual(self._rows(), [("Lizard Spear", 2, 3)])

    def test_discarding_removes_copies_and_logs_nothing(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=4, cost=9)

        one = self.client.delete(self._url(self.sword.id))
        two = self.client.delete(self._url(self.sword.id), {"quantity": 2}, format="json")
        self.assertEqual((one.status_code, two.status_code), (204, 204))
        self.assertEqual(self._rows(), [("Sword", 1, 9)])

        zero = self.client.delete(self._url(self.sword.id), {"quantity": 0}, format="json")  # at least one
        self.assertEqual((zero.status_code, self._rows()), (204, []))
        missing = self.client.delete(self._url(self.sword.id))
        self.assertEqual((missing.status_code, missing.json()), (404, {"detail": "Item not found in stash"}))
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))

    def test_discarding_more_than_the_stash_holds_deletes_the_row(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2)

        response = self.client.delete(self._url(self.sword.id), {"quantity": 9}, format="json")

        self.assertEqual((response.status_code, self._rows()), (204, []))

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
        self.assertEqual(self._rows(), [("Sword", 5, 10)])  # the manager added one and discarded one


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

    def test_a_negative_amount_is_accepted(self):
        # Characterises current behaviour (BUG-68, pinned; flips in PR A)
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=1)

        response = self.client.patch(self._url(resource.id), {"amount": -4}, format="json")

        self.assertEqual((response.status_code, response.json()["amount"]), (200, -4))
        resource.refresh_from_db()
        self.assertEqual(resource.amount, -4)

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
