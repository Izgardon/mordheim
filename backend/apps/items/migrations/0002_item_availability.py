import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


def forward_copy_availability(apps, schema_editor):
    """Copy cost/rarity/unique_to/variable from Item into ItemAvailability."""
    Item = apps.get_model("items", "Item")
    ItemAvailability = apps.get_model("items", "ItemAvailability")
    batch = []
    for item in Item.objects.all().iterator():
        batch.append(
            ItemAvailability(
                item=item,
                cost=item.cost,
                rarity=item.rarity,
                unique_to=item.unique_to or "",
                variable_cost=item.variable or None,
            )
        )
        if len(batch) >= 500:
            ItemAvailability.objects.bulk_create(batch)
            batch = []
    if batch:
        ItemAvailability.objects.bulk_create(batch)


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ItemAvailability",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("cost", models.PositiveIntegerField(default=0)),
                (
                    "rarity",
                    models.PositiveSmallIntegerField(
                        default=2,
                        validators=[
                            django.core.validators.MinValueValidator(2),
                            django.core.validators.MaxValueValidator(20),
                        ],
                    ),
                ),
                (
                    "unique_to",
                    models.CharField(blank=True, default="", max_length=200),
                ),
                (
                    "variable_cost",
                    models.CharField(blank=True, max_length=120, null=True),
                ),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="availabilities",
                        to="items.item",
                    ),
                ),
            ],
            options={
                "db_table": "item_availability",
                "ordering": ["unique_to", "cost"],
            },
        ),
        migrations.AddConstraint(
            model_name="itemavailability",
            constraint=models.CheckConstraint(
                check=models.Q(rarity__gte=2, rarity__lte=20),
                name="item_availability_rarity_range",
            ),
        ),
        migrations.RunPython(forward_copy_availability, migrations.RunPython.noop),
    ]
