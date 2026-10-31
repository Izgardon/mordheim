"""Settings as the pages read them (grading phase 1): a setting brief (on a warband type, a catalogue row) and the
settings list with what each holds."""

from rest_framework import serializers

from ..models import GRADE_LABELS, CampaignType


class SettingBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignType
        fields = ("id", "slug", "name", "grade")


class SettingSerializer(serializers.ModelSerializer):
    """A setting on the settings list: its grade (and the grade's name), its chip order, whether it is always on, and
    how many of the book's warband types it holds (`warband_types`, annotated)."""

    grade_label = serializers.SerializerMethodField()
    warband_types = serializers.IntegerField(read_only=True, default=0)

    def get_grade_label(self, setting: CampaignType) -> str:
        return GRADE_LABELS.get(setting.grade, "")

    class Meta:
        model = CampaignType
        fields = ("id", "slug", "name", "grade", "grade_label", "sort_order", "always_on", "warband_types")
