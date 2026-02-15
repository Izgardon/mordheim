from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('spells', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='spell',
            name='roll',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
