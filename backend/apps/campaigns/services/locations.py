"""A campaign's location groups and their locations (William, 23 Nov 2026).

Every member reads them while the Locations page is switched on; `manage_locations` (owners and admins hold it) adds,
edits and removes them. A new group or location goes last. Removal is a soft delete (`removed_at`), as for
encampments: a removed group takes its locations off the list with it, and a removed row is never listed again.
"""

from typing import Any

from django.db import transaction
from django.db.models import Max, Prefetch, QuerySet
from django.utils import timezone

from ..errors import CampaignError
from ..models import CampaignLocation, CampaignLocationChart, CampaignLocationGroup
from .location_tables import write_links, write_tables

UNKNOWN_GROUP = "Put the location in one of the campaign's groups."


def listed_locations() -> "QuerySet[CampaignLocation]":
    """Locations not removed, each with its own tables (their results and the results' tables) and its links."""
    links = CampaignLocationChart.objects.select_related("chart").order_by("order", "id")
    return (
        CampaignLocation.objects.filter(removed_at__isnull=True)
        .prefetch_related("tables__rows__charts__rows", Prefetch("chart_links", queryset=links))
        .order_by("order", "id")
    )


def location_groups(campaign_id: int) -> "QuerySet[CampaignLocationGroup]":
    """The listed groups in their order, each with its listed locations: seven queries, whatever they hold."""
    return (
        CampaignLocationGroup.objects.filter(campaign_id=campaign_id, removed_at__isnull=True)
        .prefetch_related(Prefetch("locations", queryset=listed_locations()))
        .order_by("order", "id")
    )


def group_of(campaign_id: int, group_id: int) -> CampaignLocationGroup | None:
    return CampaignLocationGroup.objects.filter(campaign_id=campaign_id, id=group_id, removed_at__isnull=True).first()


def visitable(campaign_id: int, location_id: int) -> CampaignLocation | None:
    """A listed location of a listed group, alone (a visit reads nothing else of it)."""
    rows = CampaignLocation.objects.filter(campaign_id=campaign_id, id=location_id, removed_at__isnull=True)
    return rows.filter(group__removed_at__isnull=True).first()


def location_of(campaign_id: int, location_id: int) -> CampaignLocation | None:
    """A listed location of a listed group, with what the answer reads."""
    return listed_locations().filter(campaign_id=campaign_id, id=location_id, group__removed_at__isnull=True).first()


def _next(rows: "QuerySet[Any]") -> int:
    last = rows.aggregate(last=Max("order"))["last"]
    return 0 if last is None else last + 1


def create_group(campaign_id: int, validated: dict[str, Any]) -> CampaignLocationGroup:
    with transaction.atomic():
        order = _next(CampaignLocationGroup.objects.filter(campaign_id=campaign_id))
        return CampaignLocationGroup.objects.create(campaign_id=campaign_id, order=order, **validated)


def update_group(group: CampaignLocationGroup, validated: dict[str, Any]) -> CampaignLocationGroup:
    for field, value in validated.items():
        setattr(group, field, value)
    group.save(update_fields=[*validated, "updated_at"])
    return group


def remove_group(group: CampaignLocationGroup, by: Any) -> None:
    """Take the group and its locations off the list (a soft delete)."""
    now = timezone.now()
    with transaction.atomic():
        CampaignLocation.objects.filter(group=group, removed_at__isnull=True).update(removed_at=now, removed_by=by)
        CampaignLocationGroup.objects.filter(id=group.id).update(removed_at=now, removed_by=by)


def _group_id(campaign_id: int, group_id: int) -> int:
    if group_of(campaign_id, group_id) is None:
        raise CampaignError(UNKNOWN_GROUP, code="location_group_unknown", fields={"group_id": [UNKNOWN_GROUP]})
    return group_id


def create_location(campaign_id: int, validated: dict[str, Any]) -> CampaignLocation:
    """The new location, last in its group, with its tables and links."""
    tables, chart_ids = validated.pop("tables", []), validated.pop("chart_ids", [])
    with transaction.atomic():
        group_id = _group_id(campaign_id, validated.pop("group_id"))
        order = _next(CampaignLocation.objects.filter(group_id=group_id))
        location = CampaignLocation.objects.create(campaign_id=campaign_id, group_id=group_id, order=order, **validated)
        write_tables(location, tables)
        write_links(location, chart_ids)
    return location


def update_location(location: CampaignLocation, validated: dict[str, Any]) -> CampaignLocation:
    """The location as the request sent it; its tables and links are replaced only when they were sent. Moved to
    another group, it goes last there."""
    tables, chart_ids = validated.pop("tables", None), validated.pop("chart_ids", None)
    with transaction.atomic():
        group_id = validated.pop("group_id", location.group_id)
        if group_id != location.group_id:
            location.group_id = _group_id(location.campaign_id, group_id)
            location.order = _next(CampaignLocation.objects.filter(group_id=group_id))
            validated |= {"group_id": group_id, "order": location.order}
        for field, value in validated.items():
            setattr(location, field, value)
        location.save(update_fields=[*validated, "updated_at"])
        if tables is not None:
            write_tables(location, tables)
        if chart_ids is not None:
            write_links(location, chart_ids)
    return location


def remove_location(location: CampaignLocation, by: Any) -> None:
    """Take it off the list (a soft delete)."""
    CampaignLocation.objects.filter(id=location.id).update(removed_at=timezone.now(), removed_by=by)
