from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0010_remove_unique_hero_skill_spell"),
    ]

    operations = [
        migrations.AlterField(
            model_name="hero",
            name="xp",
            field=models.DecimalField(default=0, max_digits=6, decimal_places=1),
        ),
    ]
