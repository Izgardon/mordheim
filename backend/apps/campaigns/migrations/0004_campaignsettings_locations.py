from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0003_campaignmessage"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaignsettings",
            name="locations",
            field=models.BooleanField(default=False),
        ),
    ]
