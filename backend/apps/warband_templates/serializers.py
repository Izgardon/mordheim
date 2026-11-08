"""Warband templates as the API answers them: a list row (the template and the warband types it serves) and the
whole template (its rules, lists, fighters and upgrades)."""

from typing import Any

from rest_framework import serializers

from apps.skills.models import Skill
from apps.warbands.models.shared import STAT_FIELDS

from .models import (
    DEFAULT_MAX_MODELS,
    DEFAULT_STARTING_GOLD,
    TemplateFighter,
    TemplateList,
    TemplateListItem,
    TemplateRule,
    TemplateUpgrade,
    WarbandTemplate,
    WarbandTemplateType,
)
from .services.who import who_text


class TemplateTypeSerializer(serializers.ModelSerializer):
    """A warband type the template serves, its variant (blank: picked when raising) and, in a campaign's list,
    whether the type is in play there."""

    id = serializers.IntegerField(source="warband_type_id", read_only=True)
    name = serializers.CharField(source="warband_type.name", read_only=True)
    slug = serializers.CharField(source="warband_type.slug", read_only=True)
    source_code = serializers.CharField(source="warband_type.source_code", read_only=True)
    setting_id = serializers.IntegerField(source="warband_type.campaign_type_id", read_only=True, allow_null=True)
    campaign_id = serializers.IntegerField(source="warband_type.campaign_id", read_only=True, allow_null=True)
    archived = serializers.SerializerMethodField()
    in_play = serializers.SerializerMethodField()

    class Meta:
        model = WarbandTemplateType
        fields = ("id", "name", "slug", "source_code", "setting_id", "campaign_id", "variant", "archived", "in_play")

    def get_archived(self, link: WarbandTemplateType) -> bool:
        return link.warband_type.archived_at is not None

    def get_in_play(self, link: WarbandTemplateType) -> bool | None:
        in_play: bool | None = getattr(link, "in_play", None)
        return in_play


class WarbandTemplateSerializer(serializers.ModelSerializer):
    """A template's own fields: starting gold and most warriors as the book gives them, and as they read (500 gc
    and 15 warriors when the book gives none)."""

    setting_id = serializers.IntegerField(source="campaign_type_id", read_only=True, allow_null=True)
    campaign_id = serializers.IntegerField(read_only=True, allow_null=True)
    gold = serializers.SerializerMethodField()
    most_warriors = serializers.SerializerMethodField()
    types = TemplateTypeSerializer(source="type_links", many=True, read_only=True)

    class Meta:
        model = WarbandTemplate
        fields: tuple[str, ...] = (
            "id",
            "campaign_id",
            "setting_id",
            "name",
            "slug",
            "starting_gold",
            "gold",
            "max_models",
            "most_warriors",
            "variants",
            "source",
            "link_url",
            "types",
        )

    def get_gold(self, template: WarbandTemplate) -> int:
        return DEFAULT_STARTING_GOLD if template.starting_gold is None else template.starting_gold

    def get_most_warriors(self, template: WarbandTemplate) -> int:
        return DEFAULT_MAX_MODELS if template.max_models is None else template.max_models


class TemplateRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemplateRule
        fields = ("id", "title", "description", "variant", "warband_type_id")


class TemplateSpecialSerializer(serializers.Serializer):
    """A rule a fighter has or an upgrade gives: the special's name, text, Boons & Banes kind and category (its icon)."""

    id = serializers.IntegerField(source="special.id")
    name = serializers.CharField(source="special.name")
    kind = serializers.CharField(source="special.kind")
    category = serializers.CharField(source="special.category")
    description = serializers.CharField(source="special.description")


class TemplateSkillSerializer(serializers.Serializer):
    """A skill a fighter starts with: the skill's name and rules."""

    id = serializers.IntegerField(source="skill.id")
    name = serializers.CharField(source="skill.name")
    description = serializers.CharField(source="skill.description")


class TemplateLineSerializer(serializers.ModelSerializer):
    """A list line, with the reason anyone it isn't meant for sees it dimmed (`who_text`, "Gaolers only": the
    serializer's `fighters` context, by key)."""

    item = serializers.SerializerMethodField()
    who_text = serializers.SerializerMethodField()

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
        )

    def get_who_text(self, line: TemplateListItem) -> str:
        return who_text(line.who or {}, self.context.get("fighters") or {})

    def get_item(self, line: TemplateListItem) -> dict[str, Any]:
        item = line.item
        return {"id": item.pk, "name": item.name, "variant": item.variant, "type": item.type}


class TemplateListSerializer(serializers.ModelSerializer):
    lines = TemplateLineSerializer(many=True, read_only=True)

    class Meta:
        model = TemplateList
        fields = ("id", "key", "name", "note", "lines")


