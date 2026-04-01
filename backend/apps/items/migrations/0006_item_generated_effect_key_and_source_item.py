from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0005_item_bestiary_entry"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="generated_effect_key",
            field=models.CharField(blank=True, db_index=True, max_length=80, null=True),
        ),
        migrations.AddField(
            model_name="item",
            name="source_item",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="generated_clones",
                to="items.item",
            ),
        ),
    ]
