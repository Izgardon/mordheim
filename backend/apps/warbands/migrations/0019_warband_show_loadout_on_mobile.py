from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0018_hiredsworditem_cost"),
    ]

    operations = [
        migrations.AddField(
            model_name="warband",
            name="show_loadout_on_mobile",
            field=models.BooleanField(default=False),
        ),
    ]
