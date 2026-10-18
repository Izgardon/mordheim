# One vocabulary for ledger rows (decision 4): Buy, Sell, Recruit, Hire, Upkeep, Reward, Exploration, Trade,
# Adjustment, Starting gold, and Group for headers. Old names are renamed, matched lower-cased and trimmed:
# Bought -> Buy, Sold -> Sell, Recruited -> Recruit, Hired -> Hire, Trade sent / Trade received -> Trade (0027
# already signed them), Starting Gold -> Starting gold. Any other text was a hand-entered row counted as income:
# it becomes an "Adjustment" with the old text kept at the front of its description. Prices don't change, so
# no warband's gold does. The choices themselves change no SQL.
#
# Reversing keeps the gold the previous release would read: Trade rows go back to "Trade sent" (negative) and
# "Trade received", and an Adjustment that takes gold away becomes a "Buy" ("Adjustment: ..."), since the
# previous release counted unknown text as income. Other names stay in the vocabulary's spelling.

from django.db import migrations, models

NAMES = {
    "buy": "Buy",
    "bought": "Buy",
    "sell": "Sell",
    "sold": "Sell",
    "recruit": "Recruit",
    "recruited": "Recruit",
    "hire": "Hire",
    "hired": "Hire",
    "upkeep": "Upkeep",
    "reward": "Reward",
    "exploration": "Exploration",
    "trade": "Trade",
    "trade sent": "Trade",
    "trade received": "Trade",
    "adjustment": "Adjustment",
    "starting gold": "Starting gold",
    "group": "Group",
}
KEY = "lower(trim(action))"
KNOWN = ", ".join(f"'{name}'" for name in NAMES)
RENAMED = "CASE " + " ".join(f"WHEN {KEY} = '{old}' THEN '{new}'" for old, new in NAMES.items()) + " END"

RENAME_ACTIONS = f"UPDATE warband_trades SET action = {RENAMED} WHERE {KEY} IN ({KNOWN}) AND action <> {RENAMED}"
FREE_TEXT_TO_ADJUSTMENTS = (
    "UPDATE warband_trades SET action = 'Adjustment', description = left(action || ': ' || description, 500) "
    f"WHERE {KEY} NOT IN ({KNOWN})"
)
RESTORE_TRADE_NAMES = (
    "UPDATE warband_trades SET action = CASE WHEN price < 0 THEN 'Trade sent' ELSE 'Trade received' END "
    "WHERE action = 'Trade'"
)
RESTORE_SPENDING_ADJUSTMENTS = (
    "UPDATE warband_trades SET action = 'Buy', description = left('Adjustment: ' || description, 500) "
    "WHERE action = 'Adjustment' AND price < 0"
)

ACTION_CHOICES = [
    ("Buy", "Buy"),
    ("Sell", "Sell"),
    ("Recruit", "Recruit"),
    ("Hire", "Hire"),
    ("Upkeep", "Upkeep"),
    ("Reward", "Reward"),
    ("Exploration", "Exploration"),
    ("Trade", "Trade"),
    ("Adjustment", "Adjustment"),
    ("Starting gold", "Starting Gold"),
    ("Group", "Group"),
]


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0029_backfill_warband_gold"),
    ]

    operations = [
        migrations.RunSQL(
            [RENAME_ACTIONS, FREE_TEXT_TO_ADJUSTMENTS], [RESTORE_SPENDING_ADJUSTMENTS, RESTORE_TRADE_NAMES]
        ),
        migrations.AlterField(
            model_name="warbandtrade",
            name="action",
            field=models.CharField(choices=ACTION_CHOICES, max_length=120),
        ),
    ]
