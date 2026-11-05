"""What the warband types a template serves can usually buy (the templates plan, phase 4: the Lists' Add an item), as
the store's who-can reads it for a warband (warbands/services/offers.py): any item can go on a list, and one they
can't usually buy shows the reason ("Not usually available to Night Watch.")."""

from typing import Any

from apps.warbands.models import WarbandType
from apps.warbands.services.offers import item_offers
from apps.warbands.services.types import with_group_names
from apps.warbands.services.who_can import Buyer

from ..models import WarbandTemplate


def template_offers(template: WarbandTemplate, campaign_id: int) -> dict[str, Any]:
    """`{items: [{item_id, availability_id, options, can_buy, reason}]}` for a buyer of the template's types and their
    groups (one query for them, then the items' three)."""
    types = list(with_group_names(WarbandType.objects.filter(template_links__template=template)))
    groups = {group for row in types for group in getattr(row, "group_ids", None) or []}
    buyer = Buyer(frozenset(row.pk for row in types), frozenset(groups), template.name)
    return {"items": item_offers(campaign_id, buyer)}
