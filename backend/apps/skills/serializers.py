from typing import Any

from rest_framework import serializers

from apps.core.catalogue.scope import CatalogueIdsField
from apps.warbands.access_lines import (
    AccessLineInputSerializer,
    AccessLineSerializer,
    refuse_unknown_lines,
    unique_lines,
)

from .models import Skill, SkillGroup
from .selectors import current_skill_id


class SkillSerializer(serializers.ModelSerializer):
    """A skill: its name and rules. The groups holding it list it (`SkillGroupSerializer.skill_ids`); unit payloads
    and kits nest this too."""

    campaign_id = serializers.IntegerField(read_only=True)
    setting_id = serializers.IntegerField(source="campaign_type_id", read_only=True)  # null: Mordheim (in_play.py)

    class Meta:
        model = Skill
        fields = ("id", "campaign_id", "setting_id", "name", "description", "prebattle_roll", "prebattle_text")


class SkillCreateSerializer(serializers.ModelSerializer):
    """A custom skill's create or edit; the campaign is never an input (the view saves the create in its campaign).
    `group_ids` (the campaign's groups, book ones too) replaces the groups holding it (skills/writes.py)."""

    group_ids = CatalogueIdsField(rows=SkillGroup.objects.all(), required=False)

    class Meta:
        model = Skill
        fields = ("name", "description", "prebattle_roll", "prebattle_text", "group_ids")  # left out: no roll
        extra_kwargs = {"description": {"allow_blank": False}}


class SkillGroupSerializer(serializers.ModelSerializer):
    """A skill group: who learns from it (`for_everyone`, or the warbands its lines name), whether it is a Large
    unit's, the note shown when learning from it, and its skills as the campaign's current entries (`skill_ids`, its
    skills' name order). `access_name` is what a unit's skill access names it by: the book group's name for the book's
    and a campaign's version of it (renaming the version changes nothing a unit holds), its own for a campaign's."""

    campaign_id = serializers.IntegerField(read_only=True)
    access_name = serializers.SerializerMethodField()
    warbands = AccessLineSerializer(source="warband_links", many=True, read_only=True)
    skill_ids = serializers.SerializerMethodField()

    class Meta:
        model = SkillGroup
        fields = (
            "id",
            "campaign_id",
            "name",
            "access_name",
            "for_everyone",
            "warbands",
            "large_only",
            "learn_note",
            "skill_ids",
        )

    def get_access_name(self, group: Any) -> str:
        return str(group.replaces.name if group.replaces_id else group.name)

    def get_skill_ids(self, group: Any) -> list[int]:
        return list(dict.fromkeys(current_skill_id(link) for link in group.skill_links.all()))


class SkillGroupWriteSerializer(serializers.ModelSerializer):
    """A skill group's create or edit. A list it sends (`warbands`, who learns from it; `skill_ids`) replaces that
    list; a list it leaves out stays."""

    warbands = AccessLineInputSerializer(many=True, required=False)
    skill_ids = CatalogueIdsField(rows=Skill.objects.all(), required=False)

    class Meta:
        model = SkillGroup
        validators: list = []  # a taken name is the name rule's 400 name_taken (CAT-TWEAK-02), backed by the constraint
        fields = ("name", "for_everyone", "large_only", "learn_note", "warbands", "skill_ids")

    def validate_warbands(self, lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
        refuse_unknown_lines(lines, self.context["campaign_id"])  # the book's or the campaign's types (SEC-07)
        return unique_lines(lines)
