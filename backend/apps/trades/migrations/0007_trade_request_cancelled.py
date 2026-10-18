from django.db import migrations, models


class Migration(migrations.Migration):
    """Adds "cancelled" to the status choices: no database change, existing rows keep their status."""

    dependencies = [
        ("trades", "0006_trade_request_offer_version"),
    ]

    operations = [
        migrations.AlterField(
            model_name="traderequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("accepted", "Accepted"),
                    ("declined", "Declined"),
                    ("expired", "Expired"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending",
                max_length=16,
            ),
        ),
    ]
