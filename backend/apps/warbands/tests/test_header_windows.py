"""The warband header's windows (William, 22 Nov 2026): the rating unit by unit, with each unit's level, in the
summary, and the last ten battles from `warbands/<id>/record/`, each in a fixed number of queries."""

from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.utils import timezone

from apps.battles.models import Battle, BattleParticipant
from apps.core.testing import count_get_queries
from apps.warbands.models import HenchmenGroupItem, Warband

from .beast_support import warhorse
from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit


class RatingBreakdownTests(RosterTestCase):
    def summary(self) -> Any:
        response = self.client.get(f"/api/warbands/{self.warband.id}/sheet/")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["summary"]

    def test_each_unit_adds_its_part_and_the_parts_make_the_rating(self):
        make_unit(HERO, self.warband, name="Aldric", xp=Decimal("12.5"))
        make_unit(HERO, self.warband, name="Ogre", large=True, xp=3)
        group = make_unit(HENCHMEN, self.warband, name="Swords", xp=2, members=("A", "B"))
        HenchmenGroupItem.objects.create(henchmen_group=group, item=warhorse(), companion=True)
        make_unit(HIRELING, self.warband, name="Ranger", rating=18, xp=4)
        make_unit(HERO, self.warband, name="Away", xp=9, missing_games=1)

        summary = self.summary()

        rows = {row["name"]: row for row in summary["rating_breakdown"]}
        self.assertEqual((rows["Aldric"]["per_model"], rows["Aldric"]["xp"], rows["Aldric"]["total"]), (5, 12.5, 17.5))
        self.assertEqual(rows["Ogre"]["total"], 23)
        swords = rows["Swords"]
        self.assertEqual((swords["kind"], swords["models"], swords["mounts"], swords["total"]), ("henchmen_group", 2, 10, 24))  # fmt: skip
        self.assertEqual((rows["Ranger"]["kind"], rows["Ranger"]["total"]), ("hired_sword", 22))
        self.assertEqual((rows["Away"]["missing"], rows["Away"]["total"]), (True, 0))
        self.assertEqual(sum(row["total"] for row in summary["rating_breakdown"]), summary["rating"])

    def test_a_units_level_is_the_thresholds_its_xp_has_reached(self):
        self.set_thresholds(hero_level_thresholds=[2, 4, 6, 8])
        make_unit(HERO, self.warband, name="Aldric", xp=5)
        make_unit(HERO, self.warband, name="Fresh", xp=0)

        rows = {row["name"]: row["level"] for row in self.summary()["rating_breakdown"]}

        self.assertEqual(rows, {"Aldric": 2, "Fresh": 0})

    def test_the_sheet_reads_it_in_a_fixed_number_of_queries(self):
        url = f"/api/warbands/{self.warband.id}/sheet/"

        def recruit() -> None:
            make_unit(HERO, self.warband)
            make_unit(HENCHMEN, self.warband, members=("A",))
            make_unit(HIRELING, self.warband)

        recruit()
        few = count_get_queries(self.client, url)
        for _ in range(3):
            recruit()

        self.assertEqual(count_get_queries(self.client, url), few)


class WarbandRecordTests(RosterTestCase):
    url: str

    def setUp(self) -> None:
        super().setUp()
        self.url = f"/api/warbands/{self.warband.id}/record/"
        self.third = Warband.objects.create(campaign=self.campaign, user=self.outsider, name="Beasts")

    def battle(self, *, winners: list[Warband], others: tuple[Warband, ...] = (), days: int = 0, **fields: Any):
        battle = Battle.objects.create(
            campaign=self.campaign,
            created_by_user=self.player,
            scenario=fields.pop("scenario", "Bridge"),
            status=fields.pop("status", Battle.STATUS_ENDED),
            ended_at=timezone.now() - timedelta(days=days),
            winner_warband_ids_json=[warband.id for warband in winners],
            **fields,
        )
        for warband in (self.warband, self.rival, *others):
            BattleParticipant.objects.create(battle=battle, user=warband.user, warband=warband)
        return battle

    def test_lists_the_ended_battles_newest_first_with_each_result_and_opponent(self):
        lost = self.battle(winners=[self.rival], days=2, number=1)
        won = self.battle(winners=[self.warband], others=(self.third,), days=1, number=2, scenario="Street Fight")
        tied = self.battle(winners=[], days=0, number=3)
        self.battle(winners=[], status=Battle.STATUS_PREBATTLE)  # not over: not on the record

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row["id"] for row in response.data], [tied.id, won.id, lost.id])
        self.assertEqual([row["result"] for row in response.data], ["no_winner", "won", "lost"])
        self.assertEqual(response.data[1]["number"], 2)
        self.assertEqual(response.data[1]["scenario"], "Street Fight")
        self.assertEqual(
            response.data[1]["opponents"],
            [
                {"id": self.rival.id, "name": "Rats", "won": False},
                {"id": self.third.id, "name": "Beasts", "won": False},
            ],
        )
        self.assertEqual(response.data[2]["opponents"], [{"id": self.rival.id, "name": "Rats", "won": True}])

    def test_keeps_the_last_ten_and_leaves_out_battles_it_left_or_was_taken_off(self):
        for day in range(12):
            self.battle(winners=[self.warband], days=day + 1)
        left = self.battle(winners=[self.rival])
        BattleParticipant.objects.filter(battle=left, warband=self.warband).update(status=BattleParticipant.STATUS_DECLINED)  # fmt: skip

        response = self.client.get(self.url)

        self.assertEqual(len(response.data), 10)
        self.assertNotIn(left.id, [row["id"] for row in response.data])

    def test_any_member_reads_it_and_an_outsider_does_not(self):
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self.client.get(self.url).status_code, 200)

        self.client.force_authenticate(user=self.outsider)
        self.assertIn(self.client.get(self.url).status_code, (403, 404))

    def test_reads_in_a_fixed_number_of_queries(self):
        self.battle(winners=[self.warband])
        few = count_get_queries(self.client, self.url)
        for day in range(5):
            self.battle(winners=[self.rival], others=(self.third,), days=day + 1)

        self.assertEqual(count_get_queries(self.client, self.url), few)
