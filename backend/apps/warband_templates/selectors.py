"""What the templates' list rows and the whole template read, each in one query whatever the number of rows (query
budgets)."""

from typing import Any

from django.db.models import Prefetch, QuerySet

from apps.campaigns.in_play import with_in_play

from .models import (
    TemplateFighter,
    TemplateFighterList,
    TemplateFighterSpecial,
    TemplateList,
    TemplateListItem,
    TemplateRule,
    TemplateUpgrade,
    WarbandTemplate,
    WarbandTemplateType,
)


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


def template_details(rows: QuerySet[WarbandTemplate]) -> QuerySet[Any]:
    """The templates with everything the whole template shows: its types, rules, lists with their lines' items,
    fighters with their races, lists and rules, and upgrades with their specials (one query each)."""
    lines = TemplateListItem.objects.select_related("item")
    fighters = TemplateFighter.objects.select_related("race").prefetch_related(
        Prefetch("special_links", queryset=TemplateFighterSpecial.objects.select_related("special")),
        Prefetch("list_links", queryset=TemplateFighterList.objects.select_related("equipment_list")),
    )
    return rows.prefetch_related(
        type_links(),
        Prefetch("rules", queryset=TemplateRule.objects.select_related("warband_type")),
        Prefetch("lists", queryset=TemplateList.objects.prefetch_related(Prefetch("lines", queryset=lines))),
        Prefetch("fighters", queryset=fighters),
        Prefetch("upgrades", queryset=TemplateUpgrade.objects.select_related("special")),
    )
