from django.db import migrations, models


def normalize_caster_forward(apps, schema_editor):
    Hero = apps.get_model("warbands", "Hero")
    HiredSword = apps.get_model("warbands", "HiredSword")

    def normalize(value):
        if value is None:
            return "No"
        if isinstance(value, str) and not value.strip():
            return "No"
        return value

    for model in (Hero, HiredSword):
        for entry in model.objects.all():
            next_value = normalize(entry.caster)
            if entry.caster != next_value:
                entry.caster = next_value
                entry.save(update_fields=["caster"])


def normalize_caster_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="hero",
            name="caster",
            field=models.CharField(
                choices=[("No", "No"), ("Wizard", "Wizard"), ("Priest", "Priest")],
                default="No",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="hiredsword",
            name="caster",
            field=models.CharField(
                choices=[("No", "No"), ("Wizard", "Wizard"), ("Priest", "Priest")],
                default="No",
                max_length=20,
            ),
        ),
        migrations.RunPython(normalize_caster_forward, normalize_caster_reverse),
    ]
