"""A battle's record for the Battles page (William, 7 Nov 2026: "battles: just do put out of action, can then also show
what happened to units in that battle after if they got injuries or died").

Round by round, every unit put out of action in the order it happened, from the battle's events: a unit marked out of
action (`unit_ooa_set`), a neutral creature (`neutral_ooa_set`), or a kill in the fight that took its victim out
(`victim_ooa`), with who took him out where a kill was recorded with it (a kill on a victim already out names his
killer too). An out of action later unset (`unit_ooa_unset`, a creature back up) doesn't show, nor an undone kill's;
nothing else from the event log does. Then, for each warband, what its Aftermath recorded for its heroes, henchmen and
hired swords that battle: each serious injury's result and whether he died (`postbattle_json["unit_results"]`, the
participant's own record of the battle). A participant a battle manager took off the record shows in neither.
"""

from typing import Any

from apps.campaigns.chronicle import unit_results

from ..models import Battle, BattleEvent, BattleParticipant
from ..models.kill import called

EVENT_TYPES = (
    BattleEvent.TYPE_UNIT_OOA_SET,
    BattleEvent.TYPE_UNIT_OOA_UNSET,
    BattleEvent.TYPE_NEUTRAL_OOA_SET,
    BattleEvent.TYPE_UNIT_KILL_RECORDED,
)
UNIT_KINDS = ("hero", "henchman", "hireling")


def _dict(value: Any) -> dict[str, Any]:
    """A stored payload's part, {} when it isn't one."""
    return value if isinstance(value, dict) else {}


class Names:
    """A unit's name in the battle by its warband and key: the Aftermath's, else the battle roster's, else a temporary
    unit's; a creature's from its group."""

    def __init__(self, battle: Battle, rows: list[BattleParticipant]) -> None:
        self.units: dict[tuple[int, str], str] = {}
        for row in rows:
            roster = row.roster_json if isinstance(row.roster_json, dict) else {}
            units = [*roster.get("heroes", []), *roster.get("hirelings", [])]
            units += [member for group in roster.get("henchmenGroups", []) for member in group.get("members", [])]
            for unit in units:
                self._add(row.warband_id, unit.get("key"), unit.get("displayName"), unit.get("unitType"))
            for unit in row.custom_units_json if isinstance(row.custom_units_json, list) else []:
                if isinstance(unit, dict):
                    self._add(row.warband_id, str(unit.get("key", "")).strip(), unit.get("name"), unit.get("unit_type"))
            for key, result in unit_results(row.postbattle_json).items():
                self._add(row.warband_id, key, result.get("unit_name"), result.get("unit_type"), first=True)
        groups = battle.neutral_groups_json if isinstance(battle.neutral_groups_json, list) else []
        self.creature_types = {group.get("key"): str(group.get("creature_type") or "") for group in groups}

    def _add(self, warband_id: int, key: Any, name: Any, unit_type: Any, first: bool = False) -> None:
        if not isinstance(key, str) or not key:
            return
        text = called(str(name or "").strip(), str(unit_type or "").strip(), start=True)
        if first or (warband_id, key) not in self.units:
            self.units[(warband_id, key)] = text

    def unit(self, warband_id: Any, key: Any, payload: dict[str, Any] | None = None) -> str:
        found = self.units.get((warband_id, key)) if isinstance(key, str) else None
        if found:
            return found
        payload = payload or {}
        return called(str(payload.get("name") or "").strip(), str(payload.get("type_name") or "").strip(), start=True)

    def creature(self, neutral: dict[str, Any]) -> str:
        name = str(neutral.get("name") or "").strip()
        return called(name, self.creature_types.get(neutral.get("group_key"), ""), start=True)


def _victim(payload: dict[str, Any]) -> tuple[str, Any, Any] | None:
    """A kill's victim as the record keys him: a unit (warband, key) or a creature; None for one named by hand."""
    victim = _dict(payload.get("victim"))
    if victim.get("neutral_key"):
        return ("creature", None, victim["neutral_key"])
    if victim.get("unit_key"):
        return ("unit", victim.get("warband_id"), victim["unit_key"])
    return None


