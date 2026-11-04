"""Skill groups (phase 1a): a skill is one row per name, without a list; groups hold skills (SkillGroupSkill) and say
who learns from them (SkillGroupWarband, for_everyone, large_only, learn_note), and SkillWarband goes. Runs on an
empty database: the book is reseeded (seed_skills)."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0001_initial"),
        ("skills", "0003_large_only_and_learn_note"),
        ("warbands", "0005_warband_drop_faction_restrictions"),  # the types and groups a who-can line names
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SkillGroup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("archived_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(blank=True, null=True)),
                ("name", models.CharField(max_length=160)),
                ("for_everyone", models.BooleanField(default=True)),
                ("large_only", models.BooleanField(default=False)),
                ("learn_note", models.CharField(blank=True, default="", max_length=200)),
            ],
            options={
                "db_table": "skill_group",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="SkillGroupSkill",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ],
            options={
                "db_table": "skill_group_skill",
                "ordering": ["id"],
            },
        ),
        migrations.CreateModel(
            name="SkillGroupWarband",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("excluded", models.BooleanField(default=False)),
            ],
            options={
                "db_table": "skill_group_warband",
                "ordering": ["id"],
            },
        ),
        migrations.DeleteModel(
            name="SkillWarband",
        ),
        migrations.AlterModelOptions(
            name="skill",
            options={"ordering": ["name"]},
        ),
        migrations.RemoveConstraint(
            model_name="skill",
            name="skill_unique_name_type",
        ),
        migrations.RemoveField(
            model_name="skill",
            name="for_everyone",
        ),
        migrations.RemoveField(
            model_name="skill",
            name="large_only",
        ),
        migrations.RemoveField(
            model_name="skill",
            name="learn_note",
        ),
        migrations.RemoveField(
            model_name="skill",
            name="type",
        ),
        migrations.AddConstraint(
            model_name="skill",
            constraint=models.UniqueConstraint(
                fields=("campaign", "name"), name="skill_unique_name", nulls_distinct=False
            ),
        ),
        migrations.AddField(
            model_name="skillgroup",
            name="archived_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="skillgroup",
            name="campaign",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="skill_groups",
                to="campaigns.campaign",
            ),
        ),
        migrations.AddField(
            model_name="skillgroup",
            name="replaces",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="versions",
                to="skills.skillgroup",
            ),
        ),
        migrations.AddField(
            model_name="skillgroup",
            name="updated_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="skillgroupskill",
            name="group",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="skill_links", to="skills.skillgroup"
            ),
        ),
        migrations.AddField(
            model_name="skillgroupskill",
            name="skill",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="group_links", to="skills.skill"
            ),
        ),
        migrations.AddField(
            model_name="skillgroupwarband",
            name="group",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="warband_links", to="skills.skillgroup"
            ),
        ),
        migrations.AddField(
            model_name="skillgroupwarband",
            name="warband_group",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="warbands.warbandgroup",
            ),
        ),
        migrations.AddField(
            model_name="skillgroupwarband",
            name="warband_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="warbands.warbandtype",
            ),
        ),
        migrations.AddConstraint(
            model_name="skillgroup",
            constraint=models.UniqueConstraint(
                condition=models.Q(("replaces__isnull", False)),
                fields=("campaign", "replaces"),
                name="skill_group_one_version",
            ),
        ),
        migrations.AddConstraint(
            model_name="skillgroup",
            constraint=models.CheckConstraint(
                check=models.Q(("replaces__isnull", True), ("campaign__isnull", False), _connector="OR"),
                name="skill_group_version_in_a_campaign",
            ),
        ),
        migrations.AddConstraint(
            model_name="skillgroup",
            constraint=models.UniqueConstraint(
                fields=("campaign", "name"), name="skill_group_unique_name", nulls_distinct=False
            ),
        ),
        migrations.AddConstraint(
            model_name="skillgroupskill",
            constraint=models.UniqueConstraint(fields=("group", "skill"), name="skill_group_skill_once"),
        ),
        migrations.AddConstraint(
            model_name="skillgroupwarband",
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(("warband_group__isnull", True), ("warband_type__isnull", False)),
                    models.Q(("warband_group__isnull", False), ("warband_type__isnull", True)),
                    _connector="OR",
                ),
                name="skill_group_warband_type_or_group",
            ),
        ),
    ]
