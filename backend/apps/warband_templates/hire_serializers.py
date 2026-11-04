"""A warband's template as its hire screens read it (`GET warbands/<id>/template/`, the templates plan, phase 2): the
variant applied, what the warband has of each fighter, who each list line is meant for, the item every hire of a
fighter gets free, and the copies held of an item limited per warband. Everything comes from the payload's context
(services/payload.py), so nothing here queries."""

from typing import Any

from rest_framework import serializers

from .models import TemplateFighter, TemplateList, TemplateListItem, WarbandTemplate
from .serializers import TemplateFighterSerializer, TemplateLineSerializer, TemplateRuleSerializer
from .services.resolve import template_gold, template_size, variant_rules
from .services.who import allows, who_text

NOBODY = {"count": 0, "groups": 0}


class HireLineSerializer(TemplateLineSerializer):
    """A line with the reason anyone else sees it dimmed (`who_text`) and, where the warband may hold only so many
    (`warband_max`), how many it holds now (`held`)."""

    who_text = serializers.SerializerMethodField()
    held = serializers.SerializerMethodField()

    class Meta:
        model = TemplateListItem
        fields = (
            "id",
            "item",
            "shown_as",
            "cost",
            "cost_note",
            "first_free",
            "brace_cost",
            "who",
            "warband_max",
            "note",
            "who_text",
            "held",
        )

    def get_who_text(self, line: TemplateListItem) -> str:
        return who_text(line.who or {}, self.context["fighters"])

    def get_held(self, line: TemplateListItem) -> int | None:
        return self.context["held"].get(line.item_id, 0) if line.warband_max else None


class HireListSerializer(serializers.ModelSerializer):
    lines = HireLineSerializer(many=True, read_only=True)

    class Meta:
        model = TemplateList
        fields = ("id", "key", "name", "note", "lines")


def fighter_lines(fighter: TemplateFighter, lists: dict[int, TemplateList]) -> list[TemplateListItem]:
    """The lines of the fighter's lists, in his lists' order."""
    return [
        line
        for link in fighter.list_links.all()
        for line in (lists[link.equipment_list_id].lines.all() if link.equipment_list_id in lists else [])
    ]


def free_line(fighter: TemplateFighter, lists: dict[int, TemplateList]) -> TemplateListItem | None:
    """The "1st free" line of his lists (the Dagger every hire of his gets free), or None."""
    return next((line for line in fighter_lines(fighter, lists) if line.first_free), None)


class HireFighterSerializer(TemplateFighterSerializer):
    """A fighter as the variant has him, with what the warband has of him (`have`: heroes, or a henchman's models and
    groups), the lines he isn't meant to take (`off_lines`) and the item a hire of his gets free (`free_item`)."""

    have = serializers.SerializerMethodField()
    off_lines = serializers.SerializerMethodField()
    free_item = serializers.SerializerMethodField()

    class Meta(TemplateFighterSerializer.Meta):
        fields = tuple(
            field for field in TemplateFighterSerializer.Meta.fields if field not in ("variant_changes", "lists")
        ) + ("lists", "have", "off_lines", "free_item")

    def get_have(self, fighter: TemplateFighter) -> dict[str, int]:
        return dict(self.context["holdings"].get(fighter.key, NOBODY))

    def get_off_lines(self, fighter: TemplateFighter) -> list[int]:
        return [
            line.pk for line in fighter_lines(fighter, self.context["lists"]) if not allows(line.who or {}, fighter)
        ]

    def get_free_item(self, fighter: TemplateFighter) -> dict[str, Any] | None:
        line = free_line(fighter, self.context["lists"])
        return {"id": line.item_id, "name": line.item.name} if line is not None else None


class WarbandTemplateHireSerializer(serializers.ModelSerializer):
    """The template with the warband's variant applied: its rules for the variant, lists, fighters, and how many of
    the variant's rules the warband lacks by title (`missing_rules`)."""

    gold = serializers.SerializerMethodField()
    most_warriors = serializers.SerializerMethodField()
    rules = serializers.SerializerMethodField()
    lists = HireListSerializer(many=True, read_only=True)
    fighters = serializers.SerializerMethodField()
    missing_rules = serializers.SerializerMethodField()

    class Meta:
        model = WarbandTemplate
        fields = (
            "id",
            "campaign_id",
            "replaces",
            "name",
            "gold",
            "most_warriors",
            "variants",
            "rules",
            "lists",
            "fighters",
            "missing_rules",
        )

    def get_gold(self, template: WarbandTemplate) -> int:
        return template_gold(template, self.context["variant"])

    def get_most_warriors(self, template: WarbandTemplate) -> int:
        return template_size(template, self.context["variant"])

    def get_rules(self, template: WarbandTemplate) -> Any:
        rules = variant_rules(template.rules.all(), self.context["variant"], self.context["warband_type_id"])
        return TemplateRuleSerializer(rules, many=True).data

    def get_fighters(self, template: WarbandTemplate) -> Any:
        return HireFighterSerializer(list(self.context["fighters"].values()), many=True, context=self.context).data

    def get_missing_rules(self, template: WarbandTemplate) -> int:
        return int(self.context["missing_rules"])
