from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bestiary", "0007_hiredswordprofile_rating"),
    ]

    operations = [
        migrations.AddField(
            model_name="hiredswordprofile",
            name="race",
            field=models.CharField(blank=True, default="", max_length=60),
        ),
    ]
