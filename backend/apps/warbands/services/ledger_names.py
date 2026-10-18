"""Ledger action names: the vocabulary, and the older names clients and rows still use (decision 4).

Hand-entered rows are named from the vocabulary (`LedgerAction`, any case). Clients from before it send the
automatic names ("Bought", "Sold", "Recruited", "Hired", "Trade sent", "Trade received"), which map onto it.
Rows written under the old names (by a release from before the vocabulary while this one deployed) are renamed
and signed by `normalise_legacy_rows`, which `manage.py check_gold --fix` runs.
"""

from dataclasses import dataclass

from django.db import transaction

from apps.warbands.models import LedgerAction, WarbandTrade

# What the old names mean: the action, and the sign they force (None: the action decides).
LEGACY_NAMES: dict[str, tuple[LedgerAction, int | None]] = {
    "bought": (LedgerAction.BUY, None),
    "sold": (LedgerAction.SELL, None),
    "recruited": (LedgerAction.RECRUIT, None),
    "hired": (LedgerAction.HIRE, None),
    "trade sent": (LedgerAction.TRADE, -1),
    "trade received": (LedgerAction.TRADE, 1),
}
# The actions the gold rule counted as spending before the vocabulary (lower-cased and trimmed).
OLD_EXPENSES = frozenset({"buy", "bought", "recruit", "recruited", "hire", "hired", "upkeep", "trade sent"})
DESCRIPTION_LENGTH = 500  # WarbandTrade.description


@dataclass(frozen=True)
class ParsedAction:
    action: LedgerAction
    sign: int | None = None  # forced by an old name ("Trade sent" -1, "Trade received" +1)

    def amount(self, price: int) -> int:
        """The change in gold for a hand-entered price: signed by the old name or the action, or as given for an
        action that goes either way."""
        if self.sign is not None:
            return self.sign * abs(price)
        if self.action.is_signed:
            return price
        return -abs(price) if self.action.is_expense else abs(price)


VOCABULARY = {action.value.lower(): action for action in LedgerAction}


def parse_action(text: str) -> ParsedAction | None:
    """The vocabulary action a name means (any case, old names included); None for anything else."""
    key = text.strip().lower()
    if key in VOCABULARY:
        return ParsedAction(VOCABULARY[key])
    if key in LEGACY_NAMES:
        return ParsedAction(*LEGACY_NAMES[key])
    return None


def normalise_legacy_rows() -> int:
    """Rename and sign rows that carry a name outside the vocabulary, as migrations 0027 and 0030 did: signed by
    the old gold rule, named by `parse_action`, free text kept in the description of an "Adjustment". Their
    gold doesn't change. Returns how many rows were rewritten."""
    with transaction.atomic():
        rows = list(WarbandTrade.objects.select_for_update().exclude(action__in=LedgerAction.values))
        for row in rows:
            old = row.action
            spends = old.strip().lower() in OLD_EXPENSES
            row.price = -abs(row.price) if spends else abs(row.price)
            parsed = parse_action(old)
            if parsed is None:
                row.action = LedgerAction.ADJUSTMENT
                row.description = f"{old}: {row.description}"[:DESCRIPTION_LENGTH]
            else:
                row.action = parsed.action
        WarbandTrade.objects.bulk_update(rows, ["action", "description", "price"])
    return len(rows)
