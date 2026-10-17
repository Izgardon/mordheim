"""Characterisation: syncing a henchmen group's members through PATCH (pass 1)."""

from decimal import Decimal
from typing import Any

from apps.warbands.models import Henchman, HenchmenGroup

from .roster_support import HENCHMEN, RosterTestCase, log_rows, make_unit, trade_rows, unit_url


class HenchmenMemberSyncCharacterisationTests(RosterTestCase):
    group: HenchmenGroup
    alpha: Henchman
    beta: Henchman

    def setUp(self) -> None:
        super().setUp()
        self.group = make_unit(HENCHMEN, self.warband, name="Zealots", price=20, members=("Alpha", "Beta"))
        self.alpha, self.beta = self.group.henchmen.order_by("id")

    def _patch(self, payload: dict[str, Any]) -> Any:
        return self.client.patch(unit_url(HENCHMEN, self.warband.id, self.group.id), payload, format="json")

    def _members(self) -> list[tuple[str, int, bool]]:
        return sorted(self.group.henchmen.values_list("name", "kills", "dead"))

    def test_members_list_renames_adds_and_removes(self):
        response = self._patch(
            {"henchmen": [{"id": self.alpha.id, "name": "Alpha Prime", "kills": 2}, {"name": "Gamma", "cost": 30}]}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._members(), [("Alpha Prime", 2, False), ("Gamma", 0, False)])
        self.assertFalse(Henchman.objects.filter(id=self.beta.id).exists())
        self.assertEqual(Henchman.objects.get(id=self.alpha.id).name, "Alpha Prime")  # updated in place
        self.assertEqual(trade_rows(self.warband), [("Recruited", "Gamma into Zealots", -30, None)])
        self.assertEqual(
            log_rows(self.warband), [("personnel", "new_henchman", {"name": "Gamma", "group": "Zealots"}, None)]
        )
        self.assertEqual(sorted(m["name"] for m in response.json()["henchmen"]), ["Alpha Prime", "Gamma"])

    def test_fields_missing_from_a_member_entry_are_reset(self):
        Henchman.objects.filter(id=self.alpha.id).update(kills=3)
        self._patch({"henchmen": [{"id": self.alpha.id}, {"id": self.beta.id, "name": "Beta"}]})
        alpha = Henchman.objects.get(id=self.alpha.id)
        self.assertEqual((alpha.name, alpha.kills, alpha.dead), ("", 0, False))

    def test_omitting_the_members_list_leaves_members_alone(self):
        self._patch({"name": "Renamed"})
        self.assertEqual(self._members(), [("Alpha", 0, False), ("Beta", 0, False)])

    def test_dead_members_missing_from_the_payload_survive(self):
        # BUG-04 as filed (dead members deleted on save) does not reproduce through this endpoint:
        # the view's living-only Prefetch also scopes `group.henchmen.values_list(...)` in the
        # serializer, so only living members are candidates for deletion. This is accidental
        # (dropping that prefetch, e.g. for PERF-23, would bring the data loss back), so lock it.
        fallen = Henchman.objects.create(group=self.group, name="Fallen", kills=3, dead=True)
        living = [{"id": self.alpha.id, "name": "Alpha"}]

        self._patch({"henchmen": living})

        self.assertTrue(Henchman.objects.filter(id=fallen.id, dead=True, kills=3).exists())
        self.assertFalse(Henchman.objects.filter(id=self.beta.id).exists())  # living and missing: deleted
        kill_history = self.client.get(unit_url(HENCHMEN, self.warband.id, self.group.id, "kill-history/"))
        self.assertEqual(kill_history.json()["total_kills"], 3)

    def test_a_dead_member_sent_back_with_its_id_is_duplicated(self):
        # Characterises current behaviour (not yet in BUGS.md); update when fixed. The dead id isn't
        # among the living ids the serializer matches against, so the entry is created as a new member.
        fallen = Henchman.objects.create(group=self.group, name="Fallen", kills=3, dead=True)
        members = [{"id": self.alpha.id, "name": "Alpha"}, {"id": fallen.id, "name": "Fallen", "dead": True}]

        patched = self._patch({"henchmen": members})
        fetched = self.client.get(unit_url(HENCHMEN, self.warband.id, self.group.id))

        self.assertEqual(self._members(), [("Alpha", 0, False), ("Fallen", 0, True), ("Fallen", 3, True)])
        self.assertEqual(trade_rows(self.warband), [])  # no recruit charge for the copy
        # the PATCH response drops the living-only prefetch, so dead members appear in it (GET hides them)
        self.assertEqual(sorted(m["name"] for m in patched.json()["henchmen"]), ["Alpha", "Fallen", "Fallen"])
        self.assertEqual([m["name"] for m in fetched.json()["henchmen"]], ["Alpha"])

    def test_members_can_be_marked_dead_without_the_group_dying(self):
        response = self._patch(
            {"henchmen": [{"id": m.id, "name": m.name, "dead": True} for m in (self.alpha, self.beta)]}
        )

        self.assertEqual(response.status_code, 200)
        self.group.refresh_from_db()
        self.assertFalse(self.group.dead)
        listed = self.client.get(unit_url(HENCHMEN, self.warband.id)).json()
        self.assertEqual([(row["id"], row["henchmen"]) for row in listed], [(self.group.id, [])])

    def test_default_hire_cost_adds_every_group_item_and_twice_the_xp_truncated(self):
        # Characterises current behaviour (BUG-66, BUG-85); update when fixed
        self.group.xp = Decimal("1.3")
        self.group.save()
        self.group.henchmen_group_items.create(item=self.sword, cost=10)
        self.group.henchmen_group_items.create(item=self.axe, cost=7)
        members = [{"id": self.alpha.id, "name": "Alpha"}, {"id": self.beta.id, "name": "Beta"}, {"name": "New"}]

        self._patch({"henchmen": members})

        # 20 (price) + 17 (both members' items, not one share) + 2.6 (2 x XP) = 39.6, stored as -39
        self.assertEqual(trade_rows(self.warband), [("Recruited", "New into Zealots", -39, None)])

    def test_an_explicit_cost_is_parsed_loosely(self):
        members = [{"name": "Cheap", "cost": "12.9"}, {"name": "Free", "cost": -5}, {"name": "Junk", "cost": "abc"}]

        self._patch({"henchmen": members})

        # "12.9" -> 12, negatives -> 0 (still written), unparsable -> the default cost (20)
        trades = trade_rows(self.warband)
        header = "Recruited 3 into Zealots"
        self.assertEqual(trades[0], ("Group", header, 0, None))
        self.assertEqual(
            sorted(trades[1:]),
            [
                ("Recruited", "Cheap into Zealots", -12, header),
                ("Recruited", "Free into Zealots", 0, header),
                ("Recruited", "Junk into Zealots", -20, header),
            ],
        )

    def test_adding_several_members_writes_a_trade_and_log_header(self):
        self._patch({"henchmen": [{"name": "Ana", "cost": 20, "item_notes": "club"}, {"cost": 20}]})

        header = "Recruited 2 into Zealots"
        trades = trade_rows(self.warband)
        self.assertEqual(trades[0], ("Group", header, 0, None))
        self.assertEqual(
            sorted(trades[1:]),
            [
                ("Recruited", "Ana into Zealots", -20, header),
                ("Recruited", "Unnamed Henchman into Zealots", -20, header),
            ],
        )
        self.assertEqual(self.warband.trades.get(description="Ana into Zealots").notes, "club")
        batch = "new_henchmen_group_batch"
        logs = log_rows(self.warband)
        self.assertEqual(logs[0], ("personnel", batch, {"name": "Zealots", "count": 2}, None))
        self.assertEqual([row[3] for row in logs[1:]], [batch, batch])

    def test_a_string_member_id_names_the_same_member(self):
        # BUG-93: "12" used to miss member 12, which was then deleted, recreated and charged again
        members = [{"id": str(self.alpha.id), "name": "Alpha Prime"}, {"id": self.beta.id, "name": "Beta"}]

        response = self._patch({"henchmen": members})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Henchman.objects.get(id=self.alpha.id).name, "Alpha Prime")  # updated in place
        self.assertEqual(self._members(), [("Alpha Prime", 0, False), ("Beta", 0, False)])
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))

    def test_an_unknown_member_id_is_treated_as_a_new_member(self):
        self._patch({"henchmen": [{"id": 999999, "name": "Ghost", "cost": 5}]})
        self.assertEqual(self._members(), [("Ghost", 0, False)])
        self.assertEqual(trade_rows(self.warband), [("Recruited", "Ghost into Zealots", -5, None)])

    def test_invalid_member_entries_are_rejected_and_change_nothing(self):
        # BUG-90: the bad values used to reach the database and return 500 after the group fields
        # were saved. A non-numeric id used to make a new member (and delete the rest).
        cases: list[Any] = [
            {"name": None},
            {"name": "x" * 121},
            {"name": "Gamma", "kills": -1},
            {"name": "Gamma", "kills": "many"},
            {"name": "Gamma", "dead": None},
            {"id": "abc", "name": "Gamma"},
            "Gamma",
        ]
        for entry in cases:
            with self.subTest(entry=entry):
                response = self._patch({"name": "Renamed", "henchmen": [entry]})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(list(response.json()), ["henchmen"])

        self.group.refresh_from_db()
        self.assertEqual(self.group.name, "Zealots")
        self.assertEqual(self._members(), [("Alpha", 0, False), ("Beta", 0, False)])
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))
