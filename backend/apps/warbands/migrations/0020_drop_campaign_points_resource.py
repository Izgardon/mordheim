from django.db import migrations


class Migration(migrations.Migration):
    """Campaign points stop being a counter: they are a number on the warband the player types (apps/plots), so the
    `WarbandResource.is_campaign_points` column and its one-per-warband constraint go. Nothing is moved: data is
    disposable during the review, and every migration still runs on an empty database."""

    dependencies = [("warbands", "0019_henchmen_group_item_ordering")]

    operations = [
        migrations.RemoveConstraint(model_name="warbandresource", name="one_campaign_points_per_warband"),
        migrations.AlterModelOptions(name="warbandresource", options={"ordering": ("-is_default", "id")}),
        migrations.RemoveField(model_name="warbandresource", name="is_campaign_points"),
    ]
