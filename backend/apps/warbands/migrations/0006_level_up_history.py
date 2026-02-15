from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0005_remove_item_unique_constraints"),
    ]

    operations = [
        migrations.AddField(
            model_name="hero",
            name="level_up_history",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="henchmengroup",
            name="level_up_history",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="hiredsword",
            name="level_up_history",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
