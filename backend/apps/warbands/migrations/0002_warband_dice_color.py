import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="warband",
            name="dice_color",
            field=models.CharField(
                default="#2e8555",
                max_length=9,
                validators=[
                    django.core.validators.RegexValidator(
                        regex="^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
                        message="Dice color must be a valid hex color (e.g. #2e8555).",
                    )
                ],
            ),
        ),
    ]
