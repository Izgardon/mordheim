from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0003_heroes"),
        ("items", "0002_custom_table_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="HeroItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "hero",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hero_items", to="warbands.hero"),
                ),
                (
                    "item",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hero_items", to="items.item"),
                ),
            ],
            options={
                "db_table": "warband_hero_item",
            },
        ),
        migrations.AddField(
            model_name="hero",
            name="items",
            field=models.ManyToManyField(blank=True, related_name="heroes", through="warbands.HeroItem", to="items.item"),
        ),
        migrations.AddConstraint(
            model_name="heroitem",
            constraint=models.UniqueConstraint(fields=("hero", "item"), name="unique_hero_item"),
        ),
    ]
