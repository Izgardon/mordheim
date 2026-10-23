"""The book catalogue's version (PERF-13): one row, created here with a random value, so a database migrated from
empty (or wiped and migrated again) caches its lists under a key no earlier database used."""

import uuid

from django.db import migrations, models


def create_row(apps, schema_editor):
    CatalogueVersion = apps.get_model("core", "CatalogueVersion")
    CatalogueVersion.objects.get_or_create(id=1, defaults={"version": uuid.uuid4()})


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="CatalogueVersion",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, primary_key=True, serialize=False)),
                ("version", models.UUIDField(default=uuid.uuid4)),
            ],
            options={
                "db_table": "catalogue_version",
            },
        ),
        migrations.AddConstraint(
            model_name="catalogueversion",
            constraint=models.CheckConstraint(check=models.Q(("id", 1)), name="catalogue_version_one_row"),
        ),
        migrations.RunPython(create_row, migrations.RunPython.noop),
    ]
