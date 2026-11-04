"""Warband templates as the API answers them: a list row (the template and the warband types it serves)."""

from rest_framework import serializers

from .models import DEFAULT_MAX_MODELS, DEFAULT_STARTING_GOLD, WarbandTemplate, WarbandTemplateType


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
        fields = (
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
