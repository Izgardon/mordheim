from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0007_battle_winner_warband_ids_json_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="battle",
            name="winner_warband",
        ),
    ]
