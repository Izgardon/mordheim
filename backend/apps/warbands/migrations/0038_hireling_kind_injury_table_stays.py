# A hireling is a hired sword or a dramatis persona (bestiary rewrite step 2): its kind, injury table, how long it
# stays and what it is paid in; the cost formulas take the catalogue's 120 characters.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0037_hireling_index_names"),
    ]

    operations = [
        migrations.AddField(
            model_name="hireling",
            name="injury_table",
            field=models.CharField(
                choices=[("henchman", "Henchman"), ("hero", "Hero")], default="henchman", max_length=20
            ),
        ),
        migrations.AddField(
            model_name="hireling",
            name="kind",
            field=models.CharField(
                choices=[("hired_sword", "Hired sword"), ("dramatis_persona", "Dramatis persona")],
                default="hired_sword",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="hireling",
            name="payment_note",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="hireling",
            name="stays",
            field=models.CharField(
                choices=[("always", "Always"), ("one_battle", "One battle")], default="always", max_length=20
            ),
        ),
        migrations.AlterField(
            model_name="hireling",
            name="hire_cost_expression",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AlterField(
            model_name="hireling",
            name="upkeep_cost_expression",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
