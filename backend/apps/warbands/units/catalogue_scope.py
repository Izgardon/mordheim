"""Unit and stash writes may only reference book catalogue entries or the warband's own campaign's (SEC-07), and
each lands on the campaign's current entry: a book id the campaign has a version of is the version (CAT-TWEAK-03),
so a list read before the edit, Buy again, a hire preset copied from a bestiary entry and a battle find never store
a copy of the book entry the campaign replaced."""

from collections.abc import Iterable
from typing import Any

from django.core.exceptions import ImproperlyConfigured
from django.db.models import Exists, OuterRef, Q, QuerySet
from rest_framework import serializers

from apps.core.catalogue.current import current_rows
from apps.core.catalogue.scope import as_id
from apps.core.models import CatalogueRemoval
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


def in_campaign_scope[RowsT: QuerySet[Any]](rows: RowsT, campaign_id: int) -> RowsT:
    """The catalogue `rows` a campaign may use: book entries and its own."""
    scoped: RowsT = rows.filter(Q(campaign__isnull=True) | Q(campaign_id=campaign_id))
    return scoped


def current_entry(rows: QuerySet[Any], entry_id: Any, campaign_id: int) -> Any:
    """The campaign's current entry for `entry_id` (the version of a book entry it replaced), or None for another
    campaign's or an unknown id: one query."""
    return current_rows(rows, [entry_id], campaign_id).get(entry_id)


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
    """Rejects an item, skill, special or spell that belongs to another campaign, and points each id at the
    campaign's current entry.

    One query per catalogue type the write sends (the race is read by its own field). Ids that don't exist at all
    are left alone: the loadout code skips them, as it always has. The campaign is `context["campaign_id"]`, or the
    campaign of the unit being updated.
    """

    def _campaign_id(self) -> int:
        campaign_id = self.context.get("campaign_id")
        if campaign_id is None and self.instance is not None:
            campaign_id = self.instance.warband.campaign_id
        if campaign_id is None:
            raise ImproperlyConfigured("Pass context={'campaign_id': ...} to a unit create serializer.")
        return int(campaign_id)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        requested = {field: _whole_ids(attrs[field]) for field in CATALOGUE_ID_FIELDS if attrs.get(field)}
        if attrs.get("items"):
            requested["items"] = _whole_ids(entry.get("id") for entry in attrs["items"])
        errors = {}
        for field, ids in requested.items():
            model = Item if field == "items" else CATALOGUE_ID_FIELDS[field]
            foreign, versions = self._read(model, ids)
            if foreign:
                errors[field] = [f"Not available in this campaign: {', '.join(str(pk) for pk in foreign)}."]
            elif versions:
                self._point_at_versions(attrs, field, versions)
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def _read(self, model: Any, ids: set[int]) -> tuple[list[int], dict[int, int]]:
        """Another campaign's ids among `ids`, and each book id the campaign has a version of -> the version's id."""
        campaign_id = self._campaign_id()
        rows = model.objects.filter(Q(id__in=ids) | Q(campaign_id=campaign_id, replaces_id__in=ids))
        foreign, versions = [], {}
        for pk, campaign, replaces in rows.values_list("id", "campaign_id", "replaces_id"):
            if pk in ids and campaign not in (None, campaign_id):
                foreign.append(pk)
            if replaces in ids and campaign == campaign_id:
                versions[replaces] = pk
        return sorted(foreign), versions

    def _point_at_versions(self, attrs: dict[str, Any], field: str, versions: dict[int, int]) -> None:
        if field == "items":
            for entry in attrs["items"]:
                entry["id"] = versions.get(as_id(entry.get("id")), entry.get("id"))
            return
        attrs[field] = list(dict.fromkeys(versions.get(as_id(pk), pk) for pk in attrs[field]))  # a skill once


def shop_items(campaign_id: int) -> QuerySet[Item]:
    """Items as a purchase reads them: their prices, and whether the campaign removed the book item (`removed`), so
    buying an archived or removed item from a list read before can warn (decision 5)."""
    removed = CatalogueRemoval.objects.filter(campaign_id=campaign_id, kind="items", entry_id=OuterRef("pk"))
    return Item.objects.prefetch_related("availabilities").annotate(removed=Exists(removed))
