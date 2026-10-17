"""Unit writes are all-or-nothing: a failure partway leaves no unit, member, trade or log behind (pass 1 PR A2).

Each test makes the last write of a request fail (the trade, the log or the delete) and checks that
nothing the request wrote before it survived.
"""

from typing import Any
from unittest import mock

from apps.warbands.models import Henchman, WarbandLog, WarbandTrade
from apps.warbands.utils.trades import TradeHelper

from .roster_support import HENCHMEN, KINDS, Kind, RosterTestCase, create_payload, make_unit, related_ids, unit_url

# Where each write logs, since PR B shared the unit code between the kinds.
PATCH_MODULE = "apps.warbands.units.services.update"
LEVEL_UP_MODULE = "apps.warbands.units.services.level_up"


class Boom(Exception):
    pass


def failing_log(kind: Kind) -> Any:
    return mock.patch(f"{PATCH_MODULE}.log_warband_event", side_effect=Boom)


def failing_level_up_log() -> Any:
    return mock.patch(f"{LEVEL_UP_MODULE}.log_warband_event", side_effect=Boom)


class RosterAtomicWriteTests(RosterTestCase):
    def _ledger(self) -> tuple[int, int, int]:
        return (
            WarbandTrade.objects.filter(warband=self.warband).count(),
            WarbandLog.objects.filter(warband=self.warband).count(),
            Henchman.objects.filter(group__warband=self.warband).count(),
        )

    def test_a_failed_create_leaves_nothing_behind(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                before = (kind.model.objects.count(), self._ledger())
                payload = create_payload(kind, skill_ids=[self.skills[0].id])
                if kind is HENCHMEN:
                    payload["henchmen"] = [{"name": "Alpha"}, {"name": "Beta"}]

                with mock.patch.object(TradeHelper, "create_trade", side_effect=Boom), self.assertRaises(Boom):
                    self.client.post(unit_url(kind, self.warband.id), payload, format="json")

                self.assertEqual((kind.model.objects.count(), self._ledger()), before)

    def test_a_failed_patch_leaves_the_unit_unchanged(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = self._make(kind)
                before = self._ledger()
                payload: dict[str, Any] = {"name": "Renamed", "skill_ids": [self.skills[0].id]}
                failure = failing_log(kind)
                if kind is HENCHMEN:
                    members = list(unit.henchmen.values("id"))
                    payload["henchmen"] = [*members, {"name": "Gamma", "cost": 10}]
                    failure = mock.patch.object(TradeHelper, "create_trade", side_effect=Boom)

                with failure, self.assertRaises(Boom):
                    self.client.patch(unit_url(kind, self.warband.id, unit.id), payload, format="json")

                unit.refresh_from_db()
                self.assertEqual((unit.name, related_ids(unit, kind.skills, "skill")), ("Original", []))
                self.assertEqual(self._ledger(), before)

    def test_a_failed_delete_keeps_the_unit_and_writes_no_log(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = self._make(kind)
                before = self._ledger()

                with mock.patch.object(kind.model, "delete", side_effect=Boom), self.assertRaises(Boom):
                    self.client.delete(unit_url(kind, self.warband.id, unit.id))

                self.assertTrue(kind.model.objects.filter(id=unit.id).exists())
                self.assertEqual(self._ledger(), before)

    def test_a_failed_level_up_spends_nothing(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = self._make(kind, level_up=1, weapon_skill=3)
                body = {"payload": {"advance": {"id": "WS", "label": "Weapon Skill"}}}

                with failing_level_up_log(), self.assertRaises(Boom):
                    self.client.post(unit_url(kind, self.warband.id, unit.id, "level-up/"), body, format="json")

                unit.refresh_from_db()
                self.assertEqual((unit.level_up, unit.weapon_skill, unit.level_up_history), (1, 3, []))

    def _make(self, kind: Kind, **fields: Any) -> Any:
        return make_unit(kind, self.warband, name="Original", **fields)
