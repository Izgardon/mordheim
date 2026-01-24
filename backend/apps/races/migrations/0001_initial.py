from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Race",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=160, unique=True)),
                ("movement", models.CharField(max_length=10)),
                ("weapon_skill", models.CharField(max_length=10)),
                ("ballistic_skill", models.CharField(max_length=10)),
                ("strength", models.CharField(max_length=10)),
                ("toughness", models.CharField(max_length=10)),
                ("wounds", models.CharField(max_length=10)),
                ("initiative", models.CharField(max_length=10)),
                ("attacks", models.CharField(max_length=10)),
                ("leadership", models.CharField(max_length=10)),
            ],
            options={
                "db_table": "race",
                "ordering": ["name"],
            },
        ),
    ]
