# Beasts in the warband (bestiary rewrite step 4): a unit's item row can be its mount or pet (`companion`), and a
# henchmen group remembers the creature it was recruited from (`source_beast`). Squashed in step 6.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bestiary", "0014_bestiary_kinds"),
        ("warbands", "0038_hireling_kind_injury_table_stays"),
    ]

    operations = [
        migrations.AddField(
            model_name="henchmengroup",
            name="source_beast",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="henchmen_groups",
                to="bestiary.bestiaryentry",
            ),
        ),
        migrations.AddField(
            model_name="henchmengroupitem",
            name="companion",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="heroitem",
            name="companion",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="hirelingitem",
            name="companion",
            field=models.BooleanField(default=False),
        ),
    ]
