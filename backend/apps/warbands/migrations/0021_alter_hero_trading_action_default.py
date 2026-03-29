from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0020_hero_trading_action"),
    ]

    operations = [
        migrations.AlterField(
            model_name="hero",
            name="trading_action",
            field=models.BooleanField(default=True),
        ),
    ]
