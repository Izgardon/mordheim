"""What postbattle suggests to the player, and the rules it plays by, from the server (IMP-52, BATL-CQ-03).

`suggested_postbattle` is today's rule, which the postbattle page worked out on its own until now:
- XP: 1 for each hero and hired sword (0 for one with no level-ups) plus 1 per live kill that earns XP; a henchmen
  group earns 1 plus its selected members' kills, the same for each member (0 when any has no level-ups);
- exploration dice: one per selected hero still in action, one more for a winner (the player's own declaration
  while the others still fight, decision 4), at most 10;
- upkeep: every hired sword on the battle's roster, at his upkeep price.
PR C adds Winning Leader +1 and the reason for each suggestion (BATL-NEW-09).

`rules` are the exploration chart and dice limits, and the serious injury tables with the campaign's hero death roll
(henchmen and hired swords roll a d6).
"""

from collections.abc import Iterable
from typing import Any

from ...models import Battle, BattleParticipant
from ...validation.config import normalize_unit_information
from ...validation.postbattle import MAX_EXPLORATION_DICE
from ..exploration import exploration_table
from ..injuries import injury_tables
from ..kills import count_kills, live_kill_events
from ..selection import selected_unit_keys
from ..unusual import MAX_EXPLORATION_DICE as MAX_CHOSEN_DICE
from .kill_list import unit_kills


def _xp_kills(kill_payloads: Iterable[Any], warband_id: int) -> dict[str, int]:
    earning = [
        payload for payload in kill_payloads if not (isinstance(payload, dict) and payload.get("earned_xp") is False)
    ]
    return dict(count_kills(earning, warband_id))


def _group_results(groups: list[dict], selected: set[str], kills: dict[str, int]) -> dict[str, dict]:
    results: dict[str, dict] = {}
    for group in groups:
        members = [member for member in group.get("members", []) if member.get("key") in selected]
        if not members:
            continue
        no_level_ups = any(member.get("noLevelUps") for member in members)
        xp = 0 if no_level_ups else 1 + sum(kills.get(member["key"], 0) for member in members)
        results.update({member["key"]: {"xp_earned": xp} for member in members})
    return results


def _upkeep(hired_swords: list[dict]) -> dict[str, dict]:
    entries = {}
    for sword in hired_swords:
        price = sword.get("upkeepPrice")
        cost = max(0, int(price)) if isinstance(price, int | float) and not isinstance(price, bool) else None
        entries[sword["key"]] = {"unit_name": sword.get("displayName"), "cost": cost}
    return entries


def won(battle: Battle, participant: BattleParticipant) -> bool:
    """Whether the suggestions count the player as a winner: the battle's winners once the fight is over, his own
    declaration while the others still fight (decision 4)."""
    if battle.status == Battle.STATUS_ACTIVE:
        return participant.declared_result == BattleParticipant.DECLARED_WON
    return participant.warband_id in (battle.winner_warband_ids_json or [])


def suggested_postbattle(battle: Battle, participant: BattleParticipant, kill_payloads: Iterable[Any]) -> dict:
    """The player's suggested XP per unit, exploration dice and upkeep, from his battle roster."""
    roster = participant.roster_json or {}
    selected = selected_unit_keys(participant)
    kills = _xp_kills(kill_payloads, participant.warband_id)
    heroes = [hero for hero in roster.get("heroes", []) if hero.get("key") in selected]
    swords = [sword for sword in roster.get("hiredSwords", []) if sword.get("key") in selected]
    unit_results = {hero["key"]: {"xp_earned": 1 + kills.get(hero["key"], 0)} for hero in heroes}
    for sword in swords:
        unit_results[sword["key"]] = {"xp_earned": 0 if sword.get("noLevelUps") else 1 + kills.get(sword["key"], 0)}
    unit_results.update(_group_results(roster.get("henchmenGroups", []), selected, kills))
    information = normalize_unit_information(participant.unit_information_json)
    in_action = [hero for hero in heroes if not information.get(hero["key"], {}).get("out_of_action")]
    winner = won(battle, participant)
    return {
        "unit_results": unit_results,
        "exploration": {"dice_count": max(0, min(MAX_EXPLORATION_DICE, len(in_action) + int(winner)))},
        "upkeep": {"entries": _upkeep(roster.get("hiredSwords", []))},
    }


def postbattle_rules(hero_death_roll: str) -> dict:
    return {
        "exploration_table": exploration_table(),
        "exploration_dice": {"max": MAX_EXPLORATION_DICE, "max_chosen": MAX_CHOSEN_DICE},
        "hero_death_roll": hero_death_roll,
        "injury_tables": injury_tables(),
    }


def postbattle_guide(battle: Battle, participant: BattleParticipant) -> dict:
    """`suggested_postbattle`, `rules` and `unit_kills` (his units' kills by victim, BATL-NEW-06) for the postbattle
    page's state (two reads: the player's battle roster and the live kill events; the campaign's settings come with
    the battle, the participants with the snapshot)."""
    settings = getattr(battle.campaign, "settings", None)
    kills = list(live_kill_events(battle.id).only("id", "payload_json").order_by("id"))
    return {
        "suggested_postbattle": suggested_postbattle(battle, participant, [event.payload_json for event in kills]),
        "rules": postbattle_rules((settings.hero_death_roll if settings else None) or "d66"),
        "unit_kills": unit_kills(participant.warband_id, kills, battle.participants.all()),
    }
