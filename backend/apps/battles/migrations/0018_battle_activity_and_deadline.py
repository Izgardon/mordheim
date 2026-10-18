import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0017_battleparticipant_skipped_postbattle"),
    ]

    operations = [
        migrations.AddField(
            model_name="battle",
            name="last_activity_at",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="battle",
            name="closes_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="battle",
            index=models.Index(fields=["status", "last_activity_at"], name="battle_status_activity_idx"),
        ),
    ]
