from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0016_battle_state_version"),
    ]

    operations = [
        migrations.AddField(
            model_name="battleparticipant",
            name="skipped_postbattle",
            field=models.BooleanField(default=False),
        ),
    ]
