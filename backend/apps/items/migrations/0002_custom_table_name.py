from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="custom",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterModelTable(name="item", table="item"),
    ]
