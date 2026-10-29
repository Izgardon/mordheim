"""What postbattle suggests to the player, and the rules it plays by, from the server (IMP-52, BATL-CQ-03).

`suggested_postbattle` is today's rule, which the postbattle page worked out on its own until now:
- XP: 1 for each hero and hired sword (0 for one with no level-ups, and for a dramatis persona, who gains none) plus 1
  per live kill that earns XP, plus 1 for a winning warband's leader (Winning Leader, BATL-NEW-09); a henchmen group
  earns 1 plus its selected members' kills, the same for each member (0 when any has no level-ups). Each unit's suggestion lists its `reasons`
  (`[{"label": "survived", "xp": 1}, {"label": "2 kills", "xp": 2}, {"label": "winning leader", "xp": 1}]`), which
  add up to its `xp_earned`, and the `level_ups` that XP would earn (services/postbattle/level_ups.py);
- exploration dice: one per selected hero still in action, one more for a winner (the player's own declaration
  while the others still fight, decision 4), at most 10;
- upkeep: every hireling on the battle's roster but one who stays for one battle or misses games, at his upkeep
  price, with his upkeep formula when he has one (one that isn't gold, "1 piece of wyrdstone", is a reminder: its
  price is 0);
- dismiss (only when there is one): each selected hireling who stays for one battle, suggested to leave (never
  forced);
- mount survival (only when there is one): a D6 for each selected rider taken out of action on his mount
  (services/postbattle/mounts.py).

`rules` are the exploration chart and dice limits, and the serious injury tables with the campaign's hero death roll
(henchmen, and hirelings on the henchman table, roll a d6; the battle roster shows each hireling's `injuryTable`):
only the d6 and the campaign's hero table, the ones its units roll on, so the rules fit the end of the fight's
broadcast (services/broadcast.py).
"""

from collections.abc import Iterable
from typing import Any

from apps.campaigns.models import CampaignSettings

from ...models import Battle, BattleParticipant
from ...validation.config import normalize_unit_information
from ...validation.postbattle import MAX_EXPLORATION_DICE
from ..exploration import exploration_table
from ..injuries import injury_tables
from ..kills import count_kills, live_kill_events
from ..selection import selected_unit_keys
from ..unusual import MAX_EXPLORATION_DICE as MAX_CHOSEN_DICE
from .kill_list import unit_kills
from .level_ups import add_level_ups, unit_rows
from .mounts import mount_survival


def _xp_kills(kill_payloads: Iterable[Any], warband_id: int) -> dict[str, int]:
    earning = [
        payload for payload in kill_payloads if not (isinstance(payload, dict) and payload.get("earned_xp") is False)
    ]
    return dict(count_kills(earning, warband_id))


def _suggestion(*reasons: tuple[str, int] | None) -> dict:
    """A unit's suggested XP and why: the reasons that apply, which add up to it."""
    listed = [{"label": label, "xp": xp} for label, xp in filter(None, reasons)]
    return {"xp_earned": sum(reason["xp"] for reason in listed), "reasons": listed}


def _kills(count: int, noun: str = "kill") -> tuple[str, int] | None:
    return (f"{count} {noun}{'' if count == 1 else 's'}", count) if count else None


SURVIVED = ("survived", 1)
NO_LEVEL_UPS = ("no level-ups", 0)
DRAMATIS_PERSONA = ("dramatis persona", 0)  # gains no XP


def _hero_results(heroes: list[dict], kills: dict[str, int], winner: bool) -> dict[str, dict]:
    return {
        hero["key"]: _suggestion(
            SURVIVED,
            _kills(kills.get(hero["key"], 0)),
            ("winning leader", 1) if winner and hero.get("isLeader") else None,
        )
        for hero in heroes
    }


def _group_results(groups: list[dict], selected: set[str], kills: dict[str, int]) -> dict[str, dict]:
    results: dict[str, dict] = {}
    for group in groups:
        members = [member for member in group.get("members", []) if member.get("key") in selected]
        if not members:
            continue
        group_kills = sum(kills.get(member["key"], 0) for member in members)
        no_level_ups = any(member.get("noLevelUps") for member in members)
        suggestion = (
            _suggestion(NO_LEVEL_UPS) if no_level_ups else _suggestion(SURVIVED, _kills(group_kills, "group kill"))
        )
        results.update({member["key"]: suggestion for member in members})
    return results


def _hireling_results(swords: list[dict], kills: dict[str, int]) -> dict[str, dict]:
    results = {}
    for sword in swords:
        if sword.get("hirelingKind") == "dramatis_persona":
            results[sword["key"]] = _suggestion(DRAMATIS_PERSONA)
        elif sword.get("noLevelUps"):
            results[sword["key"]] = _suggestion(NO_LEVEL_UPS)
        else:
            results[sword["key"]] = _suggestion(SURVIVED, _kills(kills.get(sword["key"], 0)))
    return results


