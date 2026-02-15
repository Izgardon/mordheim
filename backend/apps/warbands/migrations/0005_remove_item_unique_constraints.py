from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0004_henchmen_group_max_size"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="henchmengroupitem",
            name="unique_henchmen_group_item",
        ),
        migrations.RemoveConstraint(
            model_name="hiredsworditem",
            name="unique_hired_sword_item",
        ),
    ]
