"""A battle's record on the Battles page (William, 7 Nov 2026: "battles: just do put out of action, can then also show
what happened to units in that battle after if they got injuries or died"; battles/services/record.py): round by
round each unit put out of action in order, by whom where a kill was recorded, an out of action later unset or an
undone kill's left out and nothing else from the log; then each warband's serious injuries and deaths from its
Aftermath. Any member reads it, in a few queries whatever the battle holds.
"""

from datetime import UTC, datetime
from typing import Any

from apps.battles.models import Battle, BattleEvent, BattleParticipant

from .campaign_support import CampaignTestCase

HURT = {
    "hero:1": {"unit_name": "Abbess", "unit_kind": "hero", "unit_type": "Matriarch", "dead": True},
    "henchman:2": {
        "unit_name": "Novice",
        "unit_kind": "henchman",
        "group_name": "Novices",
        "dead": False,
        "serious_injury_rolls": [{"result_label": "Survives", "rolls": [4]}],
    },
    "hero:5": {
        "unit_name": "",
        "unit_kind": "hero",
        "unit_type": "Sister",
        "dead": False,
        "serious_injury_rolls": [
            {"result_label": "Multiple Injuries"},
            {"result_label": "Mutation", "mutation": {"name": "Fangs"}},
        ],
    },
    "hero:6": {"unit_name": "Prioress", "unit_kind": "hero", "dead": False, "serious_injury_rolls": []},
}
UNHURT = {"hero:3": {"unit_name": "Seer", "unit_kind": "hero", "dead": False, "serious_injury_rolls": []}}


class BattleRecordTests(CampaignTestCase):
    def setUp(self) -> None:
        self.battle = Battle.objects.create(
            campaign=self.campaign,
            created_by_user=self.player,
            scenario="Street Fight",
            status=Battle.STATUS_ENDED,
            ended_at=datetime(2026, 3, 24, tzinfo=UTC),
            neutral_groups_json=[{"key": "neutral-1", "creature_type": "Zombie", "creatures": []}],
        )
        for user, warband, results in ((self.player, self.warband, HURT), (self.rival, self.rival_warband, UNHURT)):
            roster = {"heroes": [{"key": "hero:7", "displayName": "Vera", "unitType": "Sister"}]}
            BattleParticipant.objects.create(
                battle=self.battle,
                user=user,
                warband=warband,
                status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
                roster_json=roster if warband == self.warband else {},
                postbattle_json={"unit_results": results},
            )
        self.monks, self.rats = self.warband.id, self.rival_warband.id

    def event(self, kind: str, payload: dict[str, Any], *, voided: bool = False) -> None:
        voided_at = datetime(2026, 3, 24, tzinfo=UTC) if voided else None
        BattleEvent.objects.create(battle=self.battle, type=kind, payload_json=payload, voided_at=voided_at)

    def out(self, warband_id: int, key: str, round_number: int, *, back: bool = False) -> None:
        kind = BattleEvent.TYPE_UNIT_OOA_UNSET if back else BattleEvent.TYPE_UNIT_OOA_SET
        unit = {"unit_key": key, "unit_type": key.split(":")[0], "unit_id": 1, "warband_id": warband_id}
        self.event(kind, {"unit": unit, "out_of_action": not back, "round": round_number})

    def kill(self, victim: dict[str, Any], round_number: int, *, took_out: bool, voided: bool = False) -> None:
        killer = {"unit_key": "hero:3", "name": "Seer", "warband_id": self.rats}
        payload = {"killer": killer, "victim": victim, "source": "battle", "round": round_number}
        self.event(BattleEvent.TYPE_UNIT_KILL_RECORDED, {**payload, "victim_ooa": took_out} if took_out else payload, voided=voided)  # fmt: skip

    def read(self, battle_id: int | None = None, user: Any = None) -> Any:
        self.client.force_authenticate(user=user or self.player)
        return self.client.get(
            f"/api/campaigns/{self.campaign.id}/battle-history/{battle_id or self.battle.id}/record/"
        )

    def test_round_by_round_who_went_out_of_action_and_by_whom(self):
        novice = {"unit_key": "henchman:2", "name": "Novice", "warband_id": self.monks}
        self.out(self.monks, "hero:1", 1)  # marked out, then a kill recorded on her names her killer
        self.event(BattleEvent.TYPE_ITEM_USED, {"unit_key": "hero:1", "item": "Healing Herbs", "round": 1})
        self.kill({"unit_key": "hero:1", "name": "Abbess", "warband_id": self.monks}, 1, took_out=False)
        self.kill(novice, 1, took_out=True)
        self.out(self.rats, "hero:3", 2)
        self.out(self.rats, "hero:3", 2, back=True)  # stood back up: not shown
        neutral = {"key": "neutral-1-1", "name": "", "group_key": "neutral-1"}
        self.event(BattleEvent.TYPE_NEUTRAL_OOA_SET, {"neutral": neutral, "out_of_action": True, "round": 2})
        self.kill({"unit_key": "hero:7", "name": "Vera", "warband_id": self.monks}, 2, took_out=True, voided=True)
        self.out(self.monks, "hero:7", 3)  # named from the battle roster

        with self.assertNumQueries(4):  # the membership, the battle, its participants, its events
            answer = self.read()

        self.assertEqual(answer.status_code, 200, answer.content)
        rounds = [(entry["round"], [(out["name"], out["by"], out["warband_name"]) for out in entry["out_of_action"]]) for entry in answer.json()["rounds"]]  # fmt: skip
        self.assertEqual(
            rounds,
            [
                (1, [("Abbess", "Seer", "Monks"), ("Novice", "Seer", "Monks")]),
                (2, [("A Zombie", None, "")]),
                (3, [("Vera", None, "Monks")]),
            ],
        )

    def test_after_the_battle_each_warbands_injuries_and_deaths(self):
        answer = self.read(user=self.rival).json()

        self.assertEqual(
            answer["aftermath"],
            [
                {
                    "warband_id": self.monks,
                    "warband_name": "Monks",
                    "units": [
                        {"name": "Abbess", "unit_kind": "hero", "group_name": "", "results": [], "dead": True},
                        {
                            "name": "A Sister",
                            "unit_kind": "hero",
                            "group_name": "",
                            "results": ["Multiple Injuries", "Mutation (Fangs)"],
                            "dead": False,
                        },
                        {
                            "name": "Novice",
                            "unit_kind": "henchman",
                            "group_name": "Novices",
                            "results": ["Survives"],
                            "dead": False,
                        },
                    ],
                }
            ],
        )  # heroes first, then henchmen; the Rats' Seer came through unhurt, and the Prioress rolled nothing
        self.assertEqual(answer["rounds"], [])

    def test_a_warband_taken_off_the_record_and_a_battle_not_ended_show_nothing(self):
        self.out(self.monks, "hero:1", 1)
        BattleParticipant.objects.filter(battle=self.battle, warband=self.warband).update(removed_from_record=True)

        self.assertEqual(self.read().json(), {"rounds": [], "aftermath": []})
        open_battle = Battle.objects.create(campaign=self.campaign, created_by_user=self.player, scenario="Ambush")
        self.assertEqual(self.read(open_battle.id).status_code, 404)
        self.assertEqual(self.read(user=self.outsider).status_code, 404)
