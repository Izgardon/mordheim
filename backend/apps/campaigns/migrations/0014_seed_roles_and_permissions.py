"""Seed the campaign roles and permission codes (BUG-15, design 0.29 Q4).

A frozen copy of `apps/campaigns/constants.py` as it stands at this migration, so later edits to the constants never
change what this migration writes. Upserts: a database whose rows were created lazily by older code keeps them, with
their names brought up to date. Reversing leaves the rows (memberships protect the roles).
"""

from django.db import migrations

ROLES = (("owner", "Owner"), ("admin", "Admin"), ("player", "Player"))

PERMISSIONS = (
    ("add_custom", "Add custom"),
    ("manage_items", "Manage items"),
    ("manage_skills", "Manage skills"),
    ("manage_spells", "Manage spells"),
    ("manage_specials", "Manage specials"),
    ("manage_rules", "Manage rules"),
    ("manage_warbands", "Manage warbands"),
    ("manage_encampments", "Manage encampments"),
    ("manage_locations", "Manage locations"),
    ("manage_bestiary", "Manage bestiary"),
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
        ("campaigns", "0013_sanitize_location_content"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
