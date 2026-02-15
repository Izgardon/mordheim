from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("warbands", "0007_hired_sword_available_skills_upkeep"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="henchmengroupskill",
            name="unique_henchmen_group_skill",
        ),
        migrations.RemoveConstraint(
            model_name="hiredswordskill",
            name="unique_hired_sword_skill",
        ),
        migrations.RemoveConstraint(
            model_name="hiredswordspell",
            name="unique_hired_sword_spell",
        ),
    ]
