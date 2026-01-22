from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0003_warbands"),
    ]

    operations = [
        migrations.AlterModelTable(name="campaign", table="campaign"),
        migrations.AlterModelTable(name="campaignrole", table="campaign_role"),
        migrations.AlterModelTable(name="campaignpermission", table="campaign_permission"),
        migrations.AlterModelTable(
            name="campaignrolepermission", table="campaign_role_permission"
        ),
        migrations.AlterModelTable(
            name="campaignmembership", table="campaign_membership"
        ),
    ]
