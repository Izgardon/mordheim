from apps.battles.models import Battle, BattleEvent, BattleParticipant

from .models import PivotalMoment

EVENT_DRIVEN_MOMENT_KINDS = {
    "hero_slayer": "Hero Slayer",
    "no_fairies": "I don't believe in fairies",
    "giant_slayer": "Giant Slayer",
}

WARBAND_MOMENT_KINDS = {
    "carried_the_fight": "Carried the Fight",
    "bloody_martyr": "Bloody Martyr",
    "untouched_triumph": "Untouched Triumph",
    "pyrrhic_victory": "Pyrrhic Victory",
    "wiped_out": "Wiped Out",
    "black_day": "Black Day",
}


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
    selected_unit_keys = participant.selected_unit_keys_json if isinstance(participant.selected_unit_keys_json, list) else []
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
    *,
    battle: Battle,
    participant: BattleParticipant | None,
    warband_id: int,
    kind: str,
    headline: str,
    detail: str,
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
            headline=headline,
            detail=detail,
            unit_key=unit_key,
            unit_name=unit_name,
            battle_ended_at=battle.ended_at or battle.created_at,
        )
    )


def _generate_event_driven_moments(
    battle: Battle,
    participants_by_warband_id: dict[int, BattleParticipant],
    names_by_key: dict[str, str],
    rows: list[PivotalMoment],
) -> None:
    kill_events = BattleEvent.objects.filter(
        battle_id=battle.id,
        type=BattleEvent.TYPE_UNIT_KILL_RECORDED,
    ).order_by("id")

    for event in kill_events:
        payload = event.payload_json if isinstance(event.payload_json, dict) else {}
        killer = payload.get("killer", {})
        victim = payload.get("victim", {})
        if not isinstance(killer, dict) or not isinstance(victim, dict):
            continue

        killer_warband_id = killer.get("warband_id")
        try:
            killer_warband_id = int(killer_warband_id)
        except (TypeError, ValueError):
            continue

        participant = participants_by_warband_id.get(killer_warband_id)
        if not participant:
            continue

        killer_unit_type = str(killer.get("unit_type", "")).strip().lower()
        victim_unit_type = str(victim.get("unit_type", "")).strip().lower()
        killer_unit_key = str(killer.get("unit_key", "")).strip() or None
        victim_unit_key = str(victim.get("unit_key", "")).strip() or None
        killer_name = str(killer.get("name", "")).strip() or names_by_key.get(killer_unit_key or "", "Unknown unit")
        victim_name = str(victim.get("name", "")).strip() or names_by_key.get(victim_unit_key or "", "Unknown unit")

        if killer_unit_type == "henchman" and victim_unit_type == "hero":
            _append_moment(
                rows,
                battle=battle,
                participant=participant,
                warband_id=participant.warband_id,
                kind="hero_slayer",
                headline=EVENT_DRIVEN_MOMENT_KINDS["hero_slayer"],
                detail=f"{killer_name} took {victim_name} out of action.",
                unit_key=killer_unit_key,
                unit_name=killer_name,
                source_event_id=event.id,
            )

        victim_is_caster = victim.get("is_caster")
        victim_caster_type = str(victim.get("caster_type", "")).strip()
        if victim_is_caster is True and victim_caster_type in {"Wizard", "Priest"}:
            _append_moment(
                rows,
                battle=battle,
                participant=participant,
                warband_id=participant.warband_id,
                kind="no_fairies",
                headline=EVENT_DRIVEN_MOMENT_KINDS["no_fairies"],
                detail=f"{killer_name} brought down caster {victim_name}.",
                unit_key=killer_unit_key,
                unit_name=killer_name,
                source_event_id=event.id,
            )

        victim_is_large = victim.get("is_large")
        if killer_unit_type in {"hero", "henchman", "hired_sword"} and victim_is_large is True:
            _append_moment(
                rows,
                battle=battle,
                participant=participant,
                warband_id=participant.warband_id,
                kind="giant_slayer",
                headline=EVENT_DRIVEN_MOMENT_KINDS["giant_slayer"],
                detail=f"{killer_name} slew large target {victim_name}.",
                unit_key=killer_unit_key,
                unit_name=killer_name,
                source_event_id=event.id,
            )


