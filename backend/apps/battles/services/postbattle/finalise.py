"""Finalise: a player's checked postbattle draft applied to his warband (decision 3: wins and losses wait for the
battle's end).

Applied in this order: the units' results, exploration, upkeep, finds and their reward, the single-use items used in
battle, then the logs. The warnings say which units were left out (BUG-73) and what was unusual (decision 9).
"""

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import Warband

from ...models import Battle, BattleParticipant
from ...validation.config import normalize_unit_information
from ..unusual import unusual_value_warnings
from ..warnings import Warning
from .items import consume_single_use_items
from .logs import write_battle_logs
from .rewards import apply_exploration, apply_finds, apply_upkeep
from .units import UnitResults


def apply_postbattle(battle: Battle, participant: BattleParticipant, draft: dict) -> list[Warning]:
    """Apply a participant's draft, which the caller validated once (services/postbattle/validate.py)."""
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
