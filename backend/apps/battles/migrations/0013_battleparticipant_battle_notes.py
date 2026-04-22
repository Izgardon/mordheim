from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0012_remove_battle_settings_json"),
    ]

    operations = [
        migrations.AddField(
            model_name="battleparticipant",
            name="battle_notes",
            field=models.TextField(blank=True, default=""),
        ),
    ]
