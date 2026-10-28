"""A henchmen group mounts as one (William's rule after the bestiary rewrite).

Every member of a group carries the same gear, so a group's mount is a group decision: the companion switch on one of
its copies of a mount switches every copy of that mount on, or off. Heroes, hired swords and a group's pets still
switch one copy. A mounted group whose mounts aren't one per living member, or that rides more than one kind of mount,
warns (never refuses): in the switch's answer as before, and on the group's own payload (`mount_warnings`), so a
member recruited after the group mounted shows it too.
"""

from typing import Any

from apps.warbands.models import Henchman, HenchmenGroupItem, HeroItem
from apps.warbands.units.companions import group_mount_warnings

from .beast_support import make_animal
from .roster_support import HENCHMEN, HERO, make_unit, unit_url
from .test_companions import CompanionTestCase

SHORT = "Every member of a group carries the same gear, so Outriders can't take the field until each of its"


class GroupMountTestCase(CompanionTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pony = make_animal("Pony", "mount", rating_bonus=2, movement=6)
        self.group = make_unit(HENCHMEN, self.warband, name="Outriders", members=("A", "B", "C"), movement=4)

    def copies(self, item: Any, count: int, **fields: Any) -> list[HenchmenGroupItem]:
        return [HenchmenGroupItem.objects.create(henchmen_group=self.group, item=item, **fields) for _ in range(count)]

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
    def test_one_switch_mounts_the_whole_group_on_every_copy_of_that_mount(self):
        horses = self.copies(self.horse, 3)

        response = self.switch_group(horses[0])

        self.assertEqual(self.switched(self.horse), [True, True, True])
        unit = response.data["unit"]
        self.assertEqual((unit["mount"]["name"], unit["effective_stats"]), ("Warhorse", {"movement": 8, "armour_save": 6}))  # fmt: skip
        self.assertEqual((self.group_warnings(response), unit["mount_warnings"]), ([], []))
        self.assertEqual([warning["code"] for warning in response.data["warnings"]], ["warband_mounts"])

    def test_switching_off_dismounts_the_whole_group(self):
        horses = self.copies(self.horse, 3, companion=True)

        unit = self.switch_group(horses[2], on=False).data["unit"]

        self.assertEqual(self.switched(self.horse), [False, False, False])
        self.assertEqual((unit["mount"], unit["effective_stats"], unit["mount_warnings"]), (None, None, []))

    def test_a_spare_copy_rides_with_the_rest_and_another_kind_of_mount_is_left_as_it_is(self):
        horses = self.copies(self.horse, 2, companion=True) + self.copies(self.horse, 1)  # the third arrived later
        self.copies(self.pony, 1)

        self.switch_group(horses[2])

        self.assertEqual((self.switched(self.horse), self.switched(self.pony)), ([True, True, True], [False]))

    def test_a_groups_pets_still_switch_one_copy_each(self):
        ravens = self.copies(self.raven, 2)  # each switched-on pet is a model of its own in battle

        self.switch_group(ravens[0])

        self.assertEqual(self.switched(self.raven), [True, False])

    def test_a_hero_still_switches_one_copy(self):
        rows = [HeroItem.objects.create(hero=self.hero, item=self.horse) for _ in range(2)]

        self.switch(rows[1])

        self.assertEqual([row.companion for row in self.hero.hero_items.order_by("id")], [False, True])

    def test_another_groups_copies_are_left_alone(self):
        other = make_unit(HENCHMEN, self.warband, name="Scouts", members=("D",))
        theirs = HenchmenGroupItem.objects.create(henchmen_group=other, item=self.horse)

        self.switch_group(self.copies(self.horse, 1)[0])

        self.assertFalse(HenchmenGroupItem.objects.get(pk=theirs.pk).companion)


class GroupMountWarningTests(GroupMountTestCase):
    def test_a_group_short_of_mounts_cant_take_the_field_until_each_member_has_one(self):
        [horse] = self.copies(self.horse, 1)

        response = self.switch_group(horse)

        warning = {"code": "group_mounts", "message": f"{SHORT} 3 members has a Warhorse (it has 1).", "mounts": 1}
        self.assertEqual(response.data["warnings"], [{**warning, "members": 3}])
        self.assertEqual(response.data["unit"]["mount_warnings"], [{**warning, "members": 3}])

    def test_a_group_with_more_mounts_than_members_has_some_left_over(self):
        horses = self.copies(self.horse, 4)

        [warning] = self.group_warnings(self.switch_group(horses[0]))

        message = (
            "Every member of a group rides one mount, so Outriders has 1 left over (4 mounts for 3 living members)."
        )
        self.assertEqual(warning, {"code": "group_mounts", "message": message, "mounts": 4, "members": 3})

    def test_a_group_riding_two_kinds_of_mount_cant_take_the_field(self):
        self.copies(self.horse, 2, companion=True)
        [pony] = self.copies(self.pony, 1)

        response = self.switch_group(pony)

        message = "Every member of a group carries the same gear, so Outriders can't take the field riding 2 kinds of mount (Warhorse and Pony)."  # fmt: skip
        kinds = {"code": "group_mount_kinds", "message": message, "kinds": ["Warhorse", "Pony"]}
        self.assertEqual(self.group_warnings(response), [kinds])  # three mounts for three members

    def test_a_group_short_of_mounts_of_two_kinds_needs_a_mount_for_each_member(self):
        self.copies(self.horse, 1, companion=True)
        [pony] = self.copies(self.pony, 1)

        warnings = self.switch_group(pony).data["warnings"]

        self.assertEqual([warning["code"] for warning in warnings], ["group_mounts", "group_mount_kinds"])  # two mounts
        self.assertEqual(warnings[0]["message"], f"{SHORT} 3 members has a mount (it has 2).")

    def test_a_group_on_foot_has_no_mount_warning(self):
        horses = self.copies(self.horse, 1, companion=True)

        response = self.switch_group(horses[0], on=False)

        self.assertEqual((response.data["warnings"], response.data["unit"]["mount_warnings"]), ([], []))

    def test_a_member_recruited_after_the_group_mounted_shows_on_the_groups_payload(self):
        self.copies(self.horse, 3, companion=True)
        members = [{"id": member.id} for member in self.group.henchmen.order_by("id")]

        patched = self.client.patch(
            unit_url(HENCHMEN, self.warband.id, self.group.id), {"henchmen": [*members, {"name": "D"}]}, format="json"
        )

        self.assertEqual(patched.status_code, 200, patched.data)
        expected = [f"{SHORT} 4 members has a Warhorse (it has 3)."]
        self.assertEqual([warning["message"] for warning in patched.data["mount_warnings"]], expected)
        listed = self.client.get(unit_url(HENCHMEN, self.warband.id)).data
        self.assertEqual([warning["message"] for warning in listed[0]["mount_warnings"]], expected)
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").data
        [group] = sheet["henchmen_groups"]
        self.assertEqual([warning["message"] for warning in group["mount_warnings"]], expected)

    def test_a_purchase_for_a_group_answers_with_its_mount_warnings(self):
        response = self.client.post(
            f"/api/warbands/{self.warband.id}/purchases/",
            {
                "item_id": self.horse.id,
                "price": 0,
                "target_type": HENCHMEN.key,
                "target_id": self.group.id,
                "companion": True,
            },  # fmt: skip
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual([warning["code"] for warning in response.data["mount_warnings"]], ["group_mounts"])
        self.assertEqual([warning["code"] for warning in response.data["warnings"]], ["group_mounts"])


class GroupMountWordingTests(GroupMountTestCase):
    def rows(self, *items: Any) -> list[Any]:
        return [HenchmenGroupItem(henchmen_group=self.group, item=item, companion=True) for item in items]

    def test_a_mount_whose_name_starts_with_a_vowel_takes_an(self):
        steed = make_animal("Elven Steed", "mount", movement=9)

        [warning] = group_mount_warnings("Outriders", self.rows(steed), 2)

        self.assertTrue(warning["message"].endswith("each of its 2 members has an Elven Steed (it has 1)."))

    def test_three_kinds_are_listed_in_order(self):
        mule = make_animal("Mule", "mount")

        warnings = group_mount_warnings("Outriders", self.rows(self.horse, self.pony, mule), 3)

        self.assertEqual(warnings[0]["kinds"], ["Warhorse", "Pony", "Mule"])
        self.assertIn("riding 3 kinds of mount (Warhorse, Pony and Mule).", warnings[0]["message"])

    def test_one_member_with_two_mounts_has_one_left_over(self):
        [warning] = group_mount_warnings("Outriders", self.rows(self.horse, self.horse), 1)

        self.assertIn("has 1 left over (2 mounts for 1 living member).", warning["message"])

    def test_a_pet_or_a_mount_not_switched_on_is_no_mount(self):
        spare = HenchmenGroupItem(henchmen_group=self.group, item=self.horse, companion=False)

        self.assertEqual(group_mount_warnings("Outriders", [*self.rows(self.raven), spare], 3), [])

    def test_dead_members_dont_ride(self):
        self.copies(self.horse, 2, companion=True)
        Henchman.objects.filter(group=self.group, name="C").update(dead=True)

        listed = self.client.get(unit_url(HENCHMEN, self.warband.id)).data

        self.assertEqual(listed[0]["mount_warnings"], [])  # two horses for the two living members
        self.assertNotIn("mount_warnings", self.client.get(unit_url(HERO, self.warband.id)).data[0])
