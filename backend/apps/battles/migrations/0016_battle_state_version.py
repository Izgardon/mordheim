from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0015_battleparticipant_roster_json"),
    ]

    operations = [
        migrations.AddField(
            model_name="battle",
            name="state_version",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
