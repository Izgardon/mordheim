from django.db import migrations, models


def backfill_campaign_item_settings(apps, schema_editor):
    CampaignSettings = apps.get_model("campaigns", "CampaignSettings")
    Restriction = apps.get_model("restrictions", "Restriction")
    WarbandRestriction = apps.get_model("warbands", "Warband").restrictions.through

    for settings in CampaignSettings.objects.all():
        setting_ids = list(
            Restriction.objects.filter(
                type="Setting",
                campaign__isnull=True,
                warbands__campaign_id=settings.campaign_id,
            )
            .values_list("id", flat=True)
            .distinct()
        )
        if setting_ids:
            settings.item_settings.set(setting_ids)

    WarbandRestriction.objects.filter(restriction__type="Setting").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0008_campaignhouserule_effect_key"),
        ("restrictions", "0001_initial"),
        ("warbands", "0019_warband_show_loadout_on_mobile"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaignsettings",
            name="item_settings",
            field=models.ManyToManyField(blank=True, related_name="campaign_settings", to="restrictions.restriction"),
        ),
        migrations.RunPython(backfill_campaign_item_settings, migrations.RunPython.noop),
    ]
