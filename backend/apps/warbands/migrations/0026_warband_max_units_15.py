# Warband size defaults to 15 (decision 12, BUG-67). The old default, 0, meant "no limit set": those rows
# become 15 too. The limit only warns, so no warband is blocked by this. Reversing restores the old default
# but leaves the rows at 15 (which of them were 0 isn't recorded).

from django.db import migrations, models

DEFAULT_MAX_UNITS = 15


def set_unset_limits(apps, schema_editor):
    apps.get_model("warbands", "Warband").objects.filter(max_units=0).update(max_units=DEFAULT_MAX_UNITS)


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0025_unit_xp_high_water"),
    ]

    operations = [
        migrations.AlterField(
            model_name="warband",
            name="max_units",
            field=models.PositiveSmallIntegerField(default=DEFAULT_MAX_UNITS),
        ),
        migrations.RunPython(set_unset_limits, migrations.RunPython.noop),
    ]
