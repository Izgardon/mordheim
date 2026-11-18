"""Equipping and unequipping armour moves the unit's stored save (William, 18 Nov 2026).

A copy arriving moves the save by the item's steps, from the value the unit holds, with no save as 7+; a copy
leaving moves it back, and a save moved to 7+ is no save again. Only one `body` item counts at a time, the oldest
the unit carries, so a second adds nothing and the next oldest takes over when the one counting leaves. A shield,
a mount and an extra always apply, with no checks. A henchmen group is one unit with one save. Nothing is refused,
and the save stays a plain field the player can type over (apps/warbands/services/armour.py).
"""

from typing import Any

from apps.items.models import Item, ItemAvailability
from apps.warbands.models import HenchmenGroupItem, HeroItem, LedgerAction, WarbandItem
from apps.warbands.services import ledger

from .roster_support import HENCHMEN, HERO, RosterTestCase, make_unit


def armour(name: str, bonus: int | None, slot: str, cost: int = 20) -> Item:
    """A book armour item with its save bonus and slot (phase 1's columns), at one price for everyone."""
    item = Item.objects.create(name=name, type="Armour", subtype="Body Armour", save_bonus=bonus, save_slot=slot)
    ItemAvailability.objects.create(item=item, cost=cost, for_everyone=True)
    return item


