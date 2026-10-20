"""Pivotal moments: the headlines a normal battle leaves in the campaign's history when it ends.

Kill moments come from the battle's live kill events (undone kills don't count, decision 5); warband moments from
each participant's postbattle results, counted as finalise counts them (decision 5, BUG-11). A battle's moments are
written once, in the order they are found.
"""

from dataclasses import dataclass

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.battles.services.kills import count_kills, live_kill_events

from .models import PivotalMoment

EVENT_DRIVEN_MOMENT_KINDS = {
    "hero_slayer": "Hero Slayer",
    "no_fairies": "I don't believe in fairies",
    "giant_slayer": "Giant Slayer",
    "there_can_be_only_one": "There can be only one",
}

WARBAND_MOMENT_KINDS = {
    "carried_the_fight": "Carried the Fight",
    "bloody_martyr": "Bloody Martyr",
    "untouched_triumph": "Untouched Triumph",
    "pyrrhic_victory": "Pyrrhic Victory",
    "wiped_out": "Wiped Out",
    "black_day": "Black Day",
}
HEADLINES = {**EVENT_DRIVEN_MOMENT_KINDS, **WARBAND_MOMENT_KINDS}
UNRECORDED_UNIT_PREFIXES = ("custom:", "bestiary:")  # units outside the warband's roster


def _normalize_unit_results(participant: BattleParticipant) -> dict[str, dict]:
    postbattle_json = participant.postbattle_json if isinstance(participant.postbattle_json, dict) else {}
    raw_unit_results = postbattle_json.get("unit_results", {})
    if not isinstance(raw_unit_results, dict):
        return {}
    return {
        unit_key: result
        for unit_key, result in raw_unit_results.items()
        if isinstance(unit_key, str) and isinstance(result, dict)
    }


def _build_unit_names_by_key(participants: list[BattleParticipant]) -> dict[str, str]:
    names_by_key: dict[str, str] = {}
    for participant in participants:
        for unit_key, result in _normalize_unit_results(participant).items():
            unit_name = str(result.get("unit_name", "")).strip()
            if unit_name:
                names_by_key.setdefault(unit_key, unit_name)
    return names_by_key


def _selected_ooa_count(participant: BattleParticipant) -> tuple[int, int]:
    selected_unit_keys = (
        participant.selected_unit_keys_json if isinstance(participant.selected_unit_keys_json, list) else []
    )
    selected_keys = [key for key in selected_unit_keys if isinstance(key, str) and key.strip()]
    unit_information = participant.unit_information_json if isinstance(participant.unit_information_json, dict) else {}

    ooa_count = 0
    for unit_key in selected_keys:
        unit_info = unit_information.get(unit_key, {})
        if isinstance(unit_info, dict) and bool(unit_info.get("out_of_action", False)):
            ooa_count += 1
    return len(selected_keys), ooa_count


def _append_moment(
    rows: list[PivotalMoment],
    battle: Battle,
    warband_id: int,
    kind: str,
    detail: str,
    *,
    unit_key: str | None = None,
    unit_name: str | None = None,
    source_event_id: int | None = None,
) -> None:
    if battle.flow_type != Battle.FLOW_TYPE_NORMAL:
        return
    rows.append(
        PivotalMoment(
            campaign_id=battle.campaign_id,
            battle_id=battle.id,
            warband_id=warband_id,
            source_event_id=source_event_id,
            kind=kind,
            headline=HEADLINES[kind],
            detail=detail,
            unit_key=unit_key,
            unit_name=unit_name,
            battle_ended_at=battle.ended_at or battle.created_at,
        )
    )


# Kill moments


@dataclass(frozen=True)
class _Kill:
    """One live kill event, read: the killer's warband (a participant) and both units."""

    event_id: int
    warband_id: int
    killer: dict
    victim: dict
    killer_key: str | None
    killer_name: str
    victim_name: str

    @property
    def killer_type(self) -> str:
        return str(self.killer.get("unit_type", "")).strip().lower()

    @property
    def victim_type(self) -> str:
        return str(self.victim.get("unit_type", "")).strip().lower()


def _read_kill(
    event: BattleEvent, participants_by_warband_id: dict[int, BattleParticipant], names_by_key: dict[str, str]
) -> _Kill | None:
    """The kill, or None when its payload is malformed or its killer's warband isn't in the battle."""
    payload = event.payload_json if isinstance(event.payload_json, dict) else {}
    killer = payload.get("killer", {})
    victim = payload.get("victim", {})
    if not isinstance(killer, dict) or not isinstance(victim, dict):
        return None
    raw_killer_warband_id = killer.get("warband_id")
    if not isinstance(raw_killer_warband_id, int | float | str):
        return None
    try:
        participant = participants_by_warband_id.get(int(raw_killer_warband_id))
    except ValueError:
        return None
    if not participant:
        return None
    killer_key = str(killer.get("unit_key", "")).strip() or None
    victim_key = str(victim.get("unit_key", "")).strip() or None
    return _Kill(
        event_id=event.id,
        warband_id=participant.warband_id,
        killer=killer,
        victim=victim,
        killer_key=killer_key,
        killer_name=str(killer.get("name", "")).strip() or names_by_key.get(killer_key or "", "Unknown unit"),
        victim_name=str(victim.get("name", "")).strip() or names_by_key.get(victim_key or "", "Unknown unit"),
    )


