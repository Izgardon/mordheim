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

from apps.battles.services.injuries import describe_roll, injury_tables
from apps.battles.validation.postbattle import normalize_postbattle
from apps.warbands.models import Henchman, HenchmenGroup, Hero, Hireling, WarbandLog, WarbandTrade

from .battle_support import BattleTestCase, draft, injury_roll, unit_result

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


class MissingGamesFromInjuriesTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.campaign_settings.hero_death_roll = "d100"
        self.campaign_settings.save()
        self.hero = self.warband.heroes.create(name="Aldric", unit_type="Captain", is_leader=True)
        self.persona = self.warband.hirelings.create(name="Bertha", unit_type="Bertha", kind="dramatis_persona",
                                                     injury_table="hero")  # fmt: skip
        self.mine, self.persona_key = f"hero:{self.hero.id}", f"hireling:{self.persona.id}"
        self.rat = f"hero:{self.rival.heroes.create(name='Rat', unit_type='Assassin').id}"

    def postbattle(self) -> int:
        return self.to_postbattle({self.player: [self.mine, self.persona_key], self.viewer: [self.rat]})

    def result(self, key: str, missing: Any = None, **fields: Any) -> dict[str, Any]:
        entry = unit_result(key, rolls=[injury_roll([47], "d100", "Deep Wound")], **fields)
        if missing is not None:
            entry["missing_games"] = missing
        return entry

    def test_the_injury_tables_say_which_results_miss_games(self):
        self.assertEqual(
            describe_roll("d100", [47])["effect"], {"kind": "manual", "misses": {"games": 2, "dice": "D3"}}
        )
        self.assertEqual(describe_roll("d66", [6, 1])["effect"], {"kind": "manual", "misses": {"games": 1}})  # Captured
        self.assertEqual(describe_roll("d66", [3, 1])["effect"], {"kind": "special", "special": "Old Battle Wound"})
        for table in ("d66", "d100"):
            missing = {row["label"] for row in injury_tables()[table] if "misses" in row["effect"]}
            expected = {"Smashed Leg", "Arm Wound", "Captured", "Sold to the Pits"} | ({"Deep Wound"} if table == "d100" else set())  # fmt: skip
            self.assertEqual(missing, expected)

    def test_a_confirmed_injury_sets_missing_games_for_the_games_after_this_one(self):
        self.hero.missing_games = 1  # brought anyway: this battle counts his last game, then the wound sets 3
        self.hero.save()
        battle_id = self.postbattle()
        results = {
            self.mine: self.result(self.mine, {"games": 3, "reason": "Deep Wound"}, name="Aldric"),
            self.persona_key: self.result(self.persona_key, {"games": 1, "reason": " Captured "}, name="Bertha"),
        }

        self.ok(self.finalize(self.player, battle_id, draft(results)))

        hero, persona = Hero.objects.get(id=self.hero.id), Hireling.objects.get(id=self.persona.id)
        self.assertEqual((hero.missing_games, hero.missing_reason), (3, "Deep Wound"))
        self.assertEqual((persona.missing_games, persona.missing_reason), (1, "Captured"))
        self.assertEqual(missing_logs(self.warband.id), [
            ("unit_returns", {"name": "Aldric"}),
            ("unit_missing", {"name": "Aldric", "games": 3, "reason": "Deep Wound"}),
            ("unit_missing", {"name": "Bertha", "games": 1, "reason": "Captured"}),
        ])  # fmt: skip

    def test_an_injury_left_unconfirmed_or_on_a_dead_unit_sets_nothing(self):
        battle_id = self.postbattle()
        results = {
            self.mine: self.result(self.mine, {"games": 0, "reason": "Deep Wound"}),  # 0 games: not set
            self.persona_key: self.result(self.persona_key, {"games": 2, "reason": "Captured"}, dead=True),
        }

        self.ok(self.finalize(self.player, battle_id, draft(results)))

        self.assertEqual(Hero.objects.get(id=self.hero.id).missing_games, 0)
        self.assertEqual(Hireling.objects.get(id=self.persona.id).missing_games, 0)
        self.assertEqual(missing_logs(self.warband.id), [])

    def test_a_malformed_missing_games_entry_is_refused_and_a_count_is_capped_at_99(self):
        battle_id = self.postbattle()
        bad = {self.mine: self.result(self.mine, "two"), self.persona_key: self.result(self.persona_key)}
        refused = self.post_as(self.player, self.url(battle_id, "postbattle"), {"postbattle_json": draft(bad)})

        many = {self.mine: self.result(self.mine, {"games": 500}), self.persona_key: self.result(self.persona_key)}
        self.ok(self.finalize(self.player, battle_id, draft(many)))

        self.assertEqual(refused.status_code, 400)
        self.assertIn("missing_games", str(refused.data))
        self.assertEqual(Hero.objects.get(id=self.hero.id).missing_games, 99)

    def test_only_heroes_and_hired_swords_carry_missing_games_in_the_draft(self):
        group = HenchmenGroup.objects.create(warband=self.warband, name="Swords")
        member = f"henchman:{Henchman.objects.create(group=group, name='Hans').id}"
        missing = {"games": 2, "reason": "Lost"}

        saved = normalize_postbattle(draft({self.mine: self.result(self.mine, missing), member: self.result(member, missing)}))  # fmt: skip

        self.assertEqual(saved["unit_results"][self.mine]["missing_games"], {"games": 2, "reason": "Lost"})
        self.assertNotIn("missing_games", saved["unit_results"][member])
        unset = normalize_postbattle(draft({self.mine: self.result(self.mine)}))["unit_results"][self.mine]
        self.assertNotIn("missing_games", unset)
