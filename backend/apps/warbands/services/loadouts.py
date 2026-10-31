"""Henchmen loadouts: a group's item rows are what every member carries, one copy each (the items plan, step 12).

A row stands for one copy per living member, less the members who lack it (`HenchmanItemGap`): his horse died, he used
it up, his kit went to the stash, or he joined (or the row came) without one. A gap is a warning on the member, never a
block. Copies arrive as one row (a purchase for the group: "a sword each"; copies from the stash or another unit, the
members past the copies getting gaps) and leave as one row (to the stash, sold, given away: its copies are its
carriers). Nothing here locks: the callers lock the warband first, as every roster write does.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from django.db.models import Count, Exists, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce, Greatest

from apps.items.models import Item
from apps.warbands.models import Henchman, HenchmanItemGap, HenchmenGroup, HenchmenGroupItem, on_roster
from apps.warbands.units.companions import beast_of, companions

Costs = list[int | None]


def living_ids(group_id: int) -> list[int]:
    """The group's living members, oldest first: one query."""
    return list(on_roster(Henchman.objects.filter(group_id=group_id)).order_by("id").values_list("id", flat=True))


def first_known(costs: Iterable[int | None]) -> int | None:
    """The cost a row of these copies keeps: the first one known."""
    return next((cost for cost in costs if cost is not None), None)


def _count(rows: Any, column: str) -> Subquery:
    counted = rows.order_by().values(column).annotate(n=Count("id")).values("n")
    return Subquery(counted, output_field=IntegerField())


def carriers(row: str = "pk", group: str = "henchmen_group_id") -> Any:
    """The copies a loadout row stands for, as an expression on a query of rows (`row` and `group` reach its id and
    its group's from there): the group's living members less those with a gap on it, never below 0. Two subqueries
    in the query's own SELECT."""
    living = _count(on_roster(Henchman.objects.filter(group_id=OuterRef(group))), "group_id")
    gaps = HenchmanItemGap.objects.filter(group_item_id=OuterRef(row), henchman__dead=False)
    lacking = _count(gaps.filter(henchman__dismissed_at__isnull=True), "group_item_id")
    return Greatest(Coalesce(living, Value(0)) - Coalesce(lacking, Value(0)), Value(0))


def with_carriers(rows: Any) -> Any:
    """Group rows annotated with their `carriers`."""
    return rows.annotate(carriers=carriers())


def carriers_of(row: Any) -> int:
    """The copies an annotated row stands for (`with_carriers`)."""
    return int(row.carriers or 0)


def add_row(
    group: HenchmenGroup,
    item: Item,
    costs: Sequence[int | None],
    *,
    companion: bool = False,
    reason: str = HenchmanItemGap.SHORT,
) -> HenchmenGroupItem:
    """One loadout row for these copies, one each for the oldest living members: the newest members past the copies
    get a gap. The row keeps the first known cost."""
    living = living_ids(group.pk)
    row = HenchmenGroupItem.objects.create(
        henchmen_group=group, item=item, cost=first_known(costs), companion=companion
    )
    short = living[len(costs) :]
    HenchmanItemGap.objects.bulk_create(HenchmanItemGap(henchman_id=pk, group_item=row, reason=reason) for pk in short)
    return row


@dataclass(frozen=True)
class TakenRow:
    item_id: int
    costs: Costs  # one per copy that left: the row's carriers


def peek_row(group: HenchmenGroup, item_id: int) -> Any:
    """The row of `item_id` a move or sale takes from the group: its newest, a row it rides last (annotated with its
    carriers); None when it carries none."""
    rows = HenchmenGroupItem.objects.filter(henchmen_group=group, item_id=item_id).order_by("companion", "-id")
    return with_carriers(rows).first()


def take_row(group: HenchmenGroup, item_id: int) -> TakenRow:
    """Take one loadout row off the group: a copy for each living member who carries it, at the row's cost (the row and
    its gaps go). ValueError when the group carries none, or another request took it first."""
    row = peek_row(group, item_id)
    if row is None:
        raise ValueError("Item not found.")
    deleted, _ = HenchmenGroupItem.objects.filter(pk=row.pk).delete()
    if not deleted:
        raise ValueError("Item not found.")
    return TakenRow(row.item_id, [row.cost] * carriers_of(row))


def carried_rows(member: Henchman) -> list[HenchmenGroupItem]:
    """The group's rows the member carries (none he has a gap on), in row order, with their items: one query."""
    gapped = HenchmanItemGap.objects.filter(henchman=member, group_item=OuterRef("pk"))
    rows = HenchmenGroupItem.objects.filter(henchmen_group_id=member.group_id).select_related("item__bestiary_entry")
    return list(rows.filter(~Exists(gapped)).order_by("id"))


def gap_rows(rows: Iterable[HenchmenGroupItem], members: Iterable[int], reason: str) -> list[HenchmanItemGap]:
    """A gap on each of these rows for each member (none duplicated: a member who already lacks one keeps his)."""
    row_ids = [row.pk for row in rows]
    member_ids = list(members)
    held = set(
        HenchmanItemGap.objects.filter(henchman_id__in=member_ids, group_item_id__in=row_ids).values_list(
            "henchman_id", "group_item_id"
        )
    )
    gaps = [
        HenchmanItemGap(henchman_id=member, group_item_id=row_id, reason=reason)
        for member in member_ids
        for row_id in row_ids
        if (member, row_id) not in held
    ]
    return HenchmanItemGap.objects.bulk_create(gaps)


def loadout_totals(rows: Iterable[Any], members: Iterable[Any]) -> tuple[int, int]:
    """(each, total): what one member's loadout cost, and the copies the group holds at their costs (members times the
    loadout, less the gaps), from loaded rows and living members each read with their gap rows (`gap_entries`)."""
    living = list(members)
    rows = list(rows)
    each = sum(int(row.cost or 0) for row in rows)
    lacking = lacking_by_row(living)
    total = sum(int(row.cost or 0) * max(len(living) - lacking.get(row.pk, 0), 0) for row in rows)
    return each, total


def lacking_by_row(members: Iterable[Any]) -> dict[int, int]:
    """Row id -> how many of these members (read with `gap_entries`) lack it."""
    lacking: dict[int, int] = {}
    for member in members:
        for gap in getattr(member, "gap_entries", None) or []:
            lacking[gap["row_id"]] = lacking.get(gap["row_id"], 0) + 1
    return lacking


def group_mount_rating_of(rows: Iterable[Any], members: Sequence[Any]) -> int:
    """A group's first ridden mount's rating bonus times the members who carry it, from loaded rows (`with_beasts`) and
    living members read with their gaps: what `summary.group_mount_rating` reads in SQL."""
    ridden = companions(rows).mounts
    if not ridden:
        return 0
    row = ridden[0]
    riders = max(len(members) - lacking_by_row(members).get(row.pk, 0), 0)
    return int(beast_of(row.item).rating_bonus or 0) * riders
