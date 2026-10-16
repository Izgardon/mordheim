from django.db import migrations


def sanitize_existing_location_content(apps, schema_editor):
    """Location content is rendered as HTML for every member; clean rows saved before sanitising existed."""
    from apps.core.html import sanitize_rich_text

    CampaignLocation = apps.get_model("campaigns", "CampaignLocation")
    for location in CampaignLocation.objects.exclude(content="").only("id", "content"):
        cleaned = sanitize_rich_text(location.content)
        if cleaned != location.content:
            CampaignLocation.objects.filter(id=location.id).update(content=cleaned)


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0012_campaignencampment_campaignlocation"),
    ]

    operations = [
        migrations.RunPython(sanitize_existing_location_content, migrations.RunPython.noop),
    ]
