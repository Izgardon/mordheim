from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bestiary", "0006_bestiary_armour_save_integer"),
    ]

    operations = [
        migrations.AddField(
            model_name="hiredswordprofile",
            name="rating",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
