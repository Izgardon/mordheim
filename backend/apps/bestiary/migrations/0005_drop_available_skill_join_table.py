from django.db import migrations, models


ABBREV_TO_TYPE = {
    "C": "Combat",
    "Sh": "Shooting",
    "A": "Academic",
    "St": "Strength",
    "Sp": "Speed",
}


def convert_skill_types_to_list(apps, schema_editor):
    HiredSwordProfile = apps.get_model("bestiary", "HiredSwordProfile")
    HiredSwordProfileAvailableSkill = apps.get_model(
        "bestiary", "HiredSwordProfileAvailableSkill"
    )

    for profile in HiredSwordProfile.objects.all():
        raw = profile.available_skill_types or {}
        types = []

        if isinstance(raw, dict):
            for key, enabled in raw.items():
                if not enabled:
                    continue
                full_name = ABBREV_TO_TYPE.get(key, key)
                if full_name not in types:
                    types.append(full_name)
        elif isinstance(raw, list):
            types = list(raw)

        # Harvest unique skill types from the join table
        special_types = (
            HiredSwordProfileAvailableSkill.objects.filter(
                hired_sword_profile=profile
            )
            .values_list("skill__type", flat=True)
            .distinct()
        )
        for skill_type in special_types:
            if skill_type and skill_type not in types:
                types.append(skill_type)

        profile.available_skill_types = types
        profile.save(update_fields=["available_skill_types"])


class Migration(migrations.Migration):

    dependencies = [
        ("bestiary", "0004_hiredswordprofile_grade"),
    ]

    operations = [
        # 1. Convert existing data before dropping the join table
        migrations.RunPython(
            convert_skill_types_to_list,
            migrations.RunPython.noop,
        ),
        # 2. Remove the M2M relation (no DB table, just the descriptor)
        migrations.RemoveField(
            model_name="hiredswordprofile",
            name="available_special_skills",
        ),
        # 3. Drop the join table
        migrations.DeleteModel(
            name="HiredSwordProfileAvailableSkill",
        ),
        # 4. Update the JSONField default from dict to list
        migrations.AlterField(
            model_name="hiredswordprofile",
            name="available_skill_types",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
