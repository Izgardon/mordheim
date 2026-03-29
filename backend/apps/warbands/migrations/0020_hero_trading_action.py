from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0019_warband_show_loadout_on_mobile"),
    ]

    operations = [
        migrations.AddField(
            model_name="hero",
            name="trading_action",
            field=models.BooleanField(default=False),
        ),
    ]
