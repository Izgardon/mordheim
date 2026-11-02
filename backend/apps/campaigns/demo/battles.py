"""Playing a demo battle through the battle API, as its players would: invited and joined, units picked, ready,
started, the kills tapped round by round, each player finishing his own fight, the results confirmed, and each
post-game finalised from the server's own suggestions (XP, level-ups, exploration dice, upkeep) plus the plan's
injuries, finds and advances."""

from typing import Any

from apps.battles.services.injuries import describe_roll
from apps.warbands.units.services.level_up import STAT_LABELS

from .api import Api
from .plans import BattlePlan, Kill
from .raising import Demo, Unit

HERO_ADVANCES = ("I", "Ld", "WS", "BS", "S")  # the default for a level-up the plan doesn't name, by turn
GROUP_ADVANCES = ("I", "WS", "Ld")
# Dice that roll each advance: the hero table's 2D6 (and its D6 where it has one), the henchmen's 2D6
HERO_ROLLS = {"Skill": [2, 3], "WS": [3, 4], "BS": [4, 3], "S": [3, 3, 2], "A": [2, 4, 5], "I": [4, 4, 1]}
HERO_ROLLS |= {"Ld": [5, 3, 6], "W": [4, 5, 2], "T": [5, 4, 5]}
GROUP_ROLLS = {"I": [1, 2], "S": [2, 3], "WS": [3, 3], "BS": [3, 4], "A": [4, 4], "Ld": [4, 5]}


def label(advance: str) -> str:
    """The label the Aftermath gives an advance: "New skill", "+1 Weapon Skill"."""
    return f"New {advance.lower()}" if advance == "Skill" else f"+1 {STAT_LABELS[advance]}"