class Rounds:
    """The units put out of action, round by round, as the events tell it."""

    def __init__(self, names: Names, warbands: dict[int, str]) -> None:
        self.names, self.warbands = names, warbands
        self.entries: list[dict[str, Any]] = []
        self.out: dict[tuple[str, Any, Any], dict[str, Any]] = {}  # each unit's showing out-of-action

    def put_out(self, key: tuple[str, Any, Any], round_number: Any, name: str, by: str | None) -> None:
        warband_id = key[1]
        entry = {
            "round": round_number if isinstance(round_number, int) and round_number > 0 else 1,
            "name": name,
            "warband_id": warband_id,
            "warband_name": self.warbands.get(warband_id, "") if warband_id is not None else "",
            "by": by,
            "shown": True,
        }
        self.entries.append(entry)
        self.out[key] = entry

    def stand_up(self, key: tuple[str, Any, Any]) -> None:
        entry = self.out.pop(key, None)
        if entry is not None:
            entry["shown"] = False

    def read(self, event: BattleEvent) -> None:
        payload = event.payload_json if isinstance(event.payload_json, dict) else {}
        if event.type == BattleEvent.TYPE_NEUTRAL_OOA_SET:
            neutral = _dict(payload.get("neutral"))
            key = ("creature", None, neutral.get("key"))
            if payload.get("out_of_action"):
                self.put_out(key, payload.get("round"), self.names.creature(neutral), None)
            else:
                self.stand_up(key)
            return
        if event.type in (BattleEvent.TYPE_UNIT_OOA_SET, BattleEvent.TYPE_UNIT_OOA_UNSET):
            unit = _dict(payload.get("unit"))
            key = ("unit", unit.get("warband_id"), unit.get("unit_key"))
            if event.type == BattleEvent.TYPE_UNIT_OOA_SET:
                self.put_out(key, payload.get("round"), self.names.unit(key[1], key[2]), None)
            else:
                self.stand_up(key)
            return
        self._kill(payload)

    def _kill(self, payload: dict[str, Any]) -> None:
        key = _victim(payload)
        if key is None:
            return
        killer = _dict(payload.get("killer"))
        by = self.names.unit(killer.get("warband_id"), killer.get("unit_key"), killer)
        if payload.get("victim_ooa"):
            victim = _dict(payload.get("victim"))
            self.put_out(key, payload.get("round"), self.names.unit(key[1], key[2], victim), by)
        elif key in self.out and self.out[key]["by"] is None:
            self.out[key]["by"] = by

    def rounds(self) -> list[dict[str, Any]]:
        by_round: dict[int, list[dict[str, Any]]] = {}
        for entry in self.entries:
            if entry.pop("shown"):
                by_round.setdefault(entry.pop("round"), []).append(entry)
        return [{"round": number, "out_of_action": by_round[number]} for number in sorted(by_round)]


def _results(result: dict[str, Any]) -> list[str]:
    rolls = result.get("serious_injury_rolls")
    labels = []
    for roll in rolls if isinstance(rolls, list) else []:
        if not isinstance(roll, dict):
            continue
        label = str(roll.get("result_label") or "").strip()
        mutation = _dict(roll.get("mutation"))
        if label and mutation.get("name"):
            label = f"{label} ({mutation['name']})"
        if label:
            labels.append(label)
    return labels


def _roster_order(item: tuple[str, dict[str, Any]]) -> tuple[int, int]:
    """Heroes, then henchmen, then hired swords, each by his id (the stored results keep no order)."""
    kind, _, unit_id = item[0].partition(":")
    return (UNIT_KINDS.index(kind) if kind in UNIT_KINDS else len(UNIT_KINDS), int(unit_id) if unit_id.isdigit() else 0)


def _aftermath(row: BattleParticipant) -> dict[str, Any] | None:
    units = []
    for _key, result in sorted(unit_results(row.postbattle_json).items(), key=_roster_order):
        kind, results, dead = result.get("unit_kind"), _results(result), bool(result.get("dead"))
        if kind not in UNIT_KINDS or not (results or dead):
            continue
        name = called(
            str(result.get("unit_name") or "").strip(), str(result.get("unit_type") or "").strip(), start=True
        )
        group = str(result.get("group_name") or "").strip() if kind == "henchman" else ""
        units.append({"name": name, "unit_kind": kind, "group_name": group, "results": results, "dead": dead})
    if not units:
        return None
    return {"warband_id": row.warband_id, "warband_name": row.warband.name, "units": units}


def battle_record(battle: Battle) -> dict[str, Any]:
    """The battle round by round, then each warband's aftermath: two queries after the battle's."""
    rows = list(
        BattleParticipant.objects.filter(battle_id=battle.id, removed_from_record=False)
        .select_related("warband")
        .only("warband_id", "warband__name", "roster_json", "custom_units_json", "postbattle_json")
        .order_by("id")
    )
    warbands = {row.warband_id: row.warband.name for row in rows}
    events = BattleEvent.objects.filter(battle_id=battle.id, type__in=EVENT_TYPES, voided_at__isnull=True)
    rounds = Rounds(Names(battle, rows), warbands)
    for event in events.only("type", "payload_json").order_by("id"):
        rounds.read(event)
    on_record = rounds.rounds()
    for entry in on_record:  # a unit of a warband taken off the record doesn't show
        entry["out_of_action"] = [
            out for out in entry["out_of_action"] if out["warband_id"] is None or out["warband_id"] in warbands
        ]
    return {
        "rounds": [entry for entry in on_record if entry["out_of_action"]],
        "aftermath": [found for row in rows if (found := _aftermath(row)) is not None],
    }
