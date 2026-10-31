"""Warband types a campaign can pick (grading phase 1): the book's list and the campaign's own, each saying whether
it is in play (apps/campaigns/in_play.py), the types a warband is raised as or counts as, and adding a custom one.

A campaign sees the book's types that aren't archived and its own; another campaign's own types read as unknown.
A type outside the campaign's settings can still be picked: the picker greys it with a warning, the server never
refuses it (restrictions warn, they never block).
"""

from collections.abc import Iterable, Sequence
from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import OuterRef, Q, QuerySet
from django.db.models.functions import Lower
from django.utils.text import slugify
from rest_framework import serializers

from apps.campaigns.in_play import with_in_play
from apps.warbands.models import Warband, WarbandGroup, WarbandType

WarbandTypes = tuple[WarbandType | None, list[WarbandType]]  # a warband's type and the types it counts as


def with_group_names(rows: QuerySet[WarbandType]) -> QuerySet[WarbandType]:
    """`rows` with their setting, `group_names` (their groups' names, in order) and `group_ids` (what a who-can
    list reads) in the same query."""
    groups = WarbandGroup.objects.filter(members=OuterRef("pk")).order_by("sort_order", "name")
    return rows.select_related("campaign_type").annotate(
        group_names=ArraySubquery(groups.values("name")), group_ids=ArraySubquery(groups.values("id"))
    )


def campaign_types(campaign_id: int) -> QuerySet[WarbandType]:
    """The types the campaign may pick: the book's (not archived) and its own (not archived)."""
    return WarbandType.objects.filter(Q(campaign__isnull=True) | Q(campaign_id=campaign_id), archived_at__isnull=True)


def type_list(campaign_id: int) -> QuerySet[WarbandType]:
    """The picker's list: each type with its setting, its groups' names and `in_play` (one query)."""
    return with_in_play(with_group_names(campaign_types(campaign_id)), campaign_id).order_by(
        "name", "source_code", "id"
    )


def load_types(warbands: Sequence[Warband]) -> None:
    """What the warbands' payloads say of their types, in one query: each warband's type and the types it counts
    as, with their settings and groups' names, kept on the warband (`types_of` reads them)."""
    links = Warband.counts_as.through.objects.filter(warband_id__in=[warband.pk for warband in warbands])
    own = {warband.warband_type_id for warband in warbands} - {None}
    counted = links.filter(warbandtype_id=OuterRef("pk")).values("warband_id")
    rows = list(
        with_group_names(WarbandType.objects.filter(Q(pk__in=own) | Q(pk__in=links.values("warbandtype_id"))))
        .annotate(counted_by_ids=ArraySubquery(counted))
        .order_by("name", "id")
    )
    by_id = {row.pk: row for row in rows}
    for warband in warbands:
        counts_as = [row for row in rows if warband.pk in getattr(row, "counted_by_ids")]  # noqa: B009
        setattr(warband, "_warband_types", (by_id.get(warband.warband_type_id or 0), counts_as))  # noqa: B010


def types_of(warband: Warband) -> WarbandTypes:
    """The warband's type and the types it counts as (`load_types`, read now if they weren't)."""
    if not hasattr(warband, "_warband_types"):
        load_types([warband])
    loaded: WarbandTypes = getattr(warband, "_warband_types")  # noqa: B009
    return loaded


def scoped_types(campaign_id: int, ids: Iterable[int], field: str) -> list[WarbandType]:
    """The types `ids` names, in order and without repeats, each one the campaign may pick; an id it may not reads as
    unknown (a 400 on `field`)."""
    wanted = list(dict.fromkeys(ids))
    found = {row.pk: row for row in campaign_types(campaign_id).filter(id__in=wanted)}
    missing = [pk for pk in wanted if pk not in found]
    if missing:
        raise serializers.ValidationError({field: [f'Invalid pk "{pk}" - object does not exist.' for pk in missing]})
    return [found[pk] for pk in wanted]


def unique_slug(campaign_id: int, name: str) -> str:
    base = slugify(name)[:120] or "custom"
    taken = set(
        WarbandType.objects.filter(campaign_id=campaign_id, slug__startswith=base).values_list("slug", flat=True)
    )
    slug, count = base, 1
    while slug in taken:
        count += 1
        slug = f"{base}-{count}"
    return slug


def add_custom_type(campaign_id: int, user: Any, name: str, link_url: str = "") -> WarbandType:
    """A type of the campaign's own, which every player in it can pick; a name it already uses is a 400."""
    name = name.strip()
    if (
        WarbandType.objects.annotate(lowered=Lower("name"))
        .filter(campaign_id=campaign_id, lowered=name.lower())
        .exists()
    ):
        raise serializers.ValidationError({"name": [f"This campaign already has a warband type called {name}."]})
    return WarbandType.objects.create(
        campaign_id=campaign_id, name=name, slug=unique_slug(campaign_id, name), link_url=link_url, created_by=user
    )


def picked_types(campaign_id: int, validated: dict[str, Any]) -> list[WarbandType] | None:
    """A create's or an edit's types: `warband_type_id` becomes `warband_type` in `validated`, and the types
    `counts_as_ids` names are returned (None when it isn't sent) for the caller to set once the warband is saved."""
    if "warband_type_id" in validated:
        validated["warband_type"] = scoped_types(campaign_id, [validated.pop("warband_type_id")], "warband_type_id")[0]
    counts_as = validated.pop("counts_as_ids", None)
    return None if counts_as is None else scoped_types(campaign_id, counts_as, "counts_as_ids")
