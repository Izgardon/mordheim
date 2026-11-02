"""Pivotal moments (next step 9): built from a battle's live kills (battle_kill) and its fight's out-of-action data,
written when it ends or again by `regenerate_pivotal_moments`, and read in each battle-history row in fight order."""

from datetime import UTC, datetime
from io import StringIO
from typing import Any

from django.core.management import call_command

from apps.battles.models import Battle, BattleEvent, BattleKill, BattleParticipant
from apps.campaigns.models import PivotalMoment
from apps.campaigns.pivotal_moments import regenerate_pivotal_moments
from apps.warbands.models import Henchman, HenchmenGroup, Hero, Hireling

from .campaign_support import CampaignTestCase


class MomentTestCase(CampaignTestCase):
    """Pia's Monks against Rex's Rats."""

    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch", is_leader=True)
        self.sisters = HenchmenGroup.objects.create(warband=self.warband, name="Sisters", unit_type="Sister")
        self.ana = Henchman.objects.create(group=self.sisters, name="Ana")
        self.gorg = Hireling.objects.create(warband=self.warband, name="Gorg", unit_type="Ogre Bodyguard")
        self.skritch = Hero.objects.create(warband=self.rival_warband, name="Skritch", is_leader=True)
        self.rat = Hero.objects.create(warband=self.rival_warband, name="Rat", caster="Wizard")
        self.brute = Hero.objects.create(warband=self.rival_warband, name="Brute", large=True)
        self.youngblood = Hero.objects.create(warband=self.rival_warband, name="", unit_type="Youngblood")

    def battle(self, winners: list[int], scenario: str = "Street Fight") -> Battle:
        return Battle.objects.create(
            campaign=self.campaign,
            created_by_user=self.player,
            scenario=scenario,
            status=Battle.STATUS_ENDED,
            ended_at=datetime(2026, 3, 24, tzinfo=UTC),
            winner_warband_ids_json=winners,
        )

    def fighter(self, battle: Battle, user: Any, warband: Any, selected: list[str], out: list[str], **fields: Any):
        info = {key: {"out_of_action": True} for key in out}
        return BattleParticipant.objects.create(
            battle=battle,
            user=user,
            warband=warband,
            status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            selected_unit_keys_json=selected,
            unit_information_json=info,
            **fields,
        )

    def kill(self, battle: Battle, killer: Any, victim: Any, round: int | None = 1, **fields: Any) -> BattleKill:
        """A live kill of `killer` (a hero, henchman or hired sword) over `victim` (a hero, or a dict of columns)."""
        event = BattleEvent.objects.create(battle=battle, type=BattleEvent.TYPE_UNIT_KILL_RECORDED, payload_json={})
        if isinstance(killer, Henchman):
            keys = {"killer_kind": "henchman", "killer_henchman": killer, "killer_group": killer.group}
            warband = killer.group.warband
        else:
            kind = "hero" if isinstance(killer, Hero) else "hireling"
            keys, warband = {"killer_kind": kind, f"killer_{kind}": killer}, killer.warband
        if isinstance(victim, Hero):
            caster = victim.caster if victim.caster in ("Wizard", "Priest") else ""
            victim = {
                "victim_kind": "hero",
                "victim_hero": victim,
                "victim_warband": victim.warband,
                "victim_name": victim.name,
                "victim_type": victim.unit_type,
                "victim_leader": victim.is_leader,
                "victim_large": victim.large,
                "victim_caster": caster,
            }
        leader = isinstance(killer, Hero) and killer.is_leader
        return BattleKill.objects.create(
            battle=battle,
            campaign=self.campaign,
            event=event,
            round=round,
            phase="fight" if round or fields.pop("legacy", False) else "after",
            killer_warband=warband,
            killer_name=killer.name,
            killer_type=getattr(killer, "unit_type", ""),
            killer_leader=leader,
            **keys,
            **victim,
            **fields,
        )

    def moments(self, battle: Battle) -> list[dict[str, Any]]:
        self.client.force_authenticate(user=self.player)
        history = self.client.get(f"/api/campaigns/{self.campaign.id}/battle-history/").json()
        moments: list[dict[str, Any]] = next(entry for entry in history if entry["id"] == battle.id)["moments"]
        return moments


