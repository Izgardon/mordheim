"""The book catalogue's version row (PERF-13): the one `CatalogueVersion` row, created here with a random value.

Why a migration: book list caching keys on this row (`apps/core/catalogue/cache.py`), and a database without it
caches no book list, so it must exist before the first request, and a database migrated from empty (or wiped and
migrated again) gets a value no earlier database used, so a body cached before a wipe can't be served after it.
Seeders bump it with an upsert, so it never needs creating anywhere else. Reversing leaves the row.
"""

import uuid

from django.db import migrations

BOOK = 1  # apps.core.models.BOOK, frozen here


def create_row(apps, schema_editor):
    CatalogueVersion = apps.get_model("core", "CatalogueVersion")
    CatalogueVersion.objects.get_or_create(id=BOOK, defaults={"version": uuid.uuid4()})


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_row, migrations.RunPython.noop),
    ]