def _generate_warband_moments(
    battle: Battle,
    participants: list[BattleParticipant],
    rows: list[PivotalMoment],
) -> None:
    winner_ids = set(battle.winner_warband_ids_json or [])

    for participant in participants:
        unit_results = _normalize_unit_results(participant)
        total_kills = 0
        permanent_deaths = 0

        for unit_key, result in unit_results.items():
            kill_count = int(result.get("kill_count", 0) or 0)
            total_kills += max(0, kill_count)
            if (
                bool(result.get("dead", False))
                and not unit_key.startswith("custom:")
                and not unit_key.startswith("bestiary:")
            ):
                permanent_deaths += 1

        for unit_key, result in unit_results.items():
            if unit_key.startswith("custom:") or unit_key.startswith("bestiary:"):
                continue

            unit_name = str(result.get("unit_name", "")).strip() or unit_key
            kill_count = max(0, int(result.get("kill_count", 0) or 0))
            dead = bool(result.get("dead", False))

            if kill_count >= 2 and total_kills > 0 and kill_count * 2 >= total_kills:
                _append_moment(
                    rows,
                    battle=battle,
                    participant=participant,
                    warband_id=participant.warband_id,
                    kind="carried_the_fight",
                    headline=WARBAND_MOMENT_KINDS["carried_the_fight"],
                    detail=f"{unit_name} scored {kill_count} of {total_kills} recorded kills.",
                    unit_key=unit_key,
                    unit_name=unit_name,
                )

            if kill_count >= 2 and dead:
                _append_moment(
                    rows,
                    battle=battle,
                    participant=participant,
                    warband_id=participant.warband_id,
                    kind="bloody_martyr",
                    headline=WARBAND_MOMENT_KINDS["bloody_martyr"],
                    detail=f"{unit_name} claimed {kill_count} kills before dying.",
                    unit_key=unit_key,
                    unit_name=unit_name,
                )

        selected_count, ooa_count = _selected_ooa_count(participant)
        if participant.warband_id in winner_ids:
            if selected_count > 0 and ooa_count == 0:
                _append_moment(
                    rows,
                    battle=battle,
                    participant=participant,
                    warband_id=participant.warband_id,
                    kind="untouched_triumph",
                    headline=WARBAND_MOMENT_KINDS["untouched_triumph"],
                    detail=f"{participant.warband.name} won without a single selected unit going out of action.",
                )
            elif selected_count > 0 and ooa_count > selected_count / 2:
                _append_moment(
                    rows,
                    battle=battle,
                    participant=participant,
                    warband_id=participant.warband_id,
                    kind="pyrrhic_victory",
                    headline=WARBAND_MOMENT_KINDS["pyrrhic_victory"],
                    detail=f"{participant.warband.name} won despite {ooa_count} of {selected_count} selected units going out of action.",
                )
        elif selected_count > 0 and ooa_count * 4 >= selected_count * 3:
            _append_moment(
                rows,
                battle=battle,
                participant=participant,
                warband_id=participant.warband_id,
                kind="wiped_out",
                headline=WARBAND_MOMENT_KINDS["wiped_out"],
                detail=f"{participant.warband.name} lost {ooa_count} of {selected_count} selected units.",
            )

        if permanent_deaths >= 3:
            _append_moment(
                rows,
                battle=battle,
                participant=participant,
                warband_id=participant.warband_id,
                kind="black_day",
                headline=WARBAND_MOMENT_KINDS["black_day"],
                detail=f"{participant.warband.name} suffered {permanent_deaths} permanent deaths.",
            )


def generate_pivotal_moments_for_battle(battle: Battle) -> None:
    if battle.flow_type != Battle.FLOW_TYPE_NORMAL or battle.status != Battle.STATUS_ENDED:
        return
    if PivotalMoment.objects.filter(battle_id=battle.id).exists():
        return

    participants = list(
        BattleParticipant.objects.select_related("warband")
        .filter(battle_id=battle.id)
        .exclude(status=BattleParticipant.STATUS_CANCELED_PREBATTLE)
        .order_by("id")
    )
    if not participants:
        return

    rows: list[PivotalMoment] = []
    participants_by_warband_id = {participant.warband_id: participant for participant in participants}
    names_by_key = _build_unit_names_by_key(participants)

    _generate_event_driven_moments(battle, participants_by_warband_id, names_by_key, rows)
    _generate_warband_moments(battle, participants, rows)

    if rows:
        PivotalMoment.objects.bulk_create(rows)
