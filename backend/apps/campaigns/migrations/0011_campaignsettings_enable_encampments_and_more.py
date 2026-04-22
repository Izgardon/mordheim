from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0010_campaignbulletinentry"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaignsettings",
            name="enable_encampments",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="campaignsettings",
            name="enable_locations",
            field=models.BooleanField(default=False),
        ),
    ]
