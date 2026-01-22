from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0004_hero_items"),
        ("skills", "0002_custom_table_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="HeroSkill",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "hero",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hero_skills", to="warbands.hero"),
                ),
                (
                    "skill",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hero_skills", to="skills.skill"),
                ),
            ],
            options={
                "db_table": "warband_hero_skill",
            },
        ),
        migrations.AddField(
            model_name="hero",
            name="skills",
            field=models.ManyToManyField(blank=True, related_name="heroes", through="warbands.HeroSkill", to="skills.skill"),
        ),
        migrations.AddConstraint(
            model_name="heroskill",
            constraint=models.UniqueConstraint(fields=("hero", "skill"), name="unique_hero_skill"),
        ),
    ]
