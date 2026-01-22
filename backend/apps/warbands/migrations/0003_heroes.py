from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0002_table_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="Hero",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(blank=True, max_length=120, null=True)),
                ("unit_type", models.CharField(blank=True, max_length=80, null=True)),
                ("race", models.CharField(blank=True, max_length=80, null=True)),
                ("stats", models.JSONField(blank=True, null=True)),
                ("experience", models.IntegerField(blank=True, null=True)),
                ("hire_cost", models.IntegerField(blank=True, null=True)),
                ("available_skills", models.JSONField(blank=True, null=True)),
                (
                    "warband",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="heroes", to="warbands.warband"),
                ),
            ],
            options={
                "db_table": "warband_hero",
            },
        ),
    ]
