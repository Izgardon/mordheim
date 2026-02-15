from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0006_level_up_history"),
    ]

    operations = [
        migrations.AddField(
            model_name="hiredsword",
            name="available_skills",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="hiredsword",
            name="upkeep_price",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