class ArmourSaveTestCase(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.light = armour("Light Armour", 1, "body")
        self.heavy = armour("Heavy Armour", 2, "body")
        self.shield = armour("Shield", 1, "shield")
        self.helmet = armour("Helmet", None, "")
        self.hero = make_unit(HERO, self.warband, name="Aldric", armour_save=None)
        ledger.record(self.warband, LedgerAction.REWARD, 500, "Purse")  # no gold_negative warning

    def buy(self, item: Item, unit: Any = None, kind: Any = HERO, **body: Any) -> Any:
        target = {"target_type": kind.key, "target_id": (unit or self.hero).id}
        answer = self.client.post(
            f"/api/warbands/{self.warband.id}/purchases/", {"item_id": item.id, **target, **body}, format="json"
        )
        self.assertEqual(answer.status_code, 201, answer.data)
        return answer.data

    def move_to_stash(self, item: Item, unit: Any = None, kind: Any = HERO, quantity: int = 1) -> Any:
        body = {
            "item_id": item.id,
            "source_type": kind.key,
            "source_id": (unit or self.hero).id,
            "target_type": "stash",
            "quantity": quantity,
        }
        answer = self.client.post(f"/api/warbands/{self.warband.id}/item-transfers/", body, format="json")
        self.assertEqual(answer.status_code, 200, answer.data)
        return answer.data

    def save_of(self, unit: Any = None) -> int | None:
        unit = unit or self.hero
        unit.refresh_from_db()
        save: int | None = unit.armour_save
        return save


class BodyArmourTests(ArmourSaveTestCase):
    def test_a_6_plus_item_on_a_unit_with_no_save_gives_6_plus_and_a_5_plus_item_gives_5_plus(self):
        self.assertEqual(self.buy(self.light)["armour_save"], 6)
        self.assertEqual(self.save_of(), 6)

        other = make_unit(HERO, self.warband, name="Bertrand", armour_save=None)
        self.assertEqual(self.buy(self.heavy, other)["armour_save"], 5)

    def test_it_moves_the_save_he_holds_rather_than_working_one_out(self):
        self.hero.armour_save = 4  # typed in by the player, whatever he carries
        self.hero.save()

        self.assertEqual(self.buy(self.light)["armour_save"], 3)

    def test_a_second_body_item_adds_nothing_and_the_next_takes_over_when_the_first_goes(self):
        self.buy(self.light)
        self.buy(self.heavy)
        self.assertEqual(self.save_of(), 6)  # the light armour he put on first is the one counting

        self.move_to_stash(self.light)

        self.assertEqual(self.save_of(), 5)  # the heavy armour takes over in the same move

    def test_taking_off_a_body_item_that_never_counted_leaves_the_save_alone(self):
        self.buy(self.light)
        self.buy(self.heavy)

        self.move_to_stash(self.heavy)

        self.assertEqual(self.save_of(), 6)  # he still wears the light armour
        self.assertEqual(WarbandItem.objects.get(item=self.heavy).quantity, 1)

    def test_the_last_piece_leaving_gives_no_save_again(self):
        self.buy(self.light)

        self.move_to_stash(self.light)

        self.assertIsNone(self.save_of())

    def test_an_item_with_no_bonus_moves_nothing(self):
        self.buy(self.helmet)
        self.assertIsNone(self.save_of())

        self.move_to_stash(self.helmet)
        self.assertIsNone(self.save_of())


class ShieldAndExtraTests(ArmourSaveTestCase):
    def test_a_shield_adds_on_top_of_body_armour_and_subtracts_when_it_leaves(self):
        self.buy(self.heavy)
        self.buy(self.shield)
        self.assertEqual(self.save_of(), 4)

        self.move_to_stash(self.shield)

        self.assertEqual(self.save_of(), 5)

    def test_two_shields_each_apply_because_nothing_is_checked(self):
        self.buy(self.shield, quantity=2)

        self.assertEqual(self.save_of(), 5)  # William: "no checks needed on these its up to user to be normal"

    def test_selling_it_takes_its_step_back(self):
        self.buy(self.shield)
        body = {
            "item_id": self.shield.id,
            "source_type": HERO.key,
            "source_id": self.hero.id,
            "quantity": 1,
            "price": 10,
        }

        answer = self.client.post(f"/api/warbands/{self.warband.id}/item-sales/", body, format="json")

        self.assertEqual(answer.status_code, 200, answer.data)
        self.assertIsNone(self.save_of())


class GroupArmourTests(ArmourSaveTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = make_unit(HENCHMEN, self.warband, name="Zealots", members=("A", "B", "C"), armour_save=None)

    def test_a_loadout_row_moves_the_groups_one_save_once_whatever_its_members(self):
        self.buy(self.light, self.group, kind=HENCHMEN, quantity=3)

        self.assertEqual(self.save_of(self.group), 6)  # one row, one step: a copy each is still one piece of armour
        self.assertEqual(HenchmenGroupItem.objects.filter(henchmen_group=self.group).count(), 1)

    def test_a_shield_each_is_still_one_row_and_one_step(self):
        self.buy(self.shield, self.group, kind=HENCHMEN, quantity=3)

        self.assertEqual(self.save_of(self.group), 6)  # three copies, one row: the group has one save

    def test_the_row_leaving_takes_its_step_back(self):
        self.buy(self.light, self.group, kind=HENCHMEN, quantity=3)

        self.move_to_stash(self.light, self.group, kind=HENCHMEN, quantity=3)

        self.assertIsNone(self.save_of(self.group))

    def test_a_members_kit_taken_leaves_the_groups_save_alone(self):
        self.buy(self.light, self.group, kind=HENCHMEN, quantity=3)
        member = self.group.henchmen.order_by("id").first()
        url = f"/api/warbands/{self.warband.id}/henchmen-groups/{self.group.id}/members/{member.id}/take-kit/"

        answer = self.client.post(url, {}, format="json")

        self.assertEqual(answer.status_code, 200, answer.data)
        self.assertEqual(self.save_of(self.group), 6)  # his gap is his own; the group still wears the row


class HeroItemRowTests(ArmourSaveTestCase):
    def test_a_copy_written_straight_onto_a_unit_moves_nothing_until_it_is_moved_again(self):
        """Nothing recomputes a save: a row written outside the services (a fixture, a unit's own PATCH) is just a
        row, and the save the player typed stands until the next equip or unequip."""
        HeroItem.objects.create(hero=self.hero, item=self.light)

        self.assertIsNone(self.save_of())

        self.move_to_stash(self.light)

        self.assertIsNone(self.save_of())  # 7+ and worse is no save
