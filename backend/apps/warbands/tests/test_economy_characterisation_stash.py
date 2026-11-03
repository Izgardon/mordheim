"""Characterisation: the stash (items/) and resources (resources/) (pass 2, step 0).

The stash route only lists: its own add and discard are gone (the rebuilt frontend never called them). Copies come
in by purchases, transfers and trades, and leave by transfers, sales and trades.
"""

from apps.items.models import Item
from apps.warbands.models import WarbandItem, WarbandResource

from .roster_support import HERO, RosterTestCase, make_unit

# decision 3: half the item's current campaign price, rounded up (the Sword lists at 10, the Axe at 5 and 15)
SWORD_SALE = {
    "current_price": 10,
    "suggested_sale_price": 5,
    "sale_price_basis": "campaign_price",
    "beast_kind": None,
}  # beast_kind: step 4
AXE_SALE = {"current_price": 5, "suggested_sale_price": 3, "sale_price_basis": "campaign_price", "beast_kind": None}


class StashTests(RosterTestCase):
    def _url(self) -> str:
        return f"/api/warbands/{self.warband.id}/items/"

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
                    **AXE_SALE,
                },
                {
                    "id": self.sword.id,
                    "name": "Sword",
                    "cost": 12,
                    "quantity": 3,
                    "costs": [{"cost": 12, "quantity": 1}, {"cost": 9, "quantity": 2}],
                    **SWORD_SALE,
                },
            ],
        )

    def test_another_campaigns_item_is_not_found(self):
        # SEC-07 (stash half): transfers used to accept any campaign's item. A unit already carrying one can't move
        # it; it can still sell it, and a stash copy of one can be sold too
        foreign = Item.objects.create(name="Lizard Spear", type="Melee", campaign_id=self.foreign_race.campaign_id)
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
        sold = {"source_type": "stash", "item_id": foreign.id, "quantity": 1, "price": 2}
        self.assertEqual(self.client.post(f"{base}item-sales/", sold, format="json").status_code, 200)
        self.assertEqual((self._rows(), list(hero.hero_items.all())), ([], []))

    def test_members_read_the_stash(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=5)
        for user, read in ((self.viewer, 200), (self.manager, 200), (self.outsider, 404)):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user=user)
                self.assertEqual(self.client.get(self._url()).status_code, read)


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
                {"id": gold.id, "warband_id": self.warband.id, "name": "Gold Crowns", "amount": 7, "is_default": False},
                {"id": shards.id, "warband_id": self.warband.id, "name": "Wyrdstone", "amount": 3, "is_default": False},
            ],
        )

    def test_a_new_resource_starts_at_zero_and_names_are_unique_ignoring_case(self):
        created = self.client.post(self._url(), {"name": "  Wyrdstone ", "amount": 5}, format="json")
        duplicate = self.client.post(self._url(), {"name": "wyrdstone"}, format="json")
        blank = self.client.post(self._url(), {"name": " "}, format="json")

        self.assertEqual(created.status_code, 201)
        resource = WarbandResource.objects.get(warband=self.warband)
        self.assertEqual(
            created.json(),
            {"id": resource.id, "warband_id": self.warband.id, "name": "Wyrdstone", "amount": 0, "is_default": False},
        )
        self.assertEqual((duplicate.status_code, duplicate.json()), (400, {"detail": "Resource already exists"}))
        self.assertEqual((blank.status_code, list(blank.json())), (400, ["name"]))

    def test_an_update_sets_the_amount_outright_and_can_rename(self):
        resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=3)

        first = self.client.patch(self._url(resource.id), {"amount": 5}, format="json")
        second = self.client.patch(self._url(resource.id), {"amount": 4, "name": "Renamed"}, format="json")

        self.assertEqual((first.json()["amount"], second.json()["amount"], second.json()["name"]), (5, 4, "Renamed"))

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
            down.json(),
            {"id": resource.id, "warband_id": self.warband.id, "name": "Wyrdstone", "amount": 0, "is_default": False},
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
