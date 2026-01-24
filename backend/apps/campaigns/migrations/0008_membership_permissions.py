from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0007_permissions_update"),
    ]

    operations = [
        migrations.CreateModel(
            name="CampaignMembershipPermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "membership",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="permissions", to="campaigns.campaignmembership"),
                ),
                (
                    "permission",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="membership_permissions", to="campaigns.campaignpermission"),
                ),
            ],
            options={
                "db_table": "campaign_membership_permission",
            },
        ),
        migrations.AddConstraint(
            model_name="campaignmembershippermission",
            constraint=models.UniqueConstraint(
                fields=("membership", "permission"),
                name="unique_campaign_membership_permission",
            ),
        ),
        migrations.DeleteModel(
            name="CampaignRolePermission",
        ),
    ]
