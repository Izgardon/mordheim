"""The overview's reads for next step 5: each battle's key moments in the history, the chronicle, and each player's
own place in his unfinished battle (the readiness bar)."""

from datetime import UTC, datetime
from typing import Any

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.warbands.models import WarbandLog

from .campaign_support import CampaignTestCase

PIA_RESULTS = {
    "hero:1": {"unit_name": "Abbess", "unit_kind": "hero", "out_of_action": True, "dead": True},
    "henchman:2": {
        "unit_name": "Novice",
        "unit_kind": "henchman",
        "out_of_action": True,
        "dead": False,
        "serious_injury_rolls": [{"result_label": "Full recovery"}],
    },
}
REX_RESULTS = {"hero:3": {"unit_name": "Seer", "unit_kind": "hero", "out_of_action": False, "dead": False}}


def kill(battle: Battle, killer: dict, victim: dict, *, voided: bool = False) -> BattleEvent:
    return BattleEvent.objects.create(
        battle=battle,
        type=BattleEvent.TYPE_UNIT_KILL_RECORDED,
        payload_json={"killer": killer, "victim": victim, "earned_xp": True, "source": "battle"},
        voided_at=datetime(2026, 3, 24, tzinfo=UTC) if voided else None,
    )


class ChronicleTestCase(CampaignTestCase):
    def setUp(self) -> None:
        self.battle = Battle.objects.create(
            campaign=self.campaign,
            created_by_user=self.player,
            scenario="Street Fight",
            status=Battle.STATUS_ENDED,
            ended_at=datetime(2026, 3, 24, tzinfo=UTC),
            winner_warband_ids_json=[self.rival_warband.id],
        )
        for user, warband, results, amount in (
            (self.player, self.warband, PIA_RESULTS, 0),
            (self.rival, self.rival_warband, REX_RESULTS, 3),
        ):
            BattleParticipant.objects.create(
                battle=self.battle,
                user=user,
                warband=warband,
                status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
                postbattle_json={
                    "unit_results": results,
                    "exploration": {"dice_values": [3, 3], "amount": amount},
                    "finds": {"gold_crowns": 0, "items": [{"name": "Rope"}] if amount else []},
                },
            )
        seer = {"unit_key": "hero:3", "name": "Seer", "warband_id": self.rival_warband.id}
        kill(self.battle, seer, {"unit_key": "hero:1", "name": "Abbess", "warband_id": self.warband.id})
        kill(self.battle, seer, {"unit_key": None, "name": None, "type_name": "Brute"}, voided=True)

    def get(self, suffix: str) -> Any:
        self.client.force_authenticate(user=self.player)
        response = self.client.get(f"/api/campaigns/{self.campaign.id}/{suffix}")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()


class BattleMomentTests(ChronicleTestCase):
    def test_a_battles_moments_are_its_live_kills_the_rest_out_of_action_finds_and_deaths_after(self):
        entry = self.get("battle-history/")[0]

        self.assertEqual(
            [(moment["group"], moment["kind"], moment["text"]) for moment in entry["moments"]],
            [
                ("During", "kill", "Seer took Abbess out of action"),
                ("During", "ooa", "Novice went out of action"),
                ("During", "find", "Rats found 3 shards"),
                ("During", "find", "Rats found Rope"),
                ("After", "death", "Abbess is dead"),
            ],
        )
        totals = {row["warband_name"]: (row["shards"], row["heroes_lost"]) for row in entry["participants"]}
        self.assertEqual(totals, {"Monks": (0, 1), "Rats": (3, 0)})


class ChronicleTests(ChronicleTestCase):
    def test_kills_deaths_level_ups_purchases_and_one_entry_per_trade(self):
        log = WarbandLog.objects.create
        log(warband=self.warband, feature="advance", entry_type="hero", payload={"hero": "Abbess", "advance": "+1 WS"})
        log(
            warband=self.warband,
            feature="advance",
            entry_type="henchmen",
            payload={"group": "Novices", "advance": "BS"},
        )
        talent = {"group": "Novices", "lads_got_talent": True, "henchman_name": "Agathe"}
        log(warband=self.warband, feature="advance", entry_type="henchmen", payload=talent)
        log(
            warband=self.warband,
            feature="loadout",
            entry_type="hero_item",
            payload={"hero": "Abbess", "item": "Sword", "price": 10},
        )
        log(
            warband=self.warband,
            feature="loadout",
            entry_type="stash_item",
            payload={"item": "Rope", "reason": "Found"},
        )
        for warband, partner, gold in ((self.warband, "Rats", (5, 0)), (self.rival_warband, "Monks", (0, 5))):
            sides = {"sent": {"gold": gold[0], "items": []}, "received": {"gold": gold[1], "items": []}}
            trade = {"partner": partner, **sides}
            log(warband=warband, feature="trade", entry_type="completed", payload=trade)

        entries = self.get("chronicle/")

        texts = sorted((entry["kind"], entry["text"]) for entry in entries)
        self.assertEqual(
            texts,
            [
                ("buy", "Sword for Abbess, 10 gc"),
                ("death", "Abbess is dead"),
                ("kill", "Seer took Abbess out of action"),
                ("level", "Abbess gained +1 WS"),
                ("level", "Agathe of Novices has got talent and joins the heroes"),
                ("trade", texts[-1][1]),
            ],
        )
        self.assertIn(
            texts[-1][1],
            (
                "Monks traded with Rats: sent 5 gc, received nothing",
                "Rats traded with Monks: sent nothing, received 5 gc",
            ),
        )
        kill_entry = next(entry for entry in entries if entry["kind"] == "kill")
        self.assertEqual(kill_entry["meta"], "Rats · Street Fight")
        self.assertEqual([entry["kind"] for entry in self.get("chronicle/?kind=level")], ["level", "level"])


class ReadinessTests(ChronicleTestCase):
    def test_a_busy_player_carries_his_own_status_in_the_battle(self):
        open_battle = Battle.objects.create(
            campaign=self.campaign, created_by_user=self.player, scenario="Bridge", status=Battle.STATUS_ACTIVE
        )
        statuses = (BattleParticipant.STATUS_FINISHED_BATTLE, BattleParticipant.STATUS_IN_BATTLE)
        for user, warband, status in zip(
            (self.player, self.rival), (self.warband, self.rival_warband), statuses, strict=True
        ):
            BattleParticipant.objects.create(battle=open_battle, user=user, warband=warband, status=status)

        players = {row["name"]: row for row in self.get("players/")}

        self.assertEqual(players["Pia"]["battle_busy_participant_status"], "finished_battle")
        self.assertEqual(players["Rex"]["battle_busy_participant_status"], "in_battle")
        self.assertIsNone(players["Olga"]["battle_busy_participant_status"])
