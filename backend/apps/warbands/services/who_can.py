"""Who may buy, hire or learn (the items rebuild): where a warband stands in a who-can list, the price row each item
offers it, and whether it can hire each hired sword and dramatis persona.

A list says whether it is for everyone and names warband types or groups, each included or excluded
(`models.types.WarbandAccess`). A warband reads it through its type, the types it counts as, and their groups
(`Buyer`). Where a price row names it:

1. a line naming its type or a type it counts as;
2. otherwise a line naming a group one of them is in;
3. otherwise a row for everyone, unless an excluded line names one of its types or groups;
4. otherwise the item is "not usually available": it can still be bought at its first row, with the reason.

Among an item's rows a warband may use, the lowest step wins, then a row without a label (a "Brace" or "Skink heroes"
row is a variant, never the default), then the row naming the fewest warbands (the more specific), then the commonest,
the cheapest and the first. An item from a setting the campaign hasn't ticked is treated like step 4, the setting named
in the reason; a campaign's own item has no setting and is always in play there. Restrictions warn, they never
block: `can_buy` and the reason are for the pages, purchases never read them.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from apps.warbands.models import Warband

from .types import types_of

SortKey = tuple[int, bool, int, int, int, int]


@dataclass(frozen=True)
class Buyer:
    """A warband as a who-can list reads it: its types (its own and those it counts as), their groups, and the name
    a reason gives it ("Not usually available to Skaven")."""

    type_ids: frozenset[int]
    group_ids: frozenset[int]
    name: str


def buyer_of(warband: Warband) -> Buyer:
    """The warband's types and groups (read with its types: `types_of`)."""
    own, counts_as = types_of(warband)
    types = [row for row in (own, *counts_as) if row is not None]
    groups = {group for row in types for group in getattr(row, "group_ids", None) or []}
    return Buyer(frozenset(row.pk for row in types), frozenset(groups), own.name if own else "this warband")


def step(for_everyone: bool, lines: Iterable[Any], buyer: Buyer) -> int | None:
    """Where a who-can list lets the buyer in (1 its type, 2 its group, 3 everyone), or None (not usually)."""
    lines = list(lines)
    named = [line for line in lines if not line.excluded]
    if any(line.warband_type_id in buyer.type_ids for line in named):
        return 1
    if any(line.warband_group_id in buyer.group_ids for line in named):
        return 2
    shut_out = any(
        line.warband_type_id in buyer.type_ids or line.warband_group_id in buyer.group_ids
        for line in lines
        if line.excluded
    )
    return 3 if for_everyone and not shut_out else None


def _rank(row: Any, index: int, at: int) -> SortKey:
    named = sum(1 for line in row.warband_links.all() if not line.excluded)
    return (at, bool(row.label), named, row.rarity or 0, row.cost or 0, index)


def not_usually(buyer: Buyer) -> str:
    return f"Not usually available to {buyer.name}."


def out_of_play(setting: str) -> str:
    return f"{setting} isn't in this campaign."


@dataclass(frozen=True)
class Offer:
    """The price row an item offers a warband (`availability_id`), the other rows it may use (`options`, the chosen
    first), whether it can usually buy it, and why not."""

    item_id: int
    availability_id: int
    options: list[int]
    can_buy: bool
    reason: str

    def payload(self) -> dict[str, Any]:
        return {
            "item_id": self.item_id,
            "availability_id": self.availability_id,
            "options": self.options,
            "can_buy": self.can_buy,
            "reason": self.reason,
        }


def offer(item: Any, buyer: Buyer, in_play: bool, setting: str) -> Offer | None:
    """The item's offer to the buyer (its price rows and their lines prefetched); None for an item with no rows."""
    rows: Sequence[Any] = list(item.availabilities.all())
    if not rows:
        return None
    usable = sorted(
        (_rank(row, index, at), row)
        for index, row in enumerate(rows)
        if (at := step(row.for_everyone, row.warband_links.all(), buyer)) is not None
    )
    reasons = [] if usable else [not_usually(buyer)]
    if not in_play:
        reasons.append(out_of_play(setting))
    chosen = [row for _key, row in usable] or [rows[0]]
    return Offer(item.pk, chosen[0].pk, [row.pk for row in chosen], not reasons, " ".join(reasons))


def access(entry: Any, buyer: Buyer, in_play: bool, setting: str) -> dict[str, Any]:
    """Whether the buyer can usually hire (or learn) the entry, and why not: `{id, can_hire, reason}`."""
    reasons = [] if step(entry.for_everyone, entry.warband_links.all(), buyer) else [not_usually(buyer)]
    if not in_play:
        reasons.append(out_of_play(setting))
    return {"id": entry.pk, "can_hire": not reasons, "reason": " ".join(reasons)}
