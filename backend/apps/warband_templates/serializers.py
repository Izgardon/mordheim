"""Warband templates as the API answers them: a list row (the template and the warband types it serves) and the
whole template (its rules, lists, fighters and upgrades)."""

from typing import Any

from rest_framework import serializers

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
        fields = ("id", "title", "description", "variant")


class TemplateSpecialSerializer(serializers.Serializer):
    """A rule a fighter has or an upgrade gives: the special's name, text and Boons & Banes kind."""

    id = serializers.IntegerField(source="special.id")
    name = serializers.CharField(source="special.name")
    kind = serializers.CharField(source="special.kind")
    description = serializers.CharField(source="special.description")


class TemplateLineSerializer(serializers.ModelSerializer):
    item = serializers.SerializerMethodField()

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
        )

    def get_item(self, line: TemplateListItem) -> dict[str, Any]:
        item = line.item
        return {"id": item.pk, "name": item.name, "variant": item.variant, "type": item.type}


class TemplateListSerializer(serializers.ModelSerializer):
    lines = TemplateLineSerializer(many=True, read_only=True)

    class Meta:
        model = TemplateList
        fields = ("id", "key", "name", "note", "lines")


class TemplateFighterSerializer(serializers.ModelSerializer):
    race = serializers.SerializerMethodField()
    lists = serializers.SerializerMethodField()
    rules = TemplateSpecialSerializer(source="special_links", many=True, read_only=True)

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
        )

    def get_race(self, fighter: TemplateFighter) -> str | None:
        return fighter.race.name if fighter.race is not None else None

    def get_lists(self, fighter: TemplateFighter) -> list[str]:
        return [link.equipment_list.key for link in fighter.list_links.all()]


class TemplateUpgradeSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="special.name", read_only=True)
    description = serializers.CharField(source="special.description", read_only=True)

    class Meta:
        model = TemplateUpgrade
        fields = ("id", "group", "name", "description", "cost", "cost_note", "note")


class WarbandTemplateDetailSerializer(WarbandTemplateSerializer):
    """The whole template: its warband rules, equipment lists, fighters and upgrades (selectors.template_details)."""

    rules = TemplateRuleSerializer(many=True, read_only=True)
    lists = TemplateListSerializer(many=True, read_only=True)
    fighters = TemplateFighterSerializer(many=True, read_only=True)
    upgrades = TemplateUpgradeSerializer(many=True, read_only=True)

    class Meta(WarbandTemplateSerializer.Meta):
        fields = (*WarbandTemplateSerializer.Meta.fields, "rules", "lists", "fighters", "upgrades")
