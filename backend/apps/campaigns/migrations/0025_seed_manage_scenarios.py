"""Seed the `manage_scenarios` permission code (William, 24 Nov 2026: who adds, removes and weights the campaign's
scenarios). A new code needs its own data migration (0003 is a frozen copy of the constants as they stood); an
upsert, so it is safe where the row exists. Reversing leaves the row (grants may point at it)."""

from django.db import migrations


def seed(apps, schema_editor):
    CampaignPermission = apps.get_model("campaigns", "CampaignPermission")
    CampaignPermission.objects.update_or_create(code="manage_scenarios", defaults={"name": "Manage scenarios"})


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0024_encampment_groups"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
