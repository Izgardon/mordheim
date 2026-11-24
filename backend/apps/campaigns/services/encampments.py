"""A campaign's encampment groups and their encampments (William, 24 Nov 2026), and the encampment rules read with
them.

Every member reads them while the Encampments page is switched on; `manage_encampments` (owners and admins hold it)
adds, edits and removes them. A new group or encampment goes last. Removal is a soft delete (`removed_at`), as for
locations: a removed group takes its encampments off the list with it, and a removed row is never listed again.
Who holds one changes only through `encampment_holding.py`.
"""

from typing import Any

from django.db import transaction
from django.db.models import Max, Prefetch, QuerySet
from django.utils import timezone

from apps.warbands.models import Warband

from ..errors import CampaignError
from ..models import ENCAMPMENT_RULE, CampaignEncampment, CampaignEncampmentGroup, CampaignRule

UNKNOWN_GROUP = "Put the encampment in one of the campaign's groups."


def listed_encampments() -> "QuerySet[CampaignEncampment]":
    """Encampments not removed, each with its holder and the holder's player."""
    return (
        CampaignEncampment.objects.filter(removed_at__isnull=True)
        .select_related("holder__user")
        .order_by("order", "id")
    )


def encampment_groups(campaign_id: int) -> "QuerySet[CampaignEncampmentGroup]":
    """The listed groups in their order, each with its listed encampments: two queries, whatever they hold."""
    return (
        CampaignEncampmentGroup.objects.filter(campaign_id=campaign_id, removed_at__isnull=True)
        .prefetch_related(Prefetch("encampments", queryset=listed_encampments()))
        .order_by("order", "id")
    )


def encampment_rules(campaign_id: int) -> "QuerySet[CampaignRule]":
    """How the campaign's encampments are held: its rules of kind `encampment`, each with its own table (three
    queries)."""
    rules = CampaignRule.objects.filter(campaign_id=campaign_id, kind=ENCAMPMENT_RULE)
    return rules.prefetch_related("charts__rows").order_by("order", "id")


def takers(campaign_id: int, user_id: int, manages: bool) -> list[Warband]:
    """The warbands the reader may take an encampment for: his own, or every warband for a manager, his own first
    (one query)."""
    rows = Warband.objects.filter(campaign_id=campaign_id).select_related("user").order_by("name", "id")
    if not manages:
        rows = rows.filter(user_id=user_id)
    return sorted(rows, key=lambda warband: warband.user_id != user_id)


def held_by(warband: Warband) -> list[dict[str, Any]]:
    """What the warband holds, for its sheet: each listed encampment's id, name and whether it is fortified."""
    rows = CampaignEncampment.objects.filter(
        holder=warband, removed_at__isnull=True, group__removed_at__isnull=True
    ).order_by("group__order", "group_id", "order", "id")
    return [{"id": row.id, "name": row.name, "fortified": row.fortified} for row in rows]


def group_of(campaign_id: int, group_id: int) -> CampaignEncampmentGroup | None:
    return CampaignEncampmentGroup.objects.filter(campaign_id=campaign_id, id=group_id, removed_at__isnull=True).first()


def encampment_of(campaign_id: int, encampment_id: int) -> CampaignEncampment | None:
    """A listed encampment of a listed group, with its holder."""
    rows = listed_encampments().filter(campaign_id=campaign_id, id=encampment_id)
    return rows.filter(group__removed_at__isnull=True).first()


def _next(rows: "QuerySet[Any]") -> int:
    last = rows.aggregate(last=Max("order"))["last"]
    return 0 if last is None else last + 1


def create_group(campaign_id: int, validated: dict[str, Any]) -> CampaignEncampmentGroup:
    with transaction.atomic():
        order = _next(CampaignEncampmentGroup.objects.filter(campaign_id=campaign_id))
        return CampaignEncampmentGroup.objects.create(campaign_id=campaign_id, order=order, **validated)


def update_group(group: CampaignEncampmentGroup, validated: dict[str, Any]) -> CampaignEncampmentGroup:
    for field, value in validated.items():
        setattr(group, field, value)
    group.save(update_fields=[*validated, "updated_at"])
    return group


def remove_group(group: CampaignEncampmentGroup, by: Any) -> None:
    """Take the group and its encampments off the list (a soft delete)."""
    now = timezone.now()
    with transaction.atomic():
        CampaignEncampment.objects.filter(group=group, removed_at__isnull=True).update(removed_at=now, removed_by=by)
        CampaignEncampmentGroup.objects.filter(id=group.id).update(removed_at=now, removed_by=by)


def _group_id(campaign_id: int, group_id: int) -> int:
    if group_of(campaign_id, group_id) is None:
        raise CampaignError(UNKNOWN_GROUP, code="encampment_group_unknown", fields={"group_id": [UNKNOWN_GROUP]})
    return group_id


def create_encampment(campaign_id: int, validated: dict[str, Any]) -> CampaignEncampment:
    """The new encampment, last in its group, held by nobody."""
    with transaction.atomic():
        group_id = _group_id(campaign_id, validated.pop("group_id"))
        order = _next(CampaignEncampment.objects.filter(group_id=group_id))
        return CampaignEncampment.objects.create(campaign_id=campaign_id, group_id=group_id, order=order, **validated)


def update_encampment(encampment: CampaignEncampment, validated: dict[str, Any]) -> CampaignEncampment:
    """The encampment as the request sent it; moved to another group, it goes last there. Who holds it is not
    written here."""
    with transaction.atomic():
        group_id = validated.pop("group_id", encampment.group_id)
        if group_id != encampment.group_id:
            encampment.group_id = _group_id(encampment.campaign_id, group_id)
            encampment.order = _next(CampaignEncampment.objects.filter(group_id=group_id))
            validated |= {"group_id": group_id, "order": encampment.order}
        for field, value in validated.items():
            setattr(encampment, field, value)
        encampment.save(update_fields=[*validated, "updated_at"])
    return encampment


def remove_encampment(encampment: CampaignEncampment, by: Any) -> None:
    """Take it off the list (a soft delete)."""
    CampaignEncampment.objects.filter(id=encampment.id).update(removed_at=timezone.now(), removed_by=by)
