"""A campaign's list of scenarios (William, 24 Nov 2026): the scenarios it plays, each at a weight.

The rows are the whole list. Ticking a setting adds that setting's scenarios at their weights, skipping any already
listed, and unticking one removes nothing: the list is the campaign's from then on, so a scenario a manager took
off stays off until a setting that adds it is ticked again. Every write bumps the campaign's scenarios
(`catalogue.changed` {kind: scenarios}), so the other members' open pages read the list again.
"""

from collections.abc import Iterable
from decimal import Decimal

from django.db.models import QuerySet

from apps.core.catalogue.cache import bump

from ..models import CampaignScenario, SettingScenario

KIND = "scenarios"  # the `catalogue.changed` kind of the scenarios and the campaign's list of them


def campaign_rows(campaign_id: int) -> QuerySet[CampaignScenario]:
    """The campaign's list with each row's scenario, by name (one query)."""
    return (
        CampaignScenario.objects.filter(campaign_id=campaign_id)
        .select_related("scenario")
        .order_by("scenario__name", "id")
    )


def add_setting_scenarios(campaign_id: int, setting_ids: Iterable[int], socket_id: str | None = None) -> int:
    """The scenarios of the settings just ticked join the campaign's list at their settings' weights, any already
    listed left as they are (a scenario two settings add takes the higher weight); how many joined (two queries, none
    for no settings)."""
    ids = list(setting_ids)
    if not ids:
        return 0
    weights: dict[int, Decimal] = {}
    for scenario_id, weight in SettingScenario.objects.filter(setting_id__in=ids).values_list("scenario_id", "weight"):
        weights[scenario_id] = max(weight, weights.get(scenario_id, weight))
    if not weights:
        return 0
    made = CampaignScenario.objects.bulk_create(
        [CampaignScenario(campaign_id=campaign_id, scenario_id=pk, weight=weight) for pk, weight in weights.items()],
        ignore_conflicts=True,  # already listed: left as it is
    )
    bump(campaign_id, KIND, socket_id=socket_id)
    return len(made)


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
