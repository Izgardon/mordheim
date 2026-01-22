from django.db import migrations


def forwards(apps, schema_editor):
    CampaignPermission = apps.get_model("campaigns", "CampaignPermission")
    CampaignRolePermission = apps.get_model("campaigns", "CampaignRolePermission")

    old_codes = ["manage_campaign", "manage_members"]
    CampaignRolePermission.objects.filter(permission__code__in=old_codes).delete()
    CampaignPermission.objects.filter(code__in=old_codes).delete()

    new_permissions = [
        ("manage_skills", "Manage skills"),
        ("manage_items", "Manage items"),
        ("manage_rules", "Manage rules"),
        ("manage_warbands", "Manage warbands"),
    ]
    for code, name in new_permissions:
        CampaignPermission.objects.get_or_create(code=code, defaults={"name": name})


def backwards(apps, schema_editor):
    CampaignPermission = apps.get_model("campaigns", "CampaignPermission")
    CampaignRolePermission = apps.get_model("campaigns", "CampaignRolePermission")

    new_codes = ["manage_skills", "manage_items", "manage_rules", "manage_warbands"]
    CampaignRolePermission.objects.filter(permission__code__in=new_codes).delete()
    CampaignPermission.objects.filter(code__in=new_codes).delete()

    old_permissions = [
        ("manage_campaign", "Manage campaign"),
        ("manage_members", "Manage members"),
    ]
    for code, name in old_permissions:
        CampaignPermission.objects.get_or_create(code=code, defaults={"name": name})


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0006_house_rules"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
