"""Skill groups (phase 1a) are a catalogue kind: a campaign may remove a book group or revert its version of one."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_catalogue_version_row"),
    ]

    operations = [
        migrations.AlterField(
            model_name="catalogueremoval",
            name="kind",
            field=models.CharField(
                choices=[
                    ("items", "Item"),
                    ("skills", "Skill"),
                    ("skill_groups", "Skill group"),
                    ("spells", "Spell"),
                    ("specials", "Special"),
                    ("races", "Race"),
                    ("bestiary", "Bestiary entry"),
                    ("hired_swords", "Hired sword"),
                    ("dramatis_personae", "Dramatis persona"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="revertedversion",
            name="kind",
            field=models.CharField(
                choices=[
                    ("items", "Item"),
                    ("skills", "Skill"),
                    ("skill_groups", "Skill group"),
                    ("spells", "Spell"),
                    ("specials", "Special"),
                    ("races", "Race"),
                    ("bestiary", "Bestiary entry"),
                    ("hired_swords", "Hired sword"),
                    ("dramatis_personae", "Dramatis persona"),
                ],
                max_length=20,
            ),
        ),
    ]
