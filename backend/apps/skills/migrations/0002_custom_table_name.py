from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("skills", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="skill",
            name="custom",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterModelTable(name="skill", table="skill"),
    ]
