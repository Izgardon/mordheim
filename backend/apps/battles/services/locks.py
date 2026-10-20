"""The order battle writes take their row locks in, so no two of them can wait on each other (BUG-106).

1. the battle row: every battle write takes it first (BattleScopedView, Close postbattle, Active Battles' cancel),
   so writes to one battle run one at a time;
2. participant rows: the caller's first, then any others the write changes, and an event the caller undoes;
3. the warband row (the ledger's balance UPDATE reuses this lock);
4. the warband's units: heroes, hired swords, henchmen, then their groups (the roster's own order, `lock_warband`
   before any unit);
5. then item, stash and resource rows.

A transaction may skip a step but never goes back up the list. Finalise holds steps 2 to 5 for the player's own
results in one transaction and takes the battle row only in a second, for the "everyone has finished" step
(services/postbattle/finalise.py), so it never waits for the battle while it holds a player's rows. Every lock is
`FOR UPDATE OF` the locked table alone, never the rows its query joins (PERF-37). test_battle_lock_order.py pins
the SQL of every battle write to this order.
"""

from django.db.models import Model, QuerySet

from ..models import Battle

LOCK_ORDER: tuple[tuple[str, ...], ...] = (
    ("battle",),
    ("battle_participant", "battle_event"),
    ("warband",),
    ("hero", "hired_sword", "henchman", "henchmen_group"),
    ("hero_item", "hired_sword_item", "henchmen_group_item", "warband_items", "warband_resources"),
)


def lock_rank(table: str) -> int:
    """The table's step in LOCK_ORDER (ValueError for a table battle writes don't lock)."""
    for rank, tables in enumerate(LOCK_ORDER):
        if table in tables:
            return rank
    raise ValueError(f"battle writes don't lock {table}")


def locked[RowT: Model](rows: QuerySet[RowT], *, skip_locked: bool = False) -> QuerySet[RowT]:
    """The rows, locked until the transaction ends: only their own table's rows, never what the query joins."""
    return rows.select_for_update(of=("self",), skip_locked=skip_locked)


def lock_battle(battle_id: int) -> Battle:
    """Step 1, on its own: the battle row (finalise's last step)."""
    return locked(Battle.objects.filter(id=battle_id)).get()
