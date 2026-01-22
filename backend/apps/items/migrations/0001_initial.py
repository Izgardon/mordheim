from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Item",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=140)),
                ("type", models.CharField(db_index=True, max_length=80)),
                ("cost", models.CharField(max_length=50)),
                ("availability", models.CharField(max_length=40)),
                ("unique_to", models.CharField(blank=True, max_length=200)),
            ],
            options={
                "ordering": ["type", "name"],
            },
        ),
    ]
