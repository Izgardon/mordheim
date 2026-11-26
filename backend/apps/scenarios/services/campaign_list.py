"""A campaign's list of scenarios (William, 24 Nov 2026): the scenarios it plays, each at a weight.

The rows are the whole list. Its preset builds it and a new preset swaps it (apps/campaign_presets/services/
preset_lists.py); the settings ticked never touch it, so a scenario a manager took off stays off. Every write bumps
the campaign's scenarios (`catalogue.changed` {kind: scenarios}), so the other members' open pages read the list
again.
"""

from decimal import Decimal

from django.db.models import QuerySet

from apps.core.catalogue.cache import bump

from ..models import CampaignScenario

KIND = "scenarios"  # the `catalogue.changed` kind of the scenarios and the campaign's list of them


def campaign_rows(campaign_id: int) -> QuerySet[CampaignScenario]:
    """The campaign's list with each row's scenario, by name (one query)."""
    return (
        CampaignScenario.objects.filter(campaign_id=campaign_id)
        .select_related("scenario")
        .order_by("scenario__name", "id")
    )


def add_scenario(campaign_id: int, scenario_id: int, weight: Decimal, socket_id: str | None = None) -> CampaignScenario:
    """The scenario joins the list at `weight`; one already listed keeps its row and takes the weight."""
    row, _ = CampaignScenario.objects.update_or_create(
        campaign_id=campaign_id, scenario_id=scenario_id, defaults={"weight": weight}
    )
    bump(campaign_id, KIND, socket_id=socket_id)
    return row


def set_weight(row: CampaignScenario, weight: Decimal, socket_id: str | None = None) -> None:
    CampaignScenario.objects.filter(pk=row.pk).update(weight=weight)
    row.weight = weight
    bump(row.campaign_id, KIND, socket_id=socket_id)


def remove(row: CampaignScenario, socket_id: str | None = None) -> None:
    """Off the list; the scenario stays in the catalogue, and battles played as it keep it."""
    row.delete()
    bump(row.campaign_id, KIND, socket_id=socket_id)
