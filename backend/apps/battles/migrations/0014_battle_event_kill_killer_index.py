"""Index unit-kill events by killer so a unit's kill history doesn't scan every battle event (PERF-29).

The expressions are exactly the ones Django writes for `payload_json__killer__unit_type` and
`payload_json__killer__unit_id` lookups, so the planner can match them; the partial condition keeps the
index to kill events only.
"""

from django.db import migrations

INDEX_NAME = "battle_event_kill_killer_idx"


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0013_battleparticipant_battle_notes"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                f"CREATE INDEX {INDEX_NAME} ON battle_event "
                "((payload_json #> '{killer,unit_type}'), (payload_json #> '{killer,unit_id}')) "
                "WHERE type = 'unit_kill_recorded'"
            ),
            reverse_sql=f"DROP INDEX {INDEX_NAME}",
        ),
    ]
