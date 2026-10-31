"""The items rebuild: who may learn a skill (a special skill names its warband types or groups; the general lists are
for everyone). seed_skills fills them from the catalogue import."""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("skills", "0001_initial"),
        ("warbands", "0005_warband_drop_faction_restrictions"),
    ]

    operations = [
        migrations.AddField(
            model_name="skill",
            name="for_everyone",
            field=models.BooleanField(default=True),
        ),
        migrations.CreateModel(
            name="SkillWarband",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("excluded", models.BooleanField(default=False)),
                (
                    "skill",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="warband_links", to="skills.skill"
                    ),
                ),
                (
                    "warband_group",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="+",
                        to="warbands.warbandgroup",
                    ),
                ),
                (
                    "warband_type",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="+",
                        to="warbands.warbandtype",
                    ),
                ),
            ],
            options={
                "db_table": "skill_warband",
                "ordering": ["id"],
            },
        ),
        migrations.AddConstraint(
            model_name="skillwarband",
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(("warband_group__isnull", True), ("warband_type__isnull", False)),
                    models.Q(("warband_group__isnull", False), ("warband_type__isnull", True)),
                    _connector="OR",
                ),
                name="skill_warband_type_or_group",
            ),
        ),
    ]
