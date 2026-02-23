import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("campaigns", "0002_campaignsettings_level_thresholds"),
    ]

    operations = [
        migrations.CreateModel(
            name="Restriction",
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
                (
                    "campaign",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="restrictions",
                        to="campaigns.campaign",
                    ),
                ),
                (
                    "type",
                    models.CharField(
                        choices=[
                            ("Warband", "Warband"),
                            ("Warband Group", "Warband Group"),
                            ("Setting", "Setting"),
                            ("Artifact", "Artifact"),
                        ],
                        default="Warband",
                        max_length=20,
                    ),
                ),
                ("restriction", models.CharField(max_length=200)),
            ],
            options={
                "db_table": "restriction",
                "ordering": ["type", "restriction"],
            },
        ),
        migrations.AddConstraint(
            model_name="restriction",
            constraint=models.UniqueConstraint(
                fields=("campaign", "type", "restriction"),
                name="unique_restriction",
            ),
        ),
        migrations.CreateModel(
            name="RestrictionCampaignType",
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
                (
                    "campaign_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="restriction_links",
                        to="campaigns.campaigntype",
                    ),
                ),
                (
                    "restriction",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="campaign_types",
                        to="restrictions.restriction",
                    ),
                ),
            ],
            options={
                "db_table": "restriction_campaign_type",
            },
        ),
        migrations.AddConstraint(
            model_name="restrictioncampaigntype",
            constraint=models.UniqueConstraint(
                fields=("campaign_type", "restriction"),
                name="unique_restriction_campaign_type",
            ),
        ),
    ]
