"""A henchman misses games on his own (William, 25 Nov 2026: "Henchmen need to be able to miss a game individually not
as a group"): his group's member list sets and clears his count and reason, logged as a unit's are; he stays in the
group and counts towards warband size, but the rating (his model, his XP and the mount he rides) leaves him out, in the
sheet's summary and the summary endpoint alike; a member who dies misses no more."""

from decimal import Decimal
from typing import Any

from apps.warbands.models import Henchman, HenchmenGroupItem, WarbandLog
from apps.warbands.services.summary import load_warband_units

from .beast_support import warhorse
from .roster_support import HENCHMEN, RosterTestCase, make_unit, unit_url


def logs() -> list[tuple[str, dict[str, Any]]]:
    rows = WarbandLog.objects.filter(feature="personnel", entry_type__in=("unit_missing", "unit_returns"))
    return [(row.entry_type, row.payload) for row in rows.order_by("id")]


class HenchmanMissingGamesTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = make_unit(HENCHMEN, self.warband, name="Swords", unit_type="Swordsman", members=("Hans", "Otto"))
        self.hans, self.other = Henchman.objects.filter(group=self.group).order_by("id")

    def save(self, *members: dict[str, Any]) -> Any:
        url = unit_url(HENCHMEN, self.warband.id, self.group.id)
        return self.client.patch(url, {"henchmen": list(members)}, format="json")

    def member(self, member: Henchman) -> tuple[int, str]:
        fresh = Henchman.objects.get(id=member.id)
        return fresh.missing_games, fresh.missing_reason

    def test_a_member_is_set_missing_on_his_own_and_it_is_logged(self):
        response = self.save(
            {"id": self.hans.id, "name": "Hans", "missing_games": 2, "missing_reason": "Captured"},
            {"id": self.other.id, "name": "Otto"},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((self.member(self.hans), self.member(self.other)), ((2, "Captured"), (0, "")))
        shown = {row["id"]: (row["missing_games"], row["missing_reason"]) for row in response.data["henchmen"]}
        self.assertEqual(shown[self.hans.id], (2, "Captured"))
        self.assertEqual(logs(), [("unit_missing", {"name": "Hans", "games": 2, "reason": "Captured"})])

    def test_clearing_brings_him_back_and_it_is_logged(self):
        Henchman.objects.filter(id=self.other.id).update(missing_games=1, missing_reason="Lost")

        self.assertEqual(self.save({"id": self.other.id, "missing_games": 0}, {"id": self.hans.id}).status_code, 200)

        self.assertEqual(self.member(self.other), (0, ""))
        self.assertEqual(logs(), [("unit_returns", {"name": "Otto"})])

    def test_a_member_who_dies_misses_no_more_and_the_count_is_bounded(self):
        Henchman.objects.filter(id=self.hans.id).update(missing_games=2, missing_reason="Captured")

        refused = self.save({"id": self.hans.id, "missing_games": 100}, {"id": self.other.id})
        died = self.save({"id": self.hans.id, "dead": True}, {"id": self.other.id})

        self.assertEqual(refused.status_code, 400)
        self.assertEqual(died.status_code, 200, died.data)
        self.assertEqual(self.member(self.hans), (0, ""))
        self.assertEqual(logs(), [])  # dead, not back

    def test_a_missing_member_stays_in_the_size_but_leaves_the_rating_and_his_mount(self):
        HenchmenGroupItem.objects.create(henchmen_group=self.group, item=warhorse(), companion=True)
        Henchman.objects.filter(group=self.group).update(missing_games=0)
        self.group.xp = Decimal("2")
        self.group.save()
        before = load_warband_units([self.warband.id])[self.warband.id]
        Henchman.objects.filter(id=self.hans.id).update(missing_games=1)

        units = load_warband_units([self.warband.id])[self.warband.id]
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()["summary"]

        per_rider = before.mounts_rating // 2
        self.assertEqual(units.rating, before.rating - (5 + 2) - per_rider)
        self.assertEqual((units.unit_count, before.unit_count), (2, 2))
        self.assertEqual(sheet["rating"], units.rating)
        row = next(row for row in sheet["rating_breakdown"] if row["name"] == "Swords")
        self.assertEqual((row["models"], row["mounts"], row["missing"]), (1, per_rider, False))
