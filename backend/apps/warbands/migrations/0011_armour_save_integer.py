from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0010_warband_restrictions"),
    ]

    operations = [
        migrations.AlterField(
            model_name="hero",
            name="armour_save",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="henchmengroup",
            name="armour_save",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="hiredsword",
            name="armour_save",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
