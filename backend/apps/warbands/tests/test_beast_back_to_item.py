"""A creature group's members back to their Animal item (the bestiary rewrite step 4):
`POST henchmen-groups/<id>/back-to-item/ {"member_ids": [...]} | {"count": n}`.

The members leave the group as records, and copies of the beast's item land in the stash at the group's price; the
group goes with its last member, its gear to the stash rather than lost. No gold moves. Only a group recruited from a
beast with an item goes back.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.bestiary.models import BestiaryEntry
from apps.warbands.models import Henchman, HenchmenGroup, HenchmenGroupItem, WarbandItem

from .beast_support import beast, make_animal, wardogs
from .roster_support import HENCHMEN, RosterTestCase, log_rows, make_unit, trade_rows, unit_url


class BackToItemTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dogs = wardogs()
        self.group = make_unit(HENCHMEN, self.warband, name="Kennel", members=("A", "B", "C"), price=30, source_beast=beast(self.dogs))  # fmt: skip
        self.members = list(Henchman.objects.filter(group=self.group).order_by("id"))

    def back(self, body: dict[str, Any], group: Any = None) -> Any:
        url = unit_url(HENCHMEN, self.warband.id, (group or self.group).id, "back-to-item/")
        return self.client.post(url, body, format="json")

    def stash(self) -> list[tuple[str, int | None, int]]:
        rows = WarbandItem.objects.filter(warband=self.warband).select_related("item").order_by("item__name", "cost")
        return [(row.item.name, row.cost, row.quantity) for row in rows]

    def test_a_member_goes_back_to_an_item_in_the_stash_at_the_groups_price(self):
        response = self.back({"count": 1})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([member["name"] for member in response.data["group"]["henchmen"]], ["A", "B"])  # newest first
        self.assertEqual(self.stash(), [("Wardogs", 30, 1)])
        [entry] = response.data["stash_items"]
        self.assertEqual((entry["id"], entry["quantity"], entry["cost"]), (self.dogs.id, 1, 30))
        self.assertIsNotNone(Henchman.objects.get(pk=self.members[2].pk).dismissed_at)  # kept as a record
        self.assertEqual(trade_rows(self.warband), [])
        self.assertEqual([(row[0], row[1]) for row in log_rows(self.warband)], [("items", "moved")])
        self.assertIn("rating", response.data["summary"])

    def test_the_members_named_go_back(self):
        response = self.back({"member_ids": [self.members[0].id]})

        self.assertEqual([member["name"] for member in response.data["group"]["henchmen"]], ["B", "C"])

    def test_the_last_member_takes_the_group_with_him_and_its_gear_goes_to_the_stash(self):
        HenchmenGroupItem.objects.create(henchmen_group=self.group, item=self.sword, cost=10)

        response = self.back({"count": 3})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["group"], None)
        self.assertIsNotNone(HenchmenGroup.objects.get(pk=self.group.pk).dismissed_at)
        self.assertEqual(self.stash(), [("Sword", 10, 1), ("Wardogs", 30, 3)])
        self.assertEqual([entry["name"] for entry in response.data["stash_items"]], ["Wardogs", "Sword"])
        self.assertIn(("personnel", "remove_henchmen_group"), [(row[0], row[1]) for row in log_rows(self.warband)])

    def test_an_archived_beasts_item_still_comes_back(self):
        BestiaryEntry.objects.filter(pk=beast(self.dogs).pk).update(archived_at="2026-10-01T00:00:00Z")

        self.assertEqual(self.back({"count": 1}).status_code, 200)
        self.assertEqual(self.stash(), [("Wardogs", 30, 1)])

    def test_only_a_group_recruited_from_a_beast_with_an_item_goes_back(self):
        plain = make_unit(HENCHMEN, self.warband)
        bare = beast(make_animal("Hounds", "creature"))
        bare.animal_item.delete()
        itemless = make_unit(HENCHMEN, self.warband, source_beast=BestiaryEntry.objects.get(pk=bare.pk))

        for group, code in ((plain, "not_from_a_beast"), (itemless, "no_animal_item")):
            response = self.back({"count": 1}, group=group)
            self.assertEqual((response.status_code, response.data["code"]), (400, code))

    def test_members_who_arent_living_members_and_too_many_are_refused(self):
        Henchman.objects.filter(pk=self.members[0].pk).update(dead=True)
        stranger = make_unit(HENCHMEN, self.warband, members=("Z",)).henchmen.get()
        for body, field in (
            ({"member_ids": [self.members[0].id]}, "member_ids"),
            ({"member_ids": [stranger.id]}, "member_ids"),
            ({"count": 3}, "count"),
            ({}, "non_field_errors"),
            ({"count": 1, "member_ids": [self.members[1].id]}, "non_field_errors"),
        ):
            response = self.back(body)
            self.assertEqual((response.status_code, response.data["code"]), (400, "invalid"), body)
            self.assertIn(field, response.data["fields"])
        self.assertEqual(self.stash(), [])

    def test_a_group_off_the_roster_is_not_found_and_a_viewer_is_forbidden(self):
        dead = make_unit(HENCHMEN, self.warband, source_beast=beast(self.dogs), dead=True)
        self.assertEqual(self.back({"count": 1}, group=dead).status_code, 404)
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self.back({"count": 1}).status_code, 403)

    def test_the_query_count_doesnt_grow_with_the_members(self):
        big = make_unit(HENCHMEN, self.warband, members=tuple("ABCDEFG"), price=30, source_beast=beast(self.dogs))  # fmt: skip
        WarbandItem.objects.create(warband=self.warband, item=self.dogs, quantity=1, cost=30)  # both add to the row
        counts = []
        for group, count in ((self.group, 1), (big, 5)):
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.back({"count": count}, group=group).status_code, 200)
            counts.append(len(captured))
        self.assertEqual(counts[0], counts[1])
