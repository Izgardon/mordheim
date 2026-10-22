# A hired sword is no longer a bestiary entry with a profile (bestiary rewrite step 2): hired swords and dramatis
# personae are their own catalogue (apps/hirelings). The profile tables go; data is disposable, so the 72 bestiary
# entries typed "Hired Sword" stay in an existing database until it is wiped (seed_bestiary no longer writes them).

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("bestiary", "0012_versions_and_archive"),
    ]

    operations = [
        migrations.DeleteModel(name="HiredSwordProfileRestriction"),
        migrations.DeleteModel(name="HiredSwordProfile"),
    ]
