"""A henchmen group mounts as one (William's rule after the bestiary rewrite, with henchmen loadouts).

A group's loadout row is what every member carries, so its mount is one row: the companion switch on it rides or
dismounts every member who carries it (a member with a gap on it goes on foot, which his gap says). Heroes, hired
swords and a group's pets still switch one row. A group riding more than one kind of mount warns (never refuses): in
the switch's answer and on the group's own payload (`mount_warnings`).
"""

from typing import Any

from apps.warbands.models import HenchmenGroupItem, HeroItem, WarbandItem
from apps.warbands.units.companions import group_mount_warnings

from .beast_support import make_animal
from .roster_support import HENCHMEN, HERO, make_unit, unit_url
from .test_companions import CompanionTestCase

KINDS_MESSAGE = "Every member of a group carries the same gear, so Outriders can't take the field riding 2 kinds of mount (Warhorse and Pony)."  # fmt: skip


class GroupMountTestCase(CompanionTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pony = make_animal("Pony", "mount", rating_bonus=2, movement=6)
        self.group = make_unit(HENCHMEN, self.warband, name="Outriders", members=("A", "B", "C"), movement=4)

    def row(self, item: Any, **fields: Any) -> HenchmenGroupItem:
        return HenchmenGroupItem.objects.create(henchmen_group=self.group, item=item, **fields)

    def switched(self, item: Any) -> list[bool]:
        rows = HenchmenGroupItem.objects.filter(henchmen_group=self.group, item=item).order_by("id")
        return list(rows.values_list("companion", flat=True))

    def switch_group(self, row: Any, on: bool = True) -> Any:
        response = self.switch(row, on=on, kind=HENCHMEN, unit=self.group)
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def group_warnings(self, response: Any) -> list[dict[str, Any]]:
        """The answer's group warnings (three riders also pass the warband's two mounts: `warband_mounts`)."""
        return [warning for warning in response.data["warnings"] if warning["code"].startswith("group_")]


class GroupMountSwitchTests(GroupMountTestCase):
    def test_one_switch_mounts_the_whole_group(self):
        horse = self.row(self.horse)

        response = self.switch_group(horse)

        self.assertEqual(self.switched(self.horse), [True])
        unit = response.data["unit"]
        self.assertEqual((unit["mount"]["name"], unit["effective_stats"]), ("Warhorse", {"movement": 8, "armour_save": 6}))  # fmt: skip
        self.assertEqual((self.group_warnings(response), unit["mount_warnings"]), ([], []))
        self.assertEqual([warning["code"] for warning in response.data["warnings"]], ["warband_mounts"])  # 3 riders

    def test_switching_off_dismounts_the_whole_group(self):
        horse = self.row(self.horse, companion=True)

        unit = self.switch_group(horse, on=False).data["unit"]

        self.assertEqual(self.switched(self.horse), [False])
        self.assertEqual((unit["mount"], unit["effective_stats"], unit["mount_warnings"]), (None, None, []))

    def test_another_kind_of_mount_and_another_groups_rows_are_left_alone(self):
        horse, pony = self.row(self.horse), self.row(self.pony)
        other = make_unit(HENCHMEN, self.warband, name="Scouts", members=("D",))
        theirs = HenchmenGroupItem.objects.create(henchmen_group=other, item=self.horse)

        self.switch_group(horse)

        self.assertEqual((self.switched(self.horse), self.switched(self.pony)), ([True], [False]))
        self.assertFalse(HenchmenGroupItem.objects.get(pk=theirs.pk).companion)
        self.assertFalse(HenchmenGroupItem.objects.get(pk=pony.pk).companion)

    def test_a_hero_still_switches_one_copy(self):
        rows = [HeroItem.objects.create(hero=self.hero, item=self.horse) for _ in range(2)]

        self.switch(rows[1])

        self.assertEqual([row.companion for row in self.hero.hero_items.order_by("id")], [False, True])


class GroupMountWarningTests(GroupMountTestCase):
    def test_a_group_riding_two_kinds_of_mount_cant_take_the_field(self):
        self.row(self.horse, companion=True)
        pony = self.row(self.pony)

        response = self.switch_group(pony)

        kinds = {"code": "group_mount_kinds", "message": KINDS_MESSAGE, "kinds": ["Warhorse", "Pony"]}
        self.assertEqual(self.group_warnings(response), [kinds])
        self.assertEqual(response.data["unit"]["mount_warnings"], [kinds])

    def test_a_group_on_foot_has_no_mount_warning(self):
        horse = self.row(self.horse, companion=True)

        response = self.switch_group(horse, on=False)

        self.assertEqual((response.data["warnings"], response.data["unit"]["mount_warnings"]), ([], []))

    def test_a_purchase_for_a_group_answers_with_the_whole_group(self):
        self.row(self.horse, companion=True)
        body = {"item_id": self.pony.id, "price": 0, "target_type": HENCHMEN.key, "target_id": self.group.id}

        response = self.client.post(f"/api/warbands/{self.warband.id}/purchases/", {**body, "companion": True}, format="json")  # fmt: skip

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual([mount["name"] for mount in response.data["unit"]["mounts"]], ["Warhorse", "Pony"])
        self.assertEqual([warning["code"] for warning in response.data["unit"]["mount_warnings"]], ["group_mount_kinds"])  # fmt: skip

    def test_three_kinds_are_listed_in_order(self):
        mule = make_animal("Mule", "mount")
        rows = [HenchmenGroupItem(henchmen_group=self.group, item=item, companion=True) for item in (self.horse, self.pony, mule)]  # fmt: skip

        [warning] = group_mount_warnings("Outriders", rows)

        self.assertEqual(warning["kinds"], ["Warhorse", "Pony", "Mule"])
        self.assertIn("riding 3 kinds of mount (Warhorse, Pony and Mule).", warning["message"])

    def test_a_pet_or_a_mount_not_switched_on_is_no_mount(self):
        rows = [
            HenchmenGroupItem(henchmen_group=self.group, item=self.raven, companion=True),
            HenchmenGroupItem(henchmen_group=self.group, item=self.horse, companion=False),
        ]

        self.assertEqual(group_mount_warnings("Outriders", rows), [])
        self.assertNotIn("mount_warnings", self.client.get(unit_url(HERO, self.warband.id)).data[0])


class ArrivingRowTests(GroupMountTestCase):
    """A mount that arrives for a group is a new loadout row, switched off unless the purchase asks: the group rides
    the row it switched on."""

    def test_a_mount_moved_in_lands_switched_off_and_arms_the_oldest_members(self):
        self.row(self.horse, companion=True)
        WarbandItem.objects.create(warband=self.warband, item=self.pony, quantity=2, cost=30)
        body = {"source_type": "stash", "target_type": HENCHMEN.key, "target_id": self.group.id, "item_id": self.pony.id}  # fmt: skip

        response = self.client.post(f"/api/warbands/{self.warband.id}/item-transfers/", {**body, "quantity": 2}, format="json")  # fmt: skip

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((self.switched(self.horse), self.switched(self.pony)), ([True], [False]))
        [pony] = [item for item in response.data["target"]["items"] if item["name"] == "Pony"]
        self.assertEqual(pony["carriers"], 2)  # two from the stash: the third member has a gap
