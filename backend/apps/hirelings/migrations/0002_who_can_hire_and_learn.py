"""The items rebuild: who may hire a hired sword or dramatis persona is for_everyone or warband types and groups, each
included or excluded, in place of the restrictions; hire_note keeps the book's sentence. seed_hired_swords fills them
from the catalogue import."""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hirelings", "0001_initial"),
        ("warbands", "0005_warband_drop_faction_restrictions"),
    ]

    operations = [
        migrations.AddField(
            model_name="dramatispersona",
            name="for_everyone",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="dramatispersona",
            name="hire_note",
            field=models.TextField(blank=True, default="", max_length=2000),
        ),
        migrations.AddField(
            model_name="hiredsword",
            name="for_everyone",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="hiredsword",
            name="hire_note",
            field=models.TextField(blank=True, default="", max_length=2000),
        ),
        migrations.CreateModel(
            name="DramatisPersonaWarband",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("excluded", models.BooleanField(default=False)),
                (
                    "dramatis_persona",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="warband_links",
                        to="hirelings.dramatispersona",
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
                "db_table": "dramatis_persona_warband",
                "ordering": ["id"],
            },
        ),
        migrations.CreateModel(
            name="HiredSwordWarband",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("excluded", models.BooleanField(default=False)),
                (
                    "hired_sword",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="warband_links",
                        to="hirelings.hiredsword",
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
                "db_table": "hired_sword_warband",
                "ordering": ["id"],
            },
        ),
        migrations.DeleteModel(
            name="DramatisPersonaRestriction",
        ),
        migrations.DeleteModel(
            name="HiredSwordRestriction",
        ),
        migrations.AddConstraint(
            model_name="dramatispersonawarband",
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(("warband_group__isnull", True), ("warband_type__isnull", False)),
                    models.Q(("warband_group__isnull", False), ("warband_type__isnull", True)),
                    _connector="OR",
                ),
                name="dramatis_persona_warband_type_or_group",
            ),
        ),
        migrations.AddConstraint(
            model_name="hiredswordwarband",
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(("warband_group__isnull", True), ("warband_type__isnull", False)),
                    models.Q(("warband_group__isnull", False), ("warband_type__isnull", True)),
                    _connector="OR",
                ),
                name="hired_sword_warband_type_or_group",
            ),
        ),
    ]
