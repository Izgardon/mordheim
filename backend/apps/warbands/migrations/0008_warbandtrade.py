from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0007_hero_hiredsword_wizard"),
    ]

    operations = [
        migrations.CreateModel(
            name="WarbandTrade",
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
                ("action", models.CharField(max_length=120)),
                ("description", models.CharField(max_length=500)),
                ("price", models.IntegerField(default=0)),
                ("notes", models.TextField(blank=True, default="", max_length=2000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "warband",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="trades",
                        to="warbands.warband",
                    ),
                ),
            ],
            options={
                "db_table": "warband_trades",
                "ordering": ["-created_at"],
            },
        ),
    ]
