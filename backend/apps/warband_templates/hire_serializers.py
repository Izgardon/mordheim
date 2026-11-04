"""A warband's template as its hire screens read it (`GET warbands/<id>/template/`, the templates plan, phase 2): the
variant applied, what the warband has of each fighter, who each list line is meant for, the item every hire of a
fighter gets free, and the copies held of an item limited per warband. Everything comes from the payload's context
(services/payload.py), so nothing here queries."""

from typing import Any

from rest_framework import serializers

from .models import TemplateFighter, TemplateList, TemplateListItem, TemplateUpgrade, WarbandTemplate
from .serializers import (
    TemplateFighterSerializer,
    TemplateLineSerializer,
    TemplateRuleSerializer,
    TemplateUpgradeSerializer,
)
from .services.resolve import template_gold, template_size, variant_rules
from .services.who import allows, who_text

NOBODY = {"count": 0, "groups": 0}
Lines = dict[int, list[TemplateListItem]]  # a list's id -> its lines for the warband's variant


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
            "variant",
            "who_text",
            "held",
        )

    def get_who_text(self, line: TemplateListItem) -> str:
        return who_text(line.who or {}, self.context["fighters"])

    def get_held(self, line: TemplateListItem) -> int | None:
        return self.context["held"].get(line.item_id, 0) if line.warband_max else None


class HireListSerializer(serializers.ModelSerializer):
    """A list with its lines for the warband's variant (the payload's `lines`)."""

    lines = serializers.SerializerMethodField()

    class Meta:
        model = TemplateList
        fields = ("id", "key", "name", "note", "lines")

    def get_lines(self, row: TemplateList) -> Any:
        return HireLineSerializer(self.context["lines"].get(row.pk, []), many=True, context=self.context).data


def fighter_lines(fighter: TemplateFighter, lines: Lines) -> list[TemplateListItem]:
    """The lines of the fighter's lists for the variant, in his lists' order."""
    return [line for link in fighter.list_links.all() for line in lines.get(link.equipment_list_id, [])]


def free_line(fighter: TemplateFighter, lines: Lines) -> TemplateListItem | None:
    """The "1st free" line of his lists (the Dagger every hire of his gets free), or None."""
    return next((line for line in fighter_lines(fighter, lines) if line.first_free), None)


class HireUpgradeSerializer(TemplateUpgradeSerializer):
    """An upgrade with the special it links (`special_id`, to count the ones a hero has), the price of the second and
    later of its group on one hero (`later_cost`: double where the book says) and the reason anyone else sees it
    dimmed (`who_text`)."""

    special_id = serializers.IntegerField(read_only=True)
    later_cost = serializers.SerializerMethodField()
    who_text = serializers.SerializerMethodField()

    class Meta(TemplateUpgradeSerializer.Meta):
        fields = (*TemplateUpgradeSerializer.Meta.fields, "special_id", "later_cost", "who_text")

    def get_later_cost(self, upgrade: TemplateUpgrade) -> int | None:
        if upgrade.cost is None:
            return None
        return upgrade.cost * 2 if upgrade.later_double else upgrade.cost

    def get_who_text(self, upgrade: TemplateUpgrade) -> str:
        return who_text(upgrade.who or {}, self.context["fighters"])


class HireFighterSerializer(TemplateFighterSerializer):
    """A fighter as the variant has him, with what the warband has of him (`have`: heroes, or a henchman's models and
    groups), the lines he isn't meant to take (`off_lines`) and the item a hire of his gets free (`free_item`)."""

    have = serializers.SerializerMethodField()
    off_lines = serializers.SerializerMethodField()
    off_upgrades = serializers.SerializerMethodField()
    free_item = serializers.SerializerMethodField()

    class Meta(TemplateFighterSerializer.Meta):
        fields = tuple(
            field for field in TemplateFighterSerializer.Meta.fields if field not in ("variant_changes", "lists")
        ) + ("lists", "have", "off_lines", "off_upgrades", "free_item")

    def get_have(self, fighter: TemplateFighter) -> dict[str, int]:
        return dict(self.context["holdings"].get(fighter.key, NOBODY))

    def get_off_lines(self, fighter: TemplateFighter) -> list[int]:
        return [
            line.pk for line in fighter_lines(fighter, self.context["lines"]) if not allows(line.who or {}, fighter)
        ]

    def get_off_upgrades(self, fighter: TemplateFighter) -> list[int]:
        return [upgrade.pk for upgrade in self.context["upgrades"] if not allows(upgrade.who or {}, fighter)]

    def get_free_item(self, fighter: TemplateFighter) -> dict[str, Any] | None:
        line = free_line(fighter, self.context["lines"])
        return {"id": line.item_id, "name": line.item.name} if line is not None else None


class WarbandTemplateHireSerializer(serializers.ModelSerializer):
    """The template with the warband's variant applied: its rules for the variant, lists, fighters, and how many of
    the variant's rules the warband lacks by title (`missing_rules`)."""

    gold = serializers.SerializerMethodField()
    most_warriors = serializers.SerializerMethodField()
    rules = serializers.SerializerMethodField()
    lists = HireListSerializer(many=True, read_only=True)
    upgrades = HireUpgradeSerializer(many=True, read_only=True)
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
            "upgrades",
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