class MomentRuleTests(MomentTestCase):
    def test_a_fight_gives_its_moments_in_fight_order_with_the_results_last(self):
        battle = self.battle([self.warband.id])
        a, s, g = f"hero:{self.abbess.id}", f"henchman:{self.ana.id}", f"hireling:{self.gorg.id}"
        rats = [f"hero:{hero.id}" for hero in (self.skritch, self.rat, self.brute, self.youngblood)]
        self.fighter(battle, self.player, self.warband, [a, s, g, "custom:dog"], ["custom:dog"], declared_rating=120)
        self.fighter(battle, self.rival, self.rival_warband, rats, rats, declared_rating=150)
        dog = {"victim_kind": "temporary", "victim_key": "custom:dog", "victim_name": "War Dog"}
        zombie = {"victim_kind": "creature", "victim_key": "n1-2", "victim_name": "Zombie 2"}
        ogre = {"victim_kind": "someone_else", "victim_name": "Ogre"}
        self.kill(battle, self.ana, self.rat, how="melee")
        self.kill(battle, self.skritch, dog | {"victim_warband": self.warband})
        self.kill(battle, self.gorg, zombie, how="shooting")
        self.kill(battle, self.skritch, ogre, round=2)
        self.kill(battle, self.gorg, self.brute, round=2, how="shooting")
        self.kill(battle, self.abbess, self.skritch, round=3, how="magic")
        self.kill(battle, self.abbess, self.youngblood, round=3, how="magic")
        self.kill(battle, self.ana, {"victim_kind": "someone_else", "victim_name": "Straggler"}, round=None)
        self.kill(battle, self.ana, self.rat, voided_at=datetime(2026, 3, 24, tzinfo=UTC))  # undone: counts nowhere

        self.assertEqual(regenerate_pivotal_moments(battle), 12)

        group = {"kind": "henchmen_group", "id": self.sisters.id, "name": "Ana"}
        gorg = {"kind": "hireling", "id": self.gorg.id, "name": "Gorg"}
        abbess = {"kind": "hero", "id": self.abbess.id, "name": "Abbess"}
        skritch = {"kind": "hero", "id": self.skritch.id, "name": "Skritch"}
        self.assertEqual(
            [(m["tag"], m["headline"], m["detail"], m["warband_name"], m["unit"]) for m in self.moments(battle)],
            [
                ("Turn 1", "First Blood", "Ana drew first blood against Rat.", "Monks", group),
                ("Turn 1", "Hero Slayer", "Ana took Rat out of action.", "Monks", group),
                ("Turn 1", "I don't believe in fairies", "Ana brought down caster Rat.", "Monks", group),
                ("Turn 1", "Monster Hunter", "Gorg slew Zombie 2.", "Monks", gorg),
                ("Turn 2", "Giant Slayer", "Gorg slew large target Brute.", "Monks", gorg),
                ("Turn 2", "Sharpshooter", "Gorg scored 2 shooting kills.", "Monks", gorg),
                ("Turn 3", "There can be only one", "Abbess slew the enemy leader Skritch.", "Monks", abbess),
                (
                    "Turn 3",
                    "Bloody Martyr",
                    "Skritch claimed 2 kills before being taken out of action.",
                    "Rats",
                    skritch,
                ),
                ("Turn 3", "Spellslinger", "Abbess scored 2 magic kills.", "Monks", abbess),
                ("Result", "Underdog", "Monks (rating 120) beat Rats (rating 150).", "Monks", None),
                ("Result", "Carried the Fight", "Skritch scored 2 of 2 recorded kills.", "Rats", skritch),
                ("Result", "Wiped Out", "Rats lost 4 of 4 selected units.", "Rats", None),
            ],
        )

    def test_a_lone_survivor_a_martyr_nobody_recorded_and_a_kill_logged_after_the_fight(self):
        battle = self.battle([self.warband.id])
        a, s, g = f"hero:{self.abbess.id}", f"henchman:{self.ana.id}", f"hireling:{self.gorg.id}"
        roster = {
            "heroes": [{"key": a, "displayName": "Abbess"}],
            "hirelings": [{"key": g, "displayName": "Gorg"}],
            "henchmenGroups": [{"id": self.sisters.id, "members": [{"key": s, "displayName": "Ana"}]}],
        }
        self.fighter(battle, self.player, self.warband, [a, s, g], [s, g], roster_json=roster)
        self.fighter(battle, self.rival, self.rival_warband, [f"hero:{self.rat.id}"], [])
        first = self.kill(battle, self.gorg, self.rat)
        self.kill(battle, self.gorg, {"victim_kind": "someone_else", "victim_name": "Ogre"}, round=2)
        after = self.kill(battle, self.abbess, self.brute, round=None)

        regenerate_pivotal_moments(battle)

        rows = list(PivotalMoment.objects.filter(battle=battle).order_by("id"))
        self.assertEqual(
            [(row.kind, row.round, row.source_kill_id) for row in rows],
            [
                ("first_blood", 1, first.id),
                ("no_fairies", 1, first.id),
                ("giant_slayer", None, after.id),  # logged after the fight: no round
                ("carried_the_fight", None, None),
                ("bloody_martyr", None, None),  # out of action, but no recorded kill took him out
                ("last_one_standing", None, None),
                ("pyrrhic_victory", None, None),
            ],
        )
        tags = {moment["headline"]: moment["tag"] for moment in self.moments(battle)}
        self.assertEqual(
            (tags["Giant Slayer"], tags["Bloody Martyr"], tags["First Blood"]), ("During", "Result", "Turn 1")
        )
        lone = next(moment for moment in self.moments(battle) if moment["kind"] == "last_one_standing")
        self.assertEqual(lone["detail"], "Abbess was the last of Monks standing.")
        self.assertEqual(lone["unit"], {"kind": "hero", "id": self.abbess.id, "name": "Abbess"})

    def test_an_untouched_win_and_a_battle_with_nothing_to_tell(self):
        won = self.battle([self.warband.id])
        self.fighter(won, self.player, self.warband, [f"hero:{self.abbess.id}"], [])
        self.fighter(won, self.rival, self.rival_warband, [f"hero:{self.rat.id}"], [])
        quiet = self.battle([], scenario="Quiet")
        self.fighter(quiet, self.player, self.warband, [], [])

        regenerate_pivotal_moments(won)
        regenerate_pivotal_moments(quiet)

        self.assertEqual([moment["kind"] for moment in self.moments(won)], ["untouched_triumph"])
        self.assertEqual(self.moments(quiet), [])


class MomentGenerationTests(MomentTestCase):
    def test_the_command_writes_ended_battles_again_and_twice_is_the_same(self):
        battle = self.battle([self.warband.id])
        self.fighter(battle, self.player, self.warband, [f"hero:{self.abbess.id}"], [])
        self.fighter(battle, self.rival, self.rival_warband, [f"hero:{self.rat.id}"], [f"hero:{self.rat.id}"])
        self.kill(battle, self.abbess, self.rat)
        open_battle = self.battle([])
        Battle.objects.filter(id=open_battle.id).update(status=Battle.STATUS_ACTIVE)
        self.kill(open_battle, self.abbess, self.rat)

        def run() -> list[tuple[int, str, str, int | None]]:
            out = StringIO()
            call_command("regenerate_pivotal_moments", stdout=out)
            self.assertIn("for 1 ended battles", out.getvalue())
            rows = PivotalMoment.objects.order_by("id")
            return [(row.battle_id, row.kind, row.detail, row.round) for row in rows]

        first = run()
        self.assertEqual([row[1] for row in first], ["first_blood", "no_fairies", "untouched_triumph", "wiped_out"])
        self.assertEqual(run(), first)
        self.assertFalse(PivotalMoment.objects.filter(battle=open_battle).exists())
