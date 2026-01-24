from django.db import migrations


def forwards(apps, schema_editor):
    CampaignPermission = apps.get_model("campaigns", "CampaignPermission")
    CampaignPermission.objects.get_or_create(
        code="manage_races", defaults={"name": "Manage races"}
    )


def backwards(apps, schema_editor):
    CampaignPermission = apps.get_model("campaigns", "CampaignPermission")
    CampaignMembershipPermission = apps.get_model(
        "campaigns", "CampaignMembershipPermission"
    )
    CampaignMembershipPermission.objects.filter(
        permission__code="manage_races"
    ).delete()
    CampaignPermission.objects.filter(code="manage_races").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0008_membership_permissions"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
