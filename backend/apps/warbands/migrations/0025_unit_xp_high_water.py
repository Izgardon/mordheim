# The XP high-water mark (decision 5, BUG-27), backfilled with each unit's current XP so no existing unit
# earns level-ups again for thresholds it has already reached. Dead and dismissed units are backfilled too.

from django.db import migrations, models
from django.db.models import F

UNIT_MODELS = ("Hero", "HenchmenGroup", "HiredSword")


def backfill_high_water(apps, schema_editor):
    for model_name in UNIT_MODELS:
        apps.get_model("warbands", model_name).objects.update(xp_high_water=F("xp"))


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0024_unit_dismissed_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="henchmengroup",
            name="xp_high_water",
            field=models.DecimalField(decimal_places=1, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name="hero",
            name="xp_high_water",
            field=models.DecimalField(decimal_places=1, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name="hiredsword",
            name="xp_high_water",
            field=models.DecimalField(decimal_places=1, default=0, max_digits=6),
        ),
        migrations.RunPython(backfill_high_water, migrations.RunPython.noop),
    ]
