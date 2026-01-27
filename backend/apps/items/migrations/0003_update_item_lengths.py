# Generated manually on 2026-01-27

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0002_add_type_to_item_property"),
    ]

    operations = [
        migrations.AlterField(
            model_name="item",
            name="name",
            field=models.CharField(max_length=255),
        ),
        migrations.AlterField(
            model_name="item",
            name="description",
            field=models.TextField(blank=True, default="", max_length=2000),
        ),
        migrations.AlterField(
            model_name="itemproperty",
            name="description",
            field=models.TextField(blank=True, default="", max_length=4000),
        ),
    ]
