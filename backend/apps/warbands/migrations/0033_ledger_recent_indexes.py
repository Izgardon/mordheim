# Newest-first pages of the warband log and the treasury (ECON-PERF-06): one index each on
# (warband, -created_at, -id), the order and cursor of every page. Both tables are small (a few hundred rows per
# warband), so a plain CREATE INDEX holds its write lock only briefly.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0032_warband_trade_corrects"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="warbandlog",
            index=models.Index(fields=["warband", "-created_at", "-id"], name="warband_log_recent_idx"),
        ),
        migrations.AddIndex(
            model_name="warbandtrade",
            index=models.Index(fields=["warband", "-created_at", "-id"], name="warband_trades_recent_idx"),
        ),
    ]
