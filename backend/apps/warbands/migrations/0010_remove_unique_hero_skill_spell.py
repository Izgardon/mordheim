from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0009_merge_0002_warbanditem_quantity_0008_warbandtrade"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="heroskill",
            name="unique_hero_skill",
        ),
        migrations.RemoveConstraint(
            model_name="herospell",
            name="unique_hero_spell",
        ),
    ]
