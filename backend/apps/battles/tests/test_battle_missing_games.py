"""Missing games in battles: each battle a warband finalises counts one game for every unit of it that is missing.

Heroes, hired swords and henchmen groups count down whether or not they fought; at 0 the unit is back, forgets its
reason and the log says "<name> returns". A cancelled battle, and a postbattle skipped or closed (nothing applied),
count nothing, and another warband's finalise never counts ours. The battle roster says who is missing, so prebattle
can leave them out; upkeep skips a missing hired sword. A serious injury the player confirms sets a hero's or hired
sword's missing games at finalise, for the games after this one. Finalise sends `warband.changed`, so other members'
open pages of the warband follow.
"""

from typing import Any
from unittest import mock

from django.test import override_settings

from apps.warbands.models import Henchman, HenchmenGroup, Hero, WarbandLog, WarbandTrade

from .battle_support import BattleTestCase, draft, unit_result

SOCKET = "123.456"


def missing_logs(warband_id: int) -> list[tuple[str, dict[str, Any]]]:
    rows = WarbandLog.objects.filter(warband_id=warband_id, entry_type__in=("unit_missing", "unit_returns"))
    return [(row.entry_type, row.payload) for row in rows.order_by("id")]


class MissingGamesCountdownTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.fighter = self.warband.heroes.create(name="Fighter", unit_type="Captain", is_leader=True)
        self.wounded = self.warband.heroes.create(name="Pieter Kalb", unit_type="Champion", missing_games=2,
                                                  missing_reason="Deep wound")  # fmt: skip
        self.group = HenchmenGroup.objects.create(warband=self.warband, name="Swords", missing_games=1,
                                                  missing_reason="Lost")  # fmt: skip
        Henchman.objects.create(group=self.group, name="Hans")
        self.grukk = self.warband.hirelings.create(name="Grukk", unit_type="Ogre", upkeep_price=30, missing_games=3)
        self.rat_hero = self.rival.heroes.create(name="Rat", unit_type="Assassin", missing_games=2)
        self.mine, self.rat = f"hero:{self.fighter.id}", f"hero:{self.rat_hero.id}"

    def postbattle(self) -> int:
        return self.to_postbattle({self.player: [self.mine], self.viewer: [self.rat]})

    def counts(self) -> tuple[int, ...]:
        units = (self.wounded, self.group, self.grukk, self.rat_hero)
        return tuple(type(unit).objects.get(id=unit.id).missing_games for unit in units)

    def test_finalising_counts_one_game_for_every_missing_unit_of_the_warband(self):
        battle_id = self.postbattle()

        self.ok(self.finalize(self.player, battle_id, draft({self.mine: unit_result(self.mine)})))

        self.assertEqual(self.counts(), (1, 0, 2, 2))  # the rival hasn't finalised: its hero still misses 2
        self.assertEqual(HenchmenGroup.objects.get(id=self.group.id).missing_reason, "")
        self.assertEqual(Hero.objects.get(id=self.wounded.id).missing_reason, "Deep wound")
        self.assertEqual(missing_logs(self.warband.id), [("unit_returns", {"name": "Swords"})])

    def test_a_unit_brought_anyway_counts_down_too(self):
        wounded = f"hero:{self.wounded.id}"
        battle_id = self.to_postbattle({self.player: [self.mine, wounded], self.viewer: [self.rat]})

        results = {self.mine: unit_result(self.mine), wounded: unit_result(wounded)}
        self.ok(self.finalize(self.player, battle_id, draft(results)))

        self.assertEqual(self.counts()[0], 1)

    def test_skipped_closed_and_cancelled_battles_count_nothing(self):
        skipped = self.postbattle()
        self.ok(self.post_as(self.player, self.url(skipped, "skip-postbattle")))
        closed = self.postbattle()
        self.ok(self.post_as(self.campaign_owner, self.url(closed, "close-postbattle")))
        cancelled = self.to_active({self.player: [self.mine], self.viewer: [self.rat]})
        self.ok(self.post_as(self.player, self.url(cancelled, "cancel-battle")))

        self.assertEqual(self.counts(), (2, 1, 3, 2))
        self.assertEqual(missing_logs(self.warband.id), [])

    def test_the_battle_roster_says_who_is_missing_and_why(self):
        battle_id = self.to_prebattle()

        roster = self.ok(self.get_as(self.player, self.url(battle_id, "rosters"))).data[str(self.player.id)]

        heroes = {entry["displayName"]: (entry["missingGames"], entry["missingReason"]) for entry in roster["heroes"]}
        self.assertEqual(heroes, {"Fighter": (0, ""), "Pieter Kalb": (2, "Deep wound")})
        group = roster["henchmenGroups"][0]
        self.assertEqual((group["missingGames"], group["members"][0]["missingGames"]), (1, 1))
        self.assertEqual(roster["hirelings"][0]["missingGames"], 3)

    def test_upkeep_skips_a_missing_hired_sword(self):
        here = self.warband.hirelings.create(name="Bertha", unit_type="Ogre", upkeep_price=20)
        battle_id = self.postbattle()
        entries = {f"hireling:{unit.id}": {"unit_name": unit.name, "cost": unit.upkeep_price} for unit in (here, self.grukk)}  # fmt: skip

        suggested = self.ok(self.get_as(self.player, self.url(battle_id, "state") + "?view=postbattle")).data
        self.ok(self.finalize(self.player, battle_id, draft({self.mine: unit_result(self.mine)}, upkeep={"pay_upkeep": True, "entries": entries})))  # fmt: skip

        upkeep = WarbandTrade.objects.get(warband=self.warband, action="Upkeep")
        self.assertEqual((upkeep.price, upkeep.notes), (-20, "Bertha: 20 gc"))
        self.assertNotIn(f"hireling:{self.grukk.id}", suggested["suggested_postbattle"]["upkeep"]["entries"])

    @override_settings(EXTERNAL_DISPATCH_SYNC=True)
    def test_finalise_tells_the_other_members_the_warband_changed(self):
        battle_id = self.postbattle()
        pusher = mock.Mock()
        with mock.patch("apps.realtime.services.get_pusher_client", return_value=pusher):
            self.client.force_authenticate(user=self.player)
            with self.captureOnCommitCallbacks(execute=True):
                body = {"postbattle_json": draft({self.mine: unit_result(self.mine)})}
                url = self.url(battle_id, "finalize-postbattle")
                self.ok(self.client.post(url, body, format="json", HTTP_X_PUSHER_SOCKET_ID=SOCKET))

        changed = [call for call in pusher.trigger.call_args_list if call.args[1] == "warband.changed"]
        channel = f"private-campaign-{self.campaign.id}-events"
        self.assertEqual([(call.args[0], call.args[2], call.kwargs) for call in changed],
                         [(channel, {"warband_id": self.warband.id}, {"socket_id": SOCKET})])  # fmt: skip
