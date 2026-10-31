"""The items rebuild: the restriction table goes once nothing points at it (item price rows and hired swords now name
warband types and groups)."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("restrictions", "0001_initial"),
        ("items", "0002_items_rules_price_rows_who_can"),
        ("hirelings", "0002_who_can_hire_and_learn"),
    ]

    operations = [
        migrations.DeleteModel(
            name="Restriction",
        ),
    ]
