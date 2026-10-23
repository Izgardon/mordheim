# The bestiary by kind (bestiary rewrite step 3): every entry is a mount, a pet or a creature, which replaces the
# free-text type, with whether it has a profile, gains XP, what it adds to a rider's rating and whether the shop sells
# it. Data is disposable: existing rows take "creature" until the catalogue is reseeded, which writes each kind.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bestiary", "0013_remove_hired_sword_profile"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="bestiaryentry",
            options={"ordering": ["kind", "name"], "verbose_name_plural": "bestiary entries"},
        ),
        migrations.RemoveField(model_name="bestiaryentry", name="type"),
        migrations.AddField(
            model_name="bestiaryentry",
            name="kind",
            field=models.CharField(
                choices=[("mount", "Mount"), ("pet", "Pet"), ("creature", "Creature")],
                db_index=True,
                default="creature",
                max_length=10,
            ),
            preserve_default=False,
        ),
        migrations.AddField(model_name="bestiaryentry", name="has_profile", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="bestiaryentry", name="gains_xp", field=models.BooleanField(default=False)),
        migrations.AddField(
            model_name="bestiaryentry",
            name="rating_bonus",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="bestiaryentry", name="available_in_shop", field=models.BooleanField(default=False)
        ),
        migrations.AddConstraint(
            model_name="bestiaryentry",
            constraint=models.CheckConstraint(
                check=models.Q(("kind__in", ["mount", "pet", "creature"])), name="bestiary_entry_kind"
            ),
        ),
    ]
