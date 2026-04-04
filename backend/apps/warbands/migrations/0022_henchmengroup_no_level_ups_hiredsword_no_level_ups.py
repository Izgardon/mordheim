from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0021_alter_hero_trading_action_default"),
    ]

    operations = [
        migrations.AddField(
            model_name="henchmengroup",
            name="no_level_ups",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="hiredsword",
            name="no_level_ups",
            field=models.BooleanField(default=False),
        ),
    ]
