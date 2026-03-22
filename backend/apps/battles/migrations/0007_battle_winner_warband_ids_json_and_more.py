from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0006_alter_battleevent_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="battle",
            name="winner_warband_ids_json",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="battleparticipant",
            name="postbattle_json",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
