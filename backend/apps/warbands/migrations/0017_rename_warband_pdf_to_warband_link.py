from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0016_hero_is_leader"),
    ]

    operations = [
        migrations.RenameField(
            model_name="warband",
            old_name="warband_pdf",
            new_name="warband_link",
        ),
    ]