class TemplateFighterSerializer(serializers.ModelSerializer):
    """A fighter: his figures, profile as written, skill groups, lores, lists, rules and the skills he starts with,
    and what each variant changes on him, a skill it gives him carrying its rules from the `skill_texts` context."""

    race = serializers.SerializerMethodField()
    lists = serializers.SerializerMethodField()
    variant_changes = serializers.SerializerMethodField()
    rules = TemplateSpecialSerializer(source="special_links", many=True, read_only=True)
    skills = TemplateSkillSerializer(source="skill_links", many=True, read_only=True)

    class Meta:
        model = TemplateFighter
        fields = (
            "id",
            "key",
            "kind",
            "name",
            "plural",
            "race_id",
            "race",
            "cost",
            "starting_xp",
            "min_count",
            "max_count",
            "group_min",
            "group_max",
            *STAT_FIELDS,
            "written_stats",
            "skill_types",
            "spell_types",
            "gains_xp",
            "promotable",
            "is_leader",
            "caster",
            "large",
            "variant_changes",
            "fixed_kit",
            "lists",
            "rules",
            "skills",
        )

    def get_race(self, fighter: TemplateFighter) -> str | None:
        return fighter.race.name if fighter.race is not None else None

    def get_lists(self, fighter: TemplateFighter) -> list[str]:
        return [link.equipment_list.key for link in fighter.list_links.all()]

    def get_variant_changes(self, fighter: TemplateFighter) -> dict[str, Any]:
        texts: dict[int, str] = self.context.get("skill_texts") or {}
        changes: dict[str, Any] = {}
        for variant, change in (fighter.variant_changes or {}).items():
            skills = [{**skill, "description": texts.get(skill["id"], "")} for skill in change.get("skills") or []]
            changes[variant] = {**change, "skills": skills} if skills else change
        return changes


def variant_skill_texts(fighters: list[TemplateFighter]) -> dict[int, str]:
    """The rules of the skills the fighters' variants give them, by id (one query, only when one gives any)."""
    ids = {
        skill["id"]
        for fighter in fighters
        for change in (fighter.variant_changes or {}).values()
        for skill in change.get("skills") or []
    }
    return dict(Skill.objects.filter(pk__in=ids).values_list("id", "description")) if ids else {}


class TemplateUpgradeSerializer(serializers.ModelSerializer):
    """An upgrade: the special it gives (its id, name, text, Boons & Banes kind and category), with who may take it
    worded as a line's is (`who_text`, from the `fighters` context)."""

    name = serializers.CharField(source="special.name", read_only=True)
    description = serializers.CharField(source="special.description", read_only=True)
    special_id = serializers.IntegerField(read_only=True)
    kind = serializers.CharField(source="special.kind", read_only=True)
    category = serializers.CharField(source="special.category", read_only=True)
    who_text = serializers.SerializerMethodField()

    class Meta:
        model = TemplateUpgrade
        fields: tuple[str, ...] = (
            "id",
            "group",
            "special_id",
            "name",
            "description",
            "kind",
            "category",
            "cost",
            "cost_note",
            "note",
            "who",
            "max_per_fighter",
            "later_double",
            "at_recruit",
            "who_text",
        )

    def get_who_text(self, upgrade: TemplateUpgrade) -> str:
        return who_text(upgrade.who or {}, self.context.get("fighters") or {})


class WarbandTemplateDetailSerializer(WarbandTemplateSerializer):
    """The whole template: its warband rules, equipment lists, fighters and upgrades (selectors.template_details), each
    line and upgrade saying who may take it in the server's words ("Gaolers only"), read from its fighters."""

    rules = TemplateRuleSerializer(many=True, read_only=True)
    lists = serializers.SerializerMethodField()
    fighters = serializers.SerializerMethodField()
    upgrades = serializers.SerializerMethodField()

    class Meta(WarbandTemplateSerializer.Meta):
        fields = (*WarbandTemplateSerializer.Meta.fields, "rules", "lists", "fighters", "upgrades")

    def _with_fighters(self, template: WarbandTemplate) -> dict[str, Any]:
        return {**self.context, "fighters": {fighter.key: fighter for fighter in template.fighters.all()}}

    def get_lists(self, template: WarbandTemplate) -> Any:
        return TemplateListSerializer(template.lists.all(), many=True, context=self._with_fighters(template)).data

    def get_fighters(self, template: WarbandTemplate) -> Any:
        fighters = list(template.fighters.all())
        context = {**self.context, "skill_texts": variant_skill_texts(fighters)}
        return TemplateFighterSerializer(fighters, many=True, context=context).data

    def get_upgrades(self, template: WarbandTemplate) -> Any:
        return TemplateUpgradeSerializer(template.upgrades.all(), many=True, context=self._with_fighters(template)).data
