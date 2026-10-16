import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("campaigns", "0011_campaignsettings_enable_encampments_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="CampaignEncampment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "campaign",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="encampments",
                        to="campaigns.campaign",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="campaign_encampments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "campaign_encampment",
                "ordering": ["name", "id"],
            },
        ),
        migrations.CreateModel(
            name="CampaignLocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("content", models.TextField(blank=True, default="")),
                ("d6_1", models.TextField(blank=True, default="")),
                ("d6_2", models.TextField(blank=True, default="")),
                ("d6_3", models.TextField(blank=True, default="")),
                ("d6_4", models.TextField(blank=True, default="")),
                ("d6_5", models.TextField(blank=True, default="")),
                ("d6_6", models.TextField(blank=True, default="")),
                (
                    "campaign",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="campaign_locations",
                        to="campaigns.campaign",
                    ),
                ),
            ],
            options={
                "db_table": "campaign_location",
                "ordering": ["name", "id"],
            },
        ),
    ]
