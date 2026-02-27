import re

from django.db import migrations, models


def _parse_armour_save(value):
    """Extract integer from strings like '4+', '5+'. Returns None if blank or '-'."""
    if not value or str(value).strip() in ("", "-"):
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group()) if match else None


def populate_armour_save_int(apps, schema_editor):
    BestiaryEntry = apps.get_model("bestiary", "BestiaryEntry")
    for entry in BestiaryEntry.objects.all():
        entry.armour_save_int = _parse_armour_save(entry.armour_save)
        entry.save(update_fields=["armour_save_int"])


class Migration(migrations.Migration):

    dependencies = [
        ("bestiary", "0005_drop_available_skill_join_table"),
    ]

    operations = [
        # 1. Add a temporary integer column alongside the existing char column
        migrations.AddField(
            model_name="bestiaryentry",
            name="armour_save_int",
            field=models.SmallIntegerField(null=True, blank=True),
        ),
        # 2. Copy + parse data into the integer column
        migrations.RunPython(
            populate_armour_save_int,
            migrations.RunPython.noop,
        ),
        # 3. Drop the old char column
        migrations.RemoveField(
            model_name="bestiaryentry",
            name="armour_save",
        ),
        # 4. Rename the integer column to armour_save
        migrations.RenameField(
            model_name="bestiaryentry",
            old_name="armour_save_int",
            new_name="armour_save",
        ),
    ]
