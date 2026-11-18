"""The presets as the pages read them: the dropdown's list, and what one dictates."""

from typing import Any

from rest_framework import serializers

from .models import CampaignPreset
from .wording import sets


class CampaignPresetSerializer(serializers.ModelSerializer):
    """One preset on the dropdown: its name, the settings it guides the content choice towards, what it dictates
    (`sets`, worded by the server) and how many rules it would offer."""

    setting_ids = serializers.SerializerMethodField()
    setting_names = serializers.SerializerMethodField()
    sets = serializers.SerializerMethodField()
    rule_count = serializers.IntegerField(read_only=True, default=0)

    def get_setting_ids(self, preset: CampaignPreset) -> list[int]:
        return sorted(setting.pk for setting in preset.settings.all())

    def get_setting_names(self, preset: CampaignPreset) -> list[str]:
        return [setting.name for setting in preset.settings.all()]

    def get_sets(self, preset: CampaignPreset) -> list[dict[str, Any]]:
        return sets(preset, self.context.get("chart_names"))

    class Meta:
        model = CampaignPreset
        fields = ("id", "slug", "name", "sort_order", "setting_ids", "setting_names", "sets", "rule_count")
