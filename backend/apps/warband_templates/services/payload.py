"""The warband's template as its hire screens read it (`GET warbands/<id>/template/`), and a warband type's template in
outline for the raise screen (`GET campaigns/<id>/warband-types/<type>/template/`), each in a fixed number of
queries whatever the template's size or the roster's."""

from typing import Any

from django.db.models import Prefetch, QuerySet

from apps.warbands.models import Warband

from ..hire_serializers import WarbandTemplateHireSerializer
from ..models import (
    TemplateFighter,
    TemplateFighterList,
    TemplateFighterSpecial,
    TemplateList,
    TemplateListItem,
    WarbandTemplate,
)
from .holdings import fighter_holdings, held_items
from .list_prices import list_prices_open
from .resolve import apply_variant, templates_for_type, variant_keys, variant_rules, warband_variant


def hire_details(rows: QuerySet[WarbandTemplate]) -> QuerySet[WarbandTemplate]:
    """The templates with what the hire screens show: rules, lists with their lines' items, and fighters with their
    races, rules and lists (one query each)."""
    lines = TemplateListItem.objects.select_related("item")
    fighters = TemplateFighter.objects.select_related("race").prefetch_related(
        Prefetch("special_links", queryset=TemplateFighterSpecial.objects.select_related("special")),
        Prefetch("list_links", queryset=TemplateFighterList.objects.select_related("equipment_list")),
    )
    return rows.prefetch_related(
        "rules",
        Prefetch("lists", queryset=TemplateList.objects.prefetch_related(Prefetch("lines", queryset=lines))),
        Prefetch("fighters", queryset=fighters),
    )


def _missing_rules(warband: Warband, template: WarbandTemplate, variant: str) -> int:
    """How many of the variant's rules the warband has no rule of that title for (one query)."""
    have = {title.strip().lower() for title in warband.rules.values_list("title", flat=True)}
    return sum(1 for rule in variant_rules(template.rules.all(), variant) if rule.title.strip().lower() not in have)


def warband_template(warband: Warband) -> dict[str, Any]:
    """The warband's template with its variant applied, and whether list prices are still open (twelve queries with
    a template, two without)."""
    open_now = list_prices_open(warband.id)
    template = hire_details(templates_for_type(warband.campaign_id, warband.warband_type_id)).first()
    if template is None:
        return {"template": None, "variant": warband.template_variant, "list_prices_open": open_now}
    variant = warband_variant(warband, template)
    lists = {row.pk: row for row in template.lists.all()}
    limited = {line.item_id for row in lists.values() for line in row.lines.all() if line.warband_max}
    context = {
        "variant": variant,
        "fighters": {fighter.key: apply_variant(fighter, variant) for fighter in template.fighters.all()},
        "lists": lists,
        "holdings": fighter_holdings(warband),
        "held": held_items(warband, limited),
        "missing_rules": _missing_rules(warband, template, variant),
    }
    body = WarbandTemplateHireSerializer(template, context=context).data
    return {"template": body, "variant": variant, "list_prices_open": open_now}


def raise_gold(campaign_gold: int, template: WarbandTemplate | None) -> int:
    """What a warband is raised with (the templates plan, "Starting gold"): the campaign's gold plus the template's
    difference from 500 (Merchant Caravans' 600 gives a 450 gc campaign 550), never below 0."""
    if template is None:
        return campaign_gold
    return max(campaign_gold + template.gold - 500, 0)


def raise_outline(campaign_id: int, warband_type_id: int, variant: str, gold: int) -> dict[str, Any]:
    """The template a warband of the type would be raised from, in outline: the gold it gets, its most warriors, its
    variants and the type's preset, its rules for the variant (the preset, else the one asked), and each fighter's
    cost and counts (three queries with a template). `gold`: the campaign's starting gold."""
    template = templates_for_type(campaign_id, warband_type_id).prefetch_related("rules", "fighters").first()
    if template is None:
        return {"template": None, "gold": gold, "campaign_gold": gold, "most_warriors": 15}
    preset = getattr(template, "preset_variant", "") or ""
    picked = preset or (variant if variant in variant_keys(template) else "")
    fighters = [apply_variant(fighter, picked) for fighter in template.fighters.all()]
    outline = {
        "id": template.pk,
        "name": template.name,
        "variants": template.variants,
        "preset_variant": preset,
        "variant": picked,
        "rules": [
            {"id": rule.pk, "title": rule.title, "description": rule.description}
            for rule in variant_rules(template.rules.all(), picked)
        ],
        "fighters": [
            {
                "key": fighter.key,
                "kind": fighter.kind,
                "name": fighter.name,
                "plural": fighter.plural,
                "cost": fighter.cost,
                "min_count": fighter.min_count,
                "max_count": fighter.max_count,
                "group_min": fighter.group_min,
                "group_max": fighter.group_max,
            }
            for fighter in fighters
        ],
    }
    gets = raise_gold(gold, template)
    return {"template": outline, "gold": gets, "campaign_gold": gold, "most_warriors": template.most_warriors}
