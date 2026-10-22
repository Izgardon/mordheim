"""PERF-29: unit kill history reads only the warband's campaign, through the killer index."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.models import Battle, BattleEvent
from apps.campaigns.models import Campaign

from .roster_support import HENCHMEN, HERO, HIRELING, Kind, RosterTestCase, make_unit, record_kill, unit_url

KILLER_TYPES = ((HERO, "hero"), (HIRELING, "hireling"), (HENCHMEN, "henchman"))


class KillHistoryTests(RosterTestCase):
    def _killer(self, kind: Kind) -> tuple[Any, int]:
        unit = make_unit(kind, self.warband)
        return unit, (unit.henchmen.first().id if kind is HENCHMEN else unit.id)

    def test_kills_recorded_in_another_campaigns_battle_are_not_listed(self):
        elsewhere = Battle.objects.create(
            campaign=Campaign.objects.get(name="Elsewhere"),
            created_by_user=self.outsider,
            scenario="Elsewhere",
            status=Battle.STATUS_ENDED,
        )
        ours = self.make_battle("Ours")
        for kind, killer_type in KILLER_TYPES:
            with self.subTest(kind=kind.key):
                unit, killer_id = self._killer(kind)
                record_kill(ours, killer_type, killer_id, {"name": "Rat", "warband_id": self.rival.id})
                record_kill(elsewhere, killer_type, killer_id, {"name": "Lizard", "warband_id": self.rival.id})

                response = self.client.get(unit_url(kind, self.warband.id, unit.id, "kill-history/"))

                self.assertEqual(response.status_code, 200)
                self.assertEqual([kill["scenario_name"] for kill in response.json()["named_kills"]], ["Ours"])

    def test_the_kill_event_query_can_use_the_killer_index(self):
        battle = self.make_battle()
        # On a near-empty table the battle_id index costs the same as the killer index, so the
        # planner's choice flips with statistics. Other killers' events in the same battle (the
        # realistic case) plus fresh statistics make the killer index the clear winner.
        BattleEvent.objects.bulk_create(
            BattleEvent(
                battle=battle,
                type=BattleEvent.TYPE_UNIT_KILL_RECORDED,
                payload_json={"killer": {"unit_type": "hero", "unit_id": 900_000 + n}, "victim": {}},
            )
            for n in range(2_000)
        )
        with connection.cursor() as cursor:
            cursor.execute("ANALYZE battle_event")
        for kind, killer_type in KILLER_TYPES:
            with self.subTest(kind=kind.key):
                unit, killer_id = self._killer(kind)
                record_kill(battle, killer_type, killer_id, {"name": "Rat", "warband_id": self.rival.id})
                with CaptureQueriesContext(connection) as captured:
                    self.client.get(unit_url(kind, self.warband.id, unit.id, "kill-history/"))
                [sql] = [query["sql"] for query in captured if 'FROM "battle_event"' in query["sql"]]

                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL enable_seqscan = off")
                    cursor.execute(f"EXPLAIN {sql}")
                    plan = "\n".join(row[0] for row in cursor.fetchall())
                    cursor.execute("SET LOCAL enable_seqscan = on")

                self.assertIn("battle_event_kill_killer_idx", plan)
