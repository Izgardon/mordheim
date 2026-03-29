from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0017_rename_warband_pdf_to_warband_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="hiredsworditem",
            name="cost",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
