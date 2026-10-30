"""A battle's key moments, for the overview's and the Battles page's expandable rows (next step 5).

A kill tapped in a round (next step 6 stamps the round on it) is grouped "Round N"; older kills, and the moments that
carry no round, are grouped "During", and the deaths found in the post-game "After". During: each live kill (undone
kills don't count, decision 5), each unit taken out of action that no recorded kill accounts for, and what each
warband found (exploration shards, gold and items). Routs aren't recorded, so there are none.
"""

from collections.abc import Iterable, Mapping
from typing import Any

DURING = "During"
AFTER = "After"


def unit_results(postbattle_json: Any) -> dict[str, dict]:
    """A participant's stored unit results by unit key ({} when there are none)."""
    raw = postbattle_json.get("unit_results", {}) if isinstance(postbattle_json, dict) else {}
    if not isinstance(raw, dict):
        return {}
    return {key: result for key, result in raw.items() if isinstance(key, str) and isinstance(result, dict)}


def who(unit: Any, *, start: bool = False) -> str:
    """A kill's killer or victim as the moment names him: his name, else "a <type>", else "someone"."""
    unit = unit if isinstance(unit, dict) else {}
    name = str(unit.get("name") or "").strip()
    if name:
        return name
    kind = str(unit.get("type_name") or "").strip()
    phrase = f"a {kind}" if kind else "someone"
    return phrase[:1].upper() + phrase[1:] if start else phrase


def kill_text(payload: Any) -> str:
    payload = payload if isinstance(payload, dict) else {}
    return f"{who(payload.get('killer'), start=True)} took {who(payload.get('victim'))} out of action"


def victim_key(payload: Any) -> str | None:
    victim = payload.get("victim") if isinstance(payload, dict) else None
    key = victim.get("unit_key") if isinstance(victim, dict) else None
    return key if isinstance(key, str) else None


def death_text(name: str, result: Mapping[str, Any]) -> str:
    """ "Ulla Vorn is dead (Dead)" reads badly: the injury's label only when it says more than "dead"."""
    rolls = result.get("serious_injury_rolls")
    last = rolls[-1] if isinstance(rolls, list) and rolls and isinstance(rolls[-1], dict) else {}
    label = str(last.get("result_label") or "").strip()
    return f"{name} is dead ({label})" if label and label.lower() != "dead" else f"{name} is dead"


def _count(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _finds(warband: str, postbattle_json: dict) -> list[str]:
    exploration = postbattle_json.get("exploration")
    shards = _count(exploration.get("amount")) if isinstance(exploration, dict) else 0
    finds = postbattle_json.get("finds")
    finds = finds if isinstance(finds, dict) else {}
    gold = _count(finds.get("gold_crowns"))
    raw_items = finds.get("items")
    items: list[Any] = raw_items if isinstance(raw_items, list) else []
    names = [str(item.get("name") or "").strip() for item in items if isinstance(item, dict)]
    texts = [f"{warband} found {shards} {'shard' if shards == 1 else 'shards'}"] if shards else []
    texts += [f"{warband} found {gold} gc"] if gold else []
    texts += [f"{warband} found {', '.join(name for name in names if name)}"] if any(names) else []
    return texts


def kill_group(payload: Any) -> str:
    """ "Round N" for a kill that carries its round, "During" for an older one."""
    round_number = payload.get("round") if isinstance(payload, dict) else None
    return f"Round {round_number}" if isinstance(round_number, int) and round_number > 0 else DURING


def battle_moments(participants: Iterable[Any], kill_payloads: Iterable[Any]) -> list[dict[str, str]]:
    """The battle's moments in order, each `{group, kind, text}`: kills by round, then the kills with no round,
    out of action and finds During, then deaths After. `participants` carry `postbattle_json` and `warband.name`."""
    rounds: dict[int, list[dict[str, str]]] = {}
    during: list[dict[str, str]] = []
    after: list[dict[str, str]] = []
    victims: set[str] = set()
    for payload in kill_payloads:
        group = kill_group(payload)
        moment = {"group": group, "kind": "kill", "text": kill_text(payload)}
        if group == DURING:
            during.append(moment)
        else:
            rounds.setdefault(int(payload["round"]), []).append(moment)
        if key := victim_key(payload):
            victims.add(key)
    for participant in participants:
        postbattle_json = participant.postbattle_json if isinstance(participant.postbattle_json, dict) else {}
        for key, result in unit_results(postbattle_json).items():
            name = str(result.get("unit_name") or "").strip() or "A unit"
            if result.get("out_of_action") and key not in victims:
                during.append({"group": DURING, "kind": "ooa", "text": f"{name} went out of action"})
            if result.get("dead"):
                after.append({"group": AFTER, "kind": "death", "text": death_text(name, result)})
        during += [
            {"group": DURING, "kind": "find", "text": text}
            for text in _finds(participant.warband.name, postbattle_json)
        ]
    by_round = [moment for number in sorted(rounds) for moment in rounds[number]]
    return by_round + during + after
