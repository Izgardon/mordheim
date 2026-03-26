from django.db import migrations, models


def assign_initial_leaders(apps, schema_editor):
    Hero = apps.get_model("warbands", "Hero")

    warband_ids = list(Hero.objects.values_list("warband_id", flat=True).distinct())
    for warband_id in warband_ids:
        living_heroes = Hero.objects.filter(warband_id=warband_id, dead=False).order_by("id")
        leader = living_heroes.first()
        if leader is None:
            continue
        Hero.objects.filter(warband_id=warband_id, is_leader=True).exclude(id=leader.id).update(is_leader=False)
        Hero.objects.filter(id=leader.id).update(is_leader=True)


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0015_warband_pdf"),
    ]

    operations = [
        migrations.AddField(
            model_name="hero",
            name="is_leader",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(assign_initial_leaders, migrations.RunPython.noop),
    ]
