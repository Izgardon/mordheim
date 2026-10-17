"""The recruit queue's Save: POST /api/warbands/<id>/<kind>/batch/ (decision 1, ROST-TWEAK-01).

{"create": [...], "update": [{"id": ..., ...}], "dismiss": [ids]} is applied all or nothing through the
per-unit services; errors come back at once in the standard shape with keys like "create.0.name"; the
answer is every visible unit of the kind (detail shape) and the summary.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.warbands.models import Henchman, Hero, WarbandLog, WarbandTrade

from .roster_support import (
    HENCHMEN,
    HERO,
    HIRED_SWORD,
    KINDS,
    Kind,
    RosterTestCase,
    create_payload,
    log_rows,
    make_unit,
    trade_rows,
    unit_url,
)


class RosterBatchTests(RosterTestCase):
    def _batch(self, kind: Kind, body: Any) -> Any:
        return self.client.post(unit_url(kind, self.warband.id, suffix="batch/"), body, format="json")

    def _ledger(self) -> tuple[int, int]:
        return WarbandTrade.objects.filter(warband=self.warband).count(), WarbandLog.objects.count()

    def test_creates_updates_and_dismissals_land_together(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.warband.logs.all().delete()
                self.warband.trades.all().delete()
                kept, gone = make_unit(kind, self.warband, name="Kept"), make_unit(kind, self.warband, name="Gone")
                body = {
                    "create": [create_payload(kind, name="New", price=30)],
                    "update": [{"id": kept.id, "name": "Renamed", "xp": 2}],
                    "dismiss": [gone.id],
                }

                response = self._batch(kind, body)

                self.assertEqual(response.status_code, 200, response.data)
                units = response.json()["units"]
                self.assertEqual([unit["name"] for unit in units], ["Renamed", "New"])
                self.assertEqual(units, self.client.get(unit_url(kind, self.warband.id, suffix="detail/")).json())
                summary = self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()
                self.assertEqual(response.json()["summary"], summary)
                self.assertIsNotNone(kind.model.objects.get(id=gone.id).dismissed_at)
                self.assertEqual(kind.model.objects.get(id=kept.id).level_up, 1)  # 2 XP crosses the first threshold
                self.assertEqual([row[1] for row in log_rows(self.warband)][:2], [kind.log_remove, kind.log_new])
                self.assertEqual(trade_rows(self.warband)[-1][2], -30)
                kind.model.objects.filter(warband=self.warband).delete()

    def test_one_bad_entry_saves_nothing_and_every_error_is_reported(self):
        kept, gone = make_unit(HERO, self.warband, name="Kept"), make_unit(HERO, self.warband, name="Gone")
        dead = make_unit(HERO, self.warband, dead=True)
        foreign = make_unit(HERO, self.rival)
        before = self._ledger()
        body = {
            "create": [create_payload(HERO), create_payload(HERO, name="", weapon_skill=11)],
            "update": [
                {"id": kept.id, "xp": "1.25", "name": "Renamed"},
                {"name": "No id"},
                {"id": dead.id, "name": "Risen"},
                {"id": foreign.id, "name": "Stolen"},
                {"id": kept.id, "name": "Twice"},
            ],
            "dismiss": [gone.id, 999999, gone.id],
        }

        response = self._batch(HERO, body)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "invalid")
        self.assertEqual(
            sorted(response.json()["fields"]),
            [
                "create.1.name",
                "create.1.weapon_skill",
                "dismiss.1",
                "dismiss.2",
                "update.0.xp",
                "update.1.id",
                "update.2.id",
                "update.3.id",
                "update.4.id",
            ],
        )
        self.assertEqual(self._ledger(), before)
        self.assertEqual(
            list(Hero.objects.filter(warband=self.warband).order_by("id").values_list("name", flat=True)),
            ["Kept", "Gone", "Test hero"],
        )
        self.assertIsNone(Hero.objects.get(id=gone.id).dismissed_at)

    def test_a_cap_refusal_names_its_entry_and_undoes_the_whole_batch(self):
        self.campaign_settings.max_heroes = 2
        self.campaign_settings.save()
        first, second = make_unit(HERO, self.warband), make_unit(HERO, self.warband)

        made_room = self._batch(HERO, {"dismiss": [first.id], "create": [create_payload(HERO, name="Replacement")]})
        self.assertEqual(made_room.status_code, 200, made_room.data)

        before = self._ledger()
        refused = self._batch(
            HERO,
            {"update": [{"id": second.id, "name": "Renamed"}], "create": [create_payload(HERO)] * 2},
        )

        detail = "Warband already has 2 heroes"
        self.assertEqual(
            (refused.status_code, refused.json()),
            (400, {"detail": detail, "code": "hero_cap_reached", "fields": {"create.0": [detail]}}),
        )
        self.assertEqual(self._ledger(), before)
        self.assertEqual(Hero.objects.get(id=second.id).name, "Test hero")

    def test_henchmen_groups_recruit_members_and_create_groups_in_one_save(self):
        group = make_unit(HENCHMEN, self.warband, name="Zealots", price=20, members=("Alpha",))
        alpha = group.henchmen.get()
        body = {
            "update": [{"id": group.id, "henchmen": [{"id": alpha.id}, {"name": "Beta"}]}],
            "create": [create_payload(HENCHMEN, name="Rats", price=15, henchmen=[{"name": "R1"}, {"name": "R2"}])],
        }

        response = self._batch(HENCHMEN, body)

        self.assertEqual(response.status_code, 200, response.data)
        groups = {row["name"]: [m["name"] for m in row["henchmen"]] for row in response.json()["units"]}
        self.assertEqual(groups, {"Zealots": ["Alpha", "Beta"], "Rats": ["R1", "R2"]})
        prices = sorted(price for _, _, price, _ in trade_rows(self.warband) if price)
        self.assertEqual(prices, [-20, -15, -15])  # Beta at the group's hire cost, two Rats at their price

    def test_dead_units_can_be_dismissed_like_delete_allows(self):
        dead = make_unit(HIRED_SWORD, self.warband, dead=True)
        self.assertEqual(self._batch(HIRED_SWORD, {"dismiss": [dead.id]}).status_code, 200)
        self.assertIsNotNone(type(dead).objects.get(id=dead.id).dismissed_at)

    def test_malformed_bodies_are_400s_in_the_standard_shape(self):
        cases: list[tuple[Any, list[str]]] = [
            ({"create": {"name": "x"}}, ["create"]),
            ({"create": ["x"]}, ["create.0"]),
            ({"dismiss": ["abc"]}, ["dismiss.0"]),
            ({"update": [5]}, ["update.0"]),
        ]
        for body, fields in cases:
            with self.subTest(body=body):
                response = self._batch(HERO, body)
                self.assertEqual(response.status_code, 400)
                self.assertEqual((response.json()["code"], sorted(response.json()["fields"])), ("invalid", fields))

    def test_an_empty_batch_answers_the_roster(self):
        make_unit(HERO, self.warband)
        response = self._batch(HERO, {})
        self.assertEqual((response.status_code, len(response.json()["units"])), (200, 1))

    def test_access(self):
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self._batch(HERO, {}).status_code, 403)
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self._batch(HERO, {}).status_code, 404)

    def test_queries_grow_with_the_entries_not_the_roster(self):
        def save_once(label: str) -> int:
            kept, gone = make_unit(HERO, self.warband, name=label), make_unit(HERO, self.warband)
            body = {
                "create": [create_payload(HERO, name=f"{label} new")],
                "update": [{"id": kept.id, "xp": 3}],
                "dismiss": [gone.id],
            }
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self._batch(HERO, body).status_code, 200)
            return len(captured)

        self.campaign_settings.max_heroes = 50
        self.campaign_settings.save()
        # seed one item first: item details are only read once some unit carries an item (fixed, not growth)
        make_unit(HERO, self.warband, name="Seed").hero_items.create(item=self.sword, cost=10)
        first = save_once("First")
        for index in range(5):
            hero = make_unit(HERO, self.warband, name=f"Extra {index}")
            hero.hero_items.create(item=self.sword, cost=10)
            Henchman.objects.create(group=make_unit(HENCHMEN, self.warband, members=()), name="X")
        self.assertEqual(save_once("Second"), first)