def _upkeep(hirelings: list[dict]) -> dict[str, dict]:
    """Each hireling's upkeep, but for one who stays for one battle (he leaves after it, so nothing keeps him on) or one
    missing games (he missed this battle)."""
    entries = {}
    for sword in hirelings:
        if sword.get("stays") == "one_battle" or sword.get("missingGames"):
            continue
        price = sword.get("upkeepPrice")
        cost = max(0, int(price)) if isinstance(price, int | float) and not isinstance(price, bool) else None
        entry = {"unit_name": sword.get("displayName"), "cost": cost}
        if sword.get("upkeepCostExpression"):  # left out when empty: the broadcast fits Pusher's 10 KB (item 8)
            entry["cost_expression"] = sword["upkeepCostExpression"]
        entries[sword["key"]] = entry
    return entries


def _dismiss(swords: list[dict]) -> dict[str, dict]:
    """The selected hirelings who stay for one battle: this one."""
    return {
        sword["key"]: {"unit_name": sword.get("displayName"), "reason": "stays_one_battle"}
        for sword in swords
        if sword.get("stays") == "one_battle"
    }


def won(battle: Battle, participant: BattleParticipant) -> bool:
    """Whether the suggestions count the player as a winner: the battle's winners once the fight is over, his own
    declaration while the others still fight (decision 4)."""
    if battle.status == Battle.STATUS_ACTIVE:
        return participant.declared_result == BattleParticipant.DECLARED_WON
    return participant.warband_id in (battle.winner_warband_ids_json or [])


def suggested_postbattle(battle: Battle, participant: BattleParticipant, kill_payloads: Iterable[Any]) -> dict:
    """The player's suggested XP per unit, exploration dice, upkeep and who leaves, from his battle roster."""
    roster = participant.roster_json or {}
    selected = selected_unit_keys(participant)
    kills = _xp_kills(kill_payloads, participant.warband_id)
    heroes = [hero for hero in roster.get("heroes", []) if hero.get("key") in selected]
    swords = [sword for sword in roster.get("hirelings", []) if sword.get("key") in selected]
    winner = won(battle, participant)
    unit_results = {**_hero_results(heroes, kills, winner), **_hireling_results(swords, kills)}
    unit_results.update(_group_results(roster.get("henchmenGroups", []), selected, kills))
    information = normalize_unit_information(participant.unit_information_json)
    in_action = [hero for hero in heroes if not information.get(hero["key"], {}).get("out_of_action")]
    suggested = {
        "unit_results": unit_results,
        "exploration": {"dice_count": max(0, min(MAX_EXPLORATION_DICE, len(in_action) + int(winner)))},
        "upkeep": {"entries": _upkeep(roster.get("hirelings", []))},
    }
    leaving = _dismiss(swords)
    if leaving:  # only when someone leaves, as an empty upkeep formula is left out: the broadcast's 10 KB (item 8)
        suggested["dismiss"] = {"entries": leaving}
    if at_risk := mount_survival(participant, selected, information):  # only when a mount may die (step 5)
        suggested["mount_survival"] = {"entries": at_risk}
    return suggested


def postbattle_rules(hero_death_roll: str) -> dict:
    tables = injury_tables()
    return {
        "exploration_table": exploration_table(),
        "exploration_dice": {"max": MAX_EXPLORATION_DICE, "max_chosen": MAX_CHOSEN_DICE},
        "hero_death_roll": hero_death_roll,
        "injury_tables": {roll: tables[roll] for roll in ("d6", hero_death_roll) if roll in tables},
    }


def rules_for(settings: CampaignSettings | None) -> dict:
    return postbattle_rules((settings.hero_death_roll if settings else None) or "d66")


def suggestions_for(
    battle: Battle,
    participants: list[BattleParticipant],
    settings: CampaignSettings | None,
    kill_payloads: list[Any] | None = None,
) -> dict[int, dict]:
    """Each player's `suggested_postbattle` by user id (players read with their battle rosters), with the level-ups
    each unit's XP would earn: the live kill events (unless given) and at most one read per unit kind for all."""
    if kill_payloads is None:
        kill_payloads = list(live_kill_events(battle.id).values_list("payload_json", flat=True))
    suggestions = {entry.user_id: suggested_postbattle(battle, entry, kill_payloads) for entry in participants}
    keys = {key for suggestion in suggestions.values() for key in suggestion["unit_results"]}
    rows = unit_rows([entry.roster_json or {} for entry in participants], keys)
    for suggestion in suggestions.values():
        add_level_ups(suggestion["unit_results"], rows, settings)
    return suggestions


def postbattle_guide(battle: Battle, participant: BattleParticipant) -> dict:
    """`suggested_postbattle`, `rules` and `unit_kills` (his units' kills by victim, BATL-NEW-06) for the postbattle
    page's state: the player's battle roster, the live kill events and his units' XP (up to three reads); the
    campaign's settings come with the battle, the participants with the snapshot."""
    settings = getattr(battle.campaign, "settings", None)
    kills = list(live_kill_events(battle.id).only("id", "payload_json").order_by("id"))
    payloads = [event.payload_json for event in kills]
    return {
        "suggested_postbattle": suggestions_for(battle, [participant], settings, payloads)[participant.user_id],
        "rules": rules_for(settings),
        "unit_kills": unit_kills(participant.warband_id, kills, battle.participants.all()),
    }
