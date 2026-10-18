# Fill in `Warband.gold` with the gold the ledger gives under the rule the summary used until now: abs(price),
# subtracted for the spending actions (lower-cased and trimmed) and added for everything else. After 0027 that
# is also SUM(price). One UPDATE; warbands without rows keep 0. Reversing leaves the column to 0028's reverse.
# `manage.py check_gold` reports any warband whose gold differs from its ledger afterwards.

from django.db import migrations

# summary.EXPENSE_ACTIONS when this migration was written
SIGNED = (
    "CASE WHEN lower(trim(action)) IN ('buy', 'bought', 'recruit', 'recruited', 'hire', 'hired', 'upkeep', "
    "'trade sent') THEN -abs(price) ELSE abs(price) END"
)

BACKFILL_GOLD = (
    "UPDATE warband SET gold = ledger.total "
    f"FROM (SELECT warband_id, SUM({SIGNED}) AS total FROM warband_trades GROUP BY warband_id) AS ledger "
    "WHERE ledger.warband_id = warband.id AND warband.gold <> ledger.total"
)


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0028_warband_gold"),
    ]

    operations = [
        migrations.RunSQL(BACKFILL_GOLD, migrations.RunSQL.noop),
    ]
