"""Encampments in groups, held by a warband (William, 24 Nov 2026), and the encampment rules beside the campaign's
and battle rules. The old shape (a name, a description and a member who owned it) is dropped with its rows, which
are disposable: the table is made afresh."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def _removed() -> models.ForeignKey:
    return models.ForeignKey(
        blank=True,
        null=True,
        on_delete=django.db.models.deletion.SET_NULL,
        related_name="+",
        to=settings.AUTH_USER_MODEL,
    )


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("campaigns", "0023_location_groups"),
        (
            "warbands",
            "0001_initial",
        ),  # the warband table is all the holder needs; a later one would tie the apps' pasts
    ]

    operations = [
        migrations.DeleteModel(name="CampaignEncampment"),
        migrations.AlterField(
            model_name="campaignrule",
            name="kind",
            field=models.CharField(
                choices=[("campaign", "Campaign rule"), ("battle", "Battle rule"), ("encampment", "Encampment rule")],
                default="campaign",
                max_length=10,
            ),
        ),
        migrations.CreateModel(
            name="CampaignEncampmentGroup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("description", models.TextField(blank=True, default="", max_length=4000)),
                ("order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("removed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "campaign",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="encampment_groups",
                        to="campaigns.campaign",
                    ),
                ),
                ("removed_by", _removed()),
            ],
            options={"db_table": "campaign_encampment_group", "ordering": ["order", "id"]},
        ),
        migrations.CreateModel(
            name="CampaignEncampment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("gained_by", models.CharField(blank=True, default="", max_length=200)),
                ("fortified", models.BooleanField(default=False)),
                ("text", models.TextField(blank=True, default="", max_length=8000)),
                ("razed", models.BooleanField(default=False)),
                ("order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("removed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "campaign",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="encampments",
                        to="campaigns.campaign",
                    ),
                ),
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="encampments",
                        to="campaigns.campaignencampmentgroup",
                    ),
                ),
                (
                    "holder",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="encampments",
                        to="warbands.warband",
                    ),
                ),
                ("removed_by", _removed()),
            ],
            options={"db_table": "campaign_encampment", "ordering": ["order", "id"]},
        ),
    ]
