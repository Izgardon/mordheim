from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0010_remove_battle_title"),
    ]

    operations = [
        migrations.AddField(
            model_name="battle",
            name="scenario_link",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]
