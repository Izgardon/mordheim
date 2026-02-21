from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0008_allow_duplicate_skills_spells"),
    ]

    operations = [
        migrations.AddField(
            model_name="warbanditem",
            name="cost",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="heroitem",
            name="cost",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="henchmengroupitem",
            name="cost",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
