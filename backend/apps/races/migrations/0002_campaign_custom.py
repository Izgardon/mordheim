from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0008_membership_permissions"),
        ("races", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="race",
            name="campaign",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="races",
                to="campaigns.campaign",
            ),
        ),
        migrations.AlterField(
            model_name="race",
            name="name",
            field=models.CharField(max_length=160),
        ),
        migrations.AddConstraint(
            model_name="race",
            constraint=models.UniqueConstraint(
                fields=("campaign", "name"), name="unique_campaign_race"
            ),
        ),
        migrations.AddConstraint(
            model_name="race",
            constraint=models.UniqueConstraint(
                fields=("name",),
                condition=Q(campaign__isnull=True),
                name="unique_global_race_name",
            ),
        ),
    ]
