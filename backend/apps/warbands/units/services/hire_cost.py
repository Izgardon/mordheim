"""What one more henchman costs a group (decision 7, BUG-66, BUG-85, henchmen loadouts).

The group's base price, plus its loadout (one copy of each row: what every member carries, services/loadouts.py),
plus twice its whole XP (a half point is dropped), in whole gold crowns: the roster card's "Reinforce Cost". A recruit
who takes a row's copy from the stash, or joins without it, is charged that much less.
"""

from collections.abc import Iterable
from decimal import Decimal
from typing import Any


def henchman_hire_cost(price: Any, xp: Any, row_costs: Iterable[int | None]) -> int:
    """Base price + one copy of each loadout row + 2 x whole XP."""
    whole_xp = int(Decimal(str(xp or 0)))
    return int(price or 0) + sum(int(cost or 0) for cost in row_costs) + 2 * max(whole_xp, 0)
