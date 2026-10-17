"""What one more henchman costs a group (decision 7, BUG-66, BUG-85).

The group's base price, plus one member's share of the group's items, plus twice its whole XP (a half
point is dropped), in whole gold crowns. A group stores one item row per copy (three members with swords
carry three sword rows), so a member's share of an item is its copies divided by the living members,
rounded down but at least one copy, priced at the item's first row: the roster card's "Reinforce Cost".
"""

from collections.abc import Iterable
from decimal import Decimal
from typing import Any


def member_item_share(item_rows: Iterable[tuple[int, int | None]], members: int) -> int:
    """One member's share of a group's items, from its (item id, cost) rows in id order."""
    first_cost: dict[int, int] = {}
    copies: dict[int, int] = {}
    for item_id, cost in item_rows:
        first_cost.setdefault(item_id, int(cost or 0))
        copies[item_id] = copies.get(item_id, 0) + 1
    return sum(
        first_cost[item_id] * (max(1, count // members) if members > 0 else 1) for item_id, count in copies.items()
    )


def henchman_hire_cost(price: Any, xp: Any, item_rows: Iterable[tuple[int, int | None]], members: int) -> int:
    """Base price + one member's share of the items (`members` living members) + 2 x whole XP."""
    whole_xp = int(Decimal(str(xp or 0)))
    return int(price or 0) + member_item_share(item_rows, members) + 2 * max(whole_xp, 0)
