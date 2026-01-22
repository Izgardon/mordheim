from django.db import migrations, models
import django.db.models.deletion

ROLE_SEED = [
    ("owner", "Owner"),
    ("admin", "Admin"),
    ("player", "Player"),
]

PERMISSION_SEED = [
    ("manage_campaign", "Manage campaign"),
    ("manage_members", "Manage members"),
]

DEFAULT_ADMIN_PERMISSIONS = {"manage_members"}


def seed_roles_permissions(apps, schema_editor):
    CampaignRole = apps.get_model("campaigns", "CampaignRole")
    CampaignPermission = apps.get_model("campaigns", "CampaignPermission")
    CampaignRolePermission = apps.get_model("campaigns", "CampaignRolePermission")
    CampaignMembership = apps.get_model("campaigns", "CampaignMembership")
    Campaign = apps.get_model("campaigns", "Campaign")

    role_map = {}
    for slug, name in ROLE_SEED:
        role, _ = CampaignRole.objects.get_or_create(slug=slug, defaults={"name": name})
        role_map[slug] = role

    perm_map = {}
    for code, name in PERMISSION_SEED:
        permission, _ = CampaignPermission.objects.get_or_create(
            code=code, defaults={"name": name}
        )
        perm_map[code] = permission

    for membership in CampaignMembership.objects.all():
        role = role_map.get(membership.role, role_map["player"])
        membership.role_ref_id = role.id
        membership.save(update_fields=["role_ref"])

    for campaign in Campaign.objects.all():
        for permission in perm_map.values():
            CampaignRolePermission.objects.get_or_create(
                campaign=campaign, role=role_map["owner"], permission=permission
            )
        for code in DEFAULT_ADMIN_PERMISSIONS:
            permission = perm_map.get(code)
            if permission:
                CampaignRolePermission.objects.get_or_create(
                    campaign=campaign,
                    role=role_map["admin"],
                    permission=permission,
                )


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CampaignRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.CharField(max_length=20, unique=True)),
                ("name", models.CharField(max_length=40)),
            ],
        ),
        migrations.AddConstraint(
            model_name="campaignrole",
            constraint=models.CheckConstraint(
                check=models.Q(("slug__in", ["owner", "admin", "player"])),
                name="campaign_role_slug_valid",
            ),
        ),
        migrations.CreateModel(
            name="CampaignPermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=50, unique=True)),
                ("name", models.CharField(max_length=80)),
            ],
        ),
        migrations.CreateModel(
            name="CampaignRolePermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "campaign",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="role_permissions", to="campaigns.campaign"),
                ),
                (
                    "permission",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="role_permissions", to="campaigns.campaignpermission"),
                ),
                (
                    "role",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="role_permissions", to="campaigns.campaignrole"),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="campaignrolepermission",
            constraint=models.UniqueConstraint(fields=("campaign", "role", "permission"), name="unique_campaign_role_permission"),
        ),
        migrations.AddField(
            model_name="campaignmembership",
            name="role_ref",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name="memberships", to="campaigns.campaignrole"),
        ),
        migrations.RunPython(seed_roles_permissions, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="campaignmembership",
            name="role",
        ),
        migrations.RenameField(
            model_name="campaignmembership",
            old_name="role_ref",
            new_name="role",
        ),
        migrations.AlterField(
            model_name="campaignmembership",
            name="role",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="memberships", to="campaigns.campaignrole"),
        ),
    ]
