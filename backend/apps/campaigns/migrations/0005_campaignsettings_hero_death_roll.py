from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0004_campaignsettings_locations"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaignsettings",
            name="hero_death_roll",
            field=models.CharField(
                choices=[("d66", "D66"), ("d100", "D100")],
                default="d66",
                max_length=10,
            ),
        ),
    ]
