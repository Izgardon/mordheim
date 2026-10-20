from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0014_battle_event_kill_killer_index"),
    ]

    operations = [
        migrations.AddField(
            model_name="battleparticipant",
            name="roster_json",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
