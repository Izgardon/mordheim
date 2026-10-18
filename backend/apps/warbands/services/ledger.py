"""The warband ledger: the one writer of gold (decision 4, ECON-CQ-01).

Every gold change is a signed row in `WarbandTrade` (spending negative) and the same change to the stored
balance `Warband.gold`, written together in the caller's transaction (or in one of their own when the caller
has none). The balance is changed in the database (`gold = gold + amount`) and read back by the same
statement, so concurrent writers never lose an update and the caller's `Warband` shows the new balance.
Writing the balance locks the warband row until the transaction ends: callers that also lock other rows of
the warband (stash, resources) write the ledger first, as postbattle and trade completion do.
`manage.py check_gold` compares every balance with its rows.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from django.db import connection, transaction
from django.db.models import BigIntegerField, F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from apps.warbands.models import LedgerAction, Warband, WarbandTrade

# WarbandTrade.price is a 32-bit integer column.
MAX_TRADE_PRICE = 2_147_483_647


@dataclass(frozen=True)
class Entry:
    warband: Warband
    action: LedgerAction
    amount: int  # the change in gold: negative for spending
    description: str
    notes: str = ""
    parent: WarbandTrade | None = None
    created_by: Any = None  # the user who entered the row by hand (decision 6); None for automatic rows
    corrects: WarbandTrade | None = None  # the row an adjustment corrects (decision 5)


def record(
    warband: Warband,
    action: LedgerAction,
    amount: int,
    description: str,
    *,
    notes: str = "",
    parent: WarbandTrade | None = None,
    created_by: Any = None,
    corrects: WarbandTrade | None = None,
) -> WarbandTrade:
    """Write one ledger row changing the warband's gold by `amount`; `created_by` for a row entered by hand."""
    return record_entries([Entry(warband, action, amount, description, notes, parent, created_by, corrects)])[0]


def group_header(warband: Warband, description: str) -> WarbandTrade:
    """A "Group" row that the rows of one action (a batch of recruits) nest under; it moves no gold."""
    return record(warband, LedgerAction.GROUP, 0, description)


def record_entries(entries: Sequence[Entry]) -> list[WarbandTrade]:
    """Write the rows (one INSERT) and each warband's change in gold (one UPDATE for all of them)."""
    if not entries:
        return []
    if connection.in_atomic_block:
        return _write(entries)
    with transaction.atomic():
        return _write(entries)


def _write(entries: Sequence[Entry]) -> list[WarbandTrade]:
    rows = WarbandTrade.objects.bulk_create(
        WarbandTrade(
            warband=entry.warband,
            action=entry.action,
            description=entry.description,
            price=entry.amount,
            notes=entry.notes or "",
            parent=entry.parent,
            created_by=entry.created_by,
            corrects=entry.corrects,
        )
        for entry in entries
    )
    changes: dict[int, int] = {}
    for entry in entries:
        changes[entry.warband.id] = changes.get(entry.warband.id, 0) + entry.amount
    _change_balances(changes, [entry.warband for entry in entries])
    return rows


def _change_balances(changes: dict[int, int], warbands: Sequence[Warband]) -> None:
    """Add each change to its warband's gold in one statement and show the new balances on `warbands`."""
    changes = {warband_id: amount for warband_id, amount in changes.items() if amount}
    if not changes:
        return
    ids = sorted(changes)
    table, gold, pk = (connection.ops.quote_name(name) for name in (Warband._meta.db_table, "gold", "id"))
    cases = " ".join(f"WHEN {pk} = %s THEN %s" for _ in ids)
    placeholders = ", ".join("%s" for _ in ids)
    sql = f"UPDATE {table} SET {gold} = {gold} + CASE {cases} END WHERE {pk} IN ({placeholders}) RETURNING {pk}, {gold}"
    params = [value for warband_id in ids for value in (warband_id, changes[warband_id])] + ids
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        balances = dict(cursor.fetchall())
    for warband in warbands:
        if warband.id in balances:
            warband.gold = balances[warband.id]


def rewrite_starting_gold(warband: Warband, starting_gold: int) -> None:
    """Make the warband's oldest row "Starting gold" at `starting_gold`, moving the balance by the difference.

    BUG-78 (pass 4): the oldest row of any action is rewritten, as before; a warband without rows gets one.
    """
    amount = abs(int(starting_gold or 0))
    with transaction.atomic():
        row = WarbandTrade.objects.select_for_update().filter(warband=warband).order_by("created_at").first()
        if row is None:
            record(warband, LedgerAction.STARTING_GOLD, amount, "Starting Gold")
            return
        difference = amount - row.price
        row.action, row.description, row.price = LedgerAction.STARTING_GOLD, "Starting Gold", amount
        row.save(update_fields=["action", "description", "price", "updated_at"])
        _change_balances({warband.id: difference}, [warband])


def _ledger_sum() -> Coalesce:
    """The sum of the outer warband's rows, 0 without rows."""
    totals = WarbandTrade.objects.filter(warband=OuterRef("pk")).values("warband").annotate(total=Sum("price"))
    return Coalesce(Subquery(totals.values("total")), Value(0), output_field=BigIntegerField())


def gold_drift() -> list[tuple[int, str, int, int]]:
    """(id, name, stored gold, ledger sum) for every warband whose stored gold differs from its rows."""
    drifted = Warband.objects.annotate(ledger=_ledger_sum()).exclude(gold=F("ledger")).order_by("id")
    return list(drifted.values_list("id", "name", "gold", "ledger"))


def reset_gold(warband_ids: Sequence[int]) -> int:
    """Set each warband's stored gold to the sum of its rows; returns how many were written."""
    return Warband.objects.filter(id__in=warband_ids).update(gold=_ledger_sum())