def _kill_moments(kill: _Kill) -> list[tuple[str, str]]:
    """The (kind, detail) of each moment the kill makes, in order (a leader slaying a leader: see the caller)."""
    moments = []
    if kill.killer_type == "henchman" and kill.victim_type == "hero":
        moments.append(("hero_slayer", f"{kill.killer_name} took {kill.victim_name} out of action."))
    caster_type = str(kill.victim.get("caster_type", "")).strip()
    if kill.victim.get("is_caster") is True and caster_type in {"Wizard", "Priest"}:
        moments.append(("no_fairies", f"{kill.killer_name} brought down caster {kill.victim_name}."))
    if kill.killer_type in {"hero", "henchman", "hired_sword"} and kill.victim.get("is_large") is True:
        moments.append(("giant_slayer", f"{kill.killer_name} slew large target {kill.victim_name}."))
    if kill.killer.get("is_leader") is True and kill.victim.get("is_leader") is True:
        moments.append(("there_can_be_only_one", f"{kill.killer_name} slew the enemy leader {kill.victim_name}."))
    return moments


def _generate_event_driven_moments(
    battle: Battle,
    participants_by_warband_id: dict[int, BattleParticipant],
    names_by_key: dict[str, str],
    rows: list[PivotalMoment],
    kill_events: list[BattleEvent],
) -> None:
    for event in kill_events:
        kill = _read_kill(event, participants_by_warband_id, names_by_key)
        if kill is None:
            continue
        for kind, detail in _kill_moments(kill):
            if kind == "there_can_be_only_one" and any(
                row.kind == kind and row.warband_id == kill.warband_id for row in rows
            ):
                continue  # once per warband
            _append_moment(
                rows,
                battle,
                kill.warband_id,
                kind,
                detail,
                unit_key=kill.killer_key,
                unit_name=kill.killer_name,
                source_event_id=kill.event_id,
            )


# Warband moments


def _unit_moments(
    battle: Battle, participant: BattleParticipant, unit_results: dict[str, dict], kills: dict, rows: list
) -> None:
    """Carried the Fight and Bloody Martyr, for each roster unit of the participant."""
    total_kills = sum(kills.get(unit_key, 0) for unit_key in unit_results)
    for unit_key, result in unit_results.items():
        if unit_key.startswith(UNRECORDED_UNIT_PREFIXES):
            continue
        unit_name = str(result.get("unit_name", "")).strip() or unit_key
        kill_count = kills.get(unit_key, 0)
        moments = []
        if kill_count >= 2 and total_kills > 0 and kill_count * 2 >= total_kills:
            moments.append(("carried_the_fight", f"{unit_name} scored {kill_count} of {total_kills} recorded kills."))
        if kill_count >= 2 and bool(result.get("dead", False)):
            moments.append(("bloody_martyr", f"{unit_name} claimed {kill_count} kills before dying."))
        for kind, detail in moments:
            _append_moment(rows, battle, participant.warband_id, kind, detail, unit_key=unit_key, unit_name=unit_name)


def _outcome_moment(participant: BattleParticipant, won: bool) -> tuple[str, str] | None:
    """Untouched Triumph or Pyrrhic Victory for a winner, Wiped Out for anyone else, from his out-of-action count."""
    selected_count, ooa_count = _selected_ooa_count(participant)
    name = participant.warband.name
    if selected_count == 0:
        return None
    if won and ooa_count == 0:
        return "untouched_triumph", f"{name} won without a single selected unit going out of action."
    if won and ooa_count > selected_count / 2:
        detail = f"{name} won despite {ooa_count} of {selected_count} selected units going out of action."
        return "pyrrhic_victory", detail
    if not won and ooa_count * 4 >= selected_count * 3:
        return "wiped_out", f"{name} lost {ooa_count} of {selected_count} selected units."
    return None


def _permanent_deaths(unit_results: dict[str, dict]) -> int:
    return sum(
        1
        for unit_key, result in unit_results.items()
        if bool(result.get("dead", False)) and not unit_key.startswith(UNRECORDED_UNIT_PREFIXES)
    )


def _generate_warband_moments(
    battle: Battle,
    participants: list[BattleParticipant],
    rows: list[PivotalMoment],
    kill_events: list[BattleEvent],
) -> None:
    winner_ids = set(battle.winner_warband_ids_json or [])
    kills = count_kills(event.payload_json for event in kill_events)  # as finalise counts them (decision 5, BUG-11)
    for participant in participants:
        unit_results = _normalize_unit_results(participant)
        _unit_moments(battle, participant, unit_results, kills, rows)
        outcome = _outcome_moment(participant, participant.warband_id in winner_ids)
        if outcome:
            _append_moment(rows, battle, participant.warband_id, *outcome)
        permanent_deaths = _permanent_deaths(unit_results)
        if permanent_deaths >= 3:
            detail = f"{participant.warband.name} suffered {permanent_deaths} permanent deaths."
            _append_moment(rows, battle, participant.warband_id, "black_day", detail)


def generate_pivotal_moments_for_battle(battle: Battle) -> None:
    if battle.flow_type != Battle.FLOW_TYPE_NORMAL or battle.status != Battle.STATUS_ENDED:
        return
    if PivotalMoment.objects.filter(battle_id=battle.id).exists():
        return

    participants = list(
        BattleParticipant.objects.select_related("warband")
        .filter(battle_id=battle.id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .order_by("id")
    )
    if not participants:
        return

    rows: list[PivotalMoment] = []
    participants_by_warband_id = {participant.warband_id: participant for participant in participants}
    names_by_key = _build_unit_names_by_key(participants)

    kill_events = list(live_kill_events(battle.id).order_by("id"))  # undone kills don't count (decision 5)
    _generate_event_driven_moments(battle, participants_by_warband_id, names_by_key, rows, kill_events)
    _generate_warband_moments(battle, participants, rows, kill_events)

    if rows:
        PivotalMoment.objects.bulk_create(rows)
