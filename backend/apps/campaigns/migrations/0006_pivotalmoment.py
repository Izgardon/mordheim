import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0010_remove_battle_title"),
        ("campaigns", "0005_campaignsettings_hero_death_roll"),
        ("warbands", "0016_hero_is_leader"),
    ]

    operations = [
        migrations.CreateModel(
            name="PivotalMoment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(max_length=64)),
                ("headline", models.CharField(max_length=120)),
                ("detail", models.TextField(blank=True)),
                ("unit_key", models.CharField(blank=True, max_length=64, null=True)),
                ("unit_name", models.CharField(blank=True, max_length=120, null=True)),
                ("battle_ended_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "battle",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pivotal_moments",
                        to="battles.battle",
                    ),
                ),
                (
                    "campaign",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pivotal_moments",
                        to="campaigns.campaign",
                    ),
                ),
                (
                    "source_event",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pivotal_moments",
                        to="battles.battleevent",
                    ),
                ),
                (
                    "warband",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pivotal_moments",
                        to="warbands.warband",
                    ),
                ),
            ],
            options={
                "db_table": "campaign_pivotal_moment",
                "ordering": ["-battle_ended_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="pivotalmoment",
            index=models.Index(fields=["campaign", "battle_ended_at"], name="campaign_pi_campaig_7e2813_idx"),
        ),
        migrations.AddIndex(
            model_name="pivotalmoment",
            index=models.Index(fields=["battle", "warband"], name="campaign_pi_battle__72c775_idx"),
        ),
        migrations.AddIndex(
            model_name="pivotalmoment",
            index=models.Index(fields=["kind"], name="campaign_pi_kind_7fbf9d_idx"),
        ),
    ]
