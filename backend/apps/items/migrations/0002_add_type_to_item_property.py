# Generated manually on 2026-01-27

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('items', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='itemproperty',
            name='type',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
    ]
