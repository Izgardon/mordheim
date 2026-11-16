from django.db import migrations, models


class Migration(migrations.Migration):
    """Blood pacts (William, 16 Nov 2026: Mutiny in Marienburg's rule is generic): a campaign setting, off at first."""

    dependencies = [
        ("campaigns", "0016_campaignsettings_exploration_chart"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaignsettings",
            name="enable_blood_pacts",
            field=models.BooleanField(default=False),
        ),
    ]
