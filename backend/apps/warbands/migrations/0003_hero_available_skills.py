from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0002_caster_string"),
    ]

    operations = [
        migrations.AddField(
            model_name="hero",
            name="available_skills",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
