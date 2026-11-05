"""The editor's Rules and Upgrades (the templates plan, phase 4), each saved whole: the rows become those sent, in
order, a row sent with its id keeping its row (on a book template's first save, the book row's id, which the copy maps:
`copied_ids`).

A rule is a warband rule's title and description, for every variant or one, and for every type the template serves or
one. An upgrade is a group ("Mutations"), the special it gives (picked, or written as the template's own:
own_specials.py), its cost (none in the book, or 0 for free), who may take it, the most of its group per fighter, the
second and later at double and whether it is bought only when he is recruited."""

from typing import Any

from rest_framework.exceptions import ValidationError

from ..models import TemplateRule, TemplateUpgrade, WarbandTemplate
from .edit_lists import check_variant, check_who
from .own_specials import specials_for
from .sync import sync_rows

RULE_FIELDS = ("id", "title", "description", "variant", "warband_type_id")
UPGRADE_FIELDS = ("id", "group", "cost", "cost_note", "note", "who", "max_per_fighter", "later_double", "at_recruit")


def write_rules(template: WarbandTemplate, rules: list[dict[str, Any]]) -> None:
    served = set(template.type_links.values_list("warband_type_id", flat=True))
    for rule in rules:
        check_variant(template, rule["variant"], "rules")
        if rule["warband_type_id"] is not None and rule["warband_type_id"] not in served:
            raise ValidationError({"rules": ["A rule for one type names a type the template serves."]})
    sent = [{field: rule[field] for field in RULE_FIELDS if field in rule} for rule in rules]
    copied = getattr(template, "copied_ids", {}).get("rules", {})
    sync_rows(TemplateRule, template.rules.all(), sent, parent={"template": template}, copied=copied)


def write_upgrades(template: WarbandTemplate, upgrades: list[dict[str, Any]]) -> None:
    keys = set(template.fighters.values_list("key", flat=True))
    for upgrade in upgrades:
        check_who(upgrade["who"], keys, "upgrades")
    special_ids = specials_for(template, [upgrade["rule"] for upgrade in upgrades])
    sent = [
        {**{field: upgrade[field] for field in UPGRADE_FIELDS if field in upgrade}, "special_id": special_id}
        for upgrade, special_id in zip(upgrades, special_ids, strict=True)
    ]
    copied = getattr(template, "copied_ids", {}).get("upgrades", {})
    sync_rows(TemplateUpgrade, template.upgrades.all(), sent, parent={"template": template}, copied=copied)
