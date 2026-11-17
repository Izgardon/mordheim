import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """A warband's plot and its campaign point total (apps/plots), and the two keys that mark a rule the server
    writes from them (services/plot_rules.py): the plot it came from, and the rung it mirrors."""

    dependencies = [
        ("plots", "0001_initial"),
        ("warbands", "0020_drop_campaign_points_resource"),
    ]

    operations = [
        migrations.AddField(
            model_name="warband",
            name="campaign_points",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="warband",
            name="plot",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="warbands",
                to="plots.plot",
            ),
        ),
        migrations.AddField(
            model_name="warbandrule",
            name="from_plot",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="warband_rules",
                to="plots.plot",
            ),
        ),
        migrations.AddField(
            model_name="warbandrule",
            name="plot_achievement",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="warband_rules",
                to="plots.plotachievement",
            ),
        ),
    ]
