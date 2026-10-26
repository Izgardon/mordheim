"""Seed the campaign roles and permission codes (BUG-15, design 0.29 Q4; pass 5 decisions 4 and 5).

Why a migration: the request path never creates these rows (it points at them by slug or code inside its own INSERT
or UPDATE, `apps/campaigns/services/codes.py`), so a fresh database must hold every role and code before its first
request. A frozen copy of `apps/campaigns/constants.py` as it stands at this migration, so later edits to the
constants never change what this migration writes: adding a code means adding it to the constants and in a new data
migration (`test_campaign_characterisation_permissions.py` fails until both exist). Upserts, so it is safe on a
database whose rows already exist. Reversing leaves the rows (memberships protect the roles).
"""

from django.db import migrations

ROLES = (("owner", "Owner"), ("admin", "Admin"), ("player", "Player"))

PERMISSIONS = (
    ("edit_catalogue", "Edit catalogue"),
    ("delete_catalogue", "Delete catalogue"),
    ("manage_rules", "Manage rules"),
    ("manage_warbands", "Manage warbands"),
    ("manage_encampments", "Manage encampments"),
    ("manage_locations", "Manage locations"),
    ("manage_battles", "Manage battles"),
)


def seed(apps, schema_editor):
    CampaignRole = apps.get_model("campaigns", "CampaignRole")
    CampaignPermission = apps.get_model("campaigns", "CampaignPermission")
    for slug, name in ROLES:
        CampaignRole.objects.update_or_create(slug=slug, defaults={"name": name})
    for code, name in PERMISSIONS:
        CampaignPermission.objects.update_or_create(code=code, defaults={"name": name})


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