class Battle:
    """One plan played out in the demo campaign."""

    def __init__(self, api: Api, demo: Demo, plan: BattlePlan) -> None:
        self.api, self.demo, self.plan = api, demo, plan
        self.base = f"campaigns/{demo.campaign_id}/battles/"
        self.url = ""
        self.turn = 0

    def user(self, player: str) -> Any:
        return self.demo.users[player]

    def unit(self, handle: str) -> Unit:
        return self.demo.units[handle]

    def post(self, player: str, action: str, body: dict | None = None) -> Any:
        return self.api.post(self.user(player), f"{self.url}{action}/", body)

    def play(self) -> int:
        battle_id = self.open()
        self.ready_and_start()
        self.fight()
        self.finish()
        for player in self.plan.players:
            self.finalise(player)
        self.pick_skills()
        return battle_id

    def open(self, ready: bool = True) -> int:
        """Created by the first player, joined by the rest, each with every living unit picked."""
        creator, *others = self.plan.players
        ratings = {str(self.user(player).id): rating for player, rating in self.plan.ratings.items()}
        body = {"participant_user_ids": [self.user(player).id for player in others], "scenario": self.plan.scenario}
        created = self.api.post(self.user(creator), self.base, {**body, "participant_ratings": ratings})
        battle_id = int(created["battle"]["id"])
        self.url = f"{self.base}{battle_id}/"
        for player in others:
            self.post(player, "join")
        for player in self.plan.players:
            keys = [unit.key for unit in self.demo.roster(player)]
            config = {"selected_unit_keys_json": keys, "unit_information_json": {}, "custom_units_json": []}
            self.post(player, "config", config)
        return battle_id

    def ready_and_start(self) -> None:
        for player in self.plan.players:
            self.post(player, "ready", {"ready": True})
        self.post(self.plan.players[0], "start")

    def fight(self) -> None:
        creator = self.plan.players[0]
        for name, creature_type, count in self.plan.neutrals:
            self.post(creator, "neutral-groups", {"name": name, "creature_type": creature_type, "count": count})
        for number, kills in enumerate(self.plan.rounds):
            if number:
                self.post(creator, "round", {"action": "force"})
            for kill in kills:
                self.kill(kill)
        for handle in self.plan.out_of_action:
            unit = self.unit(handle)
            self.post(unit.player, "unit-ooa", {"unit_key": unit.key, "out_of_action": True})

    def kill(self, kill: Kill) -> None:
        killer = self.unit(kill.killer)
        body: dict[str, Any] = {"killer_unit_key": killer.key, "how": kill.how}
        if kill.victim.startswith("neutral:"):
            body["victim_neutral_key"] = kill.victim.removeprefix("neutral:")
        else:
            body["victim_unit_key"] = self.unit(kill.victim).key
        self.post(killer.player, "unit-kill", body)

    def finish(self) -> None:
        """Each player finishes his own fight; the last one confirms the results."""
        winners = [self.demo.warbands[player] for player in self.plan.winners]
        for player in self.plan.players:
            self.post(player, "finish-mine", {"result": "won" if player in self.plan.winners else "lost"})
        losers = [self.demo.warbands[player] for player in self.plan.players if player not in self.plan.winners]
        self.post(self.plan.players[-1], "results", {"winners": winners, "losers": losers})

    def finalise(self, player: str) -> None:
        state = self.api.get(self.user(player), f"{self.url}state/?view=postbattle")
        suggested = state["suggested_postbattle"]
        dice = list(self.plan.exploration.get(player, ()))[: suggested["exploration"]["dice_count"]]
        gold, found = self.plan.finds.get(player, (0, ()))
        items = [{"item_id": item_id} for name in found if (item_id := self.demo.book.item(name))]
        upkeep = {key: {**entry, "paid": True} for key, entry in suggested["upkeep"]["entries"].items()}
        draft = {
            "exploration": {"dice_values": dice, "resource_id": self.demo.wyrdstone[player]},
            "finds": {"gold_crowns": gold, "items": items},
            "upkeep": {"pay_upkeep": True, "entries": upkeep},
            "unit_results": self.results(player, suggested["unit_results"]),
        }
        answer = self.post(player, "finalize-postbattle", {"postbattle_json": draft})
        skipped = [entry["message"] for entry in answer.get("warnings", []) if entry.get("code") == "advance_skipped"]
        self.demo.notes += skipped

    def results(self, player: str, suggested: dict[str, dict]) -> dict[str, dict]:
        handles = {unit.key: handle for handle, unit in self.demo.units.items() if unit.player == player}
        taken_out = {kill.victim for kills in self.plan.rounds for kill in kills} | set(self.plan.out_of_action)
        results, advanced_groups = {}, set()
        for key, suggestion in suggested.items():
            handle = handles[key]
            unit = self.unit(handle)
            rolls = self.injury(handle, unit)
            dead = bool(rolls) and rolls[-1]["dead_suggestion"]
            kills = sum(1 for kills in self.plan.rounds for kill in kills if kill.killer == handle)
            result = {
                "unit_name": unit.name,
                "unit_kind": unit.kind,
                "unit_type": unit.unit_type,
                "group_name": unit.group_name,
                "out_of_action": handle in taken_out,
                "kill_count": kills,
                "xp_earned": 0 if dead and not unit.group else suggestion["xp_earned"],  # a group shares its XP
                "dead": dead,
                "special_ids": [],
                "serious_injury_rolls": rolls,
            }
            level_ups = 0 if dead else suggestion.get("level_ups", 0)
            if level_ups and not (unit.group and unit.group in advanced_groups):  # a group's ride on one member
                result["advances"] = self.advances(handle, unit, level_ups)
                advanced_groups.add(unit.group)
            unit.dead = dead
            results[key] = result
        return results

    def injury(self, handle: str, unit: Unit) -> list[dict]:
        dice = self.plan.injuries.get(handle)
        if not dice:
            return []
        roll_type = "d66" if unit.kind == "hero" else "d6"
        return [{"roll_type": roll_type, "rolls": list(dice), **describe_roll(roll_type, list(dice))}]

    def advances(self, handle: str, unit: Unit, level_ups: int) -> list[dict]:
        planned = list(self.plan.advances.get(handle, ()))
        group = unit.kind == "henchman"
        defaults, rolls = (GROUP_ADVANCES, GROUP_ROLLS) if group else (HERO_ADVANCES, HERO_ROLLS)
        chosen = []
        for _ in range(level_ups):
            if planned:
                chosen.append(planned.pop(0))
            else:
                chosen.append(defaults[self.turn % len(defaults)])
                self.turn += 1
        return [{"id": advance, "label": label(advance), "rolls": rolls.get(advance, [])} for advance in chosen]

    def pick_skills(self) -> None:
        """A Skill advance picked from the hero's card: the skill added and one pick fewer to make."""
        for handle, skill in self.plan.picks.items():
            unit, skill_id = self.unit(handle), self.demo.book.skill(skill)
            path = f"warbands/{self.demo.warband_of(unit)}/heroes/{unit.unit_id}/"
            hero = self.api.get(self.user(unit.player), path)
            if skill_id is None or not hero["pending_skills"]:
                continue
            body = {
                "skill_ids": [entry["id"] for entry in hero["skills"]] + [skill_id],
                "pending_skills": hero["pending_skills"] - 1,
            }
            self.api.patch(self.user(unit.player), path, body)
