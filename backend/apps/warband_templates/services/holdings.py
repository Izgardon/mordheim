"""What a warband already has of its template: its units on the roster by the fighter they were recruited as ("1 of
0–2", a henchman's models and groups), and the copies it holds of an item a list limits per warband ("One per
warband"). Each in one query, whatever the roster's size."""

from collections.abc import Iterable
from typing import Any

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from apps.items.models import Item
from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    Hero,
    HeroItem,
    HirelingItem,
    Warband,
    WarbandItem,
    on_roster,
)

Holding = dict[str, int]  # {"count": heroes, or a henchman's living models; "groups": his groups}
LIVING = {"dead": False, "dismissed_at__isnull": True}


def fighter_holdings(warband: Warband) -> dict[str, Holding]:
    """Fighter key -> what the warband has of him: heroes on the roster, or a henchman's groups and living models
    (two queries). Units added by hand (no key) aren't counted."""
    heroes = (
        on_roster(Hero.objects.filter(warband=warband))
        .exclude(fighter_key="")
        .order_by()
        .values_list("fighter_key")
        .annotate(count=Count("id"))
    )
    found: dict[str, Holding] = {key: {"count": count, "groups": 0} for key, count in heroes}
    living = Count("henchmen", filter=Q(henchmen__dead=False, henchmen__dismissed_at__isnull=True))
    groups = (
        on_roster(HenchmenGroup.objects.filter(warband=warband))
        .exclude(fighter_key="")
        .order_by()
        .values("fighter_key")
        .annotate(groups=Count("id", distinct=True), models=living)
    )
    for row in groups:
        found[row["fighter_key"]] = {"count": row["models"], "groups": row["groups"]}
    return found


def held_items(warband: Warband, item_ids: Iterable[int]) -> dict[int, int]:
    """Item id -> the copies the warband holds: its heroes' and hired swords' on the roster, one per living member
    carrying a group's row, and the stash (one query)."""
    wanted = sorted(set(item_ids))
    if not wanted:
        return {}
    ref = OuterRef("pk")
    heroes = HeroItem.objects.filter(item_id=ref, hero__warband=warband, **{f"hero__{k}": v for k, v in LIVING.items()})
    hired = HirelingItem.objects.filter(
        item_id=ref, hireling__warband=warband, **{f"hireling__{k}": v for k, v in LIVING.items()}
    )
    carried = Henchman.objects.filter(
        group__henchmen_group_items__item_id=ref,
        group__warband=warband,
        group__dead=False,
        group__dismissed_at__isnull=True,
        **LIVING,
    )
    stash = WarbandItem.objects.filter(item_id=ref, warband=warband)
    rows = Item.objects.filter(id__in=wanted).annotate(
        on_heroes=_subtotal(heroes, "item_id", Count("id")),
        on_hired=_subtotal(hired, "item_id", Count("id")),
        on_members=_subtotal(carried, "group__henchmen_group_items__item_id", Count("id")),
        in_stash=_subtotal(stash, "item_id", Sum("quantity")),
    )
    return {row.pk: row.on_heroes + row.on_hired + row.on_members + row.in_stash for row in rows}


def _subtotal(rows: Any, by: str, value: Any) -> Coalesce:
    """`rows` (already narrowed to one item) totalled as a subquery, 0 when there are none."""
    summed = rows.order_by().values(by).annotate(n=value).values("n")[:1]
    return Coalesce(Subquery(summed, output_field=IntegerField()), Value(0))
