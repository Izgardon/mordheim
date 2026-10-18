# The row an adjustment corrects (decision 5: append-only history). Nullable: existing rows stay NULL, no table
# rewrite, plus one index on a small table.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0031_warband_trade_created_by"),
    ]

    operations = [
        migrations.AddField(
            model_name="warbandtrade",
            name="corrects",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="corrections",
                to="warbands.warbandtrade",
            ),
        ),
    ]
