"""Unit writes may only reference global catalogue entries or the warband's own campaign's (SEC-07)."""

from collections.abc import Iterable
from typing import Any

from django.core.exceptions import ImproperlyConfigured
from rest_framework import serializers

from apps.items.models import Item
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

# list-of-ids write fields and the catalogue each one points into
CATALOGUE_ID_FIELDS: dict[str, type[Skill] | type[Special] | type[Spell]] = {
    "skill_ids": Skill,
    "special_ids": Special,
    "spell_ids": Spell,
}


def _whole_ids(values: Iterable[Any]) -> set[int]:
    ids = set()
    for value in values:
        if isinstance(value, bool):
            continue
        try:
            ids.add(int(value))
        except (TypeError, ValueError):
            continue  # malformed ids are left to the loadout code, as before
    return ids


class CampaignCatalogueScopeMixin(serializers.Serializer):
    """Rejects a race, item, skill, special or spell that belongs to another campaign.

    One query per catalogue type the write sends (the race is already loaded by its field). Ids that
    don't exist at all are left alone: the loadout code skips them, as it always has. The campaign is
    `context["campaign_id"]`, or the campaign of the unit being updated.
    """

    def _campaign_id(self) -> int:
        campaign_id = self.context.get("campaign_id")
        if campaign_id is None and self.instance is not None:
            campaign_id = self.instance.warband.campaign_id
        if campaign_id is None:
            raise ImproperlyConfigured("Pass context={'campaign_id': ...} to a unit create serializer.")
        return int(campaign_id)

    def validate_race(self, race: Any) -> Any:
        if race is not None and race.campaign_id not in (None, self._campaign_id()):
            # the same error as an id that doesn't exist, so other campaigns' entries stay invisible
            raise serializers.ValidationError(
                self.fields["race"].error_messages["does_not_exist"].format(pk_value=race.pk)
            )
        return race

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        requested = {field: _whole_ids(attrs[field]) for field in CATALOGUE_ID_FIELDS if attrs.get(field)}
        if attrs.get("items"):
            requested["items"] = _whole_ids(entry.get("id") for entry in attrs["items"])
        errors = {}
        for field, ids in requested.items():
            model = Item if field == "items" else CATALOGUE_ID_FIELDS[field]
            foreign = sorted(
                model.objects.filter(id__in=ids, campaign__isnull=False)
                .exclude(campaign_id=self._campaign_id())
                .values_list("id", flat=True)
            )
            if foreign:
                errors[field] = [f"Not available in this campaign: {', '.join(str(pk) for pk in foreign)}."]
        if errors:
            raise serializers.ValidationError(errors)
        return attrs
