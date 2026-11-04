"""What the templates' list rows read, each in one query whatever the number of rows (query budgets)."""

from typing import Any

from django.db.models import Prefetch, QuerySet

from apps.campaigns.in_play import with_in_play

from .models import WarbandTemplate, WarbandTemplateType


def type_links(campaign_id: int | None = None) -> Prefetch:
    """Each template's warband types with their setting, and, in a campaign, whether each type is in play there."""
    links = WarbandTemplateType.objects.select_related("warband_type").order_by("warband_type__name", "id")
    if campaign_id is not None:
        links = with_in_play(links, campaign_id, setting="warband_type__campaign_type")
    return Prefetch("type_links", queryset=links)


def template_rows(rows: QuerySet[WarbandTemplate] | None = None, campaign_id: int | None = None) -> QuerySet[Any]:
    """The templates with their warband types (one more query)."""
    found = WarbandTemplate.objects.all() if rows is None else rows
    return found.prefetch_related(type_links(campaign_id))
