from django.db import migrations


class Migration(migrations.Migration):
    """The free-text faction and the restrictions a player ticked by hand go: a warband's type (and what it counts
    as) says what it is (grading phase 1)."""

    dependencies = [
        ("warbands", "0004_warband_type_counts_as"),
    ]

    operations = [
        migrations.RemoveField(model_name="warband", name="faction"),
        migrations.RemoveField(model_name="warband", name="restrictions"),
    ]
