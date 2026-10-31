"""A unit's kill history (next step 9): its kills from battle_kill, in its own campaign's ended battles only, newest
first, in one read; a henchmen group's are its members', each naming the model who scored it."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.models import Battle
from apps.campaigns.models import Campaign

from .roster_support import HENCHMEN, KINDS, Kind, RosterTestCase, make_unit, record_kill, unit_url


class KillHistoryTests(RosterTestCase):
    def _killer(self, kind: Kind) -> tuple[Any, Any]:
        unit = make_unit(kind, self.warband)
        return unit, (unit.henchmen.first() if kind is HENCHMEN else unit)

    def test_kills_recorded_in_another_campaigns_battle_are_not_listed(self):
        elsewhere = Battle.objects.create(
            campaign=Campaign.objects.get(name="Elsewhere"),
            created_by_user=self.outsider,
            scenario="Elsewhere",
            status=Battle.STATUS_ENDED,
        )
        ours = self.make_battle("Ours")
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit, killer = self._killer(kind)
                record_kill(ours, killer, "Rat", self.rival)
                record_kill(elsewhere, killer, "Lizard", self.rival)

                response = self.client.get(unit_url(kind, self.warband.id, unit.id, "kill-history/"))

                self.assertEqual(response.status_code, 200)
                self.assertEqual([kill["scenario"] for kill in response.json()["kills"]], ["Ours"])

    def test_the_kills_are_one_read_whatever_their_number(self):
        battle = self.make_battle()
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit, killer = self._killer(kind)
                for victim in ("Rat", "Rat Two", "Rat Three"):
                    record_kill(battle, killer, victim, self.rival)
                with CaptureQueriesContext(connection) as captured:
                    response = self.client.get(unit_url(kind, self.warband.id, unit.id, "kill-history/"))

                self.assertEqual(len(response.json()["kills"]), 3)
                reads = [query["sql"] for query in captured if 'FROM "battle_kill"' in query["sql"]]
                self.assertEqual(len(reads), 1)
