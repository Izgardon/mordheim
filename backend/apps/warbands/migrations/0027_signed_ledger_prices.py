# Ledger prices become signed: spending negative, income positive (decision 4, BUG-37).
#
# Gold has always been read with one rule: abs(price), subtracted for the actions below (lower-cased and
# trimmed) and added for everything else. The writers stored mixed signs ("Bought" and "Trade sent" positive,
# a few hand-entered rows negative), so SUM(price) wasn't the gold. This stores each row's price as the rule
# reads it, so every warband's gold is unchanged and SUM(price) equals it. Only rows whose sign changes are
# written. Reversing stores the signs the old writers used (negative only for the exact actions in the old
# TradeHelper.NEGATIVE_TRADE_ACTIONS), which the old rule reads as the same gold.

from django.db import migrations

# summary.EXPENSE_ACTIONS when this migration was written
SIGNED = (
    "CASE WHEN lower(trim(action)) IN ('buy', 'bought', 'recruit', 'recruited', 'hire', 'hired', 'upkeep', "
    "'trade sent') THEN -abs(price) ELSE abs(price) END"
)
OLD_SIGNS = (
    "CASE WHEN action IN ('Buy', 'Upkeep', 'Recruit', 'Recruited', 'Hire', 'Hired') "
    "THEN -abs(price) ELSE abs(price) END"
)

SIGN_PRICES = f"UPDATE warband_trades SET price = {SIGNED} WHERE price <> {SIGNED}"
RESTORE_OLD_SIGNS = f"UPDATE warband_trades SET price = {OLD_SIGNS} WHERE price <> {OLD_SIGNS}"


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0026_warband_max_units_15"),
    ]

    operations = [
        migrations.RunSQL(SIGN_PRICES, RESTORE_OLD_SIGNS),
    ]
