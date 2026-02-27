from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0013_merge_20260226_2031"),
    ]

    operations = [
        migrations.AddField(
            model_name="hiredsword",
            name="hire_cost_expression",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="hiredsword",
            name="upkeep_cost_expression",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
