"""A companion is a state of the copy, so every path that rewrites or moves copies keeps or clears it on purpose (the
bestiary rewrite step 4).

A unit PATCH resends the whole items list: an entry may say `companion`; one that doesn't keeps the switch of the copy
it replaces (by item, in list order), so a client that doesn't know the flag never unseats a rider. Only a mount or a
pet may be sent switched on. Moving, selling or trading a copy clears it: the copy that arrives is never switched on,
and the unit's companions leave last, so moving a spare horse keeps the one he rides.
"""

from typing import Any

from apps.warbands.models import HeroItem, WarbandItem

from .beast_support import raven, warhorse
from .roster_support import HERO, RosterTestCase, make_unit, unit_url


class CompanionLoadoutTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse, self.raven = warhorse(), raven()
        self.hero = make_unit(HERO, self.warband, name="Aldric")

    def patch(self, items: list[dict[str, Any]]) -> Any:
        return self.client.patch(unit_url(HERO, self.warband.id, self.hero.id), {"items": items}, format="json")

    def switches(self) -> list[tuple[str, bool]]:
        return [(row.item.name, row.companion) for row in self.hero.hero_items.select_related("item").order_by("id")]

    def test_a_patch_that_doesnt_send_the_flag_keeps_the_mount(self):
        HeroItem.objects.create(hero=self.hero, item=self.sword)
        HeroItem.objects.create(hero=self.hero, item=self.horse, cost=80, companion=True)

        response = self.patch([{"id": self.sword.id}, {"id": self.horse.id, "cost": 80}])

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.switches(), [("Sword", False), ("Warhorse", True)])
        self.assertEqual(response.data["mount"]["name"], "Warhorse")

    def test_dropping_a_spare_keeps_the_one_he_rides(self):
        HeroItem.objects.create(hero=self.hero, item=self.horse)
        HeroItem.objects.create(hero=self.hero, item=self.horse, companion=True)

        self.patch([{"id": self.horse.id}])

        self.assertEqual(self.switches(), [("Warhorse", True)])

    def test_a_sent_flag_wins(self):
        HeroItem.objects.create(hero=self.hero, item=self.horse, companion=True)

        self.patch([{"id": self.horse.id, "companion": False}, {"id": self.raven.id, "companion": True}])

        self.assertEqual(self.switches(), [("Warhorse", False), ("Raven", True)])

    def test_an_entry_sent_switched_on_takes_the_place_of_a_kept_one(self):
        HeroItem.objects.create(hero=self.hero, item=self.horse, companion=True)

        self.patch([{"id": self.horse.id}, {"id": self.horse.id, "companion": True}])

        self.assertEqual(self.switches(), [("Warhorse", False), ("Warhorse", True)])

    def test_only_a_mount_or_a_pet_may_be_sent_switched_on(self):
        HeroItem.objects.create(hero=self.hero, item=self.horse, companion=True)

        response = self.patch([{"id": self.sword.id, "companion": True}])

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("items", response.data)
        self.assertEqual(self.switches(), [("Warhorse", True)])

    def test_a_new_unit_may_arrive_riding(self):
        body = {"name": "Rider", "unit_type": "Knight", "items": [{"id": self.horse.id, "companion": True}]}

        response = self.client.post(unit_url(HERO, self.warband.id), body, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["mount"]["name"], "Warhorse")


class CompanionMoveTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse = warhorse()
        self.hero = make_unit(HERO, self.warband, name="Aldric")
        self.other = make_unit(HERO, self.warband, name="Brother")

    def move(self, target_type: str = "hero", target_id: int | None = None, quantity: int = 1) -> Any:
        body = {"source_type": "hero", "source_id": self.hero.id, "target_type": target_type, "item_id": self.horse.id}
        body |= {"target_id": target_id, "quantity": quantity}
        return self.client.post(f"/api/warbands/{self.warband.id}/item-transfers/", body, format="json")

    def test_a_moved_mount_arrives_switched_off(self):
        HeroItem.objects.create(hero=self.hero, item=self.horse, cost=80, companion=True)

        response = self.move(target_id=self.other.id)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(list(self.other.hero_items.values_list("companion", "cost")), [(False, 80)])
        self.assertEqual((response.data["source"]["mount"], response.data["target"]["mount"]), (None, None))

    def test_moving_one_of_two_moves_the_spare(self):
        ridden = HeroItem.objects.create(hero=self.hero, item=self.horse, cost=80, companion=True)
        HeroItem.objects.create(hero=self.hero, item=self.horse, cost=70)

        self.move(target_type="stash")

        self.assertEqual(list(self.hero.hero_items.values_list("id", "companion")), [(ridden.id, True)])
        self.assertEqual(list(WarbandItem.objects.filter(warband=self.warband).values_list("cost", "quantity")), [(70, 1)])  # fmt: skip

    def test_selling_one_of_two_sells_the_spare(self):
        ridden = HeroItem.objects.create(hero=self.hero, item=self.horse, cost=80, companion=True)
        HeroItem.objects.create(hero=self.hero, item=self.horse, cost=70)
        body = {"source_type": "hero", "source_id": self.hero.id, "item_id": self.horse.id, "quantity": 1, "price": 35}

        response = self.client.post(f"/api/warbands/{self.warband.id}/item-sales/", body, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(list(self.hero.hero_items.values_list("id", flat=True)), [ridden.id])
        self.assertEqual(response.data["source"]["mount"]["item_row_id"], ridden.id)
