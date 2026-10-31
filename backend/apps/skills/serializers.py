from rest_framework import serializers

from apps.warbands.access_lines import AccessLineSerializer

from .models import Skill


class SkillSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    setting_id = serializers.IntegerField(source="campaign_type_id", read_only=True)  # null: Mordheim (in_play.py)

    class Meta:
        model = Skill
        fields = ("id", "campaign_id", "setting_id", "name", "type", "description", "large_only", "learn_note")


class SkillLearnersSerializer(SkillSerializer):
    """A skill as the catalogue lists it: who may learn it too (`for_everyone`, or the warbands a special skill
    names). Unit payloads and kits nest the plain skill."""

    warbands = AccessLineSerializer(source="warband_links", many=True, read_only=True)

    class Meta:
        model = Skill
        fields = (*SkillSerializer.Meta.fields, "for_everyone", "warbands")


class SkillCreateSerializer(serializers.ModelSerializer):
    """A custom skill's create or edit; the campaign is never an input (the view saves the create in its campaign). It
    may be a Large unit's skill and carry a note shown when learning it."""

    class Meta:
        model = Skill
        fields = ("name", "type", "description", "large_only", "learn_note")
        extra_kwargs = {"description": {"allow_blank": False}}
