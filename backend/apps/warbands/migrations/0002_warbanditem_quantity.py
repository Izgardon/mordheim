from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="warbanditem",
            name="quantity",
            field=models.PositiveIntegerField(default=1),
        ),
    ]
