"""One catalogue permission, edit_catalogue, and deleting apart from it, delete_catalogue (pass 5 decisions 4 and 5).

They replace add_custom, manage_items, manage_skills, manage_spells, manage_specials and manage_bestiary. The
add_custom row is renamed rather than replaced, so a member who held it (every player holds it from joining) keeps
adding entries; the per-kind rows go with their grants. Frozen values, as in 0014; it runs on an empty database
(after 0014's seed) and on one that holds the old codes. Reversing leaves the rows.
"""

from django.db import migrations

RETIRED = ("add_custom", "manage_items", "manage_skills", "manage_spells", "manage_specials", "manage_bestiary")
ADDED = (("edit_catalogue", "Edit catalogue"), ("delete_catalogue", "Delete catalogue"))


def forwards(apps, schema_editor):
    CampaignPermission = apps.get_model("campaigns", "CampaignPermission")
    if not CampaignPermission.objects.filter(code="edit_catalogue").exists():
        CampaignPermission.objects.filter(code="add_custom").update(code="edit_catalogue", name="Edit catalogue")
    for code, name in ADDED:
        CampaignPermission.objects.update_or_create(code=code, defaults={"name": name})
    CampaignPermission.objects.filter(code__in=RETIRED).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0022_campaign_types"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
