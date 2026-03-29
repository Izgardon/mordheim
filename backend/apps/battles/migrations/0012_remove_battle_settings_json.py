from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0011_battle_scenario_link"),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE "battle" DROP COLUMN IF EXISTS "settings_json"',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
