import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Nullable columns: existing rows get NULL (no trader spent by this trade), no table rewrite."""

    dependencies = [
        ("trades", "0003_trade_request_offers"),
        ("warbands", "0026_warband_max_units_15"),
    ]

    operations = [
        migrations.AddField(
            model_name="traderequest",
            name="from_trader_spent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="warbands.hero",
            ),
        ),
        migrations.AddField(
            model_name="traderequest",
            name="to_trader_spent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="warbands.hero",
            ),
        ),
    ]
