from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("trades", "0002_rename_trade_requ_campaign_3a2d2a_idx_trade_reque_campaig_c93154_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="traderequest",
            name="from_offer",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="traderequest",
            name="to_offer",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="traderequest",
            name="from_accepted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="traderequest",
            name="to_accepted",
            field=models.BooleanField(default=False),
        ),
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
                ],
                default="pending",
                max_length=16,
            ),
        ),
    ]
