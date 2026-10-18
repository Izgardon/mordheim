"""A player's postbattle: the draft he saves, and finalise, which applies it to his warband (decision 3: wins and
losses wait for the battle's end).

Finalise runs in two transactions (PERF-36), so the battle row is locked only for the last step:

1. `apply_player_postbattle`, under the player's own participant lock: the draft is checked once against the rows
   it touches (read and locked once: services/postbattle/context.py), then his units' results, exploration, upkeep
   and finds, the single-use items used in battle and the logs are written, and his status becomes
   confirmed_postbattle. That status is the idempotency guard: a repeat waits for the lock, then finds it.
2. `confirm_postbattle`, under the battle lock: his confirmation event, and the battle's end when everyone still in
   it has finished (the last player to confirm always sees everyone else's committed status).

Neither waits for the battle row while it holds a player's rows, so nothing can deadlock with writes that lock the
battle first (services/locks.py).
"""

from dataclasses import dataclass

from django.utils import timezone

from ...models import Battle, BattleEvent, BattleParticipant
from ...serializers import snapshot_participants
from ...validation.config import normalize_unit_information
from ...validation.postbattle import normalize_postbattle
from ..broadcast import bump_state_version
from ..events import append_event
from ..exploration import keep_exploration
from ..lifecycle import all_finished, end_battle
from ..locks import lock_battle
from ..unusual import unusual_value_warnings
from ..warnings import Warning
from .context import FinaliseContext, load_context
from .items import consume_single_use_items
from .logs import write_battle_logs
from .rewards import apply_exploration, apply_upkeep_and_finds
from .units import UnitResults
from .validate import check_draft, validate_postbattle


def _keep_exploration(participant: BattleParticipant, draft: dict) -> list[Warning]:
    """The draft keeps the exploration roll with the server's amount (decision 9, BUG-71); a re-roll warns."""
    stored_exploration = (participant.postbattle_json or {}).get("exploration")
    draft["exploration"], warnings = keep_exploration(stored_exploration, draft["exploration"])
    return warnings


def save_draft(battle: Battle, participant: BattleParticipant, raw_draft: object) -> list[Warning]:
    """Save the player's draft: it logs nothing (finalise logs each unit's injury once, decision 7, BUG-47) and
    answers the unusual values it will log (decision 9)."""
    draft = validate_postbattle(battle, participant, raw_draft)
    warnings = _keep_exploration(participant, draft)
    warnings += unusual_value_warnings(draft)
    participant.postbattle_json = draft
    participant.save(update_fields=["postbattle_json", "updated_at"])
    return warnings


def check_draft_against(context: FinaliseContext, draft: dict) -> None:
    """The draft save's checks, made against the rows finalise holds (the specials still read their own): the gap
    between finalise's reads and its writes."""
    settings = context.settings
    check_draft(
        draft,
        context.participant,
        context.battle.campaign_id,
        (settings.hero_death_roll if settings else None) or "d66",
        resource_found=lambda resource_id: context.resource_found,
        hired_sword_ids=lambda ids: {sword_id for sword_id in ids if sword_id in context.hired_swords},
    )


def _apply(context: FinaliseContext, draft: dict) -> list[Warning]:
    unit_information = normalize_unit_information(context.participant.unit_information_json)
    units = UnitResults(context, unit_information).apply(draft["unit_results"])
    explored = apply_exploration(context, draft["exploration"])
    finds = apply_upkeep_and_finds(
        context, draft.get("upkeep", {}), draft.get("finds", {"gold_crowns": 0, "items": []})
    )
    consume_single_use_items(context.battle, context.participant, context.item_uses)
    unusual = unusual_value_warnings(draft)
    write_battle_logs(context.battle, context.participant, draft["exploration"], explored, finds, units, unusual)
    return units.warnings + unusual


def apply_player_postbattle(battle: Battle, participant: BattleParticipant, raw_draft: object) -> list[Warning]:
    """Apply the player's postbattle and mark it finished, holding only his rows (ValueError for a draft that can't
    be applied, raised inside the transaction so nothing is kept: BUG-124). Returns the warnings."""
    draft = normalize_postbattle(raw_draft)
    context = load_context(battle, participant, draft)
    check_draft_against(context, draft)
    warnings = _keep_exploration(participant, draft)
    warnings += _apply(context, draft)
    participant.postbattle_json = draft
    participant.status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
    participant.confirmed_at = timezone.now()
    participant.save(update_fields=["postbattle_json", "status", "confirmed_at", "updated_at"])
    return warnings


@dataclass
class Confirmed:
    battle: Battle
    participants: list[BattleParticipant]  # read under the battle lock, as the answer's snapshot shows them
    events: list[dict]
    version: int


def confirm_postbattle(battle_id: int, participant: BattleParticipant, actor_user) -> Confirmed:
    """Under the battle lock: the player's confirmation, and the battle's end if he was the last one in it."""
    battle = lock_battle(battle_id)
    participants = list(snapshot_participants().filter(battle_id=battle_id))
    payload = {"participant_user_id": actor_user.id}
    event_type = BattleEvent.TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE
    events = [append_event(battle, event_type, actor_user=actor_user, payload=payload)]
    if battle.status != Battle.STATUS_ENDED and all_finished(participants):
        end_battle(battle, actor_user, events, participants)
    return Confirmed(battle, participants, events, bump_state_version(battle))
