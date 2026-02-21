from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0002_item_availability"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="item",
            name="item_rarity_range",
        ),
        migrations.RemoveField(model_name="item", name="cost"),
        migrations.RemoveField(model_name="item", name="rarity"),
        migrations.RemoveField(model_name="item", name="unique_to"),
        migrations.RemoveField(model_name="item", name="variable"),
    ]
