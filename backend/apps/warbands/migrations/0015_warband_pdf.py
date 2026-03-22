from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0014_hired_sword_cost_expressions"),
    ]

    operations = [
        migrations.AddField(
            model_name="warband",
            name="warband_pdf",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]
