"""Locations in groups, with their own tables (William, 23 Nov 2026). The old shape (an area, content and six D6
results) is dropped with its rows, which are disposable: the table is made afresh."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def _removed(related: str = "+") -> models.ForeignKey:
    return models.ForeignKey(
        blank=True,
        null=True,
        on_delete=django.db.models.deletion.SET_NULL,
        related_name=related,
        to=settings.AUTH_USER_MODEL,
    )


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("campaigns", "0022_alter_campaignchartrow_result"),
    ]

    operations = [
        migrations.DeleteModel(name="CampaignLocation"),
        migrations.CreateModel(
            name="CampaignLocationGroup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("description", models.TextField(blank=True, default="", max_length=4000)),
                ("restrictions", models.TextField(blank=True, default="", max_length=4000)),
                ("order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("removed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "campaign",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="location_groups",
                        to="campaigns.campaign",
                    ),
                ),
                ("removed_by", _removed()),
            ],
            options={"db_table": "campaign_location_group", "ordering": ["order", "id"]},
        ),
        migrations.CreateModel(
            name="CampaignLocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("rules", models.TextField(blank=True, default="", max_length=8000)),
                ("min_heroes", models.PositiveSmallIntegerField(blank=True, default=1, null=True)),
                ("max_heroes", models.PositiveSmallIntegerField(blank=True, default=1, null=True)),
                ("takes_trading_action", models.BooleanField(default=False)),
                ("order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("removed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "campaign",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="campaign_locations",
                        to="campaigns.campaign",
                    ),
                ),
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="locations",
                        to="campaigns.campaignlocationgroup",
                    ),
                ),
                ("removed_by", _removed()),
            ],
            options={"db_table": "campaign_location", "ordering": ["order", "id"]},
        ),
        migrations.AddField(
            model_name="campaignchart",
            name="location",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tables",
                to="campaigns.campaignlocation",
            ),
        ),
        migrations.CreateModel(
            name="CampaignLocationChart",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveIntegerField(default=0)),
                (
                    "chart",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="location_links",
                        to="campaigns.campaignchart",
                    ),
                ),
                (
                    "location",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="chart_links",
                        to="campaigns.campaignlocation",
                    ),
                ),
            ],
            options={
                "db_table": "campaign_location_chart",
                "ordering": ["order", "id"],
                "constraints": [
                    models.UniqueConstraint(fields=("location", "chart"), name="campaign_location_chart_unique")
                ],
            },
        ),
    ]
