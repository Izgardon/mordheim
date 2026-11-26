"""What the templates' list rows and the whole template read, each in one query whatever the number of rows (query
budgets)."""

from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import OuterRef, Prefetch, QuerySet
from django.db.models.functions import JSONObject

from apps.campaigns.in_play import InPlayScope, with_in_play

from .models import (
    TemplateFighter,
    TemplateFighterList,
    TemplateFighterSkill,
    TemplateFighterSpecial,
    TemplateFighterSpell,
    TemplateList,
    TemplateListItem,
    TemplateRule,
    TemplateUpgrade,
    WarbandTemplate,
    WarbandTemplateType,
)

START_SPELL_COLUMNS = ("id", "name", "type", "dc", "description", "is_prayer")


def with_start_spells(fighters: QuerySet[TemplateFighter]) -> QuerySet[TemplateFighter]:
    """The fighters with the spells each starts with read in the same query (`start_spells`, in order: their ids,
    names, lores, difficulties, rules and whether each is a prayer)."""
    links = TemplateFighterSpell.objects.filter(fighter_id=OuterRef("pk")).order_by("position", "id")
    columns = {column: f"spell__{column}" for column in START_SPELL_COLUMNS}
    return fighters.annotate(start_spells=ArraySubquery(links.values(entry=JSONObject(**columns))))


def type_links(scope: InPlayScope | None = None) -> Prefetch:
    """Each template's warband types with their setting, and, in a campaign (or for `Ticked` settings), whether each
    type is in play there."""
    links = WarbandTemplateType.objects.select_related("warband_type").order_by("warband_type__name", "id")
    if scope is not None:
        links = with_in_play(links, scope, setting="warband_type__campaign_type")
    return Prefetch("type_links", queryset=links)


def template_rows(rows: QuerySet[WarbandTemplate] | None = None, scope: InPlayScope | None = None) -> QuerySet[Any]:
    """The templates with their warband types (one more query)."""
    found = WarbandTemplate.objects.all() if rows is None else rows
    return found.prefetch_related(type_links(scope))


def template_contents(rows: QuerySet[WarbandTemplate]) -> QuerySet[Any]:
    """The listed templates with what Search everything finds them by (`?view=search`): their rules, fighters with
    their rules and the skills they start with, and upgrades with their specials (one query each)."""
    fighters = TemplateFighter.objects.prefetch_related(
        Prefetch("special_links", queryset=TemplateFighterSpecial.objects.select_related("special")),
        Prefetch("skill_links", queryset=TemplateFighterSkill.objects.select_related("skill")),
    )
    return rows.prefetch_related(
        "rules",
        Prefetch("fighters", queryset=fighters),
        Prefetch("upgrades", queryset=TemplateUpgrade.objects.select_related("special")),
    )


def template_details(rows: QuerySet[WarbandTemplate]) -> QuerySet[Any]:
    """The templates with everything the whole template shows: its types, rules, lists with their lines' items,
    fighters with their races, lists, rules and starting skills and spells, and upgrades with their specials (one query
    each)."""
    lines = TemplateListItem.objects.select_related("item")
    fighters = with_start_spells(TemplateFighter.objects.select_related("race")).prefetch_related(
        Prefetch("special_links", queryset=TemplateFighterSpecial.objects.select_related("special")),
        Prefetch("skill_links", queryset=TemplateFighterSkill.objects.select_related("skill")),
        Prefetch("list_links", queryset=TemplateFighterList.objects.select_related("equipment_list")),
    )
    return rows.prefetch_related(
        type_links(),
        Prefetch("rules", queryset=TemplateRule.objects.select_related("warband_type")),
        Prefetch("lists", queryset=TemplateList.objects.prefetch_related(Prefetch("lines", queryset=lines))),
        Prefetch("fighters", queryset=fighters),
        Prefetch("upgrades", queryset=TemplateUpgrade.objects.select_related("special")),
    )
