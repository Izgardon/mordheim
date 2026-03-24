import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "notification_type",
                    models.CharField(
                        choices=[
                            ("trade_request", "Trade request"),
                            ("battle_invite", "Battle invite"),
                            ("battle_result_request", "Battle result request"),
                        ],
                        max_length=30,
                    ),
                ),
                ("campaign_id", models.IntegerField()),
                ("reference_id", models.CharField(max_length=64)),
                ("payload", models.JSONField(default=dict)),
                ("is_resolved", models.BooleanField(default=False)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "notification"},
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(
                fields=["user", "is_resolved", "created_at"],
                name="notification_user_resolved_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.UniqueConstraint(
                fields=["user", "notification_type", "reference_id"],
                name="notification_unique_user_type_ref",
            ),
        ),
    ]
