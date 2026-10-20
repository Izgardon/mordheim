"""Each campaign's catalogue version (PERF-13): replaced by every write to the campaign's catalogue and by every seed
of the book, which retires its cached lists. Rows that exist get one value between them; the cache key holds the
campaign's id as well."""

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0023_catalogue_permissions"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaignsettings",
            name="catalogue_version",
            field=models.UUIDField(default=uuid.uuid4, editable=False),
        ),
    ]
