import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("campaigns", "0002_campaignsettings_level_thresholds"),
        ("warbands", "0008_allow_duplicate_skills_spells"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TradeRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("accepted", "Accepted"), ("declined", "Declined"), ("expired", "Expired")], default="pending", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("responded_at", models.DateTimeField(blank=True, null=True)),
                ("expires_at", models.DateTimeField()),
                ("campaign", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trade_requests", to="campaigns.campaign")),
                ("from_user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trade_requests_sent", to=settings.AUTH_USER_MODEL)),
                ("to_user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trade_requests_received", to=settings.AUTH_USER_MODEL)),
                ("from_warband", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trade_requests_sent", to="warbands.warband")),
                ("to_warband", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trade_requests_received", to="warbands.warband")),
            ],
            options={
                "db_table": "trade_request",
            },
        ),
        migrations.AddIndex(
            model_name="traderequest",
            index=models.Index(fields=["campaign", "status"], name="trade_requ_campaign_3a2d2a_idx"),
        ),
        migrations.AddIndex(
            model_name="traderequest",
            index=models.Index(fields=["to_user", "status"], name="trade_requ_to_user_8f7b46_idx"),
        ),
    ]
