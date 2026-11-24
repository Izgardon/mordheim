"""The campaign scenario a new battle is played as (apps/scenarios), when the player picked one: its id, read as the
campaign's current entry for it. The battle keeps the scenario's name as well (`scenario`), so a battle typed by hand
needs none, and one whose scenario later goes keeps its name."""

from typing import Any

from apps.core.catalogue.current import current_rows
from apps.scenarios.models import Scenario

from .errors import Refused


def picked_scenario(raw: Any, campaign_id: int) -> Scenario | None:
    """The scenario `scenario_id` names (none sent: None); an id the campaign can't use is refused (one query)."""
    if raw in (None, ""):
        return None
    if isinstance(raw, bool):
        raise Refused("scenario_id must be an integer")
    try:
        pk = int(raw)
    except (TypeError, ValueError):
        raise Refused("scenario_id must be an integer") from None
    found = current_rows(Scenario.objects.only("id", "name", "campaign_id", "replaces_id"), [pk], campaign_id)
    if pk not in found:
        raise Refused("Unknown scenario")
    scenario: Scenario = found[pk]
    return scenario
