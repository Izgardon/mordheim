import django.db.models.deletion
from django.db import migrations, models

from apps.restrictions.utils import parse_unique_to


def migrate_unique_to_restrictions(apps, schema_editor):
    """For each ItemAvailability with a non-empty unique_to, parse the text
    into Restriction records and create M2M links with additional_note on
    the through table."""
    ItemAvailability = apps.get_model("items", "ItemAvailability")
    ItemAvailabilityRestriction = apps.get_model(
        "items", "ItemAvailabilityRestriction"
    )
    Restriction = apps.get_model("restrictions", "Restriction")

    restriction_cache = {}
    for r in Restriction.objects.all():
        restriction_cache[r.restriction] = r

    links = []
    for avail in ItemAvailability.objects.exclude(unique_to="").iterator():
        parsed = parse_unique_to(avail.unique_to)
        for entry in parsed:
            cache_key = entry["restriction"]
            restriction = restriction_cache.get(cache_key)
            if not restriction:
                restriction, _ = Restriction.objects.get_or_create(
                    restriction=entry["restriction"],
                    defaults={"type": entry["type"]},
                )
                restriction_cache[cache_key] = restriction
            links.append(
                ItemAvailabilityRestriction(
                    item_availability=avail,
                    restriction=restriction,
                    additional_note=entry["additional_note"],
                )
            )
            if len(links) >= 500:
                ItemAvailabilityRestriction.objects.bulk_create(
                    links, ignore_conflicts=True
                )
                links = []

    if links:
        ItemAvailabilityRestriction.objects.bulk_create(links, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0003_remove_item_old_availability_fields"),
        ("restrictions", "0001_initial"),
    ]

    operations = [
        # 1. Create the through table (with additional_note)
        migrations.CreateModel(
            name="ItemAvailabilityRestriction",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "item_availability",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="restriction_links",
                        to="items.itemavailability",
                    ),
                ),
                (
                    "restriction",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="item_availability_links",
                        to="restrictions.restriction",
                    ),
                ),
                (
                    "additional_note",
                    models.CharField(blank=True, default="", max_length=200),
                ),
            ],
            options={
                "db_table": "item_availability_restriction",
            },
        ),
        migrations.AddConstraint(
            model_name="itemavailabilityrestriction",
            constraint=models.UniqueConstraint(
                fields=("item_availability", "restriction", "additional_note"),
                name="unique_item_availability_restriction",
            ),
        ),
        # 2. Add M2M field to ItemAvailability
        migrations.AddField(
            model_name="itemavailability",
            name="restrictions",
            field=models.ManyToManyField(
                blank=True,
                related_name="item_availabilities",
                through="items.ItemAvailabilityRestriction",
                to="restrictions.restriction",
            ),
        ),
        # 3. Data migration: parse unique_to -> restriction M2M links
        migrations.RunPython(
            migrate_unique_to_restrictions, migrations.RunPython.noop
        ),
        # 4. Remove old unique_to field
        migrations.RemoveField(
            model_name="itemavailability",
            name="unique_to",
        ),
        # 5. Update ordering and id field
        migrations.AlterModelOptions(
            name="itemavailability",
            options={"ordering": ["cost"]},
        ),
        migrations.AlterField(
            model_name="itemavailability",
            name="id",
            field=models.BigAutoField(
                auto_created=True,
                primary_key=True,
                serialize=False,
                verbose_name="ID",
            ),
        ),
    ]
