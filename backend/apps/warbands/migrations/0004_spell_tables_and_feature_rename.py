from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0002_remove_henchmengroup_kills_hiredsword_kills"),
    ]

    operations = [
        migrations.RenameField(
            model_name="herofeature",
            old_name="title",
            new_name="name",
        ),
        migrations.RenameField(
            model_name="henchmengroupfeature",
            old_name="title",
            new_name="name",
        ),
        migrations.RenameField(
            model_name="hiredswordfeature",
            old_name="title",
            new_name="name",
        ),
        migrations.CreateModel(
            name="HeroSpell",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("description", models.CharField(max_length=500)),
                ("dc", models.CharField(max_length=40)),
                ("hero", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="spells", to="warbands.hero")),
            ],
            options={
                "db_table": "hero_spell",
            },
        ),
        migrations.CreateModel(
            name="HiredSwordSpell",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("description", models.CharField(max_length=500)),
                ("dc", models.CharField(max_length=40)),
                ("hired_sword", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="spells", to="warbands.hiredsword")),
            ],
            options={
                "db_table": "hired_sword_spell",
            },
        ),
    ]

