"""A campaign's encampment groups and encampments (William, 24 Nov 2026), read whole with the campaign's encampment
rules and the warbands the reader may take one for, and written a group or an encampment at a time.

What the reader may do with each encampment is the server's (`capabilities`, from `context["access"]`, the reader's
CampaignAccess): take it, and raze it or give it up. Who holds one is written only by take, raze and give up.
"""

from typing import Any

from rest_framework import serializers

from apps.users.names import display_name

from ..access import CAMPAIGN_RULES
from ..models import MAX_ENCAMPMENT_TEXT, CampaignEncampment, CampaignEncampmentGroup


def _text(limit: int) -> serializers.CharField:
    return serializers.CharField(max_length=limit, allow_blank=True, required=False, default="", trim_whitespace=True)


def holder_of(encampment: CampaignEncampment) -> dict[str, Any] | None:
    """The warband holding it, with its player's name, from the row already read (no query); None for nobody."""
    warband = encampment.holder
    if warband is None:
        return None
    return {"id": warband.pk, "name": warband.name, "player": display_name(warband.user)}


class CampaignEncampmentSerializer(serializers.ModelSerializer):
    """An encampment as the page reads it, with who holds it and what the reader may do with it."""

    group_id = serializers.IntegerField(read_only=True)
    holder = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()

    class Meta:
        model = CampaignEncampment
        fields = (
            "id",
            "group_id",
            "name",
            "gained_by",
            "fortified",
            "text",
            "holder",
            "razed",
            "order",
            "capabilities",
        )

    def get_holder(self, encampment: CampaignEncampment) -> dict[str, Any] | None:
        return holder_of(encampment)

    def get_capabilities(self, encampment: CampaignEncampment) -> dict[str, bool]:
        access = self.context["access"]
        if access.archived:
            return {"take": False, "raze": False, "give_up": False}
        changes = CAMPAIGN_RULES["change_holding"](access, encampment)
        return {
            "take": bool(self.context.get("can_take")),
            "raze": changes and not encampment.razed,
            "give_up": changes and encampment.holder_id is not None,
        }


class CampaignEncampmentGroupSerializer(serializers.ModelSerializer):
    """A group with its listed encampments, in their order (from the prefetch); written by its name and
    description."""

    campaign_id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=160, trim_whitespace=True)
    description = _text(4000)
    encampments = serializers.SerializerMethodField()

    class Meta:
        model = CampaignEncampmentGroup
        fields = ("id", "campaign_id", "name", "description", "order", "encampments")
        read_only_fields = ("order",)

    def get_encampments(self, group: CampaignEncampmentGroup) -> list[dict[str, Any]]:
        rows = group.encampments.all()
        return list(CampaignEncampmentSerializer(rows, many=True, context=self.context).data)


class CampaignEncampmentWriteSerializer(serializers.Serializer):
    """POST encampments/ (every field) and PATCH encampments/<id>/ (the fields sent)."""

    group_id = serializers.IntegerField()
    name = serializers.CharField(max_length=160, trim_whitespace=True)
    gained_by = _text(200)
    fortified = serializers.BooleanField(required=False, default=False)
    text = _text(MAX_ENCAMPMENT_TEXT)


class EncampmentTakeSerializer(serializers.Serializer):
    """POST encampments/<id>/take/: the warband taking it."""

    warband_id = serializers.IntegerField()
