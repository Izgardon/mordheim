from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0003_hero_available_skills"),
    ]

    operations = [
        migrations.AddField(
            model_name="henchmengroup",
            name="max_size",
            field=models.PositiveIntegerField(default=5),
        ),
    ]
