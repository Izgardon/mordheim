"""A player's postbattle: the draft he saves, and finalise, which applies it to his warband (decision 3: wins and
losses wait for the battle's end).

Finalise applies, in this order: the units' results, exploration, upkeep, finds and their reward, the single-use
items used in battle, then the logs; the battle ends when he was the last one still in postbattle. The warnings
say which units were left out (BUG-73) and what was unusual (decision 9).
"""

from django.utils import timezone

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import Warband

from ...models import Battle, BattleEvent, BattleParticipant
from ...validation.config import normalize_unit_information
from ..events import append_event
from ..exploration import keep_exploration
from ..lifecycle import end_if_everyone_finished
from ..unusual import unusual_value_warnings
from ..warnings import Warning
from .items import consume_single_use_items
from .logs import write_battle_logs
from .rewards import apply_exploration, apply_finds, apply_upkeep
from .units import UnitResults
from .validate import validate_postbattle


def _checked_draft(battle: Battle, participant: BattleParticipant, raw_draft: object) -> tuple[dict, list[Warning]]:
    """The draft validated once (part of PERF-36), keeping the exploration roll with the server's amount (decision
    9, BUG-71); a re-roll comes back as a warning."""
    draft = validate_postbattle(battle, participant, raw_draft)
    stored_exploration = (participant.postbattle_json or {}).get("exploration")
    draft["exploration"], warnings = keep_exploration(stored_exploration, draft["exploration"])
    return draft, warnings


def save_draft(battle: Battle, participant: BattleParticipant, raw_draft: object) -> list[Warning]:
    """Save the player's draft: it logs nothing (finalise logs each unit's injury once, decision 7, BUG-47) and
    answers the unusual values it will log (decision 9)."""
    draft, warnings = _checked_draft(battle, participant, raw_draft)
    warnings += unusual_value_warnings(draft)
    participant.postbattle_json = draft
    participant.save(update_fields=["postbattle_json", "updated_at"])
    return warnings


def apply_postbattle(battle: Battle, participant: BattleParticipant, draft: dict) -> list[Warning]:
    """Apply a participant's checked draft to his warband."""
    unit_information = normalize_unit_information(participant.unit_information_json)
    warband = Warband.objects.select_for_update().get(id=participant.warband_id)
    settings = CampaignSettings.objects.filter(campaign_id=battle.campaign_id).first()
    units = UnitResults(battle, participant, settings).apply(draft["unit_results"], unit_information)
    explored = apply_exploration(warband, draft["exploration"])
    apply_upkeep(warband, draft.get("upkeep", {}))
    finds = apply_finds(warband, battle, draft.get("finds", {"gold_crowns": 0, "items": []}))
    consume_single_use_items(battle, participant)
    unusual = unusual_value_warnings(draft)
    write_battle_logs(battle, participant, draft["exploration"], explored, finds, units, unusual)
    return units.warnings + unusual


def finalise_postbattle(
    battle: Battle, participant: BattleParticipant, raw_draft: object, actor_user
) -> tuple[list[dict], list[Warning]]:
    """Apply the player's postbattle and mark it finished (ValueError for a draft that can't be applied: raised
    inside the transaction, so nothing is kept, BUG-124). Returns the events and the warnings."""
    draft, warnings = _checked_draft(battle, participant, raw_draft)
    warnings += apply_postbattle(battle, participant, draft)
    participant.postbattle_json = draft
    participant.status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
    participant.confirmed_at = timezone.now()
    participant.save(update_fields=["postbattle_json", "status", "confirmed_at", "updated_at"])
    payload = {"participant_user_id": actor_user.id}
    events = [
        append_event(battle, BattleEvent.TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE, actor_user=actor_user, payload=payload)
    ]
    end_if_everyone_finished(battle, actor_user, events)
    return events, warnings
