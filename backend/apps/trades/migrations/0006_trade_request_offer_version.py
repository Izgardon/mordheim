from django.db import migrations, models


class Migration(migrations.Migration):
    """A constant default: Postgres adds the column without rewriting the table; existing trades start at 0."""

    dependencies = [
        ("trades", "0005_backfill_trader_spent"),
    ]

    operations = [
        migrations.AddField(
            model_name="traderequest",
            name="offer_version",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
