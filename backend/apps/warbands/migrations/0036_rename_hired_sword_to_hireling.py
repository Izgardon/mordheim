# The warband's hired sword unit becomes the hireling (bestiary rewrite step 1): a rename only. Its tables, the join
# tables' foreign key, the related names and the stat constraints take the new name.

import django.db.models.deletion
from django.db import migrations, models

STAT_FIELDS = (
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
)
# The join tables (hireling_item, ...) and the catalogue model each one links to.
LINKS = {"item": "items.item", "skill": "skills.skill", "special": "special.special", "spell": "spells.spell"}


def _stat_check(field: str) -> models.CheckConstraint:
    return models.CheckConstraint(
        check=models.Q((f"{field}__gte", 0), (f"{field}__lte", 10)), name=f"hireling_{field}_range"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0010_versions_and_archive"),
        ("races", "0004_versions_and_archive"),
        ("skills", "0005_versions_and_archive"),
        ("special", "0005_versions_and_archive"),
        ("spells", "0005_versions_and_archive"),
        ("warbands", "0035_catalogue_references_restrict"),
    ]

    operations = [
        migrations.RenameModel("HiredSword", "Hireling"),
        *(migrations.RenameModel(f"HiredSword{link.title()}", f"Hireling{link.title()}") for link in LINKS),
        migrations.AlterModelTable("hireling", "hireling"),
        *(migrations.AlterModelTable(f"hireling{link}", f"hireling_{link}") for link in LINKS),
        *(migrations.RenameField(f"hireling{link}", "hired_sword", "hireling") for link in LINKS),
        migrations.AlterField(
            model_name="hireling",
            name="warband",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="hirelings", to="warbands.warband"
            ),
        ),
        migrations.AlterField(
            model_name="hireling",
            name="race",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="hirelings",
                to="races.race",
            ),
        ),
        *(
            migrations.AlterField(
                model_name="hireling",
                name=f"{link}s",
                field=models.ManyToManyField(
                    blank=True, related_name="hirelings", through=f"warbands.Hireling{link.title()}", to=target
                ),
            )
            for link, target in LINKS.items()
        ),
        *(
            migrations.AlterField(
                model_name=f"hireling{link}",
                name="hireling",
                field=models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name=f"hireling_{link}s",
                    to="warbands.hireling",
                ),
            )
            for link in LINKS
        ),
        *(
            migrations.AlterField(
                model_name=f"hireling{link}",
                name=link,
                field=models.ForeignKey(
                    on_delete=django.db.models.deletion.RESTRICT, related_name=f"hireling_{link}s", to=target
                ),
            )
            for link, target in LINKS.items()
        ),
        *(migrations.RemoveConstraint("hireling", f"hired_sword_{field}_range") for field in STAT_FIELDS),
        *(migrations.AddConstraint("hireling", _stat_check(field)) for field in STAT_FIELDS),
    ]
